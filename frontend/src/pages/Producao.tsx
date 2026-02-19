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
import { format, parseISO, addMinutes } from 'date-fns';
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
const MENTOR_STATES = ['gravação', 'edição'];
const LAB_STATES = ['pool_mistura', 'mistura_wip', 'pool_finalização', 'finalização_wip'];
const FEEDBACK_STATES = ['pool_feedback', 'feedback_wip'];

// States that open WorkLogModal (user is finishing a phase — log time)
const WORKLOG_STATES = ['gravação', 'edição', 'mistura_wip', 'finalização_wip'];
// States that do a direct advance (user is starting a phase — no time log)
const DIRECT_ADVANCE_STATES = ['pool_mistura', 'pool_finalização', 'pool_feedback'];

const Producao = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [isNewMusicOpen, setIsNewMusicOpen] = useState(false);
  const [viewCompleted, setViewCompleted] = useState(false);
  const [workLogModal, setWorkLogModal] = useState<{ open: boolean; music: Musica | null }>({ open: false, music: null });
  const [workLogForm, setWorkLogForm] = useState({ date: '', hora_inicio: '', hora_fim: '', observacoes: '' });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [newMusicData, setNewMusicData] = useState({ titulo: '', turma_id: '', disciplina: '' });

  const isCoordinator = profile === 'coordenador';
  const isProdutor = profile === 'produtor' || profile === 'mentor_produtor';

  // Queries
  const { data: musicas = [], isLoading } = useQuery({
    queryKey: ['musicas', user?.id],
    queryFn: async () => {
      const res = await api.get('/api/musicas?arquivadas=false');
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

  const createWorkLogMutation = useMutation({
    mutationFn: (payload: any) => api.post('/api/aulas', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aulas'] });
    },
    onError: () => {
      toast({ title: 'Aviso', description: 'Fase avançada, mas erro ao registar no calendário.', variant: 'default' });
    }
  });

  // ─── Filtering ───────────────────────────────────────────────────────────────

  const activeMusicas = musicas.filter(m => !m.arquivado && m.estado !== 'concluído');
  const completedMusicas = musicas.filter(m => m.estado === 'concluído' && !m.arquivado);

  const getVisibleMusicas = (): Musica[] => {
    if (isCoordinator) {
      // Coordinator main view: musicas needing feedback
      return activeMusicas.filter(m => FEEDBACK_STATES.includes(m.estado));
    }
    if (profile === 'produtor') {
      // Produtor sees all lab-stage musicas
      return activeMusicas.filter(m => LAB_STATES.includes(m.estado));
    }
    if (profile === 'mentor') {
      // Mentor sees only musicas they created
      return activeMusicas.filter(m => m.criador?.id === user?.id);
    }
    if (profile === 'mentor_produtor') {
      // Sees own musicas (as mentor) + all lab-stage musicas (as produtor), deduplicated
      const seen = new Set<number>();
      return activeMusicas.filter(m => {
        if (m.criador?.id === user?.id || LAB_STATES.includes(m.estado)) {
          if (!seen.has(m.id)) { seen.add(m.id); return true; }
        }
        return false;
      });
    }
    return activeMusicas;
  };

  const visibleMusicas = getVisibleMusicas();

  // ─── Permissions ─────────────────────────────────────────────────────────────

  const canUserAction = (music: Musica): boolean => {
    if (!user) return false;
    const { estado } = music;
    if (MENTOR_STATES.includes(estado)) {
      return music.criador?.id === user.id || music.responsavel?.id === user.id;
    }
    if (LAB_STATES.includes(estado)) {
      return isProdutor;
    }
    if (FEEDBACK_STATES.includes(estado)) {
      return isCoordinator;
    }
    return false;
  };

  // ─── Handlers ────────────────────────────────────────────────────────────────

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
    const [hStart, mStart] = workLogForm.hora_inicio.split(':').map(Number);
    const [hEnd, mEnd] = workLogForm.hora_fim.split(':').map(Number);
    const duracao = (hEnd * 60 + mEnd) - (hStart * 60 + mStart);
    if (duracao <= 0) {
      toast({ title: 'Hora inválida', description: 'A hora de fim deve ser posterior à de início.', variant: 'destructive' });
      return;
    }
    setWorkLogModal({ open: false, music: null });
    advancePhaseMutation.mutate({ id: music.id });
    createWorkLogMutation.mutate({
      data_hora: `${workLogForm.date} ${workLogForm.hora_inicio}`,
      duracao_minutos: duracao,
      tipo: 'trabalho_autonomo',
      is_autonomous: true,
      is_realized: true,
      tipo_atividade: 'Produção Musical',
      responsavel_user_id: user?.id,
      musica_id: music.id,
      turma_id: music.turma?.id ?? null,
      observacoes: workLogForm.observacoes || '',
    });
  };

  const submitFeedback = (musicId: number, feedback: string) => {
    advancePhaseMutation.mutate({ id: musicId, data: { feedback } });
  };

  // ─── Display Helpers ─────────────────────────────────────────────────────────

  const getPhaseInfo = (status: string) => {
    if (MENTOR_STATES.includes(status))
      return { label: 'FASE A: Criação', color: 'bg-blue-100 text-blue-700 border-blue-200' };
    if (['pool_mistura', 'mistura_wip'].includes(status))
      return { label: 'FASE B: Mistura', color: 'bg-purple-100 text-purple-700 border-purple-200' };
    if (FEEDBACK_STATES.includes(status))
      return { label: 'FASE C: Revisão', color: 'bg-orange-100 text-orange-700 border-orange-200' };
    if (['pool_finalização', 'finalização_wip'].includes(status))
      return { label: 'FASE D: Finalização', color: 'bg-pink-100 text-pink-700 border-pink-200' };
    if (status === 'concluído')
      return { label: 'CONCLUÍDO', color: 'bg-green-100 text-green-700 border-green-200' };
    return { label: 'DESCONHECIDO', color: 'bg-gray-100 text-gray-700' };
  };

  const getActionLabel = (status: string) => {
    switch (status) {
      case 'gravação':       return 'Avançar para Edição';
      case 'edição':         return 'Enviar para Laboratório';
      case 'pool_mistura':   return 'Iniciar Mistura';
      case 'mistura_wip':    return 'Enviar para Feedback';
      case 'pool_feedback':  return 'Iniciar Revisão';
      case 'feedback_wip':   return 'Enviar Feedback & Devolver';
      case 'pool_finalização': return 'Iniciar Finalização';
      case 'finalização_wip':  return 'Terminar Trabalho';
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

  // ─── Sub-components ───────────────────────────────────────────────────────────

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
          <div className="text-xs text-right text-muted-foreground">{localFeedback.length}/500</div>
          <DialogFooter>
            <Button onClick={handleSubmit}>Enviar Feedback</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const MusicCard = ({ music }: { music: Musica }) => {
    const phaseInfo = getPhaseInfo(music.estado);
    const userCanAct = canUserAction(music);
    const displayUser = music.responsavel || music.criador;

    return (
      <Card className="overflow-hidden hover:shadow-md transition-all flex flex-col h-full border-l-4" style={{ borderLeftColor: phaseInfo.color.split(' ')[1].replace('text-', 'var(--') }}>
        <CardHeader className="bg-muted/30 pb-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge variant="default" className="text-sm font-bold">
                  {getStatusLabel(music.estado)}
                </Badge>
                <Badge variant="outline" className={cn("text-[10px] font-medium", phaseInfo.color)}>
                  {phaseInfo.label}
                </Badge>
              </div>
              <CardTitle className="text-lg leading-tight">{music.titulo}</CardTitle>
              <p className="text-sm text-muted-foreground">{music.turma?.nome} • {music.turma?.estabelecimento}</p>
            </div>
            {displayUser && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-background px-2 py-1 rounded-full border shrink-0" title={`Criado por: ${displayUser.nome}`}>
                <UserIcon className="w-3 h-3" />
                {displayUser.nome.split(' ')[0]}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4 flex-grow">
          {music.feedback && (
            <div className="bg-orange-500/10 border border-orange-500/20 p-3 rounded-md text-sm">
              <p className="font-semibold text-orange-600 flex items-center gap-1 mb-1">
                <MessageSquare className="w-3 h-3" /> Feedback do Coordenador:
              </p>
              <p className="text-muted-foreground italic">"{music.feedback}"</p>
              {music.revisto_por && <div className="text-[10px] text-right mt-1 text-orange-600/60">- {music.revisto_por.nome.split(' ')[0]}</div>}
            </div>
          )}

          {/* Workflow */}
          <div className="space-y-1 pt-2 border-t border-dashed">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Workflow</div>
            {(() => {
              const currentStateIndex = ESTADOS.indexOf(music.estado);
              const workflowSteps = [
                { label: 'Criação',     completedBy: music.criador?.nome,       states: ['gravação', 'edição'] },
                { label: 'Mistura',     completedBy: music.misturado_por?.nome, states: ['pool_mistura', 'mistura_wip'] },
                { label: 'Revisão',     completedBy: music.revisto_por?.nome,   states: ['pool_feedback', 'feedback_wip'] },
                { label: 'Finalização', completedBy: music.finalizado_por?.nome, states: ['pool_finalização', 'finalização_wip'] },
                { label: 'Concluído',   completedBy: music.finalizado_por?.nome, states: ['concluído'] },
              ];

              return workflowSteps.map((step, idx) => {
                const indices = step.states.map(s => ESTADOS.indexOf(s));
                const isCompleted = indices.some(i => i < currentStateIndex);
                const isCurrent   = indices.some(i => i === currentStateIndex);
                return (
                  <div key={idx} className={cn("flex justify-between items-center text-xs py-1 px-2 rounded", isCurrent && "bg-primary/10 border border-primary/30")}>
                    <span className={cn("flex items-center gap-1 font-medium", isCompleted && "text-green-600", isCurrent && "text-primary font-bold", !isCompleted && !isCurrent && "text-muted-foreground/50")}>
                      <Circle className={cn("w-2 h-2", isCompleted && "fill-current")} />
                      {step.label}
                      {isCurrent && <span className="text-[10px] ml-1">(atual)</span>}
                    </span>
                    <span className={cn("text-muted-foreground text-[11px]", isCompleted && "font-medium")}>
                      {isCompleted ? step.completedBy?.split(' ')[0] || '✓' : '-'}
                    </span>
                  </div>
                );
              });
            })()}
          </div>

          <div className="flex items-center text-xs text-muted-foreground mt-4 pt-2 border-t">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {format(parseISO(music.criado_em), "d MMM yyyy", { locale: pt })}
            </span>
          </div>
        </CardContent>

        <CardFooter className="pb-4 flex justify-end gap-2 bg-muted/10 mt-auto pt-4">
          {music.estado !== 'concluído' && userCanAct && (
            music.estado === 'feedback_wip' ? (
              <FeedbackDialog music={music} onSubmit={(feedback) => submitFeedback(music.id, feedback)} />
            ) : DIRECT_ADVANCE_STATES.includes(music.estado) ? (
              <Button size="sm" onClick={() => advancePhaseMutation.mutate({ id: music.id })} disabled={advancePhaseMutation.isPending}>
                <PlayCircle className="w-4 h-4 mr-2" />
                {getActionLabel(music.estado)}
              </Button>
            ) : WORKLOG_STATES.includes(music.estado) ? (
              <Button size="sm" onClick={() => handleAdvance(music)}>
                <PlayCircle className="w-4 h-4 mr-2" />
                {getActionLabel(music.estado)}
              </Button>
            ) : null
          )}
        </CardFooter>
      </Card>
    );
  };

  const EmptyState = ({ message, sub }: { message: string; sub: string }) => (
    <div className="text-center py-12 bg-muted/20 rounded-lg border-2 border-dashed">
      <ListMusic className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
      <h3 className="mt-4 text-lg font-medium">{message}</h3>
      <p className="text-muted-foreground">{sub}</p>
    </div>
  );

  const getEmptyMessage = () => {
    if (isCoordinator) return { message: 'Nenhuma música para rever', sub: 'Quando houver músicas aguardando feedback aparecerão aqui.' };
    if (profile === 'produtor') return { message: 'Nenhuma música em laboratório', sub: 'Aguarda que os mentores enviem músicas para mistura.' };
    return { message: 'Não tens músicas em andamento', sub: 'Cria uma nova música para começar.' };
  };

  const emptyMsg = getEmptyMessage();

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Produção Musical</h1>
          <p className="text-muted-foreground mt-1">Gestão do fluxo de trabalho de produção musical.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={viewCompleted ? "default" : "outline"} onClick={() => setViewCompleted(!viewCompleted)}>
            <Archive className="h-4 w-4 mr-2" />
            Concluídas ({completedMusicas.length})
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
                  <Select value={newMusicData.turma_id} onValueChange={(val) => setNewMusicData({ ...newMusicData, turma_id: val })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar turma" /></SelectTrigger>
                    <SelectContent>
                      {turmas.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>{t.display_name}</SelectItem>
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
                <Button onClick={handleSubmit} disabled={createMusicMutation.isPending}>Criar Música</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Content */}
      {viewCompleted ? (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Músicas Concluídas</h2>
            <Button variant="ghost" size="sm" onClick={() => setViewCompleted(false)}>Voltar</Button>
          </div>
          {completedMusicas.length === 0 ? (
            <EmptyState message="Nenhuma música concluída" sub="As músicas finalizadas aparecerão aqui." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {completedMusicas.map(music => <MusicCard key={music.id} music={music} />)}
            </div>
          )}
        </div>

      ) : isCoordinator ? (
        /* Coordinator: feedback queue + god vision */
        <Tabs defaultValue="feedback" className="w-full">
          <TabsList className="grid grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="feedback">Para Feedback ({visibleMusicas.length})</TabsTrigger>
            <TabsTrigger value="all">Todas ({activeMusicas.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="feedback" className="mt-6">
            {visibleMusicas.length === 0 ? (
              <div className="text-center py-12 bg-muted/20 rounded-lg border-2 border-dashed">
                <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                <h3 className="mt-4 text-lg font-medium">Tudo em dia!</h3>
                <p className="text-muted-foreground">Não há músicas a aguardar feedback.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {visibleMusicas.map(music => <MusicCard key={music.id} music={music} />)}
              </div>
            )}
          </TabsContent>
          <TabsContent value="all" className="mt-6">
            {activeMusicas.length === 0 ? (
              <EmptyState message="Nenhuma música ativa" sub="Não existem músicas em andamento neste momento." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeMusicas.map(music => <MusicCard key={music.id} music={music} />)}
              </div>
            )}
          </TabsContent>
        </Tabs>

      ) : (
        /* Mentor / Produtor: single panel */
        isLoading ? (
          <div className="text-center py-12 text-muted-foreground">A carregar...</div>
        ) : visibleMusicas.length === 0 ? (
          <EmptyState message={emptyMsg.message} sub={emptyMsg.sub} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-2">
            {visibleMusicas.map(music => <MusicCard key={music.id} music={music} />)}
          </div>
        )
      )}

      {/* WorkLog Modal — intercepts phase completion to record work time */}
      <Dialog open={workLogModal.open} onOpenChange={(open) => !open && setWorkLogModal({ open: false, music: null })}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="font-display">Registar Sessão de Trabalho</DialogTitle>
            <DialogDescription>
              <span className="font-medium">"{workLogModal.music?.titulo}"</span>
              {workLogModal.music && ` — ${getActionLabel(workLogModal.music.estado)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="wl-date">Data</Label>
                <Input id="wl-date" type="date" value={workLogForm.date}
                  onChange={(e) => setWorkLogForm({ ...workLogForm, date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wl-start">Início</Label>
                <Input id="wl-start" type="time" value={workLogForm.hora_inicio}
                  onChange={(e) => setWorkLogForm({ ...workLogForm, hora_inicio: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wl-end">Fim</Label>
                <Input id="wl-end" type="time" value={workLogForm.hora_fim}
                  onChange={(e) => setWorkLogForm({ ...workLogForm, hora_fim: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wl-obs">Notas (opcional)</Label>
              <Textarea id="wl-obs" placeholder="O que foi feito nesta sessão..." rows={3}
                value={workLogForm.observacoes}
                onChange={(e) => setWorkLogForm({ ...workLogForm, observacoes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWorkLogModal({ open: false, music: null })}>Cancelar</Button>
            <Button onClick={handleWorkLogConfirm} disabled={advancePhaseMutation.isPending || createWorkLogMutation.isPending}>
              <PlayCircle className="w-4 h-4 mr-2" />
              Registar & Avançar Fase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Producao;
