import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Calendar,
  MapPin,
  Clock,
  Check,
  X,
  ArrowRight,
  ClipboardList,
  Star,
  CheckCircle2,
} from 'lucide-react';
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
  terminada: 'bg-[#6B7280] text-white border-[#6B7280]',
};

export function MentorDashboard() {
  const { user } = useProfile();
  const queryClient = useQueryClient();

  // Terminar modal state
  const [isTerminarOpen, setIsTerminarOpen] = useState(false);
  const [terminarSessionId, setTerminarSessionId] = useState<number | null>(null);
  const [terminarRating, setTerminarRating] = useState(0);
  const [terminarObs, setTerminarObs] = useState('');

  // Fetch all sessions
  const { data: allSessions = [] } = useQuery({
    queryKey: ['aulas'],
    queryFn: async () => {
      const res = await api.get('/api/aulas');
      return res.data;
    }
  });

  // Filter sessions for current mentor
  const mentorSessions = allSessions.filter((s: any) => s.mentor_user_id === user?.id);

  const pendingSessions = mentorSessions.filter((s: any) => s.estado === 'pendente');

  // Sessões por terminar: confirmadas, presenciais, cuja hora já passou
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

      queryClient.setQueryData(['aulas'], (old: any[]) => {
        return old.map((session) =>
          session.id === id ? { ...session, estado: 'confirmada' } : session
        );
      });

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

      queryClient.setQueryData(['aulas'], (old: any[]) => {
        return old.map((session) =>
          session.id === id ? { ...session, estado: 'recusada' } : session
        );
      });

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

      queryClient.setQueryData(['aulas'], (old: any[]) => {
        return old.map((session) =>
          session.id === id ? { ...session, estado: 'terminada' } : session
        );
      });

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
    return format(date, "d 'de' MMMM", { locale: pt });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-display font-bold">Olá, {user?.name?.split(' ')[0] || 'Mentor'}!</h1>
        <p className="text-muted-foreground mt-1">
          {pendingSessions.length > 0
            ? `Tens ${pendingSessions.length} sessão${pendingSessions.length > 1 ? 'ões' : ''} por confirmar.`
            : 'Todas as tuas sessões estão confirmadas.'
          }
        </p>
      </div>

      {/* Pending Confirmations */}
      {pendingSessions.length > 0 && (
        <Card className="border-yellow-200 dark:border-yellow-900 bg-yellow-50/50 dark:bg-yellow-900/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
              <Clock className="h-5 w-5" />
              Sessões por confirmar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingSessions.map((session: any) => (
              <div
                key={session.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-card border border-border shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <div className="text-center min-w-[70px] py-2 px-3 rounded-lg bg-secondary">
                    <p className="text-xs text-muted-foreground uppercase">
                      {getDateLabel(session.data_hora)}
                    </p>
                    <p className="text-lg font-bold font-display">
                      {format(new Date(session.data_hora), 'HH:mm')}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">{session.estabelecimento_nome}</p>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {session.local || 'Sem local'}
                      </span>
                      <span>•</span>
                      <span>{session.turma_nome}</span>
                      <span>•</span>
                      <span>{session.duracao_minutos} min</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 sm:flex-col min-w-[120px]">
                  <Button
                    size="sm"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => confirmMutation.mutate(session.id)}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Confirmar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                    onClick={() => rejectMutation.mutate(session.id)}
                  >
                    <X className="h-4 w-4 mr-1" />
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
        <Card className="border-[#6B7280]/30 bg-[#6B7280]/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-[#6B7280]">
              <CheckCircle2 className="h-5 w-5" />
              Sessões por terminar
              <Badge variant="secondary" className="ml-1">{toFinishSessions.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {toFinishSessions.map((session: any) => (
              <div
                key={session.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-card border border-border shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <div className="text-center min-w-[70px] py-2 px-3 rounded-lg bg-secondary">
                    <p className="text-xs text-muted-foreground uppercase">
                      {getDateLabel(session.data_hora)}
                    </p>
                    <p className="text-lg font-bold font-display">
                      {format(new Date(session.data_hora), 'HH:mm')}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">{session.estabelecimento_nome}</p>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {session.local || 'Sem local'}
                      </span>
                      <span>•</span>
                      <span>{session.turma_nome}</span>
                      <span>•</span>
                      <span>{session.duracao_minutos} min</span>
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="bg-[#6B7280] hover:bg-[#555e68] text-white min-w-[120px]"
                  onClick={() => openTerminarModal(session.id)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Terminar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sessões confirmadas
            </CardTitle>
            <Check className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display">
              {mentorSessions.filter((s: any) => s.estado === 'confirmada').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Por confirmar
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display">{pendingSessions.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Aguardam resposta</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Locais diferentes
            </CardTitle>
            <MapPin className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display">
              {new Set(mentorSessions.map((s: any) => s.estabelecimento_nome)).size}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Instituições</p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Sessions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Próximas Sessões</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/horarios">
              Ver agenda <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {upcomingSessions.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">
              Sem sessões confirmadas futuras.
            </p>
          ) : (
            <div className="space-y-3">
              {upcomingSessions.slice(0, 5).map((session: any) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-secondary/30"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[70px] py-2 px-3 rounded-lg bg-secondary">
                      <p className="text-xs text-muted-foreground uppercase">
                        {getDateLabel(session.data_hora)}
                      </p>
                      <p className="text-lg font-bold font-display">
                        {format(new Date(session.data_hora), 'HH:mm')}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">{session.estabelecimento_nome}</p>
                      <p className="text-sm text-muted-foreground">
                        {session.local || 'Sem local'} • {session.turma_nome}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
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

      {/* Terminar Sessão Modal */}
      <Dialog open={isTerminarOpen} onOpenChange={setIsTerminarOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[#6B7280]" />
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
              className="bg-[#6B7280] hover:bg-[#555e68] text-white"
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
