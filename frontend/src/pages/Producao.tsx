import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  PlayCircle,
  ListMusic,
  MessageSquare,
  Building2,
  Users,
  Calendar,
  Music,
  Pencil,
  X,
  Check,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addMinutes } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

// Types
interface Musica {
  id: number;
  titulo: string;
  estado: string;
  disciplina: string | null;
  disciplina_id?: number | null;
  arquivado: boolean;
  criado_em: string;
  turma: { id: number; nome: string; estabelecimento: string } | null;
  responsavel: { id: string; nome: string } | null;
  criador: { id: string; nome: string } | null;
  feedback?: string;
  link_demo?: string;
  misturado_por?: { id: string; nome: string };
  revisto_por?: { id: string; nome: string };
  finalizado_por?: { id: string; nome: string };
  deadline?: string | null;
  notas?: string | null;
}

interface Turma { id: number; nome: string; display_name: string; estabelecimento_id: number }
interface Projeto { id: number; nome: string; descricao: string | null; estado: string }
interface ProjetoEstabelecimento { id: number; nome: string }

interface TurmaStats {
  turma_id: number;
  turma_nome: string;
  disciplina_id: number | null;
  disciplina_nome: string | null;
  horas_previstas: number | null;
  musicas_previstas: number | null;
  horas_realizadas: number;
  sessoes_realizadas: number;
  musicas_em_curso: number;
  musicas_concluidas: number;
}

interface EstabStats {
  estabelecimento_id: number;
  estabelecimento_nome: string;
  turmas: TurmaStats[];
}

interface MembroStats {
  user_id: string;
  nome: string;
  musicas_atribuidas: number;
  musicas: { id: number; titulo: string; estado: string; turma_nome: string; estabelecimento_nome: string }[];
}

// Constants
const MENTOR_STATES = ['gravação', 'edição'];
const LAB_STATES = ['pool_mistura', 'mistura_wip', 'pool_finalização', 'finalização_wip'];
const FEEDBACK_STATES = ['pool_feedback', 'feedback_wip'];
const WORKLOG_STATES = ['gravação', 'edição', 'mistura_wip', 'finalização_wip'];
const DIRECT_ADVANCE_STATES = ['pool_mistura', 'pool_finalização', 'pool_feedback'];

const STATUS_LABELS: Record<string, string> = {
  'gravação': 'Gravação', 'edição': 'Edição',
  'pool_mistura': 'Aguardar Mistura', 'mistura_wip': 'Mistura em Curso',
  'pool_feedback': 'Aguardar Feedback', 'feedback_wip': 'Em Revisão',
  'pool_finalização': 'Aguardar Finalização', 'finalização_wip': 'Finalização em Curso',
  'concluído': 'Concluído'
};

const STATUS_COLORS: Record<string, string> = {
  'gravação': 'bg-blue-100 text-blue-700',
  'edição': 'bg-blue-100 text-blue-700',
  'pool_mistura': 'bg-purple-100 text-purple-700',
  'mistura_wip': 'bg-purple-100 text-purple-700',
  'pool_feedback': 'bg-orange-100 text-orange-700',
  'feedback_wip': 'bg-orange-100 text-orange-700',
  'pool_finalização': 'bg-pink-100 text-pink-700',
  'finalização_wip': 'bg-pink-100 text-pink-700',
  'concluído': 'bg-green-100 text-green-700',
};

const ACTION_LABELS: Record<string, string> = {
  'gravação': 'Avançar para Edição',
  'edição': 'Enviar para Laboratório',
  'pool_mistura': 'Iniciar Mistura',
  'mistura_wip': 'Enviar para Feedback',
  'pool_feedback': 'Iniciar Revisão',
  'feedback_wip': 'Enviar Feedback & Devolver',
  'pool_finalização': 'Iniciar Finalização',
  'finalização_wip': 'Terminar Trabalho',
};

