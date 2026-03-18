import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Book, Layers, Calendar, Edit2, Plus, Trash2, Save, Users, Building2, X, Music, Clock, HelpCircle, ChevronDown, Link2Off,
} from "lucide-react";
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

// Types
interface Estabelecimento {
  id: number;
  nome: string;
  sigla: string;
  morada?: string;
  latitude?: number;
  longitude?: number;
}

interface Turma {
  id: number;
  nome: string;
  estabelecimento_nome: string;
  estabelecimento_id: number;
}

interface TurmaAtividade {
  uuid: string;
  nome: string;
  codigo: string;
  sessoes_previstas: number;
  horas_por_sessao: number;
  musicas_previstas: number;
  roles: string[];
  is_autonomous: boolean;
  sessoes_realizadas?: number;
  horas_realizadas?: number;
}

const ALL_ROLES = ['mentor', 'produtor', 'mentor_produtor', 'coordenador', 'direcao', 'it_support'] as const;

const CODIGOS_ATIVIDADE = [
  'CR_TP_MR', 'CR_TA_MR', 'CR_TA_C', 'CR_TA_P',
  'CP_TP_MP', 'CP_TA_MP', 'CP_TA_C',
  'OP_TP_MR', 'OP_TA_MR', 'OP_TA_C', 'OP_TA_P',
] as const;

interface TurmaDisciplina {
  id: number;
  nome: string;
  descricao: string;
  musicas_previstas: number;
  atividades: TurmaAtividade[];
}

interface WikiTurma {
  id: number;
  nome: string;
  sessoes_previstas: number;
  musicas_previstas: number;
  disciplinas: TurmaDisciplina[];
}

interface WikiEstabelecimento {
  id: number;
  nome: string;
  sigla: string;
  turmas: WikiTurma[];
}

