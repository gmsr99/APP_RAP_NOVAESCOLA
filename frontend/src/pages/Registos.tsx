import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { fillPdf, downloadPdf, type RegistoFormData } from '@/lib/pdfFiller';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import * as XLSX from 'xlsx';
import {
  ClipboardList,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  FileText,
  Download,
  Trash2,
  Plus,
  X,
  Music2,
  User as UserIcon,
  FileSpreadsheet,
  Pencil,
} from 'lucide-react';
import { format, parseISO, addMinutes } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SessaoRegistavel {
  id: number;
  tipo: string;
  data_hora: string;
  duracao_minutos: number;
  estado: string;
  local: string | null;
  tema: string | null;
  observacoes: string | null;
  is_autonomous: boolean;
  is_realized: boolean;
  tipo_atividade: string | null;
  responsavel_user_id: string | null;
  musica_id: number | null;
  turma_nome: string | null;
  turma_id: number | null;
  estabelecimento_nome: string | null;
  estabelecimento_sigla: string | null;
  mentor_nome: string | null;
  mentor_user_id: string | null;
  mentor_latitude: number | null;
  mentor_longitude: number | null;
  estab_latitude: number | null;
  estab_longitude: number | null;
  atividade_uuid: string | null;
  disciplina_nome: string | null;
  objetivos: string | null;
  sumario: string | null;
  codigo_sessao: string | null;
}

