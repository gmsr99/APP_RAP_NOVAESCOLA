import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Calendar,
  MapPin,
  Users,
  AlertTriangle,
  Plus,
  ArrowRight,
  Star,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const statusBorderColors: Record<string, string> = {
  rascunho: 'border-l-muted-foreground/30',
  pendente: 'border-l-yellow-400',
  confirmada: 'border-l-green-500',
  recusada: 'border-l-red-500',
  terminada: 'border-l-gray-400',
};

const statusColors: Record<string, string> = {
  rascunho: 'bg-muted text-muted-foreground',
  pendente: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900',
  confirmada: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-200 dark:border-green-900',
  recusada: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900',
  terminada: 'bg-[#6B7280] text-white border-[#6B7280]',
};

const statusLabels: Record<string, string> = {
  rascunho: 'Rascunho',
  pendente: 'Pendente',
  confirmada: 'Confirmada',
  recusada: 'Recusada',
  terminada: 'Terminada',
};

export function CoordinatorDashboard() {
  const queryClient = useQueryClient();

  const [isTerminarOpen, setIsTerminarOpen] = useState(false);
  const [terminarSessionId, setTerminarSessionId] = useState<number | null>(null);
  const [terminarRating, setTerminarRating] = useState(0);
  const [terminarObs, setTerminarObs] = useState('');

  const { data: sessions = [] } = useQuery({
    queryKey: ['aulas'],
    queryFn: async () => {
      const res = await api.get('/api/aulas');
      return res.data;
    }
  });

  const { data: equipa = [] } = useQuery({
    queryKey: ['equipa'],
    queryFn: async () => {
      const res = await api.get('/api/equipa');
      return res.data;
    }
  });

  const terminarMutation = useMutation({
    mutationFn: async ({ id, avaliacao, obs_termino }: { id: number; avaliacao: number; obs_termino?: string }) => {
      const res = await api.post(`/api/aulas/${id}/terminar`, { avaliacao, obs_termino: obs_termino || undefined });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aulas'] });
      setIsTerminarOpen(false);
      setTerminarSessionId(null);
      setTerminarRating(0);
      setTerminarObs('');
    }
  });

  const openTerminarModal = (sessionId: number) => {
    setTerminarSessionId(sessionId);
    setTerminarRating(0);
    setTerminarObs('');
    setIsTerminarOpen(true);
  };

  const handleSubmitTerminar = () => {
    if (!terminarSessionId || terminarRating < 1) return;
    terminarMutation.mutate({ id: terminarSessionId, avaliacao: terminarRating, obs_termino: terminarObs });
  };

  const now = new Date();
  const pendingSessions = sessions.filter((s: any) => s.estado === 'pendente');
  const todaySessions = sessions.filter((s: any) =>
    format(new Date(s.data_hora), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  ).sort((a: any, b: any) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime());

  const activeLocations = new Set(sessions.map((s: any) => s.estabelecimento_nome)).size;
  const activeMentors = new Set(sessions.map((s: any) => s.mentor_id)).size;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1 capitalize">
            {format(now, "EEEE, d 'de' MMMM", { locale: pt })}
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link to="/horarios">
            <Plus className="h-4 w-4 mr-2" />
            Nova Sessão
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Total Sessões</p>
                <p className="text-2xl sm:text-3xl font-bold font-display mt-1">{sessions.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{pendingSessions.length} por confirmar</p>
              </div>
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Locais ativos</p>
                <p className="text-2xl sm:text-3xl font-bold font-display mt-1">{activeLocations}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Instituições com sessões</p>
              </div>
              <div className="p-2 rounded-lg bg-orange-500/10 shrink-0">
                <MapPin className="h-5 w-5 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Mentores ativos</p>
                <p className="text-2xl sm:text-3xl font-bold font-display mt-1">{activeMentors}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Com sessões agendadas</p>
              </div>
              <div className="p-2 rounded-lg bg-purple-500/10 shrink-0">
                <Users className="h-5 w-5 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Equipa Total</p>
                <p className="text-2xl sm:text-3xl font-bold font-display mt-1">{equipa.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Membros registados</p>
              </div>
              <div className="p-2 rounded-lg bg-indigo-500/10 shrink-0">
                <Users className="h-5 w-5 text-indigo-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert */}
      {pendingSessions.length > 0 && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-yellow-200 dark:border-yellow-900 bg-yellow-50/50 dark:bg-yellow-900/10">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-yellow-500/15 shrink-0">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="font-medium text-sm text-yellow-700 dark:text-yellow-400">
                {pendingSessions.length} sessão{pendingSessions.length > 1 ? 'ões' : ''} por confirmar
              </p>
              <p className="text-xs text-muted-foreground">Aguardam resposta dos mentores</p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link to="/horarios">Ver todas</Link>
          </Button>
        </div>
      )}

      {/* Today's Sessions */}
      <Card>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="font-semibold">Sessões de Hoje</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{todaySessions.length} sessão{todaySessions.length !== 1 ? 'ões' : ''} agendada{todaySessions.length !== 1 ? 's' : ''}</p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/horarios">
              Ver todas <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
        <CardContent className="pt-0">
          {todaySessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="p-3 rounded-full bg-secondary mb-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Sem sessões agendadas para hoje.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todaySessions.map((session: any) => (
                <div
                  key={session.id}
                  className={cn(
                    'flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-secondary/30 border-l-2',
                    statusBorderColors[session.estado] || 'border-l-transparent'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-center min-w-[52px]">
                      <p className="text-base font-bold font-display leading-none">
                        {format(new Date(session.data_hora), 'HH:mm')}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{session.duracao_minutos}min</p>
                    </div>
                    <div className="w-px h-8 bg-border shrink-0" />
                    <div>
                      <p className="font-medium text-sm">{session.estabelecimento_nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {session.turma_nome} · {session.mentor_nome || 'Sem mentor'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {session.estado === 'confirmada' && !session.is_autonomous && new Date(session.data_hora) < now && (
                      <Button size="sm" variant="outline" onClick={() => openTerminarModal(session.id)}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Terminar
                      </Button>
                    )}
                    <Badge className={statusColors[session.estado] || statusColors.confirmada}>
                      {statusLabels[session.estado] || session.estado}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Terminar Sessão Dialog */}
      <Dialog open={isTerminarOpen} onOpenChange={setIsTerminarOpen}>
        <DialogContent className="w-full sm:max-w-[425px] max-h-[95dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Terminar Sessão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Avaliação</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <Star
                    key={n}
                    className={cn(
                      'h-7 w-7 cursor-pointer transition-colors',
                      n <= terminarRating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
                    )}
                    onClick={() => setTerminarRating(n)}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={terminarObs}
                onChange={e => setTerminarObs(e.target.value)}
                placeholder="Observações sobre a sessão..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSubmitTerminar}
              disabled={terminarRating < 1 || terminarMutation.isPending}
            >
              {terminarMutation.isPending ? 'A submeter...' : 'Submeter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
