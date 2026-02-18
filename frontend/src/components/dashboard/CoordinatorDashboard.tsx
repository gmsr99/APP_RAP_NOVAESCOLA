import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  MapPin,
  Users,
  AlertTriangle,
  Music,
  Package,
  Plus,
  ArrowRight,
  Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

const statusColors: Record<string, string> = {
  rascunho: 'bg-muted text-muted-foreground',
  pendente: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900',
  confirmada: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-200 dark:border-green-900',
  recusada: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900',
};

const statusLabels: Record<string, string> = {
  rascunho: 'Rascunho',
  pendente: 'Pendente',
  confirmada: 'Confirmada',
  recusada: 'Recusada',
};

export function CoordinatorDashboard() {
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

  const pendingSessions = sessions.filter((s: any) => s.estado === 'pendente');
  const todaySessions = sessions.filter((s: any) =>
    format(new Date(s.data_hora), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  ).sort((a: any, b: any) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime());

  // Calculate real stats
  const sessionsThisWeek = sessions.length; // Simplified for now
  const activeLocations = new Set(sessions.map((s: any) => s.estabelecimento_nome)).size;
  const activeMentors = new Set(sessions.map((s: any) => s.mentor_id)).size;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Resumo da atividade do projeto.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/horarios">
              <Plus className="h-4 w-4 mr-2" />
              Nova Sessão
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Sessões
            </CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display">{sessions.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingSessions.length} por confirmar
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Locais ativos
            </CardTitle>
            <MapPin className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display">{activeLocations}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Instituições com sessões
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Mentores ativos
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display">{activeMentors}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Com sessões agendadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Equipa Total
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display">{equipa.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Membros registados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {pendingSessions.length > 0 && (
        <Card className="border-yellow-200 dark:border-yellow-900 bg-yellow-50/50 dark:bg-yellow-900/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="h-5 w-5" />
              Atenção necessária
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-medium">{pendingSessions.length} sessões por confirmar</p>
                  <p className="text-sm text-muted-foreground">
                    Aguardam resposta dos mentores
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/horarios">Ver todas</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's Sessions */}
        <Card className="col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Sessões de Hoje</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/horarios">
                Ver todas <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {todaySessions.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">
                Sem sessões agendadas para hoje.
              </p>
            ) : (
              <div className="space-y-3">
                {todaySessions.map((session: any) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-center min-w-[60px]">
                        <p className="text-lg font-bold font-display">
                          {format(new Date(session.data_hora), 'HH:mm')}
                        </p>
                        <p className="text-xs text-muted-foreground">{session.duracao_minutos}min</p>
                      </div>
                      <div>
                        <p className="font-medium">{session.estabelecimento_nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {session.turma_nome} • {session.mentor_nome || 'Sem mentor'}
                        </p>
                      </div>
                    </div>
                    <Badge className={statusColors[session.estado] || statusColors.confirmada}>
                      {statusLabels[session.estado] || session.estado}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
