import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Music,
  Plus,
  Archive,
  CheckCircle2,
  Circle,
  Clock,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

// Types
interface Musica {
  id: number;
  titulo: string;
  estado: string;
  disciplina: string | null;
  arquivado: boolean;
  criado_em: string;
  turma: {
    id: number;
    nome: string;
    instituicao: string;
  } | null;
}

interface Turma {
  id: number;
  nome: string;
  display_name: string;
}

const ESTADOS = ['gravação', 'edição', 'mistura', 'feedback', 'finalização'];

const Producao = () => {
  const [isNewMusicOpen, setIsNewMusicOpen] = useState(false);
  const [viewArchived, setViewArchived] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form State
  const [newMusicData, setNewMusicData] = useState({
    titulo: '',
    turma_id: '',
    disciplina: ''
  });

  // Queries
  const { data: musicas = [], isLoading } = useQuery({
    queryKey: ['musicas', viewArchived],
    queryFn: async () => {
      const res = await api.get(`/api/musicas?arquivadas=${viewArchived}`);
      return res.data as Musica[];
    }
  });

  const { data: turmas = [] } = useQuery({
    queryKey: ['turmas'],
    queryFn: async () => {
      const res = await api.get('/api/turmas');
      return res.data as Turma[];
    }
  });

  // Mutations
  const createMusicMutation = useMutation({
    mutationFn: (data: any) => api.post('/api/musicas', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['musicas'] });
      toast({ title: 'Música criada', description: 'Nova produção iniciada!' });
      setIsNewMusicOpen(false);
      setNewMusicData({ titulo: '', turma_id: '', disciplina: '' });
    },
    onError: () => toast({ title: 'Erro', description: 'Falha ao criar música.', variant: 'destructive' })
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: string }) =>
      api.patch(`/api/musicas/${id}/estado`, { estado }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['musicas'] });
      toast({ title: 'Estado atualizado', description: 'Progresso registado.' });
    }
  });

  const archiveMusicMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/api/musicas/${id}/arquivar`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['musicas'] });
      toast({ title: 'Música arquivada', description: 'Produção concluída e arquivada.' });
    }
  });

  const unarchiveMusicMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/api/musicas/${id}/desarquivar`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['musicas'] });
      toast({ title: 'Música recuperada', description: 'A música voltou para a produção.' });
    }
  });

  const handleSubmit = () => {
    if (!newMusicData.titulo || !newMusicData.turma_id) {
      toast({ title: 'Campos obrigatórios', description: 'Preenche o título e a turma.', variant: 'destructive' });
      return;
    }
    createMusicMutation.mutate({
      titulo: newMusicData.titulo,
      turma_id: parseInt(newMusicData.turma_id),
      disciplina: newMusicData.disciplina
    });
  };

  const getStepStatus = (current: string, step: string) => {
    const currentIndex = ESTADOS.indexOf(current.toLowerCase());
    const stepIndex = ESTADOS.indexOf(step.toLowerCase());
    if (currentIndex > stepIndex) return 'completed';
    if (currentIndex === stepIndex) return 'current';
    return 'upcoming';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">
            {viewArchived ? 'Arquivo Musical' : 'Produção Musical'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {viewArchived
              ? 'Histórico de músicas finalizadas.'
              : 'Acompanha o progresso de todas as músicas em produção.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setViewArchived(!viewArchived)}>
            {viewArchived ? 'Voltar à Produção' : 'Ver Arquivo'}
          </Button>
          {!viewArchived && (
            <Dialog open={isNewMusicOpen} onOpenChange={setIsNewMusicOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Música
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova Música</DialogTitle>
                  <DialogDescription>Inicia uma nova produção musical.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="titulo">Título da Música</Label>
                    <Input
                      id="titulo"
                      placeholder="Ex: Vozes do Bairro"
                      value={newMusicData.titulo}
                      onChange={(e) => setNewMusicData({ ...newMusicData, titulo: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="turma">Turma / Artista</Label>
                    <Select
                      value={newMusicData.turma_id}
                      onValueChange={(val) => setNewMusicData({ ...newMusicData, turma_id: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar turma" />
                      </SelectTrigger>
                      <SelectContent>
                        {turmas.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="disciplina">Disciplina (Opcional)</Label>
                    <Input
                      id="disciplina"
                      placeholder="Ex: Português"
                      value={newMusicData.disciplina}
                      onChange={(e) => setNewMusicData({ ...newMusicData, disciplina: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleSubmit} disabled={createMusicMutation.isPending}>
                    Criar Música
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Music List */}
      <div className="grid gap-6">
        {isLoading ? (
          <p>A carregar...</p>
        ) : musicas.length === 0 ? (
          <div className="text-center py-12 bg-muted/20 rounded-lg border-2 border-dashed">
            <Music className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
            <h3 className="mt-4 text-lg font-medium">Sem músicas encontradas</h3>
            <p className="text-muted-foreground">
              {viewArchived ? 'O arquivo está vazio.' : 'Começa por criar uma nova música!'}
            </p>
          </div>
        ) : (
          musicas.map((music) => (
            <Card key={music.id} className="overflow-hidden">
              <CardHeader className="bg-muted/30 pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="bg-background">
                        {music.turma?.instituicao || 'Sem Instituição'}
                      </Badge>
                      {music.disciplina && (
                        <Badge variant="secondary" className="text-xs">
                          {music.disciplina}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-xl">{music.titulo}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {music.turma?.nome} • Criado a {music.criado_em ? format(parseISO(music.criado_em), "d MMM yyyy", { locale: pt }) : '-'}
                    </p>
                  </div>
                  {music.estado === 'finalização' && !music.arquivado && !viewArchived && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 text-muted-foreground hover:text-foreground"
                      onClick={() => archiveMusicMutation.mutate(music.id)}
                    >
                      <Archive className="h-4 w-4" />
                      Arquivar
                    </Button>
                  )}
                  {viewArchived && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 text-muted-foreground hover:text-foreground"
                      onClick={() => unarchiveMusicMutation.mutate(music.id)}
                    >
                      <Archive className="h-4 w-4 rotate-180" />
                      Desarquivar
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {/* Stepper */}
                <div className="relative">
                  <div className="absolute top-1/2 left-0 w-full h-0.5 bg-muted -translate-y-1/2 z-0 hidden sm:block" />
                  <div className="flex flex-col sm:flex-row justify-between relative z-10 gap-4 sm:gap-0">
                    {ESTADOS.map((step, index) => {
                      const status = getStepStatus(music.estado, step);
                      const isClickable = !viewArchived && !music.arquivado;

                      return (
                        <div
                          key={step}
                          className={cn(
                            "flex sm:flex-col items-center gap-3 sm:gap-2 group",
                            isClickable && "cursor-pointer"
                          )}
                          onClick={() => isClickable && updateStatusMutation.mutate({ id: music.id, estado: step })}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all bg-background",
                            status === 'completed' && "border-primary bg-primary text-primary-foreground",
                            status === 'current' && "border-primary ring-4 ring-primary/20",
                            status === 'upcoming' && "border-muted-foreground/30 text-muted-foreground/30"
                          )}>
                            {status === 'completed' ? (
                              <CheckCircle2 className="h-5 w-5" />
                            ) : status === 'current' ? (
                              <Clock className="h-5 w-5 animate-pulse" />
                            ) : (
                              <Circle className="h-5 w-5" />
                            )}
                          </div>
                          <span className={cn(
                            "text-sm font-medium capitalize transition-colors",
                            status === 'current' && "text-primary font-bold",
                            status === 'upcoming' && "text-muted-foreground"
                          )}>
                            {step}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Producao;
