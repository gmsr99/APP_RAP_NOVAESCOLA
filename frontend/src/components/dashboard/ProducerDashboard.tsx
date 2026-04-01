import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Music,
  ArrowRight,
  MessageSquare,
  CheckCircle2,
  Clock,
  Disc3,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { OutrasTarefasWidget } from './OutrasTarefasWidget';

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

const stageBorderColors: Record<string, string> = {
  'gravação': 'border-l-info',
  'edição': 'border-l-warning',
  'pool_mistura': 'border-l-primary',
  'mistura_wip': 'border-l-primary',
  'pool_feedback': 'border-l-destructive',
  'feedback_wip': 'border-l-destructive',
  'pool_finalização': 'border-l-success',
  'finalização_wip': 'border-l-success',
  'concluído': 'border-l-success',
};

export function ProducerDashboard() {
  const { user } = useAuth();

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
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold">
          Olá, {(user as any)?.user_metadata?.full_name?.split(' ')[0] || 'Produtor'}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Tens {stats.em_producao || 0} música{stats.em_producao !== 1 ? 's' : ''} em produção.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Em produção</p>
                <p className="text-2xl sm:text-3xl font-bold font-display mt-1">{stats.em_producao || 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Músicas ativas</p>
              </div>
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <Music className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Aguardam feedback</p>
                <p className="text-2xl sm:text-3xl font-bold font-display mt-1">{stats.aguardam_feedback || 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Precisam de revisão</p>
              </div>
              <div className="p-2 rounded-lg bg-warning/10 shrink-0">
                <MessageSquare className="h-5 w-5 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Finalizadas</p>
                <p className="text-2xl sm:text-3xl font-bold font-display mt-1">{stats.finalizadas_mes || 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Este mês</p>
              </div>
              <div className="p-2 rounded-lg bg-success/10 shrink-0">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Total no pipeline</p>
                <p className="text-2xl sm:text-3xl font-bold font-display mt-1">{stats.total_pipeline || 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Todas as músicas</p>
              </div>
              <div className="p-2 rounded-lg bg-indigo-500/10 shrink-0">
                <Disc3 className="h-5 w-5 text-indigo-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Actions */}
      {acaoNecessaria.length > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <div className="px-5 pt-4 pb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              Ação necessária
              <Badge variant="secondary" className="ml-1">{acaoNecessaria.length}</Badge>
            </h2>
          </div>
          <CardContent className="pt-0 space-y-2">
            {acaoNecessaria.map((music: any) => (
              <div
                key={music.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg bg-card border border-warning/20 border-l-2 border-l-warning"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{music.titulo}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {music.turma} · {music.estabelecimento}
                  </p>
                  {music.feedback && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
                      {music.feedback}
                    </p>
                  )}
                </div>
                <Button size="sm" asChild className="shrink-0">
                  <Link to="/producao">Rever</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* My Music */}
      <Card>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="font-semibold">As minhas músicas</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{minhasMusicas.length} música{minhasMusicas.length !== 1 ? 's' : ''} atribuída{minhasMusicas.length !== 1 ? 's' : ''}</p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/producao">
              Ver pipeline <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
        <CardContent className="pt-0">
          {minhasMusicas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="p-3 rounded-full bg-secondary mb-3">
                <Music className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Ainda não tens músicas atribuídas.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {minhasMusicas.map((music: any) => (
                <div
                  key={music.id}
                  className={`flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/30 border-l-2 ${stageBorderColors[music.estado] || 'border-l-transparent'}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${stageColors[music.estado] || 'bg-muted'}`}>
                      <Music className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{music.titulo}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {music.turma} · {music.estabelecimento}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`shrink-0 text-xs ${stageColors[music.estado] || 'bg-muted'}`}>
                    {stageLabels[music.estado] || music.estado}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Outras Tarefas */}
      <OutrasTarefasWidget />
    </div>
  );
}
