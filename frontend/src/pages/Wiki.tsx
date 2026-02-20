import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
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
  DialogTrigger,
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
  Book, School, Layers, Calendar, Edit2, Plus, Trash2, Save, Users, Building2, X
} from "lucide-react";
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

// Types
interface Estabelecimento {
  id: number;
  nome: string;
  sigla: string;
}

interface Turma {
  id: number;
  nome: string;
  estabelecimento_nome: string;
  estabelecimento_id: number;
}

interface Atividade {
  id: number;
  codigo: string;
  nome: string;
  sessoes_padrao: number;
  horas_padrao: number;
  total_horas: number;
  producoes_esperadas: number;
  perfil_mentor: string;
}

interface Disciplina {
  id: number;
  disciplina: string;
  descricao: string;
  atividades: Atividade[];
}

const Wiki = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isCoordinator = user?.role === 'coordenador';

  // State for Estabelecimentos
  const [isEstabDialogOpen, setIsEstabDialogOpen] = useState(false);
  const [editingEstab, setEditingEstab] = useState<Estabelecimento | null>(null);
  const [estabForm, setEstabForm] = useState({ nome: '', sigla: '' });

  // State for Turmas
  const [isTurmaDialogOpen, setIsTurmaDialogOpen] = useState(false);
  const [editingTurma, setEditingTurma] = useState<Turma | null>(null);
  const [newTurmaName, setNewTurmaName] = useState('');
  const [selectedEstabId, setSelectedEstabId] = useState<string>('');
  const [alunosNomes, setAlunosNomes] = useState<string[]>([]);

  // State for Curriculum
  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Atividade | null>(null);
  const [selectedDisciplinaId, setSelectedDisciplinaId] = useState<number | null>(null);
  const [activityForm, setActivityForm] = useState({
    codigo: '',
    nome: '',
    sessoes_padrao: 0,
    horas_padrao: 0,
    producoes_esperadas: 0,
    perfil_mentor: ''
  });

  // State for Disciplinas
  const [isDisciplinaDialogOpen, setIsDisciplinaDialogOpen] = useState(false);
  const [newDisciplinaName, setNewDisciplinaName] = useState('');
  const [newDisciplinaDesc, setNewDisciplinaDesc] = useState('');

  // --- QUERIES ---
  const { data: estabelecimentos = [] } = useQuery({
    queryKey: ['estabelecimentos'],
    queryFn: async () => {
      const res = await api.get('/api/estabelecimentos');
      return res.data as Estabelecimento[];
    }
  });

  const { data: turmas = [] } = useQuery({
    queryKey: ['turmas'],
    queryFn: async () => {
      const res = await api.get('/api/turmas');
      return res.data as Turma[];
    }
  });

  const { data: curriculo = [] } = useQuery({
    queryKey: ['curriculo'],
    queryFn: async () => {
      const res = await api.get('/api/curriculo');
      return res.data as Disciplina[];
    }
  });

  // --- MUTATIONS: ESTABELECIMENTOS ---
  const saveEstabMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingEstab) {
        return api.put(`/api/estabelecimentos/${editingEstab.id}`, data);
      }
      return api.post('/api/estabelecimentos', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estabelecimentos'] });
      toast.success(editingEstab ? 'Estabelecimento atualizado!' : 'Estabelecimento criado!');
      setIsEstabDialogOpen(false);
    },
    onError: () => toast.error('Erro ao salvar estabelecimento.')
  });

  const deleteEstabMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/estabelecimentos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estabelecimentos'] });
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
      setIsTurmaDialogOpen(false);
      toast.success('Turma removida!');
    },
    onError: () => toast.error('Erro ao remover turma.')
  });

  // --- MUTATIONS: ATIVIDADES ---
  const saveActivityMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingActivity) {
        return api.put(`/api/atividades/${editingActivity.id}`, data);
      }
      return api.post('/api/atividades', { ...data, disciplina_id: selectedDisciplinaId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['curriculo'] });
      toast.success(editingActivity ? 'Atividade atualizada!' : 'Atividade criada!');
      setIsActivityDialogOpen(false);
    },
    onError: () => toast.error('Erro ao salvar atividade.')
  });

  const deleteActivityMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/atividades/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['curriculo'] });
      toast.success('Atividade removida!');
    }
  });

  // --- MUTATIONS: DISCIPLINAS ---
  const saveDisciplinaMutation = useMutation({
    mutationFn: (data: any) => api.post('/api/disciplinas', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['curriculo'] });
      toast.success('Disciplina criada!');
      setIsDisciplinaDialogOpen(false);
      setNewDisciplinaName('');
      setNewDisciplinaDesc('');
    },
    onError: () => toast.error('Erro ao criar disciplina.')
  });

  // --- HANDLERS ---
  const openNewEstab = () => {
    setEditingEstab(null);
    setEstabForm({ nome: '', sigla: '' });
    setIsEstabDialogOpen(true);
  };

  const openEditEstab = (estab: Estabelecimento) => {
    setEditingEstab(estab);
    setEstabForm({ nome: estab.nome, sigla: estab.sigla });
    setIsEstabDialogOpen(true);
  };

  const openNewTurma = () => {
    setEditingTurma(null);
    setNewTurmaName('');
    setSelectedEstabId('');
    setAlunosNomes([]);
    setIsTurmaDialogOpen(true);
  };

  const openEditTurma = async (turma: Turma) => {
    setEditingTurma(turma);
    setNewTurmaName(turma.nome);
    setSelectedEstabId(turma.estabelecimento_id.toString());
    try {
      const res = await api.get(`/api/turmas/${turma.id}/alunos`);
      setAlunosNomes(res.data.map((a: any) => a.nome));
    } catch {
      setAlunosNomes([]);
    }
    setIsTurmaDialogOpen(true);
  };

  const handleSaveTurma = async () => {
    if (!newTurmaName || !selectedEstabId) return;

    const saveAlunos = async (turmaId: number) => {
      const filteredNomes = alunosNomes.filter(n => n.trim());
      try {
        await api.put(`/api/turmas/${turmaId}/alunos`, { nomes: filteredNomes });
      } catch {
        toast.error('Erro ao guardar alunos.');
      }
    };

    saveTurmaMutation.mutate(
      { nome: newTurmaName, estabelecimento_id: selectedEstabId },
      {
        onSuccess: async (response) => {
          const turmaId = editingTurma?.id || response?.data?.id;
          if (turmaId) await saveAlunos(turmaId);
        },
      }
    );
  };

  const openNewActivity = (disciplinaId: number) => {
    setSelectedDisciplinaId(disciplinaId);
    setEditingActivity(null);
    setActivityForm({
      codigo: '',
      nome: '',
      sessoes_padrao: 1,
      horas_padrao: 1,
      producoes_esperadas: 0,
      perfil_mentor: ''
    });
    setIsActivityDialogOpen(true);
  };

  const openNewDisciplina = () => {
    setNewDisciplinaName('');
    setNewDisciplinaDesc('');
    setIsDisciplinaDialogOpen(true);
  };

  const handleSaveDisciplina = () => {
    if (!newDisciplinaName) return;
    saveDisciplinaMutation.mutate({ nome: newDisciplinaName, descricao: newDisciplinaDesc });
  };

  const openEditActivity = (act: Atividade) => {
    setEditingActivity(act);
    setActivityForm({
      codigo: act.codigo,
      nome: act.nome,
      sessoes_padrao: act.sessoes_padrao || 0,
      horas_padrao: act.horas_padrao || 0,
      producoes_esperadas: act.producoes_esperadas || 0,
      perfil_mentor: act.perfil_mentor || ''
    });
    setIsActivityDialogOpen(true);
  };

  // Group turmas by estabelecimento
  const turmasByEstab = estabelecimentos.map(estab => ({
    ...estab,
    turmas: turmas.filter((t: Turma) => t.estabelecimento_id === estab.id)
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold flex items-center gap-2">
          <Book className="h-8 w-8 text-primary" />
          Wiki / Base de Conhecimento
        </h1>
        <p className="text-muted-foreground mt-1">
          Documentação da lógica da aplicação, hierarquias e dados de referência.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Contexto e Hierarquia - (Mantido igual) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-500" />
              1. Contexto e Hierarquia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              A estrutura lógica da aplicação segue uma hierarquia estrita:
            </p>
            <div className="bg-muted p-4 rounded-md space-y-2 font-mono text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="default">PROJETOS</Badge>
                <span>contêm</span>
              </div>
              <div className="flex items-center gap-2 pl-4">
                <span className="text-muted-foreground">↳</span>
                <Badge variant="secondary">ESTABELECIMENTOS</Badge>
                <span>(escolas/prisões), que contêm</span>
              </div>
              <div className="flex items-center gap-2 pl-8">
                <span className="text-muted-foreground">↳</span>
                <Badge variant="outline">TURMAS</Badge>
                <span>têm</span>
              </div>
              <div className="flex items-center gap-2 pl-12">
                <span className="text-muted-foreground">↳</span>
                <Badge variant="outline" className="border-primary text-primary">DISCIPLINAS</Badge>
                <span>são compostas por</span>
              </div>
              <div className="flex items-center gap-2 pl-16">
                <span className="text-muted-foreground">↳</span>
                <Badge variant="destructive">ATIVIDADES</Badge>
                <span>(currículo/temas)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Conceito de Sessão - (Mantido igual) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-green-500" />
              2. Conceito de "Sessão" (Evento Real)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              A unidade fundamental de agendamento é a <strong>SESSÃO</strong>.
            </p>
            <ul className="list-disc pl-4 space-y-2">
              <li>Uma Sessão ocorre numa <strong>Turma</strong> específica.</li>
              <li>Corresponde à execução de uma <strong>ATIVIDADE</strong> específica do catálogo.</li>
              <li>Tem um <strong>MENTOR</strong> associado (utilizador real).</li>
              <li>
                O perfil do mentor deve corresponder ao campo <code>perfil_mentor</code> definido na Atividade
                (ex: se pede "Rapper", o mentor tem de ter essa tag).
              </li>
              <li>Consome/utiliza um <strong>KIT DE EQUIPAMENTO</strong> (asset físico).</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* 3. DADOS DE REFERÊNCIA - ESTABELECIMENTOS */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <School className="h-5 w-5 text-orange-500" />
              3. Estabelecimentos
            </CardTitle>
            <CardDescription>
              Entidades onde os projetos decorrem.
            </CardDescription>
          </div>
          {isCoordinator && (
            <Button onClick={openNewEstab} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Estabelecimento
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Sigla</TableHead>
                <TableHead>Nome do Estabelecimento</TableHead>
                <TableHead className="w-[100px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estabelecimentos.map((estab) => (
                <TableRow key={estab.id}>
                  <TableCell className="font-bold">{estab.sigla}</TableCell>
                  <TableCell>{estab.nome}</TableCell>
                  <TableCell className="text-right">
                    {isCoordinator && (
                      <Button variant="ghost" size="icon" onClick={() => openEditEstab(estab)}>
                        <Edit2 className="h-4 w-4 text-blue-500" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 4. GESTÃO DE TURMAS */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-500" />
              4. Gestão de Turmas
            </CardTitle>
            <CardDescription>
              Organização das turmas por instituição.
            </CardDescription>
          </div>
          {isCoordinator && (
            <Dialog open={isTurmaDialogOpen} onOpenChange={setIsTurmaDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2" onClick={openNewTurma}>
                  <Plus className="h-4 w-4" />
                  Nova Turma
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingTurma ? 'Editar Turma' : 'Nova Turma'}</DialogTitle>
                  <DialogDescription>
                    {editingTurma ? 'Alterar dados da turma existente.' : 'Adiciona uma nova turma a uma instituição existente.'}
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
                          <SelectItem key={inst.id} value={inst.id.toString()}>
                            {inst.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="turma-name">Nome da Turma</Label>
                    <Input
                      id="turma-name"
                      placeholder="Ex: 12º B"
                      value={newTurmaName}
                      onChange={(e) => setNewTurmaName(e.target.value)}
                    />
                  </div>

                  {/* Lista de Alunos */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="font-medium">Alunos</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => setAlunosNomes(prev => [...prev, ''])}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Adicionar
                      </Button>
                    </div>
                    {alunosNomes.length === 0 && (
                      <p className="text-sm text-muted-foreground">Nenhum aluno registado.</p>
                    )}
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {alunosNomes.map((nome, i) => (
                        <div key={i} className="flex gap-2">
                          <Input
                            placeholder={`Aluno ${i + 1}`}
                            value={nome}
                            onChange={e => {
                              const updated = [...alunosNomes];
                              updated[i] = e.target.value;
                              setAlunosNomes(updated);
                            }}
                            className="text-sm"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            onClick={() => setAlunosNomes(prev => prev.filter((_, idx) => idx !== i))}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter className="flex sm:justify-between w-full">
                  {editingTurma ? (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (confirm('Tem a certeza que deseja apagar esta turma?')) {
                          deleteTurmaMutation.mutate(editingTurma.id);
                          setIsTurmaDialogOpen(false);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Apagar
                    </Button>
                  ) : <div />}
                  <Button onClick={handleSaveTurma}>
                    Gravar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {turmasByEstab.map((estab) => (
              <AccordionItem key={estab.id} value={estab.id.toString()}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="font-medium text-lg">{estab.nome}</span>
                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full ml-2">
                      {estab.turmas.length} turmas
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pl-6 space-y-1">
                    {estab.turmas.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic py-2">
                        Nenhuma turma registada.
                      </p>
                    ) : (
                      estab.turmas.map((turma) => (
                        <div
                          key={turma.id}
                          className="flex items-center justify-between p-2 rounded-md hover:bg-secondary/50 group"
                        >
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{turma.nome}</span>
                          </div>
                          {isCoordinator && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditTurma(turma);
                              }}
                            >
                              <Edit2 className="h-3 w-3 text-blue-500" />
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* 5. CURRÍCULO E ATIVIDADES */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Book className="h-5 w-5 text-purple-500" />
              5. Currículo e Atividades
            </CardTitle>
            <CardDescription>
              Catálogo de disciplinas e atividades disponíveis.
            </CardDescription>
          </div>
          {isCoordinator && (
            <Button onClick={openNewDisciplina} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Disciplina
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {curriculo.map((item) => (
              <AccordionItem key={item.id} value={`item-${item.id}`}>
                <AccordionTrigger className="text-lg font-semibold hover:no-underline hover:text-primary">
                  {item.disciplina}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="mb-4 flex justify-end">
                    {isCoordinator && (
                      <Button size="sm" variant="outline" onClick={() => openNewActivity(item.id)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nova Atividade
                      </Button>
                    )}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Atividade</TableHead>
                        <TableHead className="text-center">Sessões</TableHead>
                        <TableHead className="text-center">Horas</TableHead>
                        <TableHead className="text-center">Total H</TableHead>
                        <TableHead className="text-center">Prod. Esp.</TableHead>
                        <TableHead>Perfil Mentor</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {item.atividades.map((act) => (
                        <TableRow key={act.id}>
                          <TableCell className="font-mono font-bold text-xs">{act.codigo}</TableCell>
                          <TableCell>{act.nome}</TableCell>
                          <TableCell className="text-center">{act.sessoes_padrao || '-'}</TableCell>
                          <TableCell className="text-center">{act.horas_padrao || '-'}</TableCell>
                          <TableCell className="text-center font-bold">{act.total_horas}</TableCell>
                          <TableCell className="text-center">{act.producoes_esperadas}</TableCell>
                          <TableCell>
                            {act.perfil_mentor ? (
                              <Badge variant="outline">{act.perfil_mentor}</Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {isCoordinator && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditActivity(act)}>
                                <Edit2 className="h-3 w-3 text-blue-500" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* DIALOG FOR ESTABELECIMENTOS */}
      <Dialog open={isEstabDialogOpen} onOpenChange={setIsEstabDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEstab ? 'Editar Estabelecimento' : 'Novo Estabelecimento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="inst-sigla">Sigla</Label>
              <Input
                id="inst-sigla"
                value={estabForm.sigla}
                onChange={(e) => setEstabForm({ ...estabForm, sigla: e.target.value })}
                placeholder="EX: EPL"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inst-nome">Nome</Label>
              <Input
                id="inst-nome"
                value={estabForm.nome}
                onChange={(e) => setEstabForm({ ...estabForm, nome: e.target.value })}
                placeholder="Nome completo do estabelecimento"
              />
            </div>
          </div>
          <DialogFooter className="flex sm:justify-between w-full">
            {editingEstab ? (
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm('Tem a certeza que deseja apagar este estabelecimento?')) {
                    deleteEstabMutation.mutate(editingEstab.id);
                    setIsEstabDialogOpen(false);
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Apagar
              </Button>
            ) : <div />}
            <Button onClick={() => saveEstabMutation.mutate(estabForm)}>
              <Save className="h-4 w-4 mr-2" />
              Gravar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG FOR ACTIVITIES */}
      <Dialog open={isActivityDialogOpen} onOpenChange={setIsActivityDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingActivity ? 'Editar Atividade' : 'Nova Atividade'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Código</Label>
              <Input
                value={activityForm.codigo}
                onChange={(e) => setActivityForm({ ...activityForm, codigo: e.target.value })}
                placeholder="EX: V-01"
              />
            </div>
            <div className="grid gap-2">
              <Label>Nome da Atividade</Label>
              <Input
                value={activityForm.nome}
                onChange={(e) => setActivityForm({ ...activityForm, nome: e.target.value })}
                placeholder="Nome descritivo"
              />
            </div>
            <div className="grid gap-2">
              <Label>Sessões Padrão</Label>
              <Input
                type="number"
                value={activityForm.sessoes_padrao}
                onChange={(e) => setActivityForm({ ...activityForm, sessoes_padrao: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Horas por Sessão</Label>
              <Input
                type="number"
                value={activityForm.horas_padrao}
                onChange={(e) => setActivityForm({ ...activityForm, horas_padrao: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Produções Esperadas</Label>
              <Input
                type="number"
                value={activityForm.producoes_esperadas}
                onChange={(e) => setActivityForm({ ...activityForm, producoes_esperadas: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Perfil Mentor</Label>
              <Input
                value={activityForm.perfil_mentor}
                onChange={(e) => setActivityForm({ ...activityForm, perfil_mentor: e.target.value })}
                placeholder="Ex: Rapper, Produtor"
              />
            </div>
          </div>
          <DialogFooter className="flex sm:justify-between w-full">
            {editingActivity ? (
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm('Tem a certeza que deseja apagar esta atividade?')) {
                    deleteActivityMutation.mutate(editingActivity.id);
                    setIsActivityDialogOpen(false);
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Apagar
              </Button>
            ) : <div />}
            <Button onClick={() => saveActivityMutation.mutate(activityForm)}>
              <Save className="h-4 w-4 mr-2" />
              Gravar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG FOR DISCIPLINA */}
      <Dialog open={isDisciplinaDialogOpen} onOpenChange={setIsDisciplinaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Disciplina</DialogTitle>
            <DialogDescription>
              Adicionar uma nova disciplina ao currículo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="disc-nome">Nome da Disciplina</Label>
              <Input
                id="disc-nome"
                value={newDisciplinaName}
                onChange={(e) => setNewDisciplinaName(e.target.value)}
                placeholder="Ex: Workshop de DJing"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="disc-desc">Descrição (Opcional)</Label>
              <Input
                id="disc-desc"
                value={newDisciplinaDesc}
                onChange={(e) => setNewDisciplinaDesc(e.target.value)}
                placeholder="Breve descrição do conteúdo"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveDisciplina}>
              <Save className="h-4 w-4 mr-2" />
              Gravar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Wiki;
