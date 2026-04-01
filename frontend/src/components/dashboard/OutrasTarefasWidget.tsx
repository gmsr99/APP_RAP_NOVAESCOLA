import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { CheckSquare, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, isPast, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';

interface Tarefa {
  id: number;
  titulo: string;
  prioridade: 'baixo' | 'medio' | 'alto' | 'urgente';
  data_limite?: string;
  meu_estado?: 'pendente' | 'em_progresso' | 'concluida' | null;
  estado_global?: string;
  atribuicoes: { user_id: string; estado: string }[];
}

const prioridadeDot: Record<string, string> = {
  urgente: 'bg-red-500',
  alto:    'bg-orange-500',
  medio:   'bg-yellow-500',
  baixo:   'bg-muted-foreground/40',
};

export function OutrasTarefasWidget() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const { data: tarefas = [] } = useQuery<Tarefa[]>({
    queryKey: ['tarefas'],
    queryFn: async () => (await api.get('/api/tarefas')).data,
  });

  const concluirMutation = useMutation({
    mutationFn: (id: number) =>
      api.patch(`/api/tarefas/${id}/estado`, { estado: 'concluida' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] });
      toast.success('Tarefa concluída!');
    },
    onError: () => toast.error('Erro ao concluir tarefa.'),
  });

  // Show only non-concluded, assigned to me or general
  const minhas = tarefas.filter(t =>
    t.estado_global !== 'concluida' &&
    (t.atribuicoes.length === 0 || t.atribuicoes.some(a => a.user_id === user?.id))
  ).slice(0, 5);

  const confirmTarefa = minhas.find(t => t.id === confirmId);

  if (minhas.length === 0) return null;

  return (
    <>
      <Card>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-primary" />
              Outras Tarefas
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">{minhas.length} pendente{minhas.length !== 1 ? 's' : ''}</p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/tarefas">Ver todas <ArrowRight className="h-4 w-4 ml-1" /></Link>
          </Button>
        </div>
        <CardContent className="pt-0 space-y-1.5">
          {minhas.map(t => {
            const isGeral = t.atribuicoes.length === 0;
            const deadline = t.data_limite ? parseISO(t.data_limite) : null;
            const vencido = deadline && isPast(deadline);

            return (
              <div key={t.id} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-secondary/30">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.titulo}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {isGeral && <Badge variant="outline" className="text-[10px] py-0">Geral</Badge>}
                    {deadline && (
                      <span className={cn('text-[10px] flex items-center gap-0.5', vencido ? 'text-red-500 font-semibold' : 'text-muted-foreground')}>
                        {vencido && <AlertTriangle className="h-3 w-3" />}
                        {format(deadline, 'd MMM', { locale: pt })}
                      </span>
                    )}
                    <span className={cn('h-2 w-2 rounded-full shrink-0', prioridadeDot[t.prioridade])} />
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 h-7 text-xs gap-1.5"
                  onClick={() => setConfirmId(t.id)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Terminar
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <AlertDialog open={confirmId !== null} onOpenChange={open => { if (!open) setConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminar tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarefa ? `"${confirmTarefa.titulo}"` : 'Esta tarefa'} será marcada como concluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmId !== null) concluirMutation.mutate(confirmId);
                setConfirmId(null);
              }}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