interface Registo {
  id: number;
  aula_id: number;
  user_id: string;
  numero_sessao: string | null;
  objetivos_gerais: string | null;
  sumario: string | null;
  participantes: { nome_completo: string }[] | null;
  criado_em: string;
  data_hora: string;
  duracao_minutos: number;
  tipo: string;
  is_autonomous: boolean;
  tipo_atividade: string | null;
  local: string | null;
  aula_observacoes: string | null;
  atividade: string | null;
  data_registo: string | null;
  local_registo: string | null;
  horario: string | null;
  tecnicos: string | null;
  turma_nome: string | null;
  estabelecimento_nome: string | null;
  estabelecimento_sigla: string | null;
  mentor_nome: string | null;
  kms_percorridos: number | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Formats time as "XXhXXm" e.g. "14h30m" */
function fmtHM(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}h${String(date.getMinutes()).padStart(2, '0')}m`;
}

/** "Das 14h30m às 16h00m" */
function buildHorario(dataHora: string, duracao: number): string {
  const start = parseISO(dataHora);
  const end = addMinutes(start, duracao);
  return `Das ${fmtHM(start)} às ${fmtHM(end)}`;
}

function sessionLabel(s: SessaoRegistavel): string {
  const date = format(parseISO(s.data_hora), "d MMM yyyy", { locale: pt });
  const time = format(parseISO(s.data_hora), "HH:mm");
  const tag = s.is_autonomous ? (s.tipo_atividade || 'Trabalho Autónomo') : (s.turma_nome || 'Aula');
  return `${date} ${time} — ${tag}`;
}

// ─── Reusable sub-components ─────────────────────────────────────────────────

/** Single registo row used in both tabs */
function RegistoRow({ reg, onReExport, onEdit, onDelete, showMentor }: {
  reg: Registo;
  onReExport: (reg: Registo) => void;
  onEdit?: (reg: Registo) => void;
  onDelete?: (id: number) => void;
  showMentor: boolean;
}) {
  return (
    <div className="flex items-start sm:items-center justify-between gap-3 p-4 rounded-lg bg-secondary/30">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-green-500/20 text-green-600 shrink-0 mt-0.5 sm:mt-0">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm leading-snug">
            {reg.is_autonomous
              ? (reg.tipo_atividade || 'Trabalho Autónomo')
              : `${reg.turma_nome || 'Aula'} — ${reg.estabelecimento_nome || ''}`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(parseISO(reg.data_hora), "d 'de' MMMM yyyy", { locale: pt })}
            {' · '}
            {buildHorario(reg.data_hora, reg.duracao_minutos)}
          </p>
          {showMentor && reg.mentor_nome && (
            <p className="text-xs text-muted-foreground mt-0.5">
              <UserIcon className="inline h-3 w-3 mr-1" />
              {reg.tecnicos || reg.mentor_nome}
            </p>
          )}
          {reg.numero_sessao && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Nº Sessão: {reg.numero_sessao}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(reg)}
            title="Editar registo"
            className="h-8 px-2 sm:px-3"
          >
            <Pencil className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Editar</span>
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onReExport(reg)}
          title="Descarregar PDF preenchido"
          className="h-8 px-2 sm:px-3"
        >
          <Download className="h-4 w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">PDF</span>
        </Button>
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(reg.id)}
            title="Apagar registo"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/** List of registos (used in "Os meus Registos" tab) */
function RegistoList({ registos, onReExport, onEdit, onDelete, showMentor }: {
  registos: Registo[];
  onReExport: (reg: Registo) => void;
  onEdit?: (reg: Registo) => void;
  onDelete?: (id: number) => void;
  showMentor: boolean;
}) {
  if (registos.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-muted-foreground text-center">Ainda não existem registos.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Registos realizados</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {registos.map(reg => (
          <RegistoRow key={reg.id} reg={reg} onReExport={onReExport} onEdit={onEdit} onDelete={onDelete} showMentor={showMentor} />
        ))}
      </CardContent>
    </Card>
  );
}

/** All registos grouped by month in an accordion (used in "Todos os Registos" tab) */
function TodosRegistosAccordion({ registos, onReExport, onEdit }: {
  registos: Registo[];
  onReExport: (reg: Registo) => void;
  onEdit?: (reg: Registo) => void;
}) {
  if (registos.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-muted-foreground text-center">Ainda não existem registos.</p>
        </CardContent>
      </Card>
    );
  }

  // Group by month (e.g. "Fevereiro 2026")
  const grouped: Record<string, Registo[]> = {};
  for (const reg of registos) {
    const key = format(parseISO(reg.data_hora), "MMMM yyyy", { locale: pt });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(reg);
  }

  // Sort months descending (most recent first) — already sorted by backend, just preserve order
  const months = Object.keys(grouped);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Todos os Registos
          <Badge variant="secondary" className="ml-2">{registos.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" defaultValue={months.slice(0, 1)}>
          {months.map(month => (
            <AccordionItem key={month} value={month}>
              <AccordionTrigger className="text-base capitalize">
                {month}
                <Badge variant="outline" className="ml-auto mr-2">{grouped[month].length}</Badge>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                {grouped[month].map(reg => (
                  <RegistoRow key={reg.id} reg={reg} onReExport={onReExport} onEdit={onEdit} showMentor />
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

const Registos = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('meus');

  // Form state for the modal
  const [formData, setFormData] = useState({
    atividade: '',
    numero_sessao: '',
    data: '',
    local: '',
    horario: '',
    tecnicos: '',
    objetivos_gerais: '',
    sumario: '',
    participantes: [] as { nome_completo: string }[],
    kms_percorridos: '',
  });

  const [selectedSession, setSelectedSession] = useState<SessaoRegistavel | null>(null);
  const [editingRegisto, setEditingRegisto] = useState<Registo | null>(null);

  // ─── Queries ────────────────────────────────────────────────────────────

  const { data: sessoes = [], isLoading: sessoesLoading, isError: sessoesError } = useQuery({
    queryKey: ['sessoes-registaveis'],
    queryFn: async () => {
      const res = await api.get('/api/aulas/registaveis');
      return res.data as SessaoRegistavel[];
    },
  });

  const { data: registos = [], isLoading: registosLoading, isError: registosError } = useQuery({
    queryKey: ['registos'],
    queryFn: async () => {
      const res = await api.get('/api/registos');
      return res.data as Registo[];
    },
  });

  const isCoord = profile === 'coordenador' || profile === 'direcao' || profile === 'it_support';

  const { data: todosRegistos = [] } = useQuery({
    queryKey: ['registos-todos'],
    queryFn: async () => {
      const res = await api.get('/api/registos/todos');
      return res.data as Registo[];
    },
    enabled: isCoord,
  });

  const { data: todasSessoesRegistaveis = [] } = useQuery({
    queryKey: ['sessoes-registaveis-todas'],
    queryFn: async () => {
      const res = await api.get('/api/aulas/registaveis/todas');
      return res.data as SessaoRegistavel[];
    },
    enabled: isCoord,
  });

  // ─── Export XLS (Direção) ───────────────────────────────────────────────

  const isDirecao = profile === 'direcao';
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportDataInicio, setExportDataInicio] = useState('');
  const [exportDataFim, setExportDataFim] = useState('');
  const [exportAllUsers, setExportAllUsers] = useState(true);
  const [exportSelectedUsers, setExportSelectedUsers] = useState<string[]>([]);
  const [exportAllEstabs, setExportAllEstabs] = useState(true);
  const [exportSelectedEstabs, setExportSelectedEstabs] = useState<number[]>([]);
  const [exportLoading, setExportLoading] = useState(false);

  const { data: equipaList = [] } = useQuery<{ id: string; full_name: string }[]>({
    queryKey: ['equipa-export'],
    queryFn: async () => {
      const res = await api.get('/api/equipa');
      return (res.data as any[]).map((p: any) => ({ id: p.id, full_name: p.full_name }));
    },
    enabled: isDirecao && exportModalOpen,
  });

  const { data: estabList = [] } = useQuery<{ id: number; nome: string }[]>({
    queryKey: ['estabelecimentos-export'],
    queryFn: async () => {
      const res = await api.get('/api/estabelecimentos');
      return (res.data as any[]).map((e: any) => ({ id: e.id, nome: e.nome }));
    },
    enabled: isDirecao && exportModalOpen,
  });

  const handleExportXls = async () => {
    if (!exportDataInicio || !exportDataFim) {
      toast({ title: 'Erro', description: 'Preenche as datas de início e fim.', variant: 'destructive' });
      return;
    }
    setExportLoading(true);
    try {
      const params = new URLSearchParams({
        data_inicio: exportDataInicio,
        data_fim: exportDataFim,
      });
      if (!exportAllUsers && exportSelectedUsers.length > 0) {
        params.set('user_ids', exportSelectedUsers.join(','));
      }
      if (!exportAllEstabs && exportSelectedEstabs.length > 0) {
        params.set('estabelecimento_ids', exportSelectedEstabs.join(','));
      }
      const res = await api.get(`/api/registos/export?${params.toString()}`);
      const data = res.data as any[];

      if (data.length === 0) {
        toast({ title: 'Sem resultados', description: 'Nenhum registo encontrado com os filtros selecionados.' });
        setExportLoading(false);
        return;
      }

      const rows = data.map((r: any) => ({
        'DATA': r.data || '',
        'PESSOA': r.pessoa || '',
        'INÍCIO': r.inicio || '',
        'FIM': r.fim || '',
        'HORAS': r.horas || '',
        'KMS': r.kms ?? '',
        'O QUÊ': r.o_que || '',
        'ONDE?': r.onde || '',
        'TURMA?': r.turma || '',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Registos');
      XLSX.writeFile(wb, `registos_${exportDataInicio}_${exportDataFim}.xlsx`);

      toast({ title: 'Exportado', description: `${data.length} registos exportados com sucesso.` });
      setExportModalOpen(false);
    } catch (err) {
      toast({ title: 'Erro', description: 'Falha ao exportar registos.', variant: 'destructive' });
    } finally {
      setExportLoading(false);
    }
  };

  // ─── Mutations ──────────────────────────────────────────────────────────

  const createRegistoMutation = useMutation({
    mutationFn: (payload: any) => api.post('/api/registos', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registos'] });
      queryClient.invalidateQueries({ queryKey: ['registos-todos'] });
      queryClient.invalidateQueries({ queryKey: ['sessoes-registaveis'] });
      queryClient.invalidateQueries({ queryKey: ['sessoes-registaveis-todas'] });
      toast({ title: 'Registo guardado', description: 'O registo foi criado com sucesso.' });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Falha ao guardar registo.', variant: 'destructive' });
    },
  });

  const updateRegistoMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      api.patch(`/api/registos/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registos'] });
      queryClient.invalidateQueries({ queryKey: ['registos-todos'] });
      toast({ title: 'Registo atualizado', description: 'As alterações foram guardadas.' });
      setModalOpen(false);
      setEditingRegisto(null);
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Falha ao guardar alterações.', variant: 'destructive' });
    },
  });

  const deleteRegistoMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/registos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registos'] });
      queryClient.invalidateQueries({ queryKey: ['registos-todos'] });
      queryClient.invalidateQueries({ queryKey: ['sessoes-registaveis'] });
      queryClient.invalidateQueries({ queryKey: ['sessoes-registaveis-todas'] });
      toast({ title: 'Registo apagado', description: 'A sessão voltou a ficar disponível.' });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Falha ao apagar registo.', variant: 'destructive' });
    },
  });

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleSelectSession = async (value: string) => {
    setSelectedSessionId(value);
    const session = sessoes.find(s => String(s.id) === value)
      ?? todasSessoesRegistaveis.find(s => String(s.id) === value);
    if (!session) return;

    setSelectedSession(session);
    const start = parseISO(session.data_hora);

    // Auto-import alunos from turma (presencial sessions only)
    let participantes: { nome_completo: string }[] = [];
    if (!session.is_autonomous && session.turma_id) {
      try {
        const res = await api.get(`/api/turmas/${session.turma_id}/alunos`);
        participantes = res.data.map((a: any) => ({ nome_completo: a.nome }));
      } catch (e) {
        console.error('Erro ao importar alunos da turma:', e);
      }
    }

    // Calcular kms (ida e volta) se sessão presencial com coordenadas
    let kms = '';
    if (
      !session.is_autonomous &&
      session.mentor_latitude && session.mentor_longitude &&
      session.estab_latitude && session.estab_longitude
    ) {
      try {
        const res = await api.get(
          `/api/distance?lat1=${session.mentor_latitude}&lng1=${session.mentor_longitude}&lat2=${session.estab_latitude}&lng2=${session.estab_longitude}`
        );
        const data = res.data ?? res;
        if (data.distance_km != null) {
          kms = String(Math.round(data.distance_km * 2)); // ida e volta
        }
      } catch {
        // ignore distance errors
      }
    }

    setFormData({
      atividade: session.disciplina_nome || (session.is_autonomous
        ? 'Trabalho Autónomo'
        : `Sessão ${session.turma_nome || ''}`.trim()),
      numero_sessao: session.tema || '',
      data: format(start, 'dd/MM/yyyy'),
      local: session.is_autonomous
        ? (session.local || '')
        : `${session.estabelecimento_sigla || session.estabelecimento_nome || ''} ${session.local ? `- ${session.local}` : ''}`.trim(),
      horario: buildHorario(session.data_hora, session.duracao_minutos),
      tecnicos: session.mentor_nome || user?.name || '',
      objetivos_gerais: session.objetivos || '',
      sumario: session.sumario || '',
      participantes,
      kms_percorridos: kms,
    });
  };

  const openModal = () => {
    if (!selectedSession) {
      toast({ title: 'Seleciona uma sessão', description: 'Escolhe uma sessão no dropdown primeiro.', variant: 'destructive' });
      return;
    }
    setModalOpen(true);
  };

  const handleSaveRegisto = async () => {
    if (!selectedSession) return;

    createRegistoMutation.mutate({
      aula_id: selectedSession.id,
      numero_sessao: formData.numero_sessao || null,
      objetivos_gerais: formData.objetivos_gerais || null,
      sumario: formData.sumario || null,
      participantes: formData.participantes.filter(p => p.nome_completo.trim()),
      atividade: formData.atividade || null,
      data_registo: formData.data || null,
      local_registo: formData.local || null,
      horario: formData.horario || null,
      tecnicos: formData.tecnicos || null,
      kms_percorridos: formData.kms_percorridos ? Number(formData.kms_percorridos) : null,
    });

    setModalOpen(false);
    setSelectedSessionId('');
    setSelectedSession(null);
  };

  const handleExportPdf = async () => {
    if (!selectedSession) return;

    const pdfData: RegistoFormData = {
      atividade: formData.atividade,
      numero_sessao: formData.numero_sessao,
      data: formData.data,
      local: formData.local,
      horario: formData.horario,
      tecnicos: formData.tecnicos,
      objetivos_gerais: formData.objetivos_gerais,
      sumario: formData.sumario,
      participantes: formData.participantes.filter(p => p.nome_completo.trim()),
    };

    try {
      const bytes = await fillPdf(pdfData, selectedSession.is_autonomous);
      const safeName = formData.atividade.replace(/[^a-zA-Z0-9À-ú ]/g, '').trim();
      downloadPdf(bytes, `Registo_${safeName}_${formData.data.replace(/\//g, '-')}.pdf`);
      toast({ title: 'PDF exportado', description: 'O ficheiro foi descarregado.' });
    } catch (err) {
      console.error('PDF export error:', err);
      toast({ title: 'Erro ao gerar PDF', description: 'Verifica a consola para mais detalhes.', variant: 'destructive' });
    }
  };

  const handleSaveAndExport = async () => {
    await handleExportPdf();
    await handleSaveRegisto();
  };

  /** Re-export PDF from a previously saved registo */
  const handleReExportPdf = async (reg: Registo) => {
    const start = parseISO(reg.data_hora);
    const pdfData: RegistoFormData = {
      atividade: reg.atividade
        || (reg.is_autonomous ? (reg.tipo_atividade || 'Trabalho Autónomo') : `Sessão ${reg.turma_nome || ''}`.trim()),
      numero_sessao: reg.numero_sessao || '',
      data: reg.data_registo || format(start, 'dd/MM/yyyy'),
      local: reg.local_registo
        || (reg.is_autonomous ? (reg.local || '') : `${reg.estabelecimento_sigla || reg.estabelecimento_nome || ''} ${reg.local ? `- ${reg.local}` : ''}`.trim()),
      horario: reg.horario || buildHorario(reg.data_hora, reg.duracao_minutos),
      tecnicos: reg.tecnicos || reg.mentor_nome || user?.name || '',
      objetivos_gerais: reg.objetivos_gerais || '',
      sumario: reg.sumario || '',
      participantes: (reg.participantes || []).filter(p => p.nome_completo.trim()),
    };

    try {
      const bytes = await fillPdf(pdfData, reg.is_autonomous);
      const safeName = pdfData.atividade.replace(/[^a-zA-Z0-9À-ú ]/g, '').trim();
      downloadPdf(bytes, `Registo_${safeName}_${pdfData.data.replace(/\//g, '-')}.pdf`);
      toast({ title: 'PDF exportado', description: 'O ficheiro foi descarregado.' });
    } catch (err) {
      console.error('PDF re-export error:', err);
      toast({ title: 'Erro ao gerar PDF', description: 'Verifica a consola para mais detalhes.', variant: 'destructive' });
    }
  };

  const handleOpenEdit = (reg: Registo) => {
    setEditingRegisto(reg);
    setSelectedSession(null);
    setFormData({
      atividade: reg.atividade || (reg.is_autonomous ? (reg.tipo_atividade || 'Trabalho Autónomo') : `Sessão ${reg.turma_nome || ''}`.trim()),
      numero_sessao: reg.numero_sessao || '',
      data: reg.data_registo || format(parseISO(reg.data_hora), 'dd/MM/yyyy'),
      local: reg.local_registo || (reg.is_autonomous
        ? (reg.local || '')
        : `${reg.estabelecimento_sigla || reg.estabelecimento_nome || ''}${reg.local ? ` - ${reg.local}` : ''}`.trim()),
      horario: reg.horario || buildHorario(reg.data_hora, reg.duracao_minutos),
      tecnicos: reg.tecnicos || reg.mentor_nome || '',
      objetivos_gerais: reg.objetivos_gerais || '',
      sumario: reg.sumario || '',
      participantes: reg.participantes || [],
      kms_percorridos: reg.kms_percorridos != null ? String(reg.kms_percorridos) : '',
    });
    setModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingRegisto) return;
    updateRegistoMutation.mutate({
      id: editingRegisto.id,
      payload: {
        numero_sessao: formData.numero_sessao || null,
        objetivos_gerais: formData.objetivos_gerais || null,
        sumario: formData.sumario || null,
        participantes: formData.participantes.filter(p => p.nome_completo.trim()),
        atividade: formData.atividade || null,
        data_registo: formData.data || null,
        local_registo: formData.local || null,
        horario: formData.horario || null,
        tecnicos: formData.tecnicos || null,
        kms_percorridos: formData.kms_percorridos ? Number(formData.kms_percorridos) : null,
      },
    });
  };

  const addParticipant = () => {
    setFormData(prev => ({
      ...prev,
      participantes: [...prev.participantes, { nome_completo: '' }],
    }));
  };

  const updateParticipant = (index: number, value: string) => {
    setFormData(prev => {
      const updated = [...prev.participantes];
      updated[index] = { nome_completo: value };
      return { ...prev, participantes: updated };
    });
  };

  const removeParticipant = (index: number) => {
    setFormData(prev => ({
      ...prev,
      participantes: prev.participantes.filter((_, i) => i !== index),
    }));
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  if (sessoesLoading || registosLoading) return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-56 rounded-md bg-muted animate-pulse" />
        <div className="h-4 w-80 rounded-md bg-muted animate-pulse" />
      </div>
      <div className="rounded-lg border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border-b last:border-0">
            <div className="h-4 w-1/3 rounded bg-muted animate-pulse" />
            <div className="h-4 w-1/5 rounded bg-muted animate-pulse" />
            <div className="h-4 w-1/6 rounded bg-muted animate-pulse ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );

  if (sessoesError || registosError) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
      <X className="h-8 w-8 text-destructive" />
      <p className="font-medium">Erro ao carregar registos.</p>
      <p className="text-sm">Verifica a ligação e tenta novamente.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="hidden sm:block">
        <h1 className="text-2xl sm:text-3xl font-display font-bold">Registos de Sessão</h1>
        <p className="text-muted-foreground mt-1">
          Regista o que aconteceu em cada sessão e exporta o documento PDF.
        </p>
      </div>

      {/* ─── Tabs + Quick Register Card ─────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedSessionId(''); setSelectedSession(null); }}>
        {/* Tab switcher always at the top (only visible for coord) */}
        {isCoord && (
          <TabsList className="mb-4">
            <TabsTrigger value="meus">Os meus Registos</TabsTrigger>
            <TabsTrigger value="todos">Todos os Registos</TabsTrigger>
          </TabsList>
        )}

        {/* Quick Register Card — adapta o pool de sessões conforme a tab ativa */}
        {(() => {
          const pool = activeTab === 'todos' ? todasSessoesRegistaveis : sessoes;
          const showMentorInLabel = activeTab === 'todos';
          return (
            <Card className="border-primary/30 bg-primary/5 mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Registar sessão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Seleciona a sessão a registar</Label>
                    <Select value={selectedSessionId} onValueChange={handleSelectSession}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolhe uma sessão..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {pool.length === 0 ? (
                          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                            Não há sessões por registar.
                          </div>
                        ) : (
                          pool.map(s => (
                            <SelectItem key={s.id} value={String(s.id)}>
                              <div className="flex items-center gap-2">
                                {s.is_autonomous ? (
                                  <Music2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                ) : (
                                  <Calendar className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                                )}
                                <span>
                                  {sessionLabel(s)}
                                  {showMentorInLabel && s.mentor_nome ? ` · ${s.mentor_nome}` : ''}
                                </span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedSession && (
                    <div className="space-y-4 p-4 rounded-lg bg-card border border-border">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(parseISO(selectedSession.data_hora), "d 'de' MMMM yyyy", { locale: pt })}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {formData.horario}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          {formData.local || 'Sem local'}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <UserIcon className="h-4 w-4 text-muted-foreground" />
                          {formData.tecnicos}
                        </div>
                      </div>
                      <Badge variant={selectedSession.is_autonomous ? 'secondary' : 'default'} className="mt-1">
                        {selectedSession.is_autonomous ? 'Trabalho Autónomo' : 'Aula Presencial'}
                      </Badge>
                      <div className="p-4 rounded-lg bg-secondary/20 border border-border">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <FileText className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">Registo de Atividade</p>
                              <p className="text-xs text-muted-foreground">
                                Documento oficial com campos pré-preenchidos
                              </p>
                            </div>
                          </div>
                          <Button variant="default" size="sm" onClick={openModal}>
                            <FileText className="h-4 w-4 mr-2" />
                            Preencher & Exportar
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Tab 1 — Os meus Registos */}
        <TabsContent value="meus">
          <RegistoList
            registos={registos}
            onReExport={handleReExportPdf}
            onEdit={handleOpenEdit}
            onDelete={id => deleteRegistoMutation.mutate(id)}
            showMentor={false}
          />
        </TabsContent>

        {/* Tab 2 — Todos os Registos (coordenador/direção) */}
        {isCoord && (
          <TabsContent value="todos">
            {isDirecao && (
              <div className="flex justify-end mb-4">
                <Button variant="outline" onClick={() => setExportModalOpen(true)}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Exportar Registos
                </Button>
              </div>
            )}
            <TodosRegistosAccordion
              registos={todosRegistos}
              onReExport={handleReExportPdf}
              onEdit={handleOpenEdit}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* ─── Modal: Export XLS ──────────────────────────────────────────── */}
      <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Exportar Registos
            </DialogTitle>
            <DialogDescription>
              Define os filtros e exporta os registos em formato Excel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Date range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Data Início</Label>
                <Input type="date" value={exportDataInicio} onChange={e => setExportDataInicio(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Data Fim</Label>
                <Input type="date" value={exportDataFim} onChange={e => setExportDataFim(e.target.value)} />
              </div>
            </div>

            {/* Users filter */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Utilizadores</Label>
              <div className="flex items-center gap-2 mb-2">
                <Checkbox
                  id="all-users"
                  checked={exportAllUsers}
                  onCheckedChange={(checked) => {
                    setExportAllUsers(!!checked);
                    if (checked) setExportSelectedUsers([]);
                  }}
                />
                <label htmlFor="all-users" className="text-sm cursor-pointer">Todos</label>
              </div>
              {!exportAllUsers && (
                <ScrollArea className="h-36 border rounded-md p-2">
                  <div className="space-y-1">
                    {equipaList.map(u => (
                      <div key={u.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`user-${u.id}`}
                          checked={exportSelectedUsers.includes(u.id)}
                          onCheckedChange={(checked) => {
                            setExportSelectedUsers(prev =>
                              checked ? [...prev, u.id] : prev.filter(id => id !== u.id)
                            );
                          }}
                        />
                        <label htmlFor={`user-${u.id}`} className="text-sm cursor-pointer">{u.full_name}</label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Establishments filter */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Estabelecimentos</Label>
              <div className="flex items-center gap-2 mb-2">
                <Checkbox
                  id="all-estabs"
                  checked={exportAllEstabs}
                  onCheckedChange={(checked) => {
                    setExportAllEstabs(!!checked);
                    if (checked) setExportSelectedEstabs([]);
                  }}
                />
                <label htmlFor="all-estabs" className="text-sm cursor-pointer">Todos</label>
              </div>
              {!exportAllEstabs && (
                <ScrollArea className="h-36 border rounded-md p-2">
                  <div className="space-y-1">
                    {estabList.map(e => (
                      <div key={e.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`estab-${e.id}`}
                          checked={exportSelectedEstabs.includes(e.id)}
                          onCheckedChange={(checked) => {
                            setExportSelectedEstabs(prev =>
                              checked ? [...prev, e.id] : prev.filter(id => id !== e.id)
                            );
                          }}
                        />
                        <label htmlFor={`estab-${e.id}`} className="text-sm cursor-pointer">{e.nome}</label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExportModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleExportXls} disabled={exportLoading}>
              <Download className="h-4 w-4 mr-2" />
              {exportLoading ? 'A exportar...' : 'Exportar Excel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Modal: fill form + export PDF ─────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) { setModalOpen(false); setEditingRegisto(null); } }}>
        <DialogContent className="w-full max-w-2xl max-h-[95dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingRegisto ? <Pencil className="h-5 w-5 text-primary" /> : <FileText className="h-5 w-5 text-primary" />}
              {editingRegisto ? 'Editar Registo' : 'Registo de Atividade'}
            </DialogTitle>
            <DialogDescription>
              {editingRegisto ? 'Edita os campos e guarda as alterações.' : 'Preenche os campos e exporta o documento PDF oficial.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Pre-filled fields (editable) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Designação do Projeto</Label>
                <Input value="RAP Nova Escola" readOnly className="bg-secondary/30 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Cód. do Projeto</Label>
                <Input value="CENTRO2030-FSE+0232800" readOnly className="bg-secondary/30 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Atividade</Label>
                <Input
                  value={formData.atividade}
                  onChange={e => setFormData(prev => ({ ...prev, atividade: e.target.value }))}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nº Sessão</Label>
                <Input
                  value={formData.numero_sessao}
                  onChange={e => setFormData(prev => ({ ...prev, numero_sessao: e.target.value }))}
                  placeholder="Ex: 12"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Data</Label>
                <Input
                  value={formData.data}
                  onChange={e => setFormData(prev => ({ ...prev, data: e.target.value }))}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Local</Label>
                <Input
                  value={formData.local}
                  onChange={e => setFormData(prev => ({ ...prev, local: e.target.value }))}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Horário</Label>
                <Input
                  value={formData.horario}
                  onChange={e => setFormData(prev => ({ ...prev, horario: e.target.value }))}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Técnico(s)/a(s)</Label>
                <Input
                  value={formData.tecnicos}
                  onChange={e => setFormData(prev => ({ ...prev, tecnicos: e.target.value }))}
                  className="text-sm"
                />
              </div>
              {((selectedSession && !selectedSession.is_autonomous) || (editingRegisto && !editingRegisto.is_autonomous)) && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Kms Percorridos (ida e volta)</Label>
                  <Input
                    type="number"
                    value={formData.kms_percorridos}
                    onChange={e => setFormData(prev => ({ ...prev, kms_percorridos: e.target.value }))}
                    placeholder="Ex: 24"
                    className="text-sm"
                  />
                </div>
              )}
            </div>

            {/* Editable text areas */}
            <div className="space-y-2">
              <Label htmlFor="obj" className="font-medium">Objetivos Gerais</Label>
              <Textarea
                id="obj"
                placeholder="Descreve os objetivos da sessão..."
                value={formData.objetivos_gerais}
                onChange={e => setFormData(prev => ({ ...prev, objetivos_gerais: e.target.value }))}
                maxLength={220}
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sum" className="font-medium">
                {(selectedSession?.is_autonomous || editingRegisto?.is_autonomous) ? 'Resumo da atividade desenvolvida' : 'Sumário'}
              </Label>
              <Textarea
                id="sum"
                placeholder="Descreve o que foi desenvolvido durante a sessão..."
                value={formData.sumario}
                onChange={e => setFormData(prev => ({ ...prev, sumario: e.target.value }))}
                maxLength={220}
                className="min-h-[100px]"
              />
            </div>

            {/* Participants list — presencial only */}
            {((selectedSession && !selectedSession.is_autonomous) || (editingRegisto && !editingRegisto.is_autonomous)) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">Lista de Participantes</Label>
                  <Button variant="outline" size="sm" onClick={addParticipant}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Adicionar
                  </Button>
                </div>
                {formData.participantes.length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">
                    Nenhum participante adicionado. Clica em "Adicionar" para começar.
                  </p>
                )}
                <div className="space-y-2">
                  {formData.participantes.map((p, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        placeholder={`Participante ${i + 1}`}
                        value={p.nome_completo}
                        onChange={e => updateParticipant(i, e.target.value)}
                        className="text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeParticipant(i)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleExportPdf} className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
            {editingRegisto ? (
              <Button onClick={handleSaveEdit} disabled={updateRegistoMutation.isPending} className="flex-1">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {updateRegistoMutation.isPending ? 'A guardar...' : 'Guardar alterações'}
              </Button>
            ) : (
              <Button onClick={handleSaveAndExport} disabled={createRegistoMutation.isPending} className="flex-1">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Guardar & Exportar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Registos;
