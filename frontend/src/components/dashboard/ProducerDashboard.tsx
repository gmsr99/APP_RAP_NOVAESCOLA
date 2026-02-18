import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Music,
  ArrowRight,
  MessageSquare,
  CheckCircle2,
  Clock,
  Disc3
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

// Map backend estados to display labels
const stageLabels: Record<string, string> = {
  'gravação': 'Gravação',
  'edição': 'Edição',
  'pool_mistura': 'Aguarda Mistura',
  'mistura_wip': 'Mistura',
  'pool_feedback': 'Aguarda Feedback',
  'feedback_wip': 'Feedback',
  'pool_finalização': 'Aguarda Finalização',
  'finalização_wip': 'Finalização',
  'concluído': 'Concluído'
};

const stageColors: Record<string, string> = {
  'gravação': 'bg-info/20 text-info border-info/30',
  'edição': 'bg-warning/20 text-warning border-warning/30',
  'pool_mistura': 'bg-primary/20 text-primary border-primary/30',
  'mistura_wip': 'bg-primary/20 text-primary border-primary/30',
  'pool_feedback': 'bg-destructive/20 text-destructive border-destructive/30',
  'feedback_wip': 'bg-destructive/20 text-destructive border-destructive/30',
  'pool_finalização': 'bg-success/20 text-success border-success/30',
  'finalização_wip': 'bg-success/20 text-success border-success/30',
  'concluído': 'bg-success/20 text-success border-success/30'
};

export function ProducerDashboard() {
  const { user } = useAuth();

  // Fetch dashboard data
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard', 'produtor'],
    queryFn: async () => {
      const res = await api.get('/api/dashboard/produtor');
      return res.data;
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">A carregar dashboard...</p>
        </div>
      </div>
    );
  }

  const stats = dashboardData?.stats || {};
  const acaoNecessaria = dashboardData?.acao_necessaria || [];
  const minhasMusicas = dashboardData?.minhas_musicas || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-display font-bold">Olá, {(user as any)?.user_metadata?.full_name?.split(' ')[0] || 'Produtor'}!</h1>
        <p className="text-muted-foreground mt-1">
          Tens {stats.em_producao || 0} música{stats.em_producao !== 1 ? 's' : ''} em produção.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Em produção
            </CardTitle>
            <Music className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display">{stats.em_producao || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Músicas ativas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aguardam feedback
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display">{stats.aguardam_feedback || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Precisam de revisão</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Finalizadas
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display">
              {stats.finalizadas_mes || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total no pipeline
            </CardTitle>
            <Disc3 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display">{stats.total_pipeline || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Todas as músicas</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Actions */}
      {acaoNecessaria.length > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              Ação necessária
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {acaoNecessaria.map((music: any) => (
              <div
                key={music.id}
                className="flex items-center justify-between p-4 rounded-lg bg-card"
              >
                <div className="space-y-1">
                  <p className="font-medium">{music.titulo}</p>
                  <p className="text-sm text-muted-foreground">
                    {music.turma} • {music.estabelecimento}
                  </p>
                  {music.feedback && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-warning" />
                        {music.feedback}
                      </p>
                    </div>
                  )}
                </div>
                <Button size="sm" asChild>
                  <Link to="/producao">Rever</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* My Music */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">As minhas músicas</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/producao">
              Ver pipeline <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {minhasMusicas.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">
              Ainda não tens músicas atribuídas.
            </p>
          ) : (
            <div className="space-y-3">
              {minhasMusicas.map((music: any) => {
                return (
                  <div
                    key={music.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-secondary/30"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${stageColors[music.estado] || 'bg-muted'}`}>
                        <Music className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{music.titulo}</p>
                        <p className="text-sm text-muted-foreground">
                          {music.turma} • {music.estabelecimento}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className={stageColors[music.estado] || 'bg-muted'}>
                        {stageLabels[music.estado] || music.estado}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
