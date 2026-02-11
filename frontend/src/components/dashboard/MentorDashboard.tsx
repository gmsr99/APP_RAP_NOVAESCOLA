import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  MapPin,
  Clock,
  Check,
  X,
  ArrowRight,
  ClipboardList
} from 'lucide-react';
import { sessions, getSessionsByMentor, currentUser } from '@/data/mockData';
import { Link } from 'react-router-dom';
import { format, isToday, isTomorrow, isThisWeek } from 'date-fns';
import { pt } from 'date-fns/locale';

const statusColors = {
  rascunho: 'bg-draft text-draft-foreground',
  pendente: 'bg-warning text-warning-foreground',
  confirmado: 'bg-success text-success-foreground',
  recusado: 'bg-destructive text-destructive-foreground',
};

import { useProfile } from '@/contexts/ProfileContext';

export function MentorDashboard() {
  const { user } = useProfile();
  const mentorSessions = getSessionsByMentor(currentUser.mentor.id);
  // Note: We are still using mock sessions, but greeting should be real.

  // ... existing logic ...
  const pendingSessions = mentorSessions.filter(s => s.status === 'pendente');
  const upcomingSessions = mentorSessions
    .filter(s => s.status === 'confirmado' && new Date(s.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const getDateLabel = (date: Date) => {
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
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              Sessões por confirmar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingSessions.map((session) => (
              <div
                key={session.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-card"
              >
                <div className="flex items-start gap-4">
                  <div className="text-center min-w-[70px] py-2 px-3 rounded-lg bg-secondary">
                    <p className="text-xs text-muted-foreground uppercase">
                      {getDateLabel(session.date)}
                    </p>
                    <p className="text-lg font-bold font-display">{session.startTime}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">{session.institution}</p>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {session.location}
                      </span>
                      <span>•</span>
                      <span>{session.turma}</span>
                      <span>•</span>
                      <span>{session.duration} min</span>
                    </div>
                    {session.equipment.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Equipamento: {session.equipment.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 sm:flex-col">
                  <Button size="sm" className="flex-1">
                    <Check className="h-4 w-4 mr-1" />
                    Confirmar
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 text-destructive hover:text-destructive">
                    <X className="h-4 w-4 mr-1" />
                    Recusar
                  </Button>
                </div>
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
            <Check className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display">
              {mentorSessions.filter(s => s.status === 'confirmado').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Esta semana</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Por confirmar
            </CardTitle>
            <Clock className="h-4 w-4 text-warning" />
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
              {new Set(mentorSessions.map(s => s.institution)).size}
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
              Sem sessões confirmadas de momento.
            </p>
          ) : (
            <div className="space-y-3">
              {upcomingSessions.slice(0, 5).map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-secondary/30"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[70px] py-2 px-3 rounded-lg bg-secondary">
                      <p className="text-xs text-muted-foreground uppercase">
                        {getDateLabel(session.date)}
                      </p>
                      <p className="text-lg font-bold font-display">{session.startTime}</p>
                    </div>
                    <div>
                      <p className="font-medium">{session.institution}</p>
                      <p className="text-sm text-muted-foreground">
                        {session.location} • {session.turma}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[session.status]}>
                      Confirmado
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
    </div>
  );
}
