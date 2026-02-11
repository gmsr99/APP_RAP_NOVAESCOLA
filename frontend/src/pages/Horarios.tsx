import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  MapPin,
  Clock,
  User,
  Package,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  List,
  Calendar as CalendarIcon
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { sessions, users, equipment } from '@/data/mockData';
import { api } from '@/services/api';
import type { AulaAPI, Turma, AulaCreate } from '@/types';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  addWeeks,
  subWeeks,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  isSameMonth,
  getDay
} from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Session, SessionStatus } from '@/types';
import { useProfile } from '@/contexts/ProfileContext';

const statusColors: Record<SessionStatus, string> = {
  rascunho: 'bg-draft text-draft-foreground border-draft/50',
  pendente: 'bg-warning text-warning-foreground border-warning/50',
  confirmado: 'bg-success text-success-foreground border-success/50',
  recusado: 'bg-destructive text-destructive-foreground border-destructive/50',
};

const statusLabels: Record<SessionStatus, string> = {
  rascunho: 'Rascunho',
  pendente: 'Pendente',
  confirmado: 'Confirmado',
  recusado: 'Recusado',
};

const statusDots: Record<SessionStatus, string> = {
  rascunho: 'bg-draft',
  pendente: 'bg-warning',
  confirmado: 'bg-success',
  recusado: 'bg-destructive',
};

