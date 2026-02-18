import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Music2,
  Plus,
  PlayCircle,
  CheckCircle2,
  ListMusic,
  Clock,
  User as UserIcon,
  MessageSquare,
  Circle,
  Archive
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

// Types
interface Musica {
  id: number;
  titulo: string;
  estado: string;
  disciplina: string | null;
  arquivado: boolean;
  criado_em: string;
  turma: {
    id: number;
    nome: string;
    estabelecimento: string;
  } | null;
  responsavel: {
    id: string;
    nome: string;
  } | null;
  criador: {
    id: string;
    nome: string;
  } | null;
  feedback?: string;
  link_demo?: string;
  misturado_por?: { id: string; nome: string };
  revisto_por?: { id: string; nome: string };
  finalizado_por?: { id: string; nome: string };
}

interface Turma {
  id: number;
  nome: string;
  display_name: string;
}

const ESTADOS = ['gravação', 'edição', 'pool_mistura', 'mistura_wip', 'pool_feedback', 'feedback_wip', 'pool_finalização', 'finalização_wip', 'concluído'];

const Producao = () => {
  const { user } = useAuth();
  const [isNewMusicOpen, setIsNewMusicOpen] = useState(false);
  const [selectedMusicId, setSelectedMusicId] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [viewArchived, setViewArchived] = useState(false);
  const [viewCompleted, setViewCompleted] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form State
  const [newMusicData, setNewMusicData] = useState({
    titulo: '',
    turma_id: '',
    disciplina: ''
  });

  // Queries
  const { data: musicas = [], isLoading } = useQuery({
    queryKey: ['musicas', viewArchived, user?.id],
    queryFn: async () => {
      const res = await api.get(`/api/musicas?arquivadas=${viewArchived}`);
      return res.data as Musica[];
    }
  });

  const { data: turmas = [] } = useQuery({
    queryKey: ['turmas'],
    queryFn: async () => {
      const res = await api.get('/api/turmas');
      return res.data as Turma[];
    }
  });

  // Mutations
  const createMusicMutation = useMutation({
    mutationFn: (data: any) => api.post('/api/musicas', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['musicas'] });
      toast({ title: 'Música criada', description: 'Nova produção iniciada!' });
      setIsNewMusicOpen(false);
      setNewMusicData({ titulo: '', turma_id: '', disciplina: '' });
    },
    onError: () => toast({ title: 'Erro', description: 'Falha ao criar música.', variant: 'destructive' })
  });

  const advancePhaseMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data?: any }) =>
      api.post(`/api/musicas/${id}/avancar`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['musicas'] });
      toast({ title: 'Fase avançada', description: 'O processo seguiu para a próxima etapa.' });
    },
    onError: (err: any) => toast({ title: 'Erro', description: err.response?.data?.detail || 'Erro ao avançar fase.', variant: 'destructive' })
  });

  const acceptTaskMutation = useMutation({
    mutationFn: (id: number) => api.post(`/api/musicas/${id}/aceitar`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['musicas'] });
      toast({ title: 'Tarefa aceite!', description: 'Agora és o responsável por esta música.' });
    },
    onError: (err: any) => toast({ title: 'Erro', description: err.response?.data?.detail || 'Erro ao aceitar tarefa.', variant: 'destructive' })
  });

  // Helper Logic
  const canIAccessPool = (estado: string) => {
    if (!user) return false;
    const role = user.role;

    if (role === 'coordenador' && estado === 'pool_feedback') return true;
    if ((role === 'produtor' || role === 'mentor_produtor') && (estado === 'pool_mistura' || estado === 'pool_finalização')) return true;

    return false; // Mentores don't pick from pools typically, they push TO pools
  };

  // Get user role from ProfileContext
  const { profile } = useProfile();
  const isCoordinator = profile === 'coordenador';

  const myWorkMusicas = musicas.filter(m => m.responsavel?.id === user?.id && !m.arquivado && m.estado !== 'concluído');
  const poolMusicas = musicas.filter(m => m.responsavel === null && canIAccessPool(m.estado) && !m.arquivado);
  const completedMusicas = musicas.filter(m => m.estado === 'concluído' && !m.arquivado);
  const allActiveMusicas = musicas.filter(m => !m.arquivado && m.estado !== 'concluído');

  const handleSubmit = () => {
    if (!newMusicData.titulo || !newMusicData.turma_id) {
      toast({ title: 'Campos obrigatórios', description: 'Preenche o título e a turma.', variant: 'destructive' });
      return;
    }
    createMusicMutation.mutate({
      titulo: newMusicData.titulo,
      turma_id: parseInt(newMusicData.turma_id),
      disciplina: newMusicData.disciplina
    });
  };

  const handleAdvance = (music: Musica) => {
    advancePhaseMutation.mutate({ id: music.id });
  };

  const submitFeedback = (musicId: number, feedback: string) => {
    advancePhaseMutation.mutate({
      id: musicId,
      data: { feedback }
    });
    setSelectedMusicId(null);
    setFeedbackText('');
  };

  const getPhaseInfo = (status: string) => {
    // FASE A: Criação/Preparação (Mentor)
    if (['gravação', 'edição'].includes(status)) {
      return { label: 'FASE A: Criação', color: 'bg-blue-100 text-blue-700 border-blue-200' };
    }
    // FASE B: Mistura (Produtor)
    if (['pool_mistura', 'mistura_wip'].includes(status)) {
      return { label: 'FASE B: Mistura', color: 'bg-purple-100 text-purple-700 border-purple-200' };
    }
    // FASE C: Revisão (Coordenador)
    if (['pool_feedback', 'feedback_wip'].includes(status)) {
      return { label: 'FASE C: Revisão', color: 'bg-orange-100 text-orange-700 border-orange-200' };
    }
    // FASE D: Finalização (Produtor)
    if (['pool_finalização', 'finalização_wip'].includes(status)) {
      return { label: 'FASE D: Finalização', color: 'bg-pink-100 text-pink-700 border-pink-200' };
    }
    // CONCLUÍDO
    if (status === 'concluído') {
      return { label: 'CONCLUÍDO', color: 'bg-green-100 text-green-700 border-green-200' };
    }
    return { label: 'DESCONHECIDO', color: 'bg-gray-100 text-gray-700' };
  };

  const getActionLabel = (status: string) => {
    switch (status) {
      case 'gravação': return 'Avançar para Edição';
      case 'edição': return 'Enviar para Laboratório (Mistura)';
      case 'mistura_wip': return 'Enviar para Feedback';
      case 'feedback_wip': return 'Enviar para Finalização'; // Managed by modal, but fallback text
      case 'finalização_wip': return 'Terminar Trabalho';
      default: return 'Avançar Fase';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'gravação': 'Gravação',
      'edição': 'Edição',
      'pool_mistura': 'Aguardar Mistura',
      'mistura_wip': 'Mistura em Curso',
      'pool_feedback': 'Aguardar Feedback',
      'feedback_wip': 'Em Revisão',
      'pool_finalização': 'Aguardar Finalização',
      'finalização_wip': 'Finalização em Curso',
      'concluído': 'Concluído'
    };
    return labels[status] || status;
  };

  // Feedback Dialog Component (uncontrolled to avoid cursor issues)
  const FeedbackDialog = ({ music, onSubmit }: { music: Musica; onSubmit: (feedback: string) => void }) => {
    const [open, setOpen] = useState(false);
    const [localFeedback, setLocalFeedback] = useState('');

    const handleSubmit = () => {
      onSubmit(localFeedback);
      setOpen(false);
      setLocalFeedback('');
    };

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700">
            <MessageSquare className="w-4 h-4 mr-2" />
            Enviar Feedback & Devolver
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Feedback de Revisão</DialogTitle>
            <DialogDescription>Indica as correções necessárias ou aprova a mistura.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={localFeedback}
            onChange={(e) => setLocalFeedback(e.target.value)}
            placeholder="Escreve aqui o teu feedback..."
            className="min-h-[100px]"
            maxLength={500}
          />
          <div className="text-xs text-right text-muted-foreground">
            {localFeedback.length}/500
          </div>
          <DialogFooter>
            <Button onClick={handleSubmit}>Enviar Feedback</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // Render Card Component
  const MusicCard = ({ music, isPool = false }: { music: Musica, isPool?: boolean }) => {
    const phaseInfo = getPhaseInfo(music.estado);

    return (
      <Card className="overflow-hidden hover:shadow-md transition-all flex flex-col h-full border-l-4" style={{ borderLeftColor: phaseInfo.color.split(' ')[1].replace('text-', 'var(--') }}>
        <CardHeader className="bg-muted/30 pb-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {/* CURRENT STATUS - More prominent */}
                <Badge variant="default" className="text-sm font-bold">
                  {getStatusLabel(music.estado)}
                </Badge>
                {/* PHASE BADGE - Less prominent */}
                <Badge variant="outline" className={cn("text-[10px] font-medium", phaseInfo.color)}>
                  {phaseInfo.label}
                </Badge>
              </div>
              <CardTitle className="text-lg leading-tight">{music.titulo}</CardTitle>
              <p className="text-sm text-muted-foreground">{music.turma?.nome} • {music.turma?.estabelecimento}</p>
            </div>
            {/* CURRENT RESPONSAVEL in top-right */}
            {music.responsavel && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-background px-2 py-1 rounded-full border" title={`Responsável atual: ${music.responsavel.nome}`}>
                <UserIcon className="w-3 h-3" />
                {music.responsavel.nome.split(' ')[0]}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4 flex-grow">
          {/* Feedback Section if exists and meaningful */}
          {music.feedback && (
            <div className="bg-orange-500/10 border border-orange-500/20 p-3 rounded-md text-sm">
              <p className="font-semibold text-orange-600 flex items-center gap-1 mb-1">
                <MessageSquare className="w-3 h-3" /> Feedback do Coordenador:
              </p>
              <p className="text-muted-foreground italic">"{music.feedback}"</p>
              {music.revisto_por && <div className="text-[10px] text-right mt-1 text-orange-600/60">- {music.revisto_por.nome.split(' ')[0]}</div>}
            </div>
          )}

          {/* WORKFLOW HISTORY - All States */}
          <div className="space-y-1 pt-2 border-t border-dashed">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Workflow History</div>

            {/* Helper function to check if state is completed */}
            {(() => {
              const currentStateIndex = ESTADOS.indexOf(music.estado);
              const isStateCompleted = (stateIndex: number) => stateIndex < currentStateIndex;
              const isStateCurrent = (stateIndex: number) => stateIndex === currentStateIndex;

              // Define workflow states with their labels and who completed them
              const workflowStates = [
                { label: 'Criação', completedBy: music.criador?.nome, states: ['gravação', 'edição'] },
                { label: 'Mistura', completedBy: music.misturado_por?.nome, states: ['pool_mistura', 'mistura_wip'] },
                { label: 'Revisão', completedBy: music.revisto_por?.nome, states: ['pool_feedback', 'feedback_wip'] },
                { label: 'Finalização', completedBy: music.finalizado_por?.nome, states: ['pool_finalização', 'finalização_wip'] },
                { label: 'Concluído', completedBy: music.finalizado_por?.nome, states: ['concluído'] }
              ];

              return workflowStates.map((step, idx) => {
                const stepStateIndices = step.states.map(s => ESTADOS.indexOf(s));
                const isCompleted = stepStateIndices.some(i => isStateCompleted(i));
                const isCurrent = stepStateIndices.some(i => isStateCurrent(i));

                return (
                  <div key={idx} className={cn(
                    "flex justify-between items-center text-xs py-1 px-2 rounded",
                    isCurrent && "bg-primary/10 border border-primary/30"
                  )}>
                    <span className={cn(
                      "flex items-center gap-1 font-medium",
                      isCompleted && "text-green-600",
                      isCurrent && "text-primary font-bold",
                      !isCompleted && !isCurrent && "text-muted-foreground/50"
                    )}>
                      <Circle className={cn("w-2 h-2", isCompleted && "fill-current")} />
                      {step.label}
                      {isCurrent && <span className="text-[10px] ml-1">(atual)</span>}
                    </span>
                    <span className={cn(
                      "text-muted-foreground text-[11px]",
                      isCompleted && "font-medium"
                    )}>
                      {isCompleted ? step.completedBy?.split(' ')[0] || '✓' : '-'}
                    </span>
                  </div>
                );
              });
            })()}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground mt-4 pt-2 border-t">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {format(parseISO(music.criado_em), "d MMM", { locale: pt })}
            </span>
          </div>
        </CardContent>

        <CardFooter className="pt-0 pb-4 flex justify-end gap-2 bg-muted/10 mt-auto pt-4">
          {isPool ? (
            <Button size="sm" onClick={() => acceptTaskMutation.mutate(music.id)} className="w-full sm:w-auto">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Aceitar Tarefa
            </Button>
          ) : (
            <>
              {/* Logic for action buttons based on state */}
              {music.estado === 'feedback_wip' ? (
                <FeedbackDialog
                  music={music}
                  onSubmit={(feedback) => submitFeedback(music.id, feedback)}
                />
              ) : (
                music.estado !== 'concluído' && (
                  <Button size="sm" onClick={() => handleAdvance(music)} className="w-full sm:w-auto">
                    <PlayCircle className="w-4 h-4 mr-2" />
                    {getActionLabel(music.estado)}
                  </Button>
                )
              )}
            </>
          )}
        </CardFooter>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Produção Musical</h1>
          <p className="text-muted-foreground mt-1">
            Gestão do fluxo de trabalho de produção musical.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewCompleted ? "default" : "outline"}
            onClick={() => setViewCompleted(!viewCompleted)}
          >
            <Archive className="h-4 w-4 mr-2" />
            Arquivo ({completedMusicas.length})
          </Button>
          <Dialog open={isNewMusicOpen} onOpenChange={setIsNewMusicOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Música
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Música</DialogTitle>
                <DialogDescription>Inicia uma nova produção musical.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="titulo">Título da Música</Label>
                  <Input
                    id="titulo"
                    placeholder="Ex: Vozes do Bairro"
                    value={newMusicData.titulo}
                    onChange={(e) => setNewMusicData({ ...newMusicData, titulo: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="turma">Turma / Artista</Label>
                  <Select
                    value={newMusicData.turma_id}
                    onValueChange={(val) => setNewMusicData({ ...newMusicData, turma_id: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar turma" />
                    </SelectTrigger>
                    <SelectContent>
                      {turmas.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="disciplina">Disciplina (Opcional)</Label>
                  <Input
                    id="disciplina"
                    placeholder="Ex: Português"
                    value={newMusicData.disciplina}
                    onChange={(e) => setNewMusicData({ ...newMusicData, disciplina: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSubmit} disabled={createMusicMutation.isPending}>
                  Criar Música
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>


      {viewCompleted ? (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Músicas Concluídas</h2>
            <Button variant="ghost" size="sm" onClick={() => setViewCompleted(false)}>
              Voltar
            </Button>
          </div>
          {completedMusicas.length === 0 ? (
            <div className="text-center py-12 bg-muted/20 rounded-lg border-2 border-dashed">
              <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
              <h3 className="mt-4 text-lg font-medium">Nenhuma música concluída</h3>
              <p className="text-muted-foreground">
                As músicas finalizadas aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {completedMusicas.map(music => (
                <MusicCard key={music.id} music={music} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <Tabs defaultValue="my_work" className="w-full">
          <TabsList className={`grid w-full ${isCoordinator ? 'grid-cols-3 lg:w-[600px]' : 'grid-cols-2 lg:w-[400px]'}`}>
            <TabsTrigger value="my_work">Minhas Tarefas ({myWorkMusicas.length})</TabsTrigger>
            <TabsTrigger value="pool">Disponíveis ({poolMusicas.length})</TabsTrigger>
            {isCoordinator && (
              <TabsTrigger value="all">Todas as Músicas ({allActiveMusicas.length})</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="my_work" className="mt-6 space-y-4">
            {myWorkMusicas.length === 0 ? (
              <div className="text-center py-12 bg-muted/20 rounded-lg border-2 border-dashed">
                <ListMusic className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                <h3 className="mt-4 text-lg font-medium">Não tens tarefas ativas</h3>
                <p className="text-muted-foreground">
                  Cria uma nova música ou aceita uma tarefa da pool.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {myWorkMusicas.map(music => (
                  <MusicCard key={music.id} music={music} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pool" className="mt-6 space-y-4">
            {poolMusicas.length === 0 ? (
              <div className="text-center py-12 bg-muted/20 rounded-lg border-2 border-dashed">
                <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                <h3 className="mt-4 text-lg font-medium">Tudo limpo!</h3>
                <p className="text-muted-foreground">
                  Não existem tarefas pendentes para o teu perfil neste momento.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {poolMusicas.map(music => (
                  <MusicCard key={music.id} music={music} isPool={true} />
                ))}
              </div>
            )}
          </TabsContent>

          {isCoordinator && (
            <TabsContent value="all" className="mt-6 space-y-4">
              {allActiveMusicas.length === 0 ? (
                <div className="text-center py-12 bg-muted/20 rounded-lg border-2 border-dashed">
                  <ListMusic className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                  <h3 className="mt-4 text-lg font-medium">Nenhuma música ativa</h3>
                  <p className="text-muted-foreground">
                    Não existem músicas em andamento neste momento.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {allActiveMusicas.map(music => (
                    <MusicCard key={music.id} music={music} />
                  ))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
};

export default Producao;
