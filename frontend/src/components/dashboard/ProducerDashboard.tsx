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
import { musics, getMusicsByProducer, currentUser } from '@/data/mockData';
import { Link } from 'react-router-dom';
import { MusicStage } from '@/types';

const stageLabels: Record<MusicStage, string> = {
  gravacao: 'Gravação',
  edicao: 'Edição',
  mistura: 'Mistura',
  feedback: 'Feedback',
  finalizacao: 'Finalização',
};

const stageColors: Record<MusicStage, string> = {
  gravacao: 'bg-info/20 text-info border-info/30',
  edicao: 'bg-warning/20 text-warning border-warning/30',
  mistura: 'bg-primary/20 text-primary border-primary/30',
  feedback: 'bg-destructive/20 text-destructive border-destructive/30',
  finalizacao: 'bg-success/20 text-success border-success/30',
};

const stageIcons: Record<MusicStage, React.ElementType> = {
  gravacao: Disc3,
  edicao: Music,
  mistura: Music,
  feedback: MessageSquare,
  finalizacao: CheckCircle2,
};

import { useProfile } from '@/contexts/ProfileContext';

export function ProducerDashboard() {
  const { user } = useProfile();
  const producerMusics = getMusicsByProducer(currentUser.produtor.id);
  const musicsByStage = {
    gravacao: producerMusics.filter(m => m.stage === 'gravacao'),
    edicao: producerMusics.filter(m => m.stage === 'edicao'),
    mistura: producerMusics.filter(m => m.stage === 'mistura'),
    feedback: producerMusics.filter(m => m.stage === 'feedback'),
    finalizacao: producerMusics.filter(m => m.stage === 'finalizacao'),
  };

  const pendingFeedback = musics.filter(m => m.stage === 'feedback');
  const inProgress = producerMusics.filter(m => m.stage !== 'finalizacao');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-display font-bold">Olá, {user?.name?.split(' ')[0] || 'Produtor'}!</h1>
        <p className="text-muted-foreground mt-1">
          Tens {inProgress.length} música{inProgress.length !== 1 ? 's' : ''} em produção.
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
            <div className="text-3xl font-bold font-display">{inProgress.length}</div>
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
            <div className="text-3xl font-bold font-display">{pendingFeedback.length}</div>
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
              {musicsByStage.finalizacao.length}
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
            <div className="text-3xl font-bold font-display">{musics.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Todas as músicas</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Actions */}
      {pendingFeedback.length > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              Ação necessária
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingFeedback.map((music) => (
              <div
                key={music.id}
                className="flex items-center justify-between p-4 rounded-lg bg-card"
              >
                <div className="space-y-1">
                  <p className="font-medium">{music.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {music.turma} • {music.project}
                  </p>
                  {music.feedback && music.feedback.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {music.feedback.map((fb, i) => (
                        <p key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-warning" />
                          {fb}
                        </p>
                      ))}
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
          {producerMusics.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">
              Ainda não tens músicas atribuídas.
            </p>
          ) : (
            <div className="space-y-3">
              {producerMusics.map((music) => {
                const Icon = stageIcons[music.stage];
                return (
                  <div
                    key={music.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-secondary/30"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${stageColors[music.stage]}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{music.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {music.turma} • {music.project}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className={stageColors[music.stage]}>
                        {stageLabels[music.stage]}
                      </Badge>
                      <div className="mt-2 w-24 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${music.progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{music.progress}%</p>
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
