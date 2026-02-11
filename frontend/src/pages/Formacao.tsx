import { useProfile } from '@/contexts/ProfileContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BookOpen, FileText, Video, CheckCircle2, Clock, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrainingLesson {
  id: string;
  title: string;
  type: 'video' | 'document' | 'quiz';
  duration: string;
  completed: boolean;
}

interface TrainingModule {
  id: string;
  name: string;
  description: string;
  lessons: TrainingLesson[];
  locked?: boolean;
}

// Módulos de formação por perfil
const trainingModules: Record<string, TrainingModule[]> = {
  coordenador: [
    {
      id: 'coord-1',
      name: 'Gestão de Equipa',
      description: 'Como coordenar mentores e produtores',
      lessons: [
        { id: 'c1-1', title: 'Introdução à coordenação', type: 'video', duration: '12 min', completed: true },
        { id: 'c1-2', title: 'Gestão de conflitos', type: 'video', duration: '18 min', completed: true },
        { id: 'c1-3', title: 'Avaliação de desempenho', type: 'document', duration: '10 min', completed: false },
      ],
    },
    {
      id: 'coord-2',
      name: 'Visão Geral do Projeto',
      description: 'Entender todos os processos do RAP Nova Escola',
      lessons: [
        { id: 'c2-1', title: 'História e missão', type: 'video', duration: '15 min', completed: true },
        { id: 'c2-2', title: 'Metodologia RAP', type: 'document', duration: '20 min', completed: false },
        { id: 'c2-3', title: 'Indicadores de sucesso', type: 'document', duration: '15 min', completed: false },
      ],
    },
  ],
  mentor: [
    {
      id: 'mentor-1',
      name: 'Oficina de PT',
      description: 'Técnicas de escrita criativa e expressão em português',
      lessons: [
        { id: 'm1-1', title: 'Escrita de letras', type: 'video', duration: '20 min', completed: true },
        { id: 'm1-2', title: 'Rima e métrica', type: 'video', duration: '15 min', completed: true },
        { id: 'm1-3', title: 'Storytelling no RAP', type: 'document', duration: '12 min', completed: false },
        { id: 'm1-4', title: 'Exercícios práticos', type: 'quiz', duration: '10 min', completed: false },
      ],
    },
    {
      id: 'mentor-2',
      name: 'Oficina de Música',
      description: 'Fundamentos musicais para produção',
      lessons: [
        { id: 'm2-1', title: 'Teoria musical básica', type: 'video', duration: '25 min', completed: true },
        { id: 'm2-2', title: 'Estrutura de uma música', type: 'video', duration: '18 min', completed: false },
        { id: 'm2-3', title: 'Instrumentação', type: 'document', duration: '15 min', completed: false },
      ],
    },
    {
      id: 'mentor-3',
      name: 'Clube de RAP',
      description: 'Dinâmicas de grupo e sessões práticas',
      lessons: [
        { id: 'm3-1', title: 'Gerir uma sessão', type: 'video', duration: '22 min', completed: true },
        { id: 'm3-2', title: 'Técnicas de freestyle', type: 'video', duration: '20 min', completed: true },
        { id: 'm3-3', title: 'Criar ambiente seguro', type: 'document', duration: '10 min', completed: false },
      ],
    },
    {
      id: 'mentor-4',
      name: 'Clube de Produção',
      description: 'Introdução à produção com jovens',
      lessons: [
        { id: 'm4-1', title: 'Software de produção', type: 'video', duration: '30 min', completed: false },
        { id: 'm4-2', title: 'Criar beats simples', type: 'video', duration: '25 min', completed: false },
        { id: 'm4-3', title: 'Workflow em grupo', type: 'document', duration: '12 min', completed: false },
      ],
    },
    {
      id: 'mentor-5',
      name: 'Produção das Músicas',
      description: 'Acompanhar o processo de gravação a finalização',
      lessons: [
        { id: 'm5-1', title: 'Fases da produção', type: 'video', duration: '18 min', completed: true },
        { id: 'm5-2', title: 'Dar feedback construtivo', type: 'video', duration: '15 min', completed: false },
        { id: 'm5-3', title: 'Qualidade final', type: 'document', duration: '10 min', completed: false },
      ],
    },
    {
      id: 'mentor-6',
      name: 'Registos',
      description: 'Documentar sessões e progresso',
      lessons: [
        { id: 'm6-1', title: 'Importância dos registos', type: 'video', duration: '10 min', completed: true },
        { id: 'm6-2', title: 'Como preencher registos', type: 'document', duration: '8 min', completed: true },
        { id: 'm6-3', title: 'Boas práticas', type: 'quiz', duration: '5 min', completed: false },
      ],
    },
  ],
  produtor: [
    {
      id: 'prod-1',
      name: 'Produção das Músicas',
      description: 'Dominar todo o pipeline de produção musical',
      lessons: [
        { id: 'p1-1', title: 'Gravação de vozes', type: 'video', duration: '25 min', completed: true },
        { id: 'p1-2', title: 'Edição e limpeza', type: 'video', duration: '30 min', completed: true },
        { id: 'p1-3', title: 'Mistura profissional', type: 'video', duration: '35 min', completed: true },
        { id: 'p1-4', title: 'Masterização básica', type: 'video', duration: '20 min', completed: false },
        { id: 'p1-5', title: 'Exportação e formatos', type: 'document', duration: '10 min', completed: false },
      ],
    },
    {
      id: 'prod-2',
      name: 'Estúdio',
      description: 'Operar e manter o estúdio de gravação',
      lessons: [
        { id: 'p2-1', title: 'Equipamento do estúdio', type: 'video', duration: '20 min', completed: true },
        { id: 'p2-2', title: 'Configuração de sessão', type: 'video', duration: '18 min', completed: true },
        { id: 'p2-3', title: 'Acústica e ambiente', type: 'document', duration: '15 min', completed: false },
        { id: 'p2-4', title: 'Manutenção preventiva', type: 'document', duration: '12 min', completed: false },
        { id: 'p2-5', title: 'Resolução de problemas', type: 'quiz', duration: '10 min', completed: false },
      ],
    },
  ],
};

