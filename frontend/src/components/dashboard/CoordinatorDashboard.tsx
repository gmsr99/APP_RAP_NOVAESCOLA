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
import { dashboardStats, sessions, musics, equipment } from '@/data/mockData';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

const statusColors = {
  rascunho: 'bg-draft text-draft-foreground',
  pendente: 'bg-warning text-warning-foreground',
  confirmado: 'bg-success text-success-foreground',
  recusado: 'bg-destructive text-destructive-foreground',
};

const statusLabels = {
  rascunho: 'Rascunho',
  pendente: 'Pendente',
  confirmado: 'Confirmado',
  recusado: 'Recusado',
};

export function CoordinatorDashboard() {
  const pendingSessions = sessions.filter(s => s.status === 'pendente');
  const todaySessions = sessions.filter(s => 
    format(s.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  );
  const equipmentInMaintenance = equipment.filter(e => e.status === 'manutencao');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Bem-vindo de volta! Aqui está o resumo do projeto.
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
              Sessões esta semana
            </CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display">{dashboardStats.sessionsThisWeek}</div>
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
            <div className="text-3xl font-bold font-display">{dashboardStats.activeLocations}</div>
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
            <div className="text-3xl font-bold font-display">{dashboardStats.activeMentors}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Com sessões agendadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Músicas em produção
            </CardTitle>
            <Music className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display">{dashboardStats.musicInProduction}</div>
            <p className="text-xs text-muted-foreground mt-1">
              No pipeline atual
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {(pendingSessions.length > 0 || equipmentInMaintenance.length > 0) && (
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Atenção necessária
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingSessions.length > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-card">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-warning" />
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
            )}
            {equipmentInMaintenance.length > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-card">
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-warning" />
                  <div>
                    <p className="font-medium">{equipmentInMaintenance.length} equipamento em manutenção</p>
                    <p className="text-sm text-muted-foreground">
                      {equipmentInMaintenance.map(e => e.name).join(', ')}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/equipamento">Gerir</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's Sessions */}
        <Card>
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
                {todaySessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-center min-w-[60px]">
                        <p className="text-lg font-bold font-display">{session.startTime}</p>
                        <p className="text-xs text-muted-foreground">{session.duration}min</p>
                      </div>
                      <div>
                        <p className="font-medium">{session.institution}</p>
                        <p className="text-sm text-muted-foreground">
                          {session.turma} • {session.mentor.name}
                        </p>
                      </div>
                    </div>
                    <Badge className={statusColors[session.status]}>
                      {statusLabels[session.status]}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Music Production Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Produção Musical</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/producao">
                Ver pipeline <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {musics.slice(0, 4).map((music) => (
                <div
                  key={music.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                >
                  <div>
                    <p className="font-medium">{music.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {music.turma} • {music.responsible.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="capitalize">
                      {music.stage.replace('cao', 'ção')}
                    </Badge>
                    <div className="mt-1 w-20 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${music.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