const Wiki = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isCoordinator = user?.role === 'coordenador' || user?.role === 'direcao' || user?.role === 'it_support';

  // State for Projetos
  const [selectedProjetoId, setSelectedProjetoId] = useState<number | null>(null);
  const [isProjetoDialogOpen, setIsProjetoDialogOpen] = useState(false);
  const [editingProjeto, setEditingProjeto] = useState<{ id: number; nome: string; descricao?: string } | null>(null);
  const [projetoForm, setProjetoForm] = useState({ nome: '', descricao: '' });
  const [addEstabToProjetoId, setAddEstabToProjetoId] = useState<string>('');

  // State for Estabelecimentos
  const [isEstabDialogOpen, setIsEstabDialogOpen] = useState(false);
  const [editingEstab, setEditingEstab] = useState<Estabelecimento | null>(null);
  const [estabForm, setEstabForm] = useState({ nome: '', sigla: '', morada: '', latitude: 0, longitude: 0 });

  // State for Turmas
  const [isTurmaDialogOpen, setIsTurmaDialogOpen] = useState(false);
  const [editingTurma, setEditingTurma] = useState<Turma | null>(null);
  const [newTurmaName, setNewTurmaName] = useState('');
  const [selectedEstabId, setSelectedEstabId] = useState<string>('');
  const [alunosNomes, setAlunosNomes] = useState<string[]>([]);

  // State for Local Disciplina dialog
  const [isDisciplinaDialogOpen, setIsDisciplinaDialogOpen] = useState(false);
  const [editingDisciplina, setEditingDisciplina] = useState<TurmaDisciplina | null>(null);
  const [disciplinaTargetTurmaId, setDisciplinaTargetTurmaId] = useState<number | null>(null);
  const [discForm, setDiscForm] = useState({ nome: '', descricao: '', musicas_previstas: '0' });
  const [batchAtividades, setBatchAtividades] = useState<Array<{
    nome: string; codigo: string; sessoes_previstas: string; horas_por_sessao: string; musicas_previstas: string; roles: string[];
  }>>([]);

  // State for Local Atividade dialog
  const [isAtividadeDialogOpen, setIsAtividadeDialogOpen] = useState(false);
  const [editingAtividade, setEditingAtividade] = useState<TurmaAtividade | null>(null);
  const [atividadeTargetDiscId, setAtividadeTargetDiscId] = useState<number | null>(null);
  const [ativForm, setAtivForm] = useState({
    nome: '', codigo: '', sessoes_previstas: '0', horas_por_sessao: '0', musicas_previstas: '0', roles: [] as string[], is_autonomous: false
  });

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  const askConfirm = (title: string, description: string, onConfirm: () => void) => {
    setConfirmDialog({ open: true, title, description, onConfirm });
  };

  // Info cards visibility
  const [showInfoCards, setShowInfoCards] = useState(false);

  // --- QUERIES ---
  interface Projeto { id: number; nome: string; descricao?: string; estado?: string; }

  const { data: projetos = [] } = useQuery({
    queryKey: ['projetos'],
    queryFn: async () => {
      const res = await api.get('/api/projetos');
      return res.data as Projeto[];
    }
  });

  const { data: estabelecimentos = [] } = useQuery({
    queryKey: ['estabelecimentos'],
    queryFn: async () => {
      const res = await api.get('/api/estabelecimentos');
      return res.data as Estabelecimento[];
    }
  });

  const { data: projetoEstabs = [] } = useQuery({
    queryKey: ['projeto-estabs', selectedProjetoId],
    queryFn: async () => {
      const res = await api.get(`/api/projetos/${selectedProjetoId}/estabelecimentos`);
      return res.data as Estabelecimento[];
    },
    enabled: !!selectedProjetoId,
  });

  const { data: wikiHierarquia = [], isLoading: hierarquiaLoading, isError: hierarquiaError } = useQuery({
    queryKey: ['wiki-hierarquia', selectedProjetoId],
    queryFn: async () => {
      const res = await api.get(`/api/wiki/projeto/${selectedProjetoId}`);
      return res.data as WikiEstabelecimento[];
    },
    enabled: !!selectedProjetoId,
  });

  // Filtered data
  const filteredEstabs = selectedProjetoId ? projetoEstabs : estabelecimentos;
  const filteredEstabIds = new Set(filteredEstabs.map(e => e.id));
  const unlinkedEstabs = selectedProjetoId
    ? estabelecimentos.filter(e => !filteredEstabIds.has(e.id))
    : [];

  const selectedProjeto = projetos.find(p => p.id === selectedProjetoId);

  // --- MUTATIONS: PROJETOS ---
  const saveProjetoMutation = useMutation({
    mutationFn: (data: { nome: string; descricao?: string }) => {
      if (editingProjeto) return api.put(`/api/projetos/${editingProjeto.id}`, data);
      return api.post('/api/projetos', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projetos'] });
      toast.success(editingProjeto ? 'Projeto atualizado!' : 'Projeto criado!');
      setIsProjetoDialogOpen(false);
    },
    onError: () => toast.error('Erro ao salvar projeto.')
  });

  const deleteProjetoMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/projetos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projetos'] });
      setSelectedProjetoId(null);
      toast.success('Projeto apagado!');
    },
  });

  const assocEstabMutation = useMutation({
    mutationFn: (estabelecimento_id: number) =>
      api.post(`/api/projetos/${selectedProjetoId}/estabelecimentos`, { estabelecimento_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projeto-estabs', selectedProjetoId] });
      queryClient.invalidateQueries({ queryKey: ['wiki-hierarquia', selectedProjetoId] });
      setAddEstabToProjetoId('');
      toast.success('Estabelecimento associado ao projeto!');
    },
  });

  const desassocEstabMutation = useMutation({
    mutationFn: (estabId: number) =>
      api.delete(`/api/projetos/${selectedProjetoId}/estabelecimentos/${estabId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projeto-estabs', selectedProjetoId] });
      queryClient.invalidateQueries({ queryKey: ['wiki-hierarquia', selectedProjetoId] });
      setIsEstabDialogOpen(false);
      toast.success('Estabelecimento desassociado!');
    },
  });

  // --- MUTATIONS: ESTABELECIMENTOS ---
  const saveEstabMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingEstab) {
        return api.put(`/api/estabelecimentos/${editingEstab.id}`, data);
      }
      return api.post('/api/estabelecimentos', data);
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['estabelecimentos'] });
      queryClient.invalidateQueries({ queryKey: ['wiki-hierarquia', selectedProjetoId] });
      toast.success(editingEstab ? 'Estabelecimento atualizado!' : 'Estabelecimento criado!');
      setIsEstabDialogOpen(false);
      if (!editingEstab && selectedProjetoId && response?.data?.id) {
        assocEstabMutation.mutate(response.data.id);
      }
    },
    onError: () => toast.error('Erro ao salvar estabelecimento.')
  });

  const deleteEstabMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/estabelecimentos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estabelecimentos'] });
      queryClient.invalidateQueries({ queryKey: ['wiki-hierarquia', selectedProjetoId] });
      setIsEstabDialogOpen(false);
      toast.success('Estabelecimento removido!');
    }
  });

  // --- MUTATIONS: TURMAS ---
  const saveTurmaMutation = useMutation({
    mutationFn: (data: { nome: string; estabelecimento_id: string }) => {
      if (editingTurma) {
        return api.put(`/api/turmas/${editingTurma.id}`, data);
      }
      return api.post('/api/turmas', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turmas'] });
      queryClient.invalidateQueries({ queryKey: ['wiki-hierarquia', selectedProjetoId] });
      setIsTurmaDialogOpen(false);
      setNewTurmaName('');
      setSelectedEstabId('');
      toast.success(editingTurma ? 'Turma atualizada!' : 'Turma criada!');
    },
    onError: () => toast.error('Erro ao salvar turma.'),
  });

  const deleteTurmaMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/turmas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turmas'] });
      queryClient.invalidateQueries({ queryKey: ['wiki-hierarquia', selectedProjetoId] });
      setIsTurmaDialogOpen(false);
      toast.success('Turma removida!');
    },
    onError: () => toast.error('Erro ao remover turma.')
  });

  // --- MUTATIONS: LOCAL DISCIPLINAS ---
  const saveDisciplinaMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingDisciplina) {
        return api.put(`/api/wiki/disciplinas/${editingDisciplina.id}`, {
          nome: data.nome,
          descricao: data.descricao,
          musicas_previstas: data.musicas_previstas,
        });
      }
      return api.post(`/api/wiki/turma/${disciplinaTargetTurmaId}/disciplinas`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki-hierarquia', selectedProjetoId] });
      toast.success(editingDisciplina ? 'Disciplina atualizada!' : 'Disciplina criada!');
      setIsDisciplinaDialogOpen(false);
    },
    onError: () => toast.error('Erro ao guardar disciplina.')
  });

  const deleteDisciplinaMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/wiki/disciplinas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki-hierarquia', selectedProjetoId] });
      toast.success('Disciplina apagada!');
      setIsDisciplinaDialogOpen(false);
    },
    onError: () => toast.error('Erro ao apagar disciplina.')
  });

  // --- MUTATIONS: LOCAL ATIVIDADES ---
  const saveAtividadeMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingAtividade) {
        return api.put(`/api/wiki/atividades/${editingAtividade.uuid}`, data);
      }
      return api.post('/api/wiki/atividades', { ...data, turma_disciplina_id: atividadeTargetDiscId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki-hierarquia', selectedProjetoId] });
      toast.success(editingAtividade ? 'Atividade atualizada!' : 'Atividade criada!');
      setIsAtividadeDialogOpen(false);
    },
    onError: () => toast.error('Erro ao guardar atividade.')
  });

  const deleteAtividadeMutation = useMutation({
    mutationFn: (uuid: string) => api.delete(`/api/wiki/atividades/${uuid}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki-hierarquia', selectedProjetoId] });
      toast.success('Atividade removida!');
      setIsAtividadeDialogOpen(false);
    },
    onError: () => toast.error('Erro ao apagar atividade.')
  });

  // --- HANDLERS ---
  const openNewEstab = () => {
    setEditingEstab(null);
    setEstabForm({ nome: '', sigla: '', morada: '', latitude: 0, longitude: 0 });
    setIsEstabDialogOpen(true);
  };

  const openEditEstab = (estab: Estabelecimento) => {
    setEditingEstab(estab);
    setEstabForm({ nome: estab.nome, sigla: estab.sigla, morada: estab.morada || '', latitude: estab.latitude || 0, longitude: estab.longitude || 0 });
    setIsEstabDialogOpen(true);
  };

  const openNewTurma = (estabId?: number) => {
    setEditingTurma(null);
    setNewTurmaName('');
    setSelectedEstabId(estabId ? String(estabId) : '');
    setAlunosNomes([]);
    setIsTurmaDialogOpen(true);
  };

  const openEditTurma = async (turma: Turma | WikiTurma, estabId?: number) => {
    const t = 'estabelecimento_id' in turma
      ? turma
      : { ...turma, estabelecimento_nome: '', estabelecimento_id: estabId || 0 };
    setEditingTurma(t as Turma);
    setNewTurmaName(t.nome);
    setSelectedEstabId(String((t as any).estabelecimento_id));
    try {
      const alunosRes = await api.get(`/api/turmas/${t.id}/alunos`);
      setAlunosNomes(alunosRes.data.map((a: any) => a.nome));
    } catch {
      setAlunosNomes([]);
    }
    setIsTurmaDialogOpen(true);
  };

  const handleSaveTurma = async () => {
    if (!newTurmaName || !selectedEstabId) return;

    const saveExtras = async (turmaId: number) => {
      const filteredNomes = alunosNomes.filter(n => n.trim());
      await api.put(`/api/turmas/${turmaId}/alunos`, { nomes: filteredNomes }).catch(() => toast.error('Erro ao guardar alunos.'));
    };

    saveTurmaMutation.mutate(
      { nome: newTurmaName, estabelecimento_id: selectedEstabId },
      {
        onSuccess: async (response) => {
          const turmaId = editingTurma?.id || response?.data?.id;
          if (turmaId) await saveExtras(turmaId);
        },
      }
    );
  };

  const openNewDisciplina = (turmaId: number) => {
    setEditingDisciplina(null);
    setDisciplinaTargetTurmaId(turmaId);
    setDiscForm({ nome: '', descricao: '', musicas_previstas: '0' });
    setBatchAtividades([]);
    setIsDisciplinaDialogOpen(true);
  };

  const openEditDisciplina = (disc: TurmaDisciplina) => {
    setEditingDisciplina(disc);
    setDisciplinaTargetTurmaId(null);
    setDiscForm({
      nome: disc.nome,
      descricao: disc.descricao || '',
      musicas_previstas: String(disc.musicas_previstas ?? 0),
    });
    setBatchAtividades([]);
    setIsDisciplinaDialogOpen(true);
  };

  const handleSaveDisciplina = () => {
    if (!discForm.nome) return;
    const payload: any = {
      nome: discForm.nome,
      descricao: discForm.descricao || null,
      musicas_previstas: parseInt(discForm.musicas_previstas) || 0,
    };
    if (!editingDisciplina && batchAtividades.length > 0) {
      payload.atividades = batchAtividades.map(a => ({
        nome: a.nome,
        codigo: a.codigo,
        sessoes_previstas: parseInt(a.sessoes_previstas) || 0,
        horas_por_sessao: parseFloat(a.horas_por_sessao) || 0,
        musicas_previstas: parseInt(a.musicas_previstas) || 0,
        roles: a.roles || [],
      }));
    }
    saveDisciplinaMutation.mutate(payload);
  };

  const openNewAtividade = (discId: number) => {
    setEditingAtividade(null);
    setAtividadeTargetDiscId(discId);
    setAtivForm({ nome: '', codigo: '', sessoes_previstas: '0', horas_por_sessao: '0', musicas_previstas: '0', roles: [], is_autonomous: false });
    setIsAtividadeDialogOpen(true);
  };

  const openEditAtividade = (ativ: TurmaAtividade) => {
    setEditingAtividade(ativ);
    setAtividadeTargetDiscId(null);
    setAtivForm({
      nome: ativ.nome,
      codigo: ativ.codigo || '',
      sessoes_previstas: String(ativ.sessoes_previstas || 0),
      horas_por_sessao: String(ativ.horas_por_sessao || 0),
      musicas_previstas: String(ativ.musicas_previstas || 0),
      roles: ativ.roles || [],
      is_autonomous: ativ.is_autonomous ?? false,
    });
    setIsAtividadeDialogOpen(true);
  };

  const handleSaveAtividade = () => {
    if (!ativForm.nome) return;
    saveAtividadeMutation.mutate({
      nome: ativForm.nome,
      codigo: ativForm.codigo || null,
      sessoes_previstas: parseInt(ativForm.sessoes_previstas) || 0,
      horas_por_sessao: parseFloat(ativForm.horas_por_sessao) || 0,
      musicas_previstas: parseInt(ativForm.musicas_previstas) || 0,
      roles: ativForm.roles,
      is_autonomous: ativForm.is_autonomous,
    });
  };

  const addBatchAtividade = () => {
    setBatchAtividades(prev => [...prev, { nome: '', codigo: '', sessoes_previstas: '0', horas_por_sessao: '0', musicas_previstas: '0', roles: [] }]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="hidden sm:block">
          <h1 className="text-2xl sm:text-3xl font-display font-bold flex items-center gap-2">
            <Book className="h-8 w-8 text-primary" />
            Wiki / Base de Conhecimento
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestão de projetos, estabelecimentos, turmas, disciplinas e atividades.
          </p>
        </div>
        {/* Info cards toggle */}
        <Collapsible open={showInfoCards} onOpenChange={setShowInfoCards}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground shrink-0 mt-1">
              <HelpCircle className="h-4 w-4" />
              Ajuda
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showInfoCards ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid gap-4 md:grid-cols-2 mt-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Layers className="h-4 w-4 text-blue-500" />
                    Contexto e Hierarquia
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <div className="bg-muted p-3 rounded-md space-y-2 font-mono text-xs">
                    <div className="flex items-center gap-2"><Badge variant="default" className="text-xs">PROJETO</Badge><span>contém</span></div>
                    <div className="flex items-center gap-2 pl-4"><span className="text-muted-foreground">↳</span><Badge variant="secondary" className="text-xs">ESTABELECIMENTOS</Badge><span>que contêm</span></div>
                    <div className="flex items-center gap-2 pl-8"><span className="text-muted-foreground">↳</span><Badge variant="outline" className="text-xs">TURMAS</Badge><span>que têm</span></div>
                    <div className="flex items-center gap-2 pl-12"><span className="text-muted-foreground">↳</span><Badge variant="outline" className="border-primary text-primary text-xs">DISCIPLINAS</Badge><span>compostas por</span></div>
                    <div className="flex items-center gap-2 pl-16"><span className="text-muted-foreground">↳</span><Badge variant="destructive" className="text-xs">ATIVIDADES (UUID)</Badge></div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-green-500" />
                    Conceito de "Sessão"
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <ul className="list-disc pl-4 space-y-1.5 text-muted-foreground">
                    <li>Ocorre numa <strong className="text-foreground">Turma</strong> específica.</li>
                    <li>Corresponde a uma <strong className="text-foreground">Atividade</strong> local da turma (UUID).</li>
                    <li>Tem um <strong className="text-foreground">Mentor</strong> cujo perfil está incluído nos <code>roles</code> da atividade.</li>
                    <li>Cada turma tem as suas próprias disciplinas e atividades (modelo local).</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Seletor de Projeto */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Projeto
            </CardTitle>
            <CardDescription>
              Seleciona um projeto para ver a sua hierarquia.
            </CardDescription>
          </div>
          {isCoordinator && (
            <Button size="sm" className="gap-2" onClick={() => {
              setEditingProjeto(null);
              setProjetoForm({ nome: '', descricao: '' });
              setIsProjetoDialogOpen(true);
            }}>
              <Plus className="h-4 w-4" />
              Novo Projeto
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 flex-wrap">
            <Select
              value={selectedProjetoId ? String(selectedProjetoId) : undefined}
              onValueChange={(v) => setSelectedProjetoId(Number(v))}
            >
              <SelectTrigger className="w-full sm:w-[300px]">
                <SelectValue placeholder="Selecionar projeto..." />
              </SelectTrigger>
              <SelectContent>
                {projetos.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProjetoId && isCoordinator && (
              <>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                  const p = projetos.find(x => x.id === selectedProjetoId);
                  if (p) {
                    setEditingProjeto(p);
                    setProjetoForm({ nome: p.nome, descricao: p.descricao || '' });
                    setIsProjetoDialogOpen(true);
                  }
                }}>
                  <Edit2 className="h-3.5 w-3.5" /> Editar
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => {
                  askConfirm(
                    'Apagar projeto?',
                    `O projeto "${selectedProjeto?.nome}" será permanentemente apagado.`,
                    () => deleteProjetoMutation.mutate(selectedProjetoId)
                  );
                }}>
                  <Trash2 className="h-3.5 w-3.5" /> Apagar
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* HIERARQUIA UNIFICADA */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-500" />
              {selectedProjeto
                ? `Hierarquia — ${selectedProjeto.nome}`
                : 'Estabelecimentos, Turmas e Atividades'}
            </CardTitle>
            <CardDescription>
              Hierarquia completa do projeto selecionado.
            </CardDescription>
          </div>
          {isCoordinator && (
            <div className="flex items-center gap-2 flex-wrap">
              {selectedProjetoId && unlinkedEstabs.length > 0 && (
                <div className="flex items-center gap-2">
                  <Select value={addEstabToProjetoId} onValueChange={setAddEstabToProjetoId}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="Associar estabelecimento..." />
                    </SelectTrigger>
                    <SelectContent>
                      {unlinkedEstabs.map((e) => (
                        <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" disabled={!addEstabToProjetoId} onClick={() => assocEstabMutation.mutate(Number(addEstabToProjetoId))}>
                    Associar
                  </Button>
                </div>
              )}
              <Button onClick={openNewEstab} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Estabelecimento
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {!selectedProjetoId ? (
            <p className="text-sm text-muted-foreground italic py-4 text-center">
              Seleciona um projeto acima para ver a hierarquia completa.
            </p>
          ) : hierarquiaError ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              <p className="text-sm font-medium text-destructive">Erro ao carregar hierarquia.</p>
              <p className="text-xs">Verifica a ligação e tenta novamente.</p>
            </div>
          ) : hierarquiaLoading ? (
            <div className="space-y-3 py-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-5 w-1/3 rounded bg-muted animate-pulse" />
                  <div className="ml-4 space-y-1.5">
                    <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
                    <div className="h-4 w-2/5 rounded bg-muted animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : wikiHierarquia.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <Building2 className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">Nenhum estabelecimento associado ao projeto.</p>
              {isCoordinator && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={openNewEstab}>
                  <Plus className="h-3.5 w-3.5" /> Adicionar Estabelecimento
                </Button>
              )}
            </div>
          ) : (
            <Accordion type="multiple" className="w-full space-y-2">
              {wikiHierarquia.map((estab) => (
                <AccordionItem key={`est-${estab.id}`} value={`est-${estab.id}`} className="border rounded-lg px-3 border-b">
                  {/* Nome — linha 1 */}
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-medium text-left">{estab.nome}</span>
                    </div>
                  </AccordionTrigger>
                  {/* Badges + ações — linha 2 */}
                  <div className="flex items-center gap-2 pb-3 flex-wrap -mt-1">
                    {estab.sigla && <Badge variant="secondary" className="text-xs">{estab.sigla}</Badge>}
                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{estab.turmas.length} turmas</span>
                    {isCoordinator && (
                      <div className="flex gap-1 ml-auto">
                        <Button size="sm" variant="outline" className="gap-1 h-7 px-2 text-xs" onClick={() => {
                          const e = estabelecimentos.find(x => x.id === estab.id);
                          if (e) openEditEstab(e);
                        }}>
                          <Edit2 className="h-3 w-3" /> Editar
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 h-7 px-2 text-xs" onClick={() => openNewTurma(estab.id)}>
                          <Plus className="h-3 w-3" /> Nova Turma
                        </Button>
                      </div>
                    )}
                  </div>
                  <AccordionContent>
                    <div className="space-y-2 pb-2">
                      {estab.turmas.length === 0 ? (
                        <div className="py-3 flex items-center gap-3">
                          <p className="text-sm text-muted-foreground italic">Nenhuma turma registada.</p>
                          {isCoordinator && (
                            <Button size="sm" variant="outline" className="gap-1 h-7 px-2 text-xs" onClick={() => openNewTurma(estab.id)}>
                              <Plus className="h-3 w-3" /> Nova Turma
                            </Button>
                          )}
                        </div>
                      ) : (
                        <Accordion type="multiple" className="w-full space-y-1.5">
                          {estab.turmas.map((turma) => (
                            <AccordionItem key={`turma-${turma.id}`} value={`turma-${turma.id}`} className="border rounded-md px-3 border-b bg-muted/20">
                              {/* Nome — linha 1 */}
                              <AccordionTrigger className="hover:no-underline py-2.5">
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <span className="font-medium text-left text-sm">{turma.nome}</span>
                                </div>
                              </AccordionTrigger>
                              {/* Badges + ações — linha 2 */}
                              <div className="flex items-center gap-2 pb-2.5 flex-wrap -mt-1">
                                <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{turma.disciplinas.length} disciplinas</span>
                                {isCoordinator && (
                                  <div className="flex gap-1 ml-auto">
                                    <Button size="sm" variant="outline" className="gap-1 h-6 px-2 text-xs" onClick={() => openEditTurma(turma, estab.id)}>
                                      <Edit2 className="h-3 w-3" /> Editar
                                    </Button>
                                    <Button size="sm" variant="outline" className="gap-1 h-6 px-2 text-xs" onClick={() => openNewDisciplina(turma.id)}>
                                      <Plus className="h-3 w-3" /> Nova Disciplina
                                    </Button>
                                  </div>
                                )}
                              </div>
                              <AccordionContent>
                                <div className="space-y-1.5 pb-2">
                                  {turma.disciplinas.length === 0 ? (
                                    <div className="py-3 flex items-center gap-3">
                                      <p className="text-sm text-muted-foreground italic">Nenhuma disciplina atribuída.</p>
                                      {isCoordinator && (
                                        <Button size="sm" variant="outline" className="gap-1 h-7 px-2 text-xs" onClick={() => openNewDisciplina(turma.id)}>
                                          <Plus className="h-3 w-3" /> Nova Disciplina
                                        </Button>
                                      )}
                                    </div>
                                  ) : (
                                    <Accordion type="multiple" className="w-full space-y-1">
                                      {turma.disciplinas.map((disc) => (
                                        <AccordionItem key={`disc-${disc.id}`} value={`disc-${disc.id}`} className="border rounded-md px-3 border-b bg-muted/10">
                                          {/* Nome — linha 1 */}
                                          <AccordionTrigger className="hover:no-underline py-2">
                                            <div className="flex items-center gap-2">
                                              <Book className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                                              <span className="font-medium text-left text-sm">{disc.nome}</span>
                                            </div>
                                          </AccordionTrigger>
                                          {/* Badges + ações — linha 2 */}
                                          <div className="flex items-center gap-2 pb-2 flex-wrap -mt-1">
                                            {disc.musicas_previstas > 0 && (
                                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Music className="h-3 w-3" /> {disc.musicas_previstas} músicas
                                              </span>
                                            )}
                                            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{disc.atividades.length} atividades</span>
                                            {isCoordinator && (
                                              <div className="flex gap-1 ml-auto">
                                                <Button size="sm" variant="outline" className="gap-1 h-6 px-2 text-xs" onClick={() => openEditDisciplina(disc)}>
                                                  <Edit2 className="h-3 w-3" /> Editar
                                                </Button>
                                                <Button size="sm" variant="outline" className="gap-1 h-6 px-2 text-xs" onClick={() => openNewAtividade(disc.id)}>
                                                  <Plus className="h-3 w-3" /> Nova Atividade
                                                </Button>
                                              </div>
                                            )}
                                          </div>
                                          <AccordionContent>
                                            <div className="border-l-2 border-purple-400/25 pl-4 ml-2">
                                              {disc.atividades.length === 0 ? (
                                                <div className="py-3 flex items-center gap-3">
                                                  <p className="text-sm text-muted-foreground italic">Nenhuma atividade.</p>
                                                  {isCoordinator && (
                                                    <Button size="sm" variant="outline" className="gap-1 h-7 px-2 text-xs" onClick={() => openNewAtividade(disc.id)}>
                                                      <Plus className="h-3 w-3" /> Nova Atividade
                                                    </Button>
                                                  )}
                                                </div>
                                              ) : (
                                                <div className="overflow-x-auto">
                                                <Table>
                                                  <TableHeader>
                                                    <TableRow>
                                                      <TableHead>Código</TableHead>
                                                      <TableHead>Atividade</TableHead>
                                                      <TableHead className="text-center">Sessões Prev.</TableHead>
                                                      <TableHead className="text-center">H/Sessão</TableHead>
                                                      <TableHead className="text-center">Músicas</TableHead>
                                                      <TableHead>Roles</TableHead>
                                                      <TableHead>Progresso</TableHead>
                                                      {isCoordinator && <TableHead className="text-right">Ações</TableHead>}
                                                    </TableRow>
                                                  </TableHeader>
                                                  <TableBody>
                                                    {disc.atividades.map((ativ) => {
                                                      const sessRealizadas = ativ.sessoes_realizadas ?? 0;
                                                      const sessPrevistas = ativ.sessoes_previstas || 0;
                                                      const progressPct = sessPrevistas > 0
                                                        ? Math.min(100, Math.round((sessRealizadas / sessPrevistas) * 100))
                                                        : 0;
                                                      return (
                                                        <TableRow key={ativ.uuid}>
                                                          <TableCell className="font-mono font-bold text-xs">{ativ.codigo || '—'}</TableCell>
                                                          <TableCell>{ativ.nome}</TableCell>
                                                          <TableCell className="text-center">{ativ.sessoes_previstas || '—'}</TableCell>
                                                          <TableCell className="text-center">{ativ.horas_por_sessao || '—'}</TableCell>
                                                          <TableCell className="text-center">{ativ.musicas_previstas || '—'}</TableCell>
                                                          <TableCell>
                                                            <div className="flex flex-wrap gap-1">
                                                              {ativ.roles && ativ.roles.length > 0
                                                                ? ativ.roles.map(r => <Badge key={r} variant="outline" className="text-xs">{r}</Badge>)
                                                                : <span className="text-muted-foreground text-xs">todos</span>
                                                              }
                                                              {ativ.is_autonomous && (
                                                                <Badge variant="secondary" className="text-xs">TA</Badge>
                                                              )}
                                                            </div>
                                                          </TableCell>
                                                          <TableCell>
                                                            <div className="space-y-1 min-w-[110px]">
                                                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                                <span className="flex items-center gap-1">
                                                                  <Calendar className="h-3 w-3" />
                                                                  {sessRealizadas}/{sessPrevistas || '?'}
                                                                </span>
                                                                <span className="flex items-center gap-1">
                                                                  <Clock className="h-3 w-3" />
                                                                  {ativ.horas_realizadas ?? 0}h
                                                                </span>
                                                              </div>
                                                              {sessPrevistas > 0 && (
                                                                <Progress value={progressPct} className="h-1.5" />
                                                              )}
                                                            </div>
                                                          </TableCell>
                                                          {isCoordinator && (
                                                            <TableCell className="text-right">
                                                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditAtividade(ativ)}>
                                                                <Edit2 className="h-3 w-3 text-blue-500" />
                                                              </Button>
                                                            </TableCell>
                                                          )}
                                                        </TableRow>
                                                      );
                                                    })}
                                                  </TableBody>
                                                </Table>
                                                </div>
                                              )}
                                            </div>
                                          </AccordionContent>
                                        </AccordionItem>
                                      ))}
                                    </Accordion>
                                  )}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* DIALOG FOR PROJETOS */}
      <Dialog open={isProjetoDialogOpen} onOpenChange={setIsProjetoDialogOpen}>
        <DialogContent className="w-full max-w-lg max-h-[95dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProjeto ? 'Editar Projeto' : 'Novo Projeto'}</DialogTitle>
            <DialogDescription>
              {editingProjeto ? 'Alterar dados do projeto.' : 'Criar um novo projeto.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="proj-nome">Nome</Label>
              <Input
                id="proj-nome"
                value={projetoForm.nome}
                onChange={(e) => setProjetoForm({ ...projetoForm, nome: e.target.value })}
                placeholder="Ex: PIS, Gulbenkian 70 anos"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="proj-desc">Descrição</Label>
              <Input
                id="proj-desc"
                value={projetoForm.descricao}
                onChange={(e) => setProjetoForm({ ...projetoForm, descricao: e.target.value })}
                placeholder="Descrição opcional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProjetoDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveProjetoMutation.mutate(projetoForm)} disabled={!projetoForm.nome}>
              <Save className="h-4 w-4 mr-2" />
              {editingProjeto ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG FOR ESTABELECIMENTOS */}
      <Dialog open={isEstabDialogOpen} onOpenChange={setIsEstabDialogOpen}>
        <DialogContent className="w-full max-w-lg max-h-[95dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEstab ? 'Editar Estabelecimento' : 'Novo Estabelecimento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="inst-sigla">Sigla</Label>
              <Input id="inst-sigla" value={estabForm.sigla} onChange={(e) => setEstabForm({ ...estabForm, sigla: e.target.value })} placeholder="EX: EPL" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inst-nome">Nome</Label>
              <Input id="inst-nome" value={estabForm.nome} onChange={(e) => setEstabForm({ ...estabForm, nome: e.target.value })} placeholder="Nome completo" />
            </div>
            <div className="grid gap-2">
              <Label>Morada</Label>
              <AddressAutocomplete
                value={estabForm.morada}
                onSelect={(r) => setEstabForm({ ...estabForm, morada: r.display_name, latitude: r.lat, longitude: r.lon })}
                placeholder="Pesquisar morada..."
              />
            </div>
          </div>
          <DialogFooter className="flex sm:justify-between w-full">
            {editingEstab ? (
              <div className="flex gap-2">
                {selectedProjetoId && (
                  <Button variant="outline" onClick={() => {
                    askConfirm(
                      'Desassociar estabelecimento?',
                      `"${editingEstab.nome}" será removido deste projeto, mas não apagado da base de dados.`,
                      () => desassocEstabMutation.mutate(editingEstab.id)
                    );
                  }}>
                    <Link2Off className="h-4 w-4 mr-2" /> Desassociar
                  </Button>
                )}
                <Button variant="destructive" onClick={() => {
                  askConfirm(
                    'Apagar estabelecimento?',
                    `"${editingEstab.nome}" será permanentemente apagado, incluindo as suas turmas.`,
                    () => deleteEstabMutation.mutate(editingEstab.id)
                  );
                }}>
                  <Trash2 className="h-4 w-4 mr-2" /> Apagar
                </Button>
              </div>
            ) : <div />}
            <Button onClick={() => saveEstabMutation.mutate(estabForm)}>
              <Save className="h-4 w-4 mr-2" /> Gravar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG FOR TURMAS */}
      <Dialog open={isTurmaDialogOpen} onOpenChange={setIsTurmaDialogOpen}>
        <DialogContent className="w-full max-w-lg max-h-[95dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTurma ? 'Editar Turma' : 'Nova Turma'}</DialogTitle>
            <DialogDescription>
              {editingTurma ? 'Alterar dados da turma.' : 'Criar nova turma num estabelecimento.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Estabelecimento</Label>
              <Select value={selectedEstabId} onValueChange={setSelectedEstabId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o estabelecimento" />
                </SelectTrigger>
                <SelectContent>
                  {estabelecimentos.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id.toString()}>{inst.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="turma-name">Nome da Turma</Label>
              <Input id="turma-name" placeholder="Ex: 12.º B" value={newTurmaName} onChange={(e) => setNewTurmaName(e.target.value)} />
            </div>
            {/* Lista de Alunos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-medium">Alunos</Label>
                <Button variant="outline" size="sm" type="button" onClick={() => setAlunosNomes(prev => [...prev, ''])}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                </Button>
              </div>
              {alunosNomes.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum aluno registado.</p>
              )}
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {alunosNomes.map((nome, i) => (
                  <div key={i} className="flex gap-2">
                    <Input placeholder={`Aluno ${i + 1}`} value={nome} onChange={e => {
                      const updated = [...alunosNomes];
                      updated[i] = e.target.value;
                      setAlunosNomes(updated);
                    }} className="text-sm" />
                    <Button variant="ghost" size="icon" type="button" onClick={() => setAlunosNomes(prev => prev.filter((_, idx) => idx !== i))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex sm:justify-between w-full">
            {editingTurma ? (
              <Button variant="destructive" onClick={() => {
                askConfirm(
                  'Apagar turma?',
                  `A turma "${editingTurma.nome}" e todas as suas disciplinas e atividades serão permanentemente apagadas.`,
                  () => deleteTurmaMutation.mutate(editingTurma.id)
                );
              }}>
                <Trash2 className="h-4 w-4 mr-2" /> Apagar
              </Button>
            ) : <div />}
            <Button onClick={handleSaveTurma}>Gravar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG FOR LOCAL DISCIPLINA */}
      <Dialog open={isDisciplinaDialogOpen} onOpenChange={setIsDisciplinaDialogOpen}>
        <DialogContent className="w-full max-w-2xl max-h-[95dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDisciplina ? 'Editar Disciplina' : 'Nova Disciplina'}</DialogTitle>
            <DialogDescription>
              {editingDisciplina ? 'Alterar dados da disciplina local.' : 'Criar disciplina local para esta turma.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Nome da Disciplina</Label>
                <Input value={discForm.nome} onChange={(e) => setDiscForm({ ...discForm, nome: e.target.value })} placeholder="Ex: Clube de RAP" />
              </div>
              <div className="grid gap-2">
                <Label>Músicas Previstas</Label>
                <Input type="number" min={0} value={discForm.musicas_previstas} onChange={(e) => setDiscForm({ ...discForm, musicas_previstas: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={discForm.descricao}
                onChange={(e) => setDiscForm({ ...discForm, descricao: e.target.value })}
                placeholder="Breve descrição"
                className="resize-none"
                rows={2}
              />
            </div>
            {/* Batch atividades (só para nova disciplina) */}
            {!editingDisciplina && (
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">Atividades (batch)</Label>
                  <Button variant="outline" size="sm" type="button" onClick={addBatchAtividade}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Atividade
                  </Button>
                </div>
                {batchAtividades.length === 0 && (
                  <p className="text-sm text-muted-foreground">Pode adicionar atividades agora ou mais tarde.</p>
                )}
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {batchAtividades.map((a, i) => (
                    <div key={i} className="border rounded-md p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Atividade {i + 1}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setBatchAtividades(prev => prev.filter((_, idx) => idx !== i))}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <Input placeholder="Nome" value={a.nome} onChange={e => {
                          const up = [...batchAtividades]; up[i] = { ...up[i], nome: e.target.value }; setBatchAtividades(up);
                        }} />
                        <Select value={a.codigo || 'none'} onValueChange={v => { const up = [...batchAtividades]; up[i] = { ...up[i], codigo: v === 'none' ? '' : v }; setBatchAtividades(up); }}>
                          <SelectTrigger><SelectValue placeholder="Código" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— Sem código —</SelectItem>
                            {CODIGOS_ATIVIDADE.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
                        <div>
                          <Label className="text-xs">Sessões</Label>
                          <Input type="number" min={0} value={a.sessoes_previstas} onChange={e => {
                            const up = [...batchAtividades]; up[i] = { ...up[i], sessoes_previstas: e.target.value }; setBatchAtividades(up);
                          }} />
                        </div>
                        <div>
                          <Label className="text-xs">H/Sessão</Label>
                          <Input type="number" min={0} step={0.5} value={a.horas_por_sessao} onChange={e => {
                            const up = [...batchAtividades]; up[i] = { ...up[i], horas_por_sessao: e.target.value }; setBatchAtividades(up);
                          }} />
                        </div>
                        <div>
                          <Label className="text-xs">Músicas</Label>
                          <Input type="number" min={0} value={a.musicas_previstas} onChange={e => {
                            const up = [...batchAtividades]; up[i] = { ...up[i], musicas_previstas: e.target.value }; setBatchAtividades(up);
                          }} />
                        </div>
                        <div className="md:col-span-4">
                          <Label className="text-xs">Associar a</Label>
                          <div className="flex flex-wrap gap-3 mt-1">
                            {ALL_ROLES.map(role => (
                              <label key={role} className="flex items-center gap-1.5 text-xs cursor-pointer">
                                <Checkbox
                                  checked={a.roles.includes(role)}
                                  onCheckedChange={(checked) => {
                                    const up = [...batchAtividades];
                                    up[i] = { ...up[i], roles: checked ? [...a.roles, role] : a.roles.filter(r => r !== role) };
                                    setBatchAtividades(up);
                                  }}
                                />
                                {role}
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex sm:justify-between w-full">
            {editingDisciplina ? (
              <Button variant="destructive" onClick={() => {
                askConfirm(
                  'Apagar disciplina?',
                  `"${editingDisciplina.nome}" e todas as suas atividades serão permanentemente apagadas.`,
                  () => deleteDisciplinaMutation.mutate(editingDisciplina.id)
                );
              }}>
                <Trash2 className="h-4 w-4 mr-2" /> Apagar
              </Button>
            ) : <div />}
            <Button onClick={handleSaveDisciplina} disabled={!discForm.nome}>
              <Save className="h-4 w-4 mr-2" /> Gravar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG FOR LOCAL ATIVIDADE */}
      <Dialog open={isAtividadeDialogOpen} onOpenChange={setIsAtividadeDialogOpen}>
        <DialogContent className="w-full max-w-2xl max-h-[95dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAtividade ? 'Editar Atividade' : 'Nova Atividade'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Código</Label>
              <Select value={ativForm.codigo || 'none'} onValueChange={(v) => setAtivForm({ ...ativForm, codigo: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar código" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem código —</SelectItem>
                  {CODIGOS_ATIVIDADE.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Nome da Atividade</Label>
              <Input value={ativForm.nome} onChange={(e) => setAtivForm({ ...ativForm, nome: e.target.value })} placeholder="Nome descritivo" />
            </div>
            <div className="grid gap-2">
              <Label>Sessões Previstas</Label>
              <Input type="number" min={0} value={ativForm.sessoes_previstas} onChange={(e) => setAtivForm({ ...ativForm, sessoes_previstas: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Horas por Sessão</Label>
              <Input type="number" min={0} step={0.5} value={ativForm.horas_por_sessao} onChange={(e) => setAtivForm({ ...ativForm, horas_por_sessao: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Músicas Previstas</Label>
              <Input type="number" min={0} value={ativForm.musicas_previstas} onChange={(e) => setAtivForm({ ...ativForm, musicas_previstas: e.target.value })} />
            </div>
            <div className="md:col-span-2 grid gap-2">
              <Label>Associar a</Label>
              <div className="flex flex-wrap gap-4">
                {ALL_ROLES.map(role => (
                  <label key={role} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={ativForm.roles.includes(role)}
                      onCheckedChange={(checked) => setAtivForm({
                        ...ativForm,
                        roles: checked ? [...ativForm.roles, role] : ativForm.roles.filter(r => r !== role)
                      })}
                    />
                    {role}
                  </label>
                ))}
              </div>
            </div>
            <div className="md:col-span-2 flex items-center gap-3 rounded-md border p-3 bg-muted/30">
              <Checkbox
                id="ativ-autonomous"
                checked={ativForm.is_autonomous}
                onCheckedChange={(checked) => setAtivForm({ ...ativForm, is_autonomous: !!checked })}
              />
              <div>
                <Label htmlFor="ativ-autonomous" className="cursor-pointer font-medium">Trabalho Autónomo</Label>
                <p className="text-xs text-muted-foreground">Esta atividade aparece no separador "Trabalho Autónomo" em /Horários</p>
              </div>
            </div>
          </div>
          <DialogFooter className="flex sm:justify-between w-full">
            {editingAtividade ? (
              <Button variant="destructive" onClick={() => {
                askConfirm(
                  'Apagar atividade?',
                  `"${editingAtividade.nome}" será permanentemente apagada.`,
                  () => deleteAtividadeMutation.mutate(editingAtividade.uuid)
                );
              }}>
                <Trash2 className="h-4 w-4 mr-2" /> Apagar
              </Button>
            ) : <div />}
            <Button onClick={handleSaveAtividade} disabled={!ativForm.nome}>
              <Save className="h-4 w-4 mr-2" /> Gravar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SHARED CONFIRM DIALOG */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                confirmDialog.onConfirm();
                setConfirmDialog(prev => ({ ...prev, open: false }));
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Wiki;