const Producao = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedProjetoId, setSelectedProjetoId] = useState<number | null>(null);
  const [isNewMusicOpen, setIsNewMusicOpen] = useState(false);
  const [newMusicData, setNewMusicData] = useState({ titulo: '', turma_id: '', disciplina: '', disciplina_id: '', projeto_id: '' });
  const [workLogModal, setWorkLogModal] = useState<{ open: boolean; music: Musica | null }>({ open: false, music: null });
  const [workLogForm, setWorkLogForm] = useState({ date: '', hora_inicio: '', hora_fim: '', observacoes: '' });
  const [editingCell, setEditingCell] = useState<{ id: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<Musica | null>(null);
  const [concluidasOpen, setConcluidasOpen] = useState(false);

  const isCoordinator = profile === 'coordenador' || profile === 'direcao' || profile === 'it_support';
  const isProdutor = profile === 'produtor' || profile === 'mentor_produtor';

  // ─── Queries ─────────────────────────────────────────────────────────────────

  const { data: projetos = [] } = useQuery({
    queryKey: ['projetos'],
    queryFn: async () => (await api.get('/api/projetos')).data as Projeto[]
  });

  // Disciplinas da turma selecionada no modal (para filtrar disciplinas)
  const selectedTurmaIdNum = newMusicData.turma_id ? parseInt(newMusicData.turma_id) : null;
  const { data: turmaDisciplinas = [] } = useQuery({
    queryKey: ['turma-disciplinas', selectedTurmaIdNum],
    queryFn: async () => (await api.get(`/api/turmas/${selectedTurmaIdNum}/disciplinas`)).data,
    enabled: !!selectedTurmaIdNum,
  });

  // Estabelecimentos do projeto selecionado no modal (para filtrar turmas)
  const modalProjetoId = newMusicData.projeto_id ? parseInt(newMusicData.projeto_id) : null;
  const { data: projetoEstabelecimentos = [] } = useQuery({
    queryKey: ['projeto-estabs', modalProjetoId],
    queryFn: async () => modalProjetoId
      ? (await api.get(`/api/projetos/${modalProjetoId}/estabelecimentos`)).data as ProjetoEstabelecimento[]
      : [] as ProjetoEstabelecimento[],
    enabled: !!modalProjetoId,
  });

  const { data: musicas = [], isLoading } = useQuery({
    queryKey: ['musicas', selectedProjetoId],
    queryFn: async () => {
      const url = selectedProjetoId
        ? `/api/musicas?arquivadas=false&projeto_id=${selectedProjetoId}`
        : '/api/musicas?arquivadas=false';
      return (await api.get(url)).data as Musica[];
    }
  });

  const { data: turmas = [] } = useQuery({
    queryKey: ['turmas'],
    queryFn: async () => (await api.get('/api/turmas')).data as Turma[]
  });

  const { data: statsInstituicao = [] } = useQuery({
    queryKey: ['producao-stats-inst', selectedProjetoId],
    queryFn: async () => {
      const url = selectedProjetoId
        ? `/api/producao/stats/instituicao?projeto_id=${selectedProjetoId}`
        : '/api/producao/stats/instituicao';
      return (await api.get(url)).data as EstabStats[];
    }
  });

  const { data: statsEquipa = [] } = useQuery({
    queryKey: ['producao-stats-equipa', selectedProjetoId],
    queryFn: async () => {
      const url = selectedProjetoId
        ? `/api/producao/stats/equipa?projeto_id=${selectedProjetoId}`
        : '/api/producao/stats/equipa';
      return (await api.get(url)).data as MembroStats[];
    }
  });

  const concluidasAtivas = musicas.filter(m => !m.arquivado && m.estado === 'concluído');
  const { data: musicasArquivadas = [] } = useQuery({
    queryKey: ['musicas-arquivadas', selectedProjetoId],
    queryFn: async () => {
      const url = selectedProjetoId
        ? `/api/musicas?arquivadas=true&projeto_id=${selectedProjetoId}`
        : '/api/musicas?arquivadas=true';
      return (await api.get(url)).data as Musica[];
    },
    enabled: concluidasOpen,
  });

  // ─── Mutations ───────────────────────────────────────────────────────────────

  const createMusicMutation = useMutation({
    mutationFn: (data: any) => api.post('/api/musicas', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['musicas'] });
      toast({ title: 'Música criada', description: 'Nova produção iniciada!' });
      setIsNewMusicOpen(false);
      setNewMusicData({ titulo: '', turma_id: '', disciplina: '', disciplina_id: '', projeto_id: '' });
    },
    onError: () => toast({ title: 'Erro', description: 'Falha ao criar música.', variant: 'destructive' })
  });

  const advancePhaseMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data?: any }) => api.post(`/api/musicas/${id}/avancar`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['musicas'] });
      queryClient.invalidateQueries({ queryKey: ['producao-stats-inst'] });
      queryClient.invalidateQueries({ queryKey: ['producao-stats-equipa'] });
      toast({ title: 'Fase avançada' });
    },
    onError: (err: any) => toast({ title: 'Erro', description: err.response?.data?.detail || 'Erro ao avançar fase.', variant: 'destructive' })
  });

  const aceitarTarefaMutation = useMutation({
    mutationFn: (id: number) => api.post(`/api/musicas/${id}/aceitar`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['musicas'] });
      queryClient.invalidateQueries({ queryKey: ['producao-stats-inst'] });
      queryClient.invalidateQueries({ queryKey: ['producao-stats-equipa'] });
      toast({ title: 'Tarefa aceite', description: 'A música foi atribuída a ti.' });
    },
    onError: (err: any) => toast({ title: 'Erro', description: err.response?.data?.detail || 'Erro ao aceitar tarefa.', variant: 'destructive' })
  });

  const createWorkLogMutation = useMutation({
    mutationFn: (payload: any) => api.post('/api/aulas', payload),
    onError: () => toast({ title: 'Aviso', description: 'Fase avançada, mas erro ao registar no calendário.' })
  });

  const updateMusicMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, any> }) => api.patch(`/api/musicas/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['musicas'] });
      setEditingCell(null);
    },
    onError: () => toast({ title: 'Erro', description: 'Falha ao guardar.', variant: 'destructive' })
  });

  const deleteMusicMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/musicas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['musicas'] });
      queryClient.invalidateQueries({ queryKey: ['producao-stats-inst'] });
      queryClient.invalidateQueries({ queryKey: ['producao-stats-equipa'] });
      toast({ title: 'Música apagada', description: 'A produção foi removida permanentemente.' });
      setDeleteConfirm(null);
    },
    onError: () => toast({ title: 'Erro', description: 'Falha ao apagar música.', variant: 'destructive' })
  });

  // ─── Filtering ───────────────────────────────────────────────────────────────

  const activeMusicas = musicas.filter(m => !m.arquivado && m.estado !== 'concluído');

  const turmasFiltradas = modalProjetoId && projetoEstabelecimentos.length > 0
    ? turmas.filter(t => projetoEstabelecimentos.some(e => e.id === t.estabelecimento_id))
    : turmas;

  const canUserAction = (music: Musica): boolean => {
    if (!user) return false;
    const { estado } = music;
    if (MENTOR_STATES.includes(estado)) return music.criador?.id === user.id || music.responsavel?.id === user.id;
    if (LAB_STATES.includes(estado)) return isProdutor;
    if (FEEDBACK_STATES.includes(estado)) return isCoordinator;
    return false;
  };

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleSubmitNew = () => {
    if (!newMusicData.titulo || !newMusicData.turma_id || !newMusicData.projeto_id || !newMusicData.disciplina_id) {
      toast({ title: 'Campos obrigatórios', description: 'Preenche o título, o projeto, a turma e a disciplina.', variant: 'destructive' });
      return;
    }
    createMusicMutation.mutate({
      titulo: newMusicData.titulo,
      turma_id: parseInt(newMusicData.turma_id),
      disciplina_id: parseInt(newMusicData.disciplina_id),
      projeto_id: parseInt(newMusicData.projeto_id),
    });
  };

  const handleAdvance = (music: Musica) => {
    if (DIRECT_ADVANCE_STATES.includes(music.estado)) {
      aceitarTarefaMutation.mutate(music.id);
      return;
    }
    const now = new Date();
    setWorkLogForm({
      date: format(now, 'yyyy-MM-dd'),
      hora_inicio: format(addMinutes(now, -120), 'HH:mm'),
      hora_fim: format(now, 'HH:mm'),
      observacoes: '',
    });
    setWorkLogModal({ open: true, music });
  };

  const handleWorkLogConfirm = () => {
    const music = workLogModal.music;
    if (!music || !workLogForm.date || !workLogForm.hora_inicio || !workLogForm.hora_fim) {
      toast({ title: 'Campos obrigatórios', description: 'Preenche a data e os horários.', variant: 'destructive' });
      return;
    }
    const [hS, mS] = workLogForm.hora_inicio.split(':').map(Number);
    const [hE, mE] = workLogForm.hora_fim.split(':').map(Number);
    const duracao = (hE * 60 + mE) - (hS * 60 + mS);
    if (duracao <= 0) {
      toast({ title: 'Hora inválida', description: 'A hora de fim deve ser posterior à de início.', variant: 'destructive' });
      return;
    }
    setWorkLogModal({ open: false, music: null });
    advancePhaseMutation.mutate({ id: music.id });
    createWorkLogMutation.mutate({
      data_hora: `${workLogForm.date} ${workLogForm.hora_inicio}`,
      duracao_minutos: duracao, tipo: 'trabalho_autonomo',
      is_autonomous: true, is_realized: true, tipo_atividade: 'Produção Musical',
      responsavel_user_id: user?.id, musica_id: music.id, turma_id: music.turma?.id ?? null,
      observacoes: workLogForm.observacoes || '',
    });
  };

  const startEdit = (id: number, field: string, currentValue: string) => {
    setEditingCell({ id, field });
    setEditValue(currentValue || '');
  };

  const saveEdit = () => {
    if (!editingCell) return;
    updateMusicMutation.mutate({ id: editingCell.id, data: { [editingCell.field]: editValue || null } });
  };

  // ─── Sub-components ─────────────────────────────────────────────────────────

  const FeedbackDialog = ({ music }: { music: Musica }) => {
    const [open, setOpen] = useState(false);
    const [fb, setFb] = useState('');
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="h-7 text-xs">
            <MessageSquare className="w-3 h-3 mr-1" /> Feedback
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Feedback: {music.titulo}</DialogTitle>
            <DialogDescription>Indica as correções necessárias.</DialogDescription>
          </DialogHeader>
          <Textarea value={fb} onChange={(e) => setFb(e.target.value)} placeholder="Escreve aqui o teu feedback..." className="min-h-[100px]" maxLength={500} />
          <DialogFooter>
            <Button onClick={() => { advancePhaseMutation.mutate({ id: music.id, data: { feedback: fb } }); setOpen(false); setFb(''); }}>
              Enviar Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const EditableCell = ({ musicId, field, value, type = 'text' }: { musicId: number; field: string; value: string | null; type?: string }) => {
    const isEditing = editingCell?.id === musicId && editingCell?.field === field;
    if (isEditing) {
      return (
        <div className="flex items-center gap-1">
          <Input
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="h-7 text-xs w-full"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingCell(null); }}
          />
          <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={saveEdit}><Check className="h-3 w-3" /></Button>
          <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => setEditingCell(null)}><X className="h-3 w-3" /></Button>
        </div>
      );
    }
    return (
      <div
        className="group flex items-center gap-1 cursor-pointer min-h-[28px]"
        onClick={() => startEdit(musicId, field, value || '')}
      >
        <span className={cn("text-xs", !value && "text-muted-foreground italic")}>{value || '—'}</span>
        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
      </div>
    );
  };

  // ─── Vista Geral (Tabela desktop / Cards mobile) ──────────────────────────

  const VistaGeral = () => (
    <>
      {/* ── Mobile card list ── */}
      <div className="flex flex-col gap-3 md:hidden">
        {activeMusicas.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ListMusic className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Nenhuma música em andamento.
          </div>
        ) : (
          activeMusicas.map(m => (
            <div key={m.id} className="rounded-lg border bg-card p-4 space-y-3">
              {/* Title + badge */}
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-sm leading-snug">{m.titulo}</p>
                <Badge variant="secondary" className={cn("text-xs shrink-0", STATUS_COLORS[m.estado])}>
                  {STATUS_LABELS[m.estado] || m.estado}
                </Badge>
              </div>

              {/* Meta */}
              <div className="space-y-1 text-xs text-muted-foreground">
                {m.turma && (
                  <p>{m.turma.nome} <span className="opacity-70">• {m.turma.estabelecimento}</span></p>
                )}
                {(m.responsavel || m.criador) && (
                  <p>Atribuído a: <span className="text-foreground">{(m.responsavel || m.criador)?.nome?.split(' ')[0]}</span></p>
                )}
              </div>

              {/* Deadline + Notas */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Deadline</p>
                  <EditableCell musicId={m.id} field="deadline" value={m.deadline || null} type="date" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Notas</p>
                  <EditableCell musicId={m.id} field="notas" value={m.notas || null} />
                </div>
              </div>

              {/* Actions */}
              {(canUserAction(m) || isCoordinator) && (
                <div className="flex items-center gap-2 pt-1 border-t border-border">
                  {canUserAction(m) && m.estado !== 'concluído' && (
                    m.estado === 'feedback_wip' ? (
                      <FeedbackDialog music={m} />
                    ) : (
                      <Button size="sm" variant="outline" className="h-8 text-xs flex-1" onClick={() => handleAdvance(m)} disabled={advancePhaseMutation.isPending || aceitarTarefaMutation.isPending}>
                        <PlayCircle className="w-3 h-3 mr-1" />
                        {ACTION_LABELS[m.estado] || 'Avançar'}
                      </Button>
                    )
                  )}
                  {isCoordinator && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0" onClick={() => setDeleteConfirm(m)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Nome</TableHead>
              <TableHead className="w-[150px]">Estado / Fase</TableHead>
              <TableHead className="w-[130px]">Atribuído a</TableHead>
              <TableHead className="w-[180px]">Turma / Instituição</TableHead>
              <TableHead className="w-[120px]">Deadline</TableHead>
              <TableHead className="w-[180px]">Notas</TableHead>
              <TableHead className="w-[140px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeMusicas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <ListMusic className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Nenhuma música em andamento.
                </TableCell>
              </TableRow>
            ) : (
              activeMusicas.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium text-sm">{m.titulo}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn("text-xs", STATUS_COLORS[m.estado])}>
                      {STATUS_LABELS[m.estado] || m.estado}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {(m.responsavel || m.criador)?.nome?.split(' ')[0] || '—'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {m.turma ? (
                      <span>{m.turma.nome} <span className="text-muted-foreground">• {m.turma.estabelecimento}</span></span>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <EditableCell musicId={m.id} field="deadline" value={m.deadline || null} type="date" />
                  </TableCell>
                  <TableCell>
                    <EditableCell musicId={m.id} field="notas" value={m.notas || null} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {canUserAction(m) && m.estado !== 'concluído' && (
                        m.estado === 'feedback_wip' ? (
                          <FeedbackDialog music={m} />
                        ) : (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAdvance(m)} disabled={advancePhaseMutation.isPending || aceitarTarefaMutation.isPending}>
                            <PlayCircle className="w-3 h-3 mr-1" />
                            {ACTION_LABELS[m.estado] || 'Avançar'}
                          </Button>
                        )
                      )}
                      {isCoordinator && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteConfirm(m)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );

  // ─── Vista por Instituição ──────────────────────────────────────────────────

  const VistaInstituicao = () => (
    <div className="space-y-6">
      {statsInstituicao.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Sem dados de instituições.
        </div>
      ) : (
        statsInstituicao.map(estab => {
          const totalHoras = estab.turmas.reduce((s, t) => s + (t.horas_previstas || 0), 0);
          const totalHorasRealizadas = estab.turmas.reduce((s, t) => s + t.horas_realizadas, 0);
          const totalMusicasPrev = estab.turmas.reduce((s, t) => s + (t.musicas_previstas || 0), 0);
          const totalConcluidas = estab.turmas.reduce((s, t) => s + t.musicas_concluidas, 0);
          const totalEmCurso = estab.turmas.reduce((s, t) => s + t.musicas_em_curso, 0);
          const pctHoras = totalHoras > 0 ? Math.round((totalHorasRealizadas / totalHoras) * 100) : 0;
          const pctMusicas = totalMusicasPrev > 0 ? Math.round((totalConcluidas / totalMusicasPrev) * 100) : 0;
          const turmaIds = new Set(estab.turmas.map(t => t.turma_id));
          const musicasEstab = activeMusicas.filter(m => m.turma && turmaIds.has(m.turma.id));

          return (
            <Card key={estab.estabelecimento_id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {estab.estabelecimento_nome}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Progress bars */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Calendar className="h-3.5 w-3.5" /> Horas
                      </span>
                      <span className="text-muted-foreground">
                        {totalHorasRealizadas}h / {totalHoras ? `${totalHoras}h` : '?'} ({pctHoras}%)
                      </span>
                    </div>
                    <Progress value={pctHoras} className="h-2.5" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Music className="h-3.5 w-3.5" /> Produção Musical
                      </span>
                      <span className="text-muted-foreground">
                        {totalConcluidas} / {totalMusicasPrev || '?'} ({pctMusicas}%)
                      </span>
                    </div>
                    <Progress value={pctMusicas} className="h-2.5" />
                  </div>
                </div>

                {/* Turmas breakdown */}
                {estab.turmas.length > 1 && (
                  <div className="border rounded-md overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="text-xs">Turma / Disciplina</TableHead>
                          <TableHead className="text-xs text-center">Horas</TableHead>
                          <TableHead className="text-xs text-center">Em Curso</TableHead>
                          <TableHead className="text-xs text-center">Concluídas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {estab.turmas.map(t => (
                          <TableRow key={`${t.turma_id}-${t.disciplina_id ?? 'none'}`}>
                            <TableCell className="text-xs font-medium">
                              {t.turma_nome}
                              {t.disciplina_nome && <span className="text-muted-foreground font-normal"> — {t.disciplina_nome}</span>}
                            </TableCell>
                            <TableCell className="text-xs text-center">
                              {t.horas_realizadas}h / {t.horas_previstas != null ? `${t.horas_previstas}h` : '?'}
                            </TableCell>
                            <TableCell className="text-xs text-center">{t.musicas_em_curso}</TableCell>
                            <TableCell className="text-xs text-center">{t.musicas_concluidas}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="flex gap-6 text-sm text-muted-foreground">
                  <span>Músicas em curso: <strong className="text-foreground">{totalEmCurso}</strong></span>
                  <span>Concluídas: <strong className="text-foreground">{totalConcluidas}</strong></span>
                </div>

                {musicasEstab.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {musicasEstab.map(m => (
                      <div key={m.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-muted/40">
                        <span className="font-medium">{m.titulo}
                          <span className="text-muted-foreground font-normal ml-1.5">— {m.turma?.nome}{m.disciplina ? ` — ${m.disciplina}` : ''}</span>
                        </span>
                        <Badge variant="secondary" className={cn('text-xs', STATUS_COLORS[m.estado])}>
                          {STATUS_LABELS[m.estado] || m.estado}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );

  // ─── Vista por Equipa ───────────────────────────────────────────────────────

  const VistaEquipa = () => (
    <div className="space-y-4">
      {statsEquipa.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Sem músicas atribuídas.
        </div>
      ) : (
        statsEquipa.map(membro => (
          <Card key={membro.user_id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {membro.nome}
                </span>
                <Badge variant="secondary">{membro.musicas_atribuidas} música{membro.musicas_atribuidas !== 1 ? 's' : ''}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {membro.musicas.map(m => (
                  <div key={m.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-muted/50">
                    <div>
                      <span className="font-medium">{m.titulo}</span>
                      <span className="text-muted-foreground text-xs ml-2">
                        {m.turma_nome} • {m.estabelecimento_nome}
                      </span>
                    </div>
                    <Badge variant="secondary" className={cn("text-xs", STATUS_COLORS[m.estado])}>
                      {STATUS_LABELS[m.estado] || m.estado}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">A carregar...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold">Produção</h1>
          <p className="text-muted-foreground mt-1">Gestão do fluxo de trabalho de produção musical.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setConcluidasOpen(true)}>
            <CheckCircle2 className="h-4 w-4 mr-2" /> Concluídas
          </Button>
          <Dialog open={isNewMusicOpen} onOpenChange={setIsNewMusicOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              if (selectedProjetoId) setNewMusicData(d => ({ ...d, projeto_id: String(selectedProjetoId) }));
            }}><Plus className="h-4 w-4 mr-2" /> Nova Música</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Música</DialogTitle>
              <DialogDescription>Inicia uma nova produção musical.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Projeto <span className="text-destructive">*</span></Label>
                <Select
                  value={newMusicData.projeto_id}
                  onValueChange={(val) => setNewMusicData({ ...newMusicData, projeto_id: val, turma_id: '' })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecionar projeto" /></SelectTrigger>
                  <SelectContent>
                    {projetos.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Título da Música <span className="text-destructive">*</span></Label>
                <Input placeholder="Ex: Vozes do Bairro" value={newMusicData.titulo} onChange={(e) => setNewMusicData({ ...newMusicData, titulo: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Turma / Artista <span className="text-destructive">*</span></Label>
                <Select value={newMusicData.turma_id} onValueChange={(val) => setNewMusicData({ ...newMusicData, turma_id: val, disciplina_id: '' })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar turma" /></SelectTrigger>
                  <SelectContent>
                    {turmasFiltradas.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.display_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Disciplina <span className="text-destructive">*</span></Label>
                <Select
                  value={newMusicData.disciplina_id || ''}
                  onValueChange={(val) => setNewMusicData({ ...newMusicData, disciplina_id: val })}
                  disabled={!newMusicData.turma_id}
                >
                  <SelectTrigger><SelectValue placeholder={newMusicData.turma_id ? 'Selecionar disciplina' : 'Seleciona primeiro a turma'} /></SelectTrigger>
                  <SelectContent>
                    {turmaDisciplinas.map((d: any) => <SelectItem key={d.id} value={String(d.id)}>{d.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSubmitNew} disabled={createMusicMutation.isPending}>Criar Música</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Project Selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Projeto:</span>
        <Select
          value={selectedProjetoId ? String(selectedProjetoId) : 'all'}
          onValueChange={(val) => setSelectedProjetoId(val === 'all' ? null : parseInt(val))}
        >
          <SelectTrigger className="w-full sm:w-[280px]">
            <SelectValue placeholder="Todos os projetos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os projetos</SelectItem>
            {projetos.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="geral" className="w-full">
        <TabsList>
          <TabsTrigger value="geral">Geral ({activeMusicas.length})</TabsTrigger>
          {isCoordinator && (
            <TabsTrigger value="instituicao">
              <Building2 className="h-3.5 w-3.5 mr-1.5" /> Por Instituição
            </TabsTrigger>
          )}
          {isCoordinator && (
            <TabsTrigger value="equipa">
              <Users className="h-3.5 w-3.5 mr-1.5" /> Por Equipa
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="geral" className="mt-4">
          <VistaGeral />
        </TabsContent>
        {isCoordinator && (
        <TabsContent value="instituicao" className="mt-4">
          <VistaInstituicao />
        </TabsContent>
        )}
        {isCoordinator && (
        <TabsContent value="equipa" className="mt-4">
          <VistaEquipa />
        </TabsContent>
        )}
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Apagar Música
            </DialogTitle>
            <DialogDescription>
              Estás prestes a apagar permanentemente a produção{' '}
              <span className="font-semibold text-foreground">"{deleteConfirm?.titulo}"</span>.
              {deleteConfirm?.turma && (
                <span className="block mt-1 text-xs">
                  Turma: {deleteConfirm.turma.nome} — {deleteConfirm.turma.estabelecimento}
                </span>
              )}
              <span className="block mt-2 font-medium text-destructive">
                Esta ação não pode ser desfeita.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteMusicMutation.mutate(deleteConfirm.id)}
              disabled={deleteMusicMutation.isPending}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Apagar Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WorkLog Modal */}
      <Dialog open={workLogModal.open} onOpenChange={(open) => !open && setWorkLogModal({ open: false, music: null })}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Registar Sessão de Trabalho</DialogTitle>
            <DialogDescription>
              <span className="font-medium">"{workLogModal.music?.titulo}"</span>
              {workLogModal.music && ` — ${ACTION_LABELS[workLogModal.music.estado] || 'Avançar'}`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={workLogForm.date} onChange={(e) => setWorkLogForm({ ...workLogForm, date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Início</Label>
                <Input type="time" value={workLogForm.hora_inicio} onChange={(e) => setWorkLogForm({ ...workLogForm, hora_inicio: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Input type="time" value={workLogForm.hora_fim} onChange={(e) => setWorkLogForm({ ...workLogForm, hora_fim: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea placeholder="O que foi feito nesta sessão..." rows={3} value={workLogForm.observacoes} onChange={(e) => setWorkLogForm({ ...workLogForm, observacoes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWorkLogModal({ open: false, music: null })}>Cancelar</Button>
            <Button onClick={handleWorkLogConfirm} disabled={advancePhaseMutation.isPending || createWorkLogMutation.isPending}>
              <PlayCircle className="w-4 h-4 mr-2" /> Registar & Avançar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Concluídas Dialog */}
      <Dialog open={concluidasOpen} onOpenChange={setConcluidasOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Músicas Concluídas & Arquivadas
            </DialogTitle>
            <DialogDescription>
              Lista de todas as produções que completaram o fluxo de trabalho.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 mt-2">
            {(() => {
              const todas = [
                ...concluidasAtivas.map(m => ({ ...m, _tipo: 'concluída' as const })),
                ...musicasArquivadas.map(m => ({ ...m, _tipo: 'arquivada' as const })),
              ].sort((a, b) => b.id - a.id);
              if (todas.length === 0) {
                return (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Nenhuma música concluída ainda.
                  </div>
                );
              }
              return (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Turma / Instituição</TableHead>
                      <TableHead>Finalizada por</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todas.map(m => (
                      <TableRow key={`${m._tipo}-${m.id}`}>
                        <TableCell className="font-medium text-sm">{m.titulo}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {m.turma ? `${m.turma.nome} • ${m.turma.estabelecimento}` : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {m.finalizado_por?.nome?.split(' ')[0] || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={m.arquivado ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'}>
                            {m.arquivado ? 'Arquivada' : 'Concluída'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConcluidasOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Producao;