const Horarios = () => {
  const { profile } = useProfile();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'list'>('week');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Aulas do backend (FastAPI + Supabase)
  const apiUrl = import.meta.env.VITE_API_URL;
  const { data: aulasApi, isLoading: aulasLoading, error: aulasError } = useQuery({
    queryKey: ['aulas'],
    queryFn: () => api.get<AulaAPI[]>('/api/aulas'),
    enabled: !!apiUrl,
  });
  // Fetch turmas for dropdown
  const { data: turmas } = useQuery({
    queryKey: ['turmas'],
    queryFn: () => api.get<Turma[]>('/api/turmas'),
    enabled: !!apiUrl,
  });

  // Fetch mentores for dropdown (Replacing mock data)
  interface Mentor { id: number; nome: string; }
  const { data: mentoresApi } = useQuery({
    queryKey: ['mentores'],
    queryFn: () => api.get<Mentor[]>('/api/mentores'),
    enabled: !!apiUrl,
  });

  const [formData, setFormData] = useState<Partial<AulaCreate>>({
    duracao_minutos: 120,
    tipo: 'ensaio'
  });

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Month view calculations
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get the first day of the month (0 = Sunday, 1 = Monday, etc.)
  const startDayOfWeek = getDay(monthStart);
  // Adjust for Monday start (0 = Monday, 6 = Sunday)
  const adjustedStartDay = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  // Add padding days from previous month
  const prevMonthEnd = new Date(monthStart);
  prevMonthEnd.setDate(0);
  const paddingDays: Date[] = [];
  for (let i = adjustedStartDay - 1; i >= 0; i--) {
    const day = new Date(prevMonthEnd);
    day.setDate(prevMonthEnd.getDate() - i);
    paddingDays.push(day);
  }

  const getSessionsForDay = (date: Date) => {
    if (!aulasApi || !Array.isArray(aulasApi)) return [];
    return aulasApi.filter(a => isSameDay(new Date(a.data_hora), date));
  };

  // Navigation helpers
  const handlePrevious = () => {
    if (viewMode === 'month') {
      setCurrentMonth(subMonths(currentMonth, 1));
    } else {
      setCurrentWeek(subWeeks(currentWeek, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentMonth(addMonths(currentMonth, 1));
    } else {
      setCurrentWeek(addWeeks(currentWeek, 1));
    }
  };

  const handleToday = () => {
    setCurrentWeek(new Date());
    setCurrentMonth(new Date());
  };

  const getNavigationLabel = () => {
    if (viewMode === 'month') {
      return format(currentMonth, "MMMM yyyy", { locale: pt });
    }
    return `${format(weekStart, "d MMM", { locale: pt })} - ${format(weekEnd, "d MMM yyyy", { locale: pt })}`;
  };

  const mentors = users.filter(u => u.role === 'mentor');
  const availableEquipment = equipment.filter(e => e.status === 'disponivel');

  const handleCreateSession = async () => {
    // Validar inputs do DOM
    const dateStr = (document.getElementById('date') as HTMLInputElement)?.value;
    const timeStr = (document.getElementById('time') as HTMLInputElement)?.value;

    if (!dateStr || !timeStr) {
      alert("Data e Hora são obrigatórios");
      return;
    }

    if (!formData.turma_id) {
      alert("Turma é obrigatória");
      return;
    }

    try {


      const finalDateTime = `${dateStr} ${timeStr}`;

      const payload: AulaCreate = {
        turma_id: Number(formData.turma_id),
        data_hora: finalDateTime,
        duracao_minutos: Number(formData.duracao_minutos),
        mentor_id: formData.mentor_id ? Number(formData.mentor_id) : null,
        local: formData.local,
        tema: 'Sessão Regular', // Default theme
        tipo: 'plano_aula', // Default type, adjust as needed
        observacoes: ''
      };

      await api.post('/api/aulas', payload);
      setIsCreateOpen(false);
      // Invalidate query to refresh list
      // queryClient.invalidateQueries({ queryKey: ['aulas'] }); // Need queryClient instance
      window.location.reload(); // Temporary refresh
    } catch (error) {
      console.error("Erro ao criar aula:", error);
      alert("Erro ao criar aula. Verifica a consola.");
    }
  };

  return (
    <div className="space-y-6">
      {/* ... existing header ... */}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Planeamento de Horários</h1>
          <p className="text-muted-foreground mt-1">
            Gere sessões e acompanha confirmações.
          </p>
        </div>
        {profile === 'coordenador' && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Sessão
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-card">
              <DialogHeader>
                <DialogTitle className="font-display">Criar Nova Sessão</DialogTitle>
                <DialogDescription>
                  Preenche os detalhes da sessão. O mentor será notificado para confirmar.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Data</Label>
                    <Input id="date" type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Hora de início</Label>
                    <Input id="time" type="time" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duração (min)</Label>
                    <Input
                      id="duration"
                      type="number"
                      defaultValue={120}
                      onChange={(e) => setFormData({ ...formData, duracao_minutos: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mentor">Mentor</Label>
                    <Select onValueChange={(v) => setFormData({ ...formData, mentor_id: Number(v) })}>
                      <SelectTrigger id="mentor">
                        <SelectValue placeholder="Selecionar mentor" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {mentoresApi?.map((mentor) => (
                          <SelectItem key={mentor.id} value={String(mentor.id)}>
                            {mentor.nome}
                          </SelectItem>
                        )) || (
                            <div className="p-2 text-sm text-muted-foreground">Carregando...</div>
                          )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Turma Dropdown */}
                <div className="space-y-2">
                  <Label htmlFor="turma">Turma</Label>
                  <Select onValueChange={(v) => setFormData({ ...formData, turma_id: Number(v) })}>
                    <SelectTrigger id="turma">
                      <SelectValue placeholder="Selecionar Turma" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {turmas?.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">Local</Label>
                    <Input
                      id="location"
                      placeholder="Ex: Sala de Música"
                      onChange={(e) => setFormData({ ...formData, local: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateSession}>
                  Criar Sessão
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* View Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevious}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[200px] text-center">
            <p className="font-medium capitalize">
              {getNavigationLabel()}
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToday}
            className="ml-2"
          >
            Hoje
          </Button>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-secondary/50 p-1">
          <Button
            variant={viewMode === 'week' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('week')}
          >
            <CalendarDays className="h-4 w-4 mr-2" />
            Semana
          </Button>
          <Button
            variant={viewMode === 'month' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('month')}
          >
            <CalendarIcon className="h-4 w-4 mr-2" />
            Mês
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4 mr-2" />
            Lista
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {Object.entries(statusLabels).map(([status, label]) => (
          <div key={status} className="flex items-center gap-2">
            <div className={cn(
              'w-3 h-3 rounded-full',
              statusDots[status as SessionStatus]
            )} />
            <span className="text-sm text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* ... Calendar Views (using aulasApi) ... */}
      {/* Replaced sessions with aulasApi mapping */}

      {/* Week View */}
      {viewMode === 'week' && (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const daySessions = getSessionsForDay(day);
            const isToday = isSameDay(day, new Date());

            return (
              <div key={day.toISOString()} className="min-h-[200px]">
                <div className={cn(
                  'text-center py-2 rounded-t-lg',
                  isToday ? 'bg-primary text-primary-foreground' : 'bg-secondary'
                )}>
                  <p className="text-xs uppercase">
                    {format(day, 'EEE', { locale: pt })}
                  </p>
                  <p className="text-lg font-bold font-display">
                    {format(day, 'd')}
                  </p>
                </div>
                <div className="bg-card rounded-b-lg p-2 space-y-2 min-h-[160px] border border-t-0 border-border">
                  {daySessions.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Sem sessões
                    </p>
                  ) : (
                    daySessions.map((session) => (
                      <div
                        key={session.id}
                        className={cn(
                          'p-2 rounded-md text-xs border cursor-pointer hover:opacity-80 transition-opacity',
                          statusColors[session.estado as SessionStatus] || 'bg-secondary'
                        )}
                      >
                        <p className="font-bold">{format(new Date(session.data_hora), 'HH:mm')}</p>
                        <p className="truncate">{session.turma_nome ?? 'Sem turma'}</p>
                        <p className="truncate opacity-80">{session.mentor_nome?.split(' ')[0] ?? 'Sem mentor'}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Month View */}
      {viewMode === 'month' && (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 bg-secondary">
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => (
              <div key={day} className="text-center py-2 text-xs font-medium text-muted-foreground uppercase">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {/* Padding days from previous month */}
            {paddingDays.map((day, index) => (
              <div
                key={`padding-${index}`}
                className="min-h-[100px] p-2 border-t border-r border-border bg-secondary/20"
              >
                <p className="text-sm text-muted-foreground/50">
                  {format(day, 'd')}
                </p>
              </div>
            ))}

            {/* Month days */}
            {monthDays.map((day, index) => {
              const daySessions = getSessionsForDay(day);
              const isToday = isSameDay(day, new Date());
              const dayOfWeek = (adjustedStartDay + index) % 7;
              const isLastColumn = dayOfWeek === 6;

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'min-h-[100px] p-2 border-t border-border',
                    !isLastColumn && 'border-r',
                    isToday && 'bg-primary/5'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className={cn(
                      'text-sm font-medium',
                      isToday && 'bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center'
                    )}>
                      {format(day, 'd')}
                    </p>
                    {daySessions.length > 0 && (
                      <Badge variant="secondary" className="text-xs h-5">
                        {daySessions.length}
                      </Badge>
                    )}
                  </div>

                  {/* Session indicators */}
                  <div className="space-y-1">
                    {daySessions.slice(0, 3).map((session) => (
                      <div
                        key={session.id}
                        className={cn(
                          'text-xs px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80',
                          statusColors[session.estado as SessionStatus] || 'bg-secondary'
                        )}
                        title={`${format(new Date(session.data_hora), 'HH:mm')} - ${session.turma_nome}`}
                      >
                        <span className="font-medium">{format(new Date(session.data_hora), 'HH:mm')}</span>
                        <span className="ml-1 opacity-80">{session.mentor_nome?.split(' ')[0] ?? '—'}</span>
                      </div>
                    ))}
                    {daySessions.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{daySessions.length - 3} mais
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {aulasApi && Array.isArray(aulasApi) && aulasApi
            .filter(a => {
              const d = new Date(a.data_hora);
              return d >= weekStart && d <= weekEnd;
            })
            .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())
            .map((session) => (
              <Card key={session.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="text-center min-w-[70px] py-2 px-3 rounded-lg bg-secondary">
                        <p className="text-xs text-muted-foreground uppercase">
                          {format(new Date(session.data_hora), 'EEE', { locale: pt })}
                        </p>
                        <p className="text-lg font-bold font-display">
                          {format(new Date(session.data_hora), 'd')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(session.data_hora), 'MMM', { locale: pt })}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge className={statusColors[session.estado as SessionStatus] || 'bg-secondary'}>
                            {session.estado}
                          </Badge>
                          <span className="text-sm font-medium">{format(new Date(session.data_hora), 'HH:mm')}</span>
                        </div>
                        <p className="font-medium">{session.turma_nome}</p>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            {session.mentor_nome ?? 'Sem mentor'}
                          </span>
                        </div>
                      </div>
                    </div>
                    {profile === 'coordenador' && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">Editar</Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

    </div>
  );
};

export default Horarios;
