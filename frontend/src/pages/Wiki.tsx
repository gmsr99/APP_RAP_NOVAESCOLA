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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from "@/components/ui/badge";
import {
  Book, Layers, Calendar, Edit2, Plus, Trash2, Save, Users, Building2, X, Music, Clock
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
  perfil_mentor: string;
  sessoes_realizadas?: number;
  horas_realizadas?: number;
}

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
    nome: string; codigo: string; sessoes_previstas: string; horas_por_sessao: string; musicas_previstas: string; perfil_mentor: string;
  }>>([]);

  // State for Local Atividade dialog
  const [isAtividadeDialogOpen, setIsAtividadeDialogOpen] = useState(false);
  const [editingAtividade, setEditingAtividade] = useState<TurmaAtividade | null>(null);
  const [atividadeTargetDiscId, setAtividadeTargetDiscId] = useState<number | null>(null);
  const [ativForm, setAtivForm] = useState({
    nome: '', codigo: '', sessoes_previstas: '0', horas_por_sessao: '0', musicas_previstas: '0', perfil_mentor: ''
  });

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

  // Wiki hierarchy: Estabelecimentos > Turmas > Disciplinas > Atividades (local)
  const { data: wikiHierarquia = [] } = useQuery({
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
        perfil_mentor: a.perfil_mentor || null,
      }));
    }
    saveDisciplinaMutation.mutate(payload);
  };

  const openNewAtividade = (discId: number) => {
    setEditingAtividade(null);
    setAtividadeTargetDiscId(discId);
    setAtivForm({ nome: '', codigo: '', sessoes_previstas: '0', horas_por_sessao: '0', musicas_previstas: '0', perfil_mentor: '' });
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
      perfil_mentor: ativ.perfil_mentor || '',
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
      perfil_mentor: ativForm.perfil_mentor || null,
    });
  };

  const addBatchAtividade = () => {
    setBatchAtividades(prev => [...prev, { nome: '', codigo: '', sessoes_previstas: '0', horas_por_sessao: '0', musicas_previstas: '0', perfil_mentor: '' }]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold flex items-center gap-2">
          <Book className="h-8 w-8 text-primary" />
          Wiki / Base de Conhecimento
        </h1>
        <p className="text-muted-foreground mt-1">
          Gestão de projetos, estabelecimentos, turmas, disciplinas e atividades.
        </p>
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
          <div className="flex items-center gap-3">
            <Select
              value={selectedProjetoId ? String(selectedProjetoId) : undefined}
              onValueChange={(v) => setSelectedProjetoId(Number(v))}
            >
              <SelectTrigger className="w-[300px]">
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
                <Button variant="ghost" size="icon" onClick={() => {
                  const p = projetos.find(x => x.id === selectedProjetoId);
                  if (p) {
                    setEditingProjeto(p);
                    setProjetoForm({ nome: p.nome, descricao: p.descricao || '' });
                    setIsProjetoDialogOpen(true);
                  }
                }}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
                  if (confirm('Apagar este projeto?')) {
                    deleteProjetoMutation.mutate(selectedProjetoId);
                  }
                }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-500" />
              Contexto e Hierarquia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              A estrutura lógica segue uma hierarquia por turma:
            </p>
            <div className="bg-muted p-4 rounded-md space-y-2 font-mono text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="default">PROJETO</Badge>
                <span>contém</span>
              </div>
              <div className="flex items-center gap-2 pl-4">
                <span className="text-muted-foreground">&#8627;</span>
                <Badge variant="secondary">ESTABELECIMENTOS</Badge>
                <span>que contêm</span>
              </div>
              <div className="flex items-center gap-2 pl-8">
                <span className="text-muted-foreground">&#8627;</span>
                <Badge variant="outline">TURMAS</Badge>
                <span>que têm</span>
              </div>
              <div className="flex items-center gap-2 pl-12">
                <span className="text-muted-foreground">&#8627;</span>
                <Badge variant="outline" className="border-primary text-primary">DISCIPLINAS (locais)</Badge>
                <span>compostas por</span>
              </div>
              <div className="flex items-center gap-2 pl-16">
                <span className="text-muted-foreground">&#8627;</span>
                <Badge variant="destructive">ATIVIDADES (UUID)</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-green-500" />
              Conceito de "Sessão"
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              A unidade fundamental de agendamento é a <strong>SESSÃO</strong>.
            </p>
            <ul className="list-disc pl-4 space-y-2">
              <li>Ocorre numa <strong>Turma</strong> específica.</li>
              <li>Corresponde a uma <strong>Atividade</strong> local da turma (UUID).</li>
              <li>Tem um <strong>Mentor</strong> associado cujo perfil corresponde ao <code>perfil_mentor</code> da atividade.</li>
              <li>Cada turma tem as suas próprias disciplinas e atividades (modelo local).</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* HIERARQUIA UNIFICADA: Estabelecimentos > Turmas > Disciplinas > Atividades */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-500" />
              Estabelecimentos, Turmas e Atividades
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
                    <SelectTrigger className="w-[200px]">
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
          ) : wikiHierarquia.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Nenhum estabelecimento associado ao projeto.</p>
          ) : (
            <Accordion type="multiple" className="w-full">
              {wikiHierarquia.map((estab) => (
                <AccordionItem key={`est-${estab.id}`} value={`est-${estab.id}`}>
                  <div className="flex items-center">
                    <AccordionTrigger className="hover:no-underline flex-1">
                      <div className="flex items-center gap-3">
                        <Building2 className="h-4 w-4 text-primary" />
                        <span className="font-medium text-lg">{estab.nome}</span>
                        {estab.sigla && <Badge variant="secondary" className="text-xs">{estab.sigla}</Badge>}
                        <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                          {estab.turmas.length} turmas
                        </span>
                      </div>
                    </AccordionTrigger>
                    {isCoordinator && (
                      <div className="flex items-center gap-1 ml-1 shrink-0">
                        <Button size="sm" variant="outline" className="gap-1 h-7 px-2 text-xs" onClick={() => {
                          const e = estabelecimentos.find(x => x.id === estab.id);
                          if (e) openEditEstab(e);
                        }}>
                          <Edit2 className="h-3 w-3" /> Editar Estabelecimento
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 h-7 px-2 text-xs" onClick={() => openNewTurma(estab.id)}>
                          <Plus className="h-3 w-3" /> Nova Turma
                        </Button>
                      </div>
                    )}
                  </div>
                  <AccordionContent>
                      <div className="pl-4 space-y-2">
                        {estab.turmas.length === 0 ? (
                          <p className="text-sm text-muted-foreground italic py-2">Nenhuma turma registada.</p>
                        ) : (
                          <Accordion type="multiple" className="w-full">
                            {estab.turmas.map((turma) => (
                              <AccordionItem key={`turma-${turma.id}`} value={`turma-${turma.id}`}>
                                <div className="flex items-center">
                                  <AccordionTrigger className="hover:no-underline flex-1">
                                    <div className="flex items-center gap-3">
                                      <Users className="h-4 w-4 text-muted-foreground" />
                                      <span className="font-medium">{turma.nome}</span>
                                      <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                                        {turma.disciplinas.length} disciplinas
                                      </span>
                                    </div>
                                  </AccordionTrigger>
                                  {isCoordinator && (
                                    <div className="flex items-center gap-1 ml-1 shrink-0">
                                      <Button size="sm" variant="outline" className="gap-1 h-7 px-2 text-xs" onClick={() => openEditTurma(turma, estab.id)}>
                                        <Edit2 className="h-3 w-3" /> Editar Turma
                                      </Button>
                                      <Button size="sm" variant="outline" className="gap-1 h-7 px-2 text-xs" onClick={() => openNewDisciplina(turma.id)}>
                                        <Plus className="h-3 w-3" /> Nova Disciplina
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                <AccordionContent>
                                  <div className="pl-4 space-y-3">
                                    {/* Disciplinas da turma */}
                                    {turma.disciplinas.length === 0 ? (
                                      <p className="text-sm text-muted-foreground italic">Nenhuma disciplina atribuída.</p>
                                    ) : (
                                      <Accordion type="multiple" className="w-full">
                                        {turma.disciplinas.map((disc) => (
                                          <AccordionItem key={`disc-${disc.id}`} value={`disc-${disc.id}`}>
                                            <div className="flex items-center">
                                              <AccordionTrigger className="hover:no-underline py-2 flex-1">
                                                <div className="flex items-center gap-2">
                                                  <Book className="h-4 w-4 text-purple-500" />
                                                  <span className="font-medium">{disc.nome}</span>
                                                  {disc.musicas_previstas > 0 && (
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                      <Music className="h-3 w-3" /> {disc.musicas_previstas}
                                                    </span>
                                                  )}
                                                  <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                                                    {disc.atividades.length} atividades
                                                  </span>
                                                </div>
                                              </AccordionTrigger>
                                              {isCoordinator && (
                                                <div className="flex items-center gap-1 ml-1 shrink-0">
                                                  <Button size="sm" variant="outline" className="gap-1 h-6 px-2 text-xs" onClick={() => openEditDisciplina(disc)}>
                                                    <Edit2 className="h-3 w-3" /> Editar Disciplina
                                                  </Button>
                                                  <Button size="sm" variant="outline" className="gap-1 h-6 px-2 text-xs" onClick={() => openNewAtividade(disc.id)}>
                                                    <Plus className="h-3 w-3" /> Nova Atividade
                                                  </Button>
                                                </div>
                                              )}
                                            </div>
                                            <AccordionContent>
                                              <div className="pl-2">
                                                {disc.atividades.length === 0 ? (
                                                  <p className="text-sm text-muted-foreground italic">Nenhuma atividade.</p>
                                                ) : (
                                                  <Table>
                                                    <TableHeader>
                                                      <TableRow>
                                                        <TableHead>Código</TableHead>
                                                        <TableHead>Atividade</TableHead>
                                                        <TableHead className="text-center">Sessões Prev.</TableHead>
                                                        <TableHead className="text-center">H/Sessão</TableHead>
                                                        <TableHead className="text-center">Músicas</TableHead>
                                                        <TableHead>Perfil</TableHead>
                                                        <TableHead className="text-center">Realizadas</TableHead>
                                                        {isCoordinator && <TableHead className="text-right">Ações</TableHead>}
                                                      </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                      {disc.atividades.map((ativ) => (
                                                        <TableRow key={ativ.uuid}>
                                                          <TableCell className="font-mono font-bold text-xs">{ativ.codigo || '—'}</TableCell>
                                                          <TableCell>{ativ.nome}</TableCell>
                                                          <TableCell className="text-center">{ativ.sessoes_previstas || '—'}</TableCell>
                                                          <TableCell className="text-center">{ativ.horas_por_sessao || '—'}</TableCell>
                                                          <TableCell className="text-center">{ativ.musicas_previstas || '—'}</TableCell>
                                                          <TableCell>
                                                            {ativ.perfil_mentor ? (
                                                              <Badge variant="outline">{ativ.perfil_mentor}</Badge>
                                                            ) : '—'}
                                                          </TableCell>
                                                          <TableCell className="text-center">
                                                            <div className="flex items-center justify-center gap-2 text-xs">
                                                              <span className="flex items-center gap-1" title="Sessões realizadas">
                                                                <Calendar className="h-3 w-3" />
                                                                {ativ.sessoes_realizadas ?? 0}/{ativ.sessoes_previstas || '?'}
                                                              </span>
                                                              <span className="flex items-center gap-1" title="Horas realizadas">
                                                                <Clock className="h-3 w-3" />
                                                                {ativ.horas_realizadas ?? 0}h
                                                              </span>
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
                                                      ))}
                                                    </TableBody>
                                                  </Table>
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
        <DialogContent>
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
        <DialogContent>
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
              <Button variant="destructive" onClick={() => {
                if (confirm('Apagar este estabelecimento?')) {
                  deleteEstabMutation.mutate(editingEstab.id);
                  setIsEstabDialogOpen(false);
                }
              }}>
                <Trash2 className="h-4 w-4 mr-2" /> Apagar
              </Button>
            ) : <div />}
            <Button onClick={() => saveEstabMutation.mutate(estabForm)}>
              <Save className="h-4 w-4 mr-2" /> Gravar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG FOR TURMAS */}
      <Dialog open={isTurmaDialogOpen} onOpenChange={setIsTurmaDialogOpen}>
        <DialogContent>
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
                if (confirm('Apagar esta turma?')) {
                  deleteTurmaMutation.mutate(editingTurma.id);
                  setIsTurmaDialogOpen(false);
                }
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
        <DialogContent className="max-w-2xl">
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
              <Input value={discForm.descricao} onChange={(e) => setDiscForm({ ...discForm, descricao: e.target.value })} placeholder="Breve descrição" />
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
                        <Input placeholder="Código (ex: CR_TP_R)" value={a.codigo} onChange={e => {
                          const up = [...batchAtividades]; up[i] = { ...up[i], codigo: e.target.value }; setBatchAtividades(up);
                        }} />
                      </div>
                      <div className="grid gap-2 md:grid-cols-4">
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
                        <div>
                          <Label className="text-xs">Perfil Mentor</Label>
                          <Input placeholder="Rapper, Produtor..." value={a.perfil_mentor} onChange={e => {
                            const up = [...batchAtividades]; up[i] = { ...up[i], perfil_mentor: e.target.value }; setBatchAtividades(up);
                          }} />
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
                if (confirm('Apagar esta disciplina e todas as suas atividades?')) {
                  deleteDisciplinaMutation.mutate(editingDisciplina.id);
                }
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingAtividade ? 'Editar Atividade' : 'Nova Atividade'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Código</Label>
              <Input value={ativForm.codigo} onChange={(e) => setAtivForm({ ...ativForm, codigo: e.target.value })} placeholder="Ex: CR_TP_R" />
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
            <div className="grid gap-2">
              <Label>Perfil Mentor</Label>
              <Input value={ativForm.perfil_mentor} onChange={(e) => setAtivForm({ ...ativForm, perfil_mentor: e.target.value })} placeholder="Rapper, Produtor..." />
            </div>
          </div>
          <DialogFooter className="flex sm:justify-between w-full">
            {editingAtividade ? (
              <Button variant="destructive" onClick={() => {
                if (confirm('Apagar esta atividade?')) {
                  deleteAtividadeMutation.mutate(editingAtividade.uuid);
                }
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
    </div>
  );
};

export default Wiki;