const getModuleProgress = (lessons: TrainingLesson[]) => {
  const completed = lessons.filter((l) => l.completed).length;
  return Math.round((completed / lessons.length) * 100);
};

const getLessonIcon = (type: TrainingLesson['type']) => {
  switch (type) {
    case 'video':
      return Video;
    case 'document':
      return FileText;
    case 'quiz':
      return BookOpen;
  }
};

const Formacao = () => {
  const { profile } = useProfile();
  const modules = trainingModules[profile] || [];

  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const completedLessons = modules.reduce(
    (acc, m) => acc + m.lessons.filter((l) => l.completed).length,
    0
  );
  const overallProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Formação</h1>
        <p className="text-muted-foreground">
          Conteúdos e módulos de aprendizagem para o teu perfil
        </p>
      </div>

      {/* Overall Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progresso geral</span>
            <span className="text-sm text-muted-foreground">
              {completedLessons} de {totalLessons} lições completas
            </span>
          </div>
          <Progress value={overallProgress} className="h-3" />
          <p className="text-xs text-muted-foreground mt-2">{overallProgress}% concluído</p>
        </CardContent>
      </Card>

      {/* Modules Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => {
          const progress = getModuleProgress(module.lessons);
          const isComplete = progress === 100;

          return (
            <Card
              key={module.id}
              className={cn(
                'transition-all hover:shadow-md cursor-pointer',
                module.locked && 'opacity-60'
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{module.name}</CardTitle>
                  {isComplete ? (
                    <Badge variant="secondary" className="bg-success/20 text-success">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Completo
                    </Badge>
                  ) : module.locked ? (
                    <Badge variant="outline">
                      <Lock className="h-3 w-3 mr-1" />
                      Bloqueado
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      <Clock className="h-3 w-3 mr-1" />
                      {progress}%
                    </Badge>
                  )}
                </div>
                <CardDescription>{module.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={progress} className="h-2 mb-4" />
                <div className="space-y-2">
                  {module.lessons.map((lesson) => {
                    const Icon = getLessonIcon(lesson.type);
                    return (
                      <div
                        key={lesson.id}
                        className={cn(
                          'flex items-center gap-3 text-sm p-2 rounded-md transition-colors',
                          lesson.completed
                            ? 'text-muted-foreground bg-muted/30'
                            : 'hover:bg-muted/50'
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className={cn('flex-1', lesson.completed && 'line-through')}>
                          {lesson.title}
                        </span>
                        <span className="text-xs text-muted-foreground">{lesson.duration}</span>
                        {lesson.completed && (
                          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Formacao;
