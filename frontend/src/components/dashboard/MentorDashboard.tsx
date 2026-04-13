import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  MapPin,
  Clock,
  Check,
  X,
  ArrowRight,
  ClipboardList,
  Star,
  CheckCircle2,
  CalendarCheck,
  CalendarClock,
} from 'lucide-react';
import { OutrasTarefasWidget } from './OutrasTarefasWidget';
import { Link } from 'react-router-dom';
import { format, isToday, isTomorrow, isThisWeek } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useProfile } from '@/contexts/ProfileContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  rascunho: 'bg-muted text-muted-foreground',
  pendente: 'bg-[#3399cd] text-white border-[#3399cd]',
  confirmada: 'bg-[#4EA380] text-white border-[#4EA380]',
  recusada: 'bg-[#A35339] text-white border-[#A35339]',
  terminada: 'bg-[#06bede] text-white border-[#06bede]',
};

export function MentorDashboard() {
  const { user } = useProfile();
  const queryClient = useQueryClient();

  const [isTerminarOpen, setIsTerminarOpen] = useState(false);
  const [terminarSessionId, setTerminarSessionId] = useState<number | null>(null);
  const [terminarRating, setTerminarRating] = useState(0);
  const [terminarObs, setTerminarObs] = useState('');

  const { data: allSessions = [] } = useQuery({
    queryKey: ['aulas'],
    queryFn: async () => {
      const res = await api.get('/api/aulas');
      return res.data;
    }
  });

  const mentorSessions = allSessions.filter((s: any) => s.mentor_user_id === user?.id);
  const pendingSessions = mentorSessions.filter((s: any) => s.estado === 'pendente' || s.estado === 'agendada');

  const toFinishSessions = mentorSessions
    .filter((s: any) => s.estado === 'confirmada' && !s.is_autonomous && new Date(s.data_hora) < new Date())
    .sort((a: any, b: any) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime());

  const upcomingSessions = mentorSessions
    .filter((s: any) => s.estado === 'confirmada' && new Date(s.data_hora) >= new Date())
    .sort((a: any, b: any) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime());

  const confirmMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/api/aulas/${id}/confirm`);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['aulas'] });
      const previousAulas = queryClient.getQueryData(['aulas']);
      queryClient.setQueryData(['aulas'], (old: any[]) =>
        old.map((session) => session.id === id ? { ...session, estado: 'confirmada' } : session)
      );
      toast.success('Sessão confirmada!');
      return { previousAulas };
    },
    onError: (_err: any, _id: any, context: any) => {
      queryClient.setQueryData(['aulas'], context.previousAulas);
      toast.error('Erro ao confirmar sessão');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['aulas'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/api/aulas/${id}/reject`);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['aulas'] });
      const previousAulas = queryClient.getQueryData(['aulas']);
      queryClient.setQueryData(['aulas'], (old: any[]) =>
        old.map((session) => session.id === id ? { ...session, estado: 'recusada' } : session)
      );
      toast.success('Sessão recusada');
      return { previousAulas };
    },
    onError: (_err: any, _id: any, context: any) => {
      queryClient.setQueryData(['aulas'], context.previousAulas);
      toast.error('Erro ao recusar sessão');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['aulas'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const terminarMutation = useMutation({
    mutationFn: async ({ id, avaliacao, obs_termino }: { id: number; avaliacao: number; obs_termino?: string }) => {
      await api.post(`/api/aulas/${id}/terminar`, { avaliacao, obs_termino });
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ['aulas'] });
      const previousAulas = queryClient.getQueryData(['aulas']);
      queryClient.setQueryData(['aulas'], (old: any[]) =>
        old.map((session) => session.id === id ? { ...session, estado: 'terminada' } : session)
      );
      toast.success('Sessão terminada!');
      return { previousAulas };
    },
    onError: (_err: any, _vars: any, context: any) => {
      queryClient.setQueryData(['aulas'], context.previousAulas);
      toast.error('Erro ao terminar sessão');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['aulas'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setIsTerminarOpen(false);
      setTerminarRating(0);
      setTerminarObs('');
      setTerminarSessionId(null);
    },
  });

  const openTerminarModal = (sessionId: number) => {
    setTerminarSessionId(sessionId);
    setTerminarRating(0);
    setTerminarObs('');
    setIsTerminarOpen(true);
  };

  const handleSubmitTerminar = () => {
    if (!terminarSessionId || terminarRating < 1) {
      toast.error('Seleciona uma avaliação (1 a 5 estrelas).');
      return;
    }
    terminarMutation.mutate({
      id: terminarSessionId,
      avaliacao: terminarRating,
      obs_termino: terminarObs || undefined,
    });
  };

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Hoje';
    if (isTomorrow(date)) return 'Amanhã';
    if (isThisWeek(date)) return format(date, 'EEEE', { locale: pt });
    return format(date, "d 'de' MMM", { locale: pt });
  };

  const confirmedCount = mentorSessions.filter((s: any) => s.estado === 'confirmada').length;
  const uniqueLocations = new Set(mentorSessions.map((s: any) => s.estabelecimento_nome)).size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold">
          Olá, {user?.name?.split(' ')[0] || 'Mentor'}!
        </h1>
        <p className="text-muted-foreground mt-1">
          {pendingSessions.length > 0
            ? `Tens ${pendingSessions.length} ${pendingSessions.length === 1 ? 'sessão' : 'sessões'} por confirmar.`
            : 'Todas as tuas sessões estão confirmadas.'
          }
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-3">
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Confirmadas</p>
                <p className="text-2xl font-bold font-display mt-1">{confirmedCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Total</p>
              </div>
              <div className="p-2 rounded-lg bg-green-500/10 shrink-0">
                <CalendarCheck className="h-4 w-4 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Por confirmar</p>
                <p className="text-2xl font-bold font-display mt-1">{pendingSessions.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Aguardam resposta</p>
              </div>
              <div className="p-2 rounded-lg bg-yellow-500/10 shrink-0">
                <Clock className="h-4 w-4 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Locais</p>
                <p className="text-2xl font-bold font-display mt-1">{uniqueLocations}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Instituições</p>
              </div>
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Confirmations */}
      {pendingSessions.length > 0 && (
        <Card className="border-yellow-200 dark:border-yellow-900 bg-yellow-50/50 dark:bg-yellow-900/10">
          <div className="px-5 pt-4 pb-3">
            <h2 className="font-semibold flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
              <Clock className="h-4 w-4" />
              Sessões por confirmar
              <Badge variant="secondary" className="ml-1 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400">
                {pendingSessions.length}
              </Badge>
            </h2>
          </div>
          <CardContent className="pt-0 space-y-2">
            {pendingSessions.map((session: any) => (
              <div
                key={session.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-card border border-yellow-100 dark:border-yellow-900/50 border-l-2 border-l-yellow-400"
              >
                <div className="flex items-start gap-3">
                  <div className="text-center min-w-[64px] py-1.5 px-2 rounded-lg bg-secondary shrink-0">
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">
                      {getDateLabel(session.data_hora)}
                    </p>
                    <p className="text-base font-bold font-display leading-tight">
                      {format(new Date(session.data_hora), 'HH:mm')}
                    </p>
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-medium truncate">{session.estabelecimento_nome}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {session.local || 'Sem local'}
                      </span>
                      <span>·</span>
                      <span>{session.turma_nome}</span>
                      <span>·</span>
                      <span>{session.duracao_minutos} min</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 sm:flex-col min-w-[110px]">
                  <Button
                    size="sm"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => confirmMutation.mutate(session.id)}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Confirmar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                    onClick={() => rejectMutation.mutate(session.id)}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Recusar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Sessions to Finish */}
      {toFinishSessions.length > 0 && (
        <Card className="border-[#06bede]/30 bg-[#06bede]/5">
          <div className="px-5 pt-4 pb-3">
            <h2 className="font-semibold flex items-center gap-2 text-[#06bede]">
              <CheckCircle2 className="h-4 w-4" />
              Sessões por terminar
              <Badge variant="secondary" className="ml-1">{toFinishSessions.length}</Badge>
            </h2>
          </div>
          <CardContent className="pt-0 space-y-2">
            {toFinishSessions.map((session: any) => (
              <div
                key={session.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-card border border-border border-l-2 border-l-gray-400"
              >
                <div className="flex items-start gap-3">
                  <div className="text-center min-w-[64px] py-1.5 px-2 rounded-lg bg-secondary shrink-0">
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">
                      {getDateLabel(session.data_hora)}
                    </p>
                    <p className="text-base font-bold font-display leading-tight">
                      {format(new Date(session.data_hora), 'HH:mm')}
                    </p>
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-medium truncate">{session.estabelecimento_nome}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {session.local || 'Sem local'}
                      </span>
                      <span>·</span>
                      <span>{session.turma_nome}</span>
                      <span>·</span>
                      <span>{session.duracao_minutos} min</span>
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="bg-[#06bede] hover:bg-[#059ab5] text-white shrink-0"
                  onClick={() => openTerminarModal(session.id)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Terminar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upcoming Sessions */}
      <Card>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="font-semibold">Próximas Sessões</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{upcomingSessions.length} confirmada{upcomingSessions.length !== 1 ? 's' : ''}</p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/horarios">
              Ver agenda <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
        <CardContent className="pt-0">
          {upcomingSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="p-3 rounded-full bg-secondary mb-3">
                <CalendarClock className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Sem sessões confirmadas futuras.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingSessions.slice(0, 5).map((session: any) => (
                <div
                  key={session.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-secondary/30 border-l-2 border-l-green-500"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-center min-w-[52px] py-1.5 px-2 rounded-lg bg-secondary shrink-0">
                      <p className="text-[10px] text-muted-foreground uppercase font-medium">
                        {getDateLabel(session.data_hora)}
                      </p>
                      <p className="text-sm font-bold font-display leading-tight">
                        {format(new Date(session.data_hora), 'HH:mm')}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{session.estabelecimento_nome}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {session.local || 'Sem local'} · {session.turma_nome}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <Badge className={statusColors[session.estado] || statusColors.confirmada}>
                      Confirmada
                    </Badge>
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/registos">
                        <ClipboardList className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Outras Tarefas */}
      <OutrasTarefasWidget />

      {/* Terminar Sessão Modal */}
      <Dialog open={isTerminarOpen} onOpenChange={setIsTerminarOpen}>
        <DialogContent className="w-full sm:max-w-[420px] max-h-[95dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[#06bede]" />
              Terminar Sessão
            </DialogTitle>
            <DialogDescription>
              Avalia a sessão e adiciona observações opcionais.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label className="font-medium">Avaliação desta Sessão</Label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <Star
                    key={n}
                    className={cn(
                      'h-8 w-8 cursor-pointer transition-colors',
                      n <= terminarRating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30 hover:text-yellow-300'
                    )}
                    onClick={() => setTerminarRating(n)}
                  />
                ))}
                {terminarRating > 0 && (
                  <span className="text-sm text-muted-foreground ml-2">{terminarRating}/5</span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-medium">Observações</Label>
              <Textarea
                placeholder="Como correu a sessão? Notas relevantes..."
                value={terminarObs}
                onChange={e => setTerminarObs(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSubmitTerminar}
              disabled={terminarRating < 1 || terminarMutation.isPending}
              className="bg-[#06bede] hover:bg-[#059ab5] text-white"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Submeter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
