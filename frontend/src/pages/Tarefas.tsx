import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { endOfDay, format, isPast, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  Edit2,
  ListFilter,
  Plus,
  Save,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

interface Tarefa {
  id: number;
  titulo: string;
  descricao?: string;
  prioridade: 'baixo' | 'medio' | 'alto' | 'urgente';
  data_limite?: string;
  criado_por: string;
  created_at: string;
  meu_estado?: 'pendente' | 'em_progresso' | 'concluida' | null;
  estado_global?: string;
  atribuicoes: { user_id: string; estado: string }[];
}

interface EquipaMember {
  id: string;
  full_name: string;
  role: string;
}

type TarefaFilter = 'todas' | 'minhas' | 'gerais' | 'prioritarias';

const prioridadeConfig = {
  urgente: {
    label: 'Urgente',
    badgeClassName: 'border-[hsl(var(--brand)/0.45)] bg-[hsl(var(--brand)/0.18)] text-orange-100',
    accentClassName: 'bg-[hsl(var(--brand))]',
  },
  alto: {
    label: 'Alta',
    badgeClassName: 'border-orange-400/40 bg-orange-400/15 text-orange-100',
    accentClassName: 'bg-orange-400',
  },
  medio: {
    label: 'Média',
    badgeClassName: 'border-[hsl(var(--primary)/0.35)] bg-[hsl(var(--primary)/0.14)] text-cyan-100',
    accentClassName: 'bg-[hsl(var(--primary))]',
  },
  baixo: {
    label: 'Baixa',
    badgeClassName: 'border-white/12 bg-white/5 text-slate-100',
    accentClassName: 'bg-slate-400/70',
  },
};

const estadoConfig = {
  pendente: { label: 'Pendente', icon: Circle, className: 'text-slate-300' },
  em_progresso: { label: 'Em progresso', icon: Clock, className: 'text-[hsl(var(--primary))]' },
  concluida: { label: 'Concluída', icon: CheckCircle2, className: 'text-emerald-400' },
};

const prioridadeOrder = {
  urgente: 0,
  alto: 1,
  medio: 2,
  baixo: 3,
};

function getDeadlineDate(value?: string) {
  return value ? endOfDay(parseISO(value)) : null;
}

function isDeadlineOverdue(tarefa: Tarefa) {
  const deadline = getDeadlineDate(tarefa.data_limite);
  return Boolean(deadline && isPast(deadline) && tarefa.estado_global !== 'concluida');
}

function sortTarefas(items: Tarefa[]) {
  return [...items].sort((a, b) => {
    const aDeadline = getDeadlineDate(a.data_limite);
    const bDeadline = getDeadlineDate(b.data_limite);

    if (aDeadline && bDeadline && aDeadline.getTime() !== bDeadline.getTime()) {
      return aDeadline.getTime() - bDeadline.getTime();
    }

    if (aDeadline && !bDeadline) return -1;
    if (!aDeadline && bDeadline) return 1;

    const prioDiff = prioridadeOrder[a.prioridade] - prioridadeOrder[b.prioridade];
    if (prioDiff !== 0) return prioDiff;

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: number;
  hint: string;
  tone?: 'default' | 'primary' | 'danger' | 'success';
}) {
  const toneClassName = {
    default: 'border-border/70 bg-card',
    primary: 'border-[hsl(var(--primary)/0.28)] bg-card',
    danger: 'border-[hsl(var(--brand)/0.32)] bg-card',
    success: 'border-emerald-400/25 bg-card',
  }[tone];

  const valueClassName = {
    default: 'text-white',
    primary: 'text-[hsl(var(--primary))]',
    danger: 'text-orange-300',
    success: 'text-emerald-300',
  }[tone];

  return (
    <Card className={cn('rounded-2xl shadow-none', toneClassName)}>
      <CardContent className="p-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-300/80">{label}</p>
        <p className={cn('mt-1 text-2xl font-semibold leading-none', valueClassName)}>{value}</p>
        <p className="mt-1 text-xs text-slate-300/75">{hint}</p>
      </CardContent>
    </Card>
  );
}

export default function Tarefas() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { profile } = useProfile();
  const isCoord = profile === 'coordenador' || profile === 'direcao' || profile === 'it_support';

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTarefa, setEditingTarefa] = useState<Tarefa | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmConcluirId, setConfirmConcluirId] = useState<number | null>(null);
  const [showConcluidas, setShowConcluidas] = useState(false);
  const [activeFilter, setActiveFilter] = useState<TarefaFilter>('todas');

  const emptyForm = { titulo: '', descricao: '', prioridade: 'medio', data_limite: '', user_ids: [] as string[] };
  const [form, setForm] = useState(emptyForm);

  const { data: tarefas = [], isLoading: isLoadingTarefas } = useQuery<Tarefa[]>({
    queryKey: ['tarefas'],
    queryFn: async () => (await api.get('/api/tarefas')).data,
  });

  const { data: equipa = [], isLoading: isLoadingEquipa } = useQuery<EquipaMember[]>({
    queryKey: ['equipa'],
    queryFn: async () => (await api.get('/api/equipa')).data,
  });

  const saveMutation = useMutation({
    mutationFn: (data: typeof form) =>
      editingTarefa
        ? api.put(`/api/tarefas/${editingTarefa.id}`, data)
        : api.post('/api/tarefas', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] });
      toast.success(editingTarefa ? 'Tarefa atualizada!' : 'Tarefa criada!');
      setIsDialogOpen(false);
      setForm(emptyForm);
    },
    onError: () => toast.error('Erro ao guardar tarefa.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/tarefas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] });
      toast.success('Tarefa apagada!');
    },
  });

  const estadoMutation = useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: string }) =>
      api.patch(`/api/tarefas/${id}/estado`, { estado }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tarefas'] }),
    onError: () => toast.error('Erro ao atualizar estado.'),
  });

  const openNew = () => {
    setEditingTarefa(null);
    setForm(emptyForm);
    setIsDialogOpen(true);
  };

  const openEdit = (t: Tarefa) => {
    setEditingTarefa(t);
    setForm({
      titulo: t.titulo,
      descricao: t.descricao || '',
      prioridade: t.prioridade,
      data_limite: t.data_limite || '',
      user_ids: t.atribuicoes.map(a => a.user_id),
    });
    setIsDialogOpen(true);
  };

  const toggleUser = (uid: string) => {
    setForm(prev => ({
      ...prev,
      user_ids: prev.user_ids.includes(uid)
        ? prev.user_ids.filter(u => u !== uid)
        : [...prev.user_ids, uid],
    }));
  };

  const nextEstado = (current: string | null | undefined) => {
    if (!current || current === 'pendente') return 'em_progresso';
    if (current === 'em_progresso') return 'concluida';
    return 'pendente';
  };

  const ativas = tarefas.filter(t => t.estado_global !== 'concluida');
  const concluidas = sortTarefas(tarefas.filter(t => t.estado_global === 'concluida'));

  const filterCounts = {
    todas: ativas.length,
    minhas: ativas.filter(t => t.atribuicoes.some(a => a.user_id === user?.id)).length,
    gerais: ativas.filter(t => t.atribuicoes.length === 0).length,
    prioritarias: ativas.filter(t => t.prioridade === 'urgente' || t.prioridade === 'alto' || isDeadlineOverdue(t)).length,
  };

  const filteredAtivas = sortTarefas(ativas.filter(t => {
    if (activeFilter === 'minhas') return t.atribuicoes.some(a => a.user_id === user?.id);
    if (activeFilter === 'gerais') return t.atribuicoes.length === 0;
    if (activeFilter === 'prioritarias') return t.prioridade === 'urgente' || t.prioridade === 'alto' || isDeadlineOverdue(t);
    return true;
  }));

  const atrasadas = filteredAtivas.filter(isDeadlineOverdue);
  const emProgresso = filteredAtivas.filter(t => !isDeadlineOverdue(t) && t.meu_estado === 'em_progresso');
  const porTratar = filteredAtivas.filter(t => !isDeadlineOverdue(t) && t.meu_estado !== 'em_progresso');

  const pendingCount = ativas.length;
  const inProgressCount = ativas.filter(t => t.meu_estado === 'em_progresso').length;
  const overdueCount = ativas.filter(isDeadlineOverdue).length;
  const completedCount = concluidas.length;
  const equipaMap = new Map(equipa.map(member => [member.id, member.full_name]));

  const TarefaCard = ({ t }: { t: Tarefa }) => {
    const prio = prioridadeConfig[t.prioridade] ?? prioridadeConfig.medio;
    const isGeral = t.atribuicoes.length === 0;
    const meuEstado = t.meu_estado;
    const isMinhaAtribuicao = !!meuEstado;
    const isMinhaConcluida = meuEstado === 'concluida';
    const estadoCfg = estadoConfig[meuEstado as keyof typeof estadoConfig] ?? estadoConfig.pendente;
    const EstadoIcon = estadoCfg.icon;
    const deadline = getDeadlineDate(t.data_limite);
    const deadlineVencido = isDeadlineOverdue(t);
    const concluidoCount = t.atribuicoes.filter(a => a.estado === 'concluida').length;
    const assignmentLabel = isGeral
      ? 'Geral'
      : t.atribuicoes.length > 1
        ? `${t.atribuicoes.length} pessoas`
        : 'Individual';
    const assignedNames = t.atribuicoes
      .map(a => equipaMap.get(a.user_id))
      .filter((name): name is string => Boolean(name));
    const atribuicaoTexto = isGeral
      ? 'Disponível para toda a equipa'
      : assignedNames.length > 0
        ? assignedNames.join(', ')
        : assignmentLabel;

    return (
      <Card
        className={cn(
          'relative overflow-hidden rounded-2xl border bg-card shadow-none transition-colors',
          isMinhaConcluida && 'opacity-70',
          deadlineVencido ? 'border-[hsl(var(--brand)/0.4)]' : 'border-border/70'
        )}
      >
        <div className={cn('pointer-events-none absolute inset-y-4 left-0 w-1 rounded-r-full', deadlineVencido ? 'bg-[hsl(var(--brand))]' : prio.accentClassName)} />
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              {isMinhaAtribuicao && !isCoord && (
                <button
                  className={cn(
                    'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-background transition-colors',
                    deadlineVencido && 'border-[hsl(var(--brand)/0.35)] bg-[hsl(var(--brand)/0.08)]',
                    estadoCfg.className
                  )}
                  onClick={() => estadoMutation.mutate({ id: t.id, estado: nextEstado(meuEstado) })}
                  aria-label={`Atualizar estado de ${t.titulo}`}
                >
                  <EstadoIcon className="h-4 w-4" />
                </button>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-medium', prio.badgeClassName)}>
                    {prio.label}
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-white/12 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-slate-100">
                    {assignmentLabel}
                  </Badge>
                  {isMinhaAtribuicao && (
                    <Badge variant="outline" className="rounded-full border-white/12 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-slate-100">
                      <EstadoIcon className={cn('mr-1 h-3 w-3', estadoCfg.className)} />
                      {estadoCfg.label}
                    </Badge>
                  )}
                </div>

                <div className="mt-2 flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm font-semibold leading-snug text-white', isMinhaConcluida && 'line-through')}>
                      {t.titulo}
                    </p>
                    {t.descricao && (
                      <p className="mt-1 text-sm leading-5 text-slate-300/80 line-clamp-3">
                        {t.descricao}
                      </p>
                    )}
                  </div>

                  {isCoord && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 rounded-full p-0"
                      onClick={() => openEdit(t)}
                      aria-label={`Editar ${t.titulo}`}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className={cn(
                'rounded-xl border px-3 py-2',
                deadlineVencido
                  ? 'border-[hsl(var(--brand)/0.35)] bg-[hsl(var(--brand)/0.08)] text-orange-50'
                  : 'border-border/70 bg-muted/30'
              )}>
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Prazo</p>
                <div className={cn('mt-1 flex items-center gap-1.5 text-sm font-medium text-white', deadlineVencido && 'text-orange-50')}>
                  <CalendarClock className="h-4 w-4" />
                  {deadline ? format(deadline, 'd MMMM', { locale: pt }) : 'Sem data limite'}
                  {deadlineVencido && <AlertTriangle className="h-4 w-4" />}
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Atribuição</p>
                <div className="mt-1 flex items-center gap-1.5 text-sm font-medium text-white">
                  {isGeral ? <Users className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  <span className="break-words">{atribuicaoTexto}</span>
                </div>
                {t.atribuicoes.length > 1 && (
                  <p className="mt-1 text-xs text-slate-300/75">
                    {concluidoCount}/{t.atribuicoes.length} concluídas
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
              {isCoord && isMinhaAtribuicao ? (
                <button
                  className={cn('flex items-center gap-1.5 text-sm font-medium', estadoCfg.className)}
                  onClick={() => estadoMutation.mutate({ id: t.id, estado: nextEstado(meuEstado) })}
                >
                  <EstadoIcon className="h-4 w-4" />
                  Marcar como {nextEstado(meuEstado) === 'em_progresso' ? 'em progresso' : nextEstado(meuEstado) === 'concluida' ? 'concluída' : 'pendente'}
                </button>
              ) : (
                <p className="text-xs text-slate-300/70">
                  {deadlineVencido ? 'Precisa de atenção imediata.' : 'Ação rápida disponível abaixo.'}
                </p>
              )}

              {t.estado_global !== 'concluida' && meuEstado !== 'concluida' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 w-full rounded-xl sm:w-auto"
                  onClick={() => setConfirmConcluirId(t.id)}
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  Terminar tarefa
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const TaskSection = ({
    title,
    subtitle,
    items,
    tone = 'default',
  }: {
    title: string;
    subtitle: string;
    items: Tarefa[];
    tone?: 'default' | 'danger';
  }) => {
    if (items.length === 0) return null;

    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">{title}</h2>
            <p className="text-sm text-slate-300/75">{subtitle}</p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-medium',
              tone === 'danger'
                ? 'border-[hsl(var(--brand)/0.4)] bg-[hsl(var(--brand)/0.16)] text-orange-100'
                : 'border-border/70 bg-muted/30 text-slate-100'
            )}
          >
            {items.length}
          </Badge>
        </div>

        <div className="space-y-3">
          {items.map(t => <TarefaCard key={t.id} t={t} />)}
        </div>
      </section>
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 pb-24 pt-4 md:px-6 md:pb-6 md:pt-6">
      <Card className="overflow-hidden rounded-3xl border-border/70 bg-card shadow-none">
        <CardContent className="p-4 md:p-5">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                    <CheckSquare className="h-5 w-5" />
                  </span>
                  <div>
                    <h1 className="text-lg font-semibold text-white md:text-xl">Tarefas Internas</h1>
                    <p className="text-sm text-slate-200/80">Tudo organizado para leitura rápida e ação no telemóvel.</p>
                  </div>
                </div>
              </div>

              {isCoord && (
                <Button size="sm" onClick={openNew} className="h-10 shrink-0 rounded-xl px-3">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Nova
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Pendentes" value={pendingCount} hint="Tarefas ativas" tone="primary" />
              <StatCard label="Em progresso" value={inProgressCount} hint="Já iniciadas" />
              <StatCard label="Atrasadas" value={overdueCount} hint="Precisam de atenção" tone="danger" />
              <StatCard label="Concluídas" value={completedCount} hint="Fechadas" tone="success" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-300/75">
                <ListFilter className="h-3.5 w-3.5" />
                Filtros rápidos
              </div>

              <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
                <div className="flex w-max gap-2">
                  {([
                    { key: 'todas', label: 'Todas', count: filterCounts.todas },
                    { key: 'minhas', label: 'Minhas', count: filterCounts.minhas },
                    { key: 'gerais', label: 'Gerais', count: filterCounts.gerais },
                    { key: 'prioritarias', label: 'Prioritárias', count: filterCounts.prioritarias },
                  ] as const).map(filter => (
                    <button
                      key={filter.key}
                      className={cn(
                        'rounded-full border px-3 py-2 text-sm font-medium transition-colors',
                        activeFilter === filter.key
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-white hover:bg-muted'
                      )}
                      onClick={() => setActiveFilter(filter.key)}
                    >
                      {filter.label}
                      <span className={cn(
                        'ml-2 rounded-full px-1.5 py-0.5 text-[11px]',
                        activeFilter === filter.key
                          ? 'bg-black/10 text-[hsl(var(--primary-foreground))]'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        {filter.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoadingTarefas ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="rounded-2xl border-border/70 bg-card shadow-none">
              <CardContent className="space-y-3 p-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredAtivas.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-border/80 bg-card shadow-none">
          <CardContent className="flex flex-col items-center justify-center px-6 py-10 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <h2 className="mt-4 text-base font-semibold text-white">Nada por mostrar neste filtro</h2>
            <p className="mt-1 max-w-sm text-sm text-slate-300/75">
              Experimenta outro filtro ou vê as concluídas para recuperar contexto.
            </p>
            {activeFilter !== 'todas' && (
              <Button variant="outline" className="mt-4 rounded-xl" onClick={() => setActiveFilter('todas')}>
                Ver todas as tarefas
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <TaskSection
            title="Atrasadas"
            subtitle="Prazo ultrapassado, convém desbloquear primeiro."
            items={atrasadas}
            tone="danger"
          />

          <TaskSection
            title="Em progresso"
            subtitle="Tarefas já iniciadas e que pedem acompanhamento."
            items={emProgresso}
          />

          <TaskSection
            title="Por tratar"
            subtitle="Tudo o que ainda está por arrancar ou sem estado iniciado."
            items={porTratar}
          />
        </div>
      )}

      {concluidas.length > 0 && (
        <Card className="rounded-2xl border-border/70 bg-card shadow-none">
          <CardContent className="p-4">
            <button
              className="flex w-full items-center justify-between gap-3 text-left"
              onClick={() => setShowConcluidas(v => !v)}
            >
              <div>
                <p className="text-base font-semibold text-white">Concluídas</p>
                <p className="text-sm text-slate-300/75">Arquivo recente para consulta rápida.</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="rounded-full border-emerald-400/25 bg-emerald-400/12 px-2.5 py-1 text-xs font-medium text-emerald-100">
                  {concluidas.length}
                </Badge>
                {showConcluidas ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </button>

            {showConcluidas && (
              <div className="mt-4 space-y-3">
                {concluidas.map(t => <TarefaCard key={t.id} t={t} />)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg rounded-3xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTarefa ? 'Editar tarefa' : 'Nova tarefa'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label>Título <span className="text-destructive">*</span></Label>
              <Input
                value={form.titulo}
                onChange={e => setForm({ ...form, titulo: e.target.value })}
                placeholder="Descrição curta da tarefa"
              />
            </div>

            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Textarea
                value={form.descricao}
                onChange={e => setForm({ ...form, descricao: e.target.value })}
                rows={3}
                placeholder="Contexto adicional, notas ou próximos passos..."
                className="resize-none"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={v => setForm({ ...form, prioridade: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixo">Baixo</SelectItem>
                    <SelectItem value="medio">Médio</SelectItem>
                    <SelectItem value="alto">Alto</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Data limite</Label>
                <Input
                  type="date"
                  value={form.data_limite}
                  onChange={e => setForm({ ...form, data_limite: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Atribuir a</Label>
              <p className="text-xs text-muted-foreground">Se não escolheres ninguém, a tarefa fica geral para a equipa.</p>

              <div className="max-h-56 overflow-y-auto rounded-2xl border border-border/80">
                {isLoadingEquipa ? (
                  <div className="space-y-2 p-3">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <Skeleton key={index} className="h-10 w-full rounded-xl" />
                    ))}
                  </div>
                ) : (
                  equipa.map(m => (
                    <label
                      key={m.id}
                      className="flex items-center gap-3 border-b border-border/60 px-3 py-3 last:border-b-0 hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={form.user_ids.includes(m.id)}
                        onCheckedChange={() => toggleUser(m.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{m.full_name}</p>
                        <p className="text-xs text-muted-foreground">{m.role}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            {editingTarefa ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setIsDialogOpen(false);
                  setConfirmDeleteId(editingTarefa.id);
                }}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Apagar
              </Button>
            ) : (
              <div />
            )}

            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.titulo.trim() || saveMutation.isPending}
            >
              <Save className="mr-1.5 h-4 w-4" />
              Gravar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteId !== null} onOpenChange={open => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar tarefa?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação é irreversível.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDeleteId) deleteMutation.mutate(confirmDeleteId);
                setConfirmDeleteId(null);
              }}
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmConcluirId !== null} onOpenChange={open => !open && setConfirmConcluirId(null)}>
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Terminar tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const t = tarefas.find(item => item.id === confirmConcluirId);
                return t ? `"${t.titulo}" será marcada como concluída.` : 'A tarefa será marcada como concluída.';
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmConcluirId) estadoMutation.mutate({ id: confirmConcluirId, estado: 'concluida' });
                setConfirmConcluirId(null);
              }}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
