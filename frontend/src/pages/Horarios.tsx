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
  Calendar as CalendarIcon,
  Edit2,
  Trash2,
  Save,
  Filter,
  Info
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
import { computeEventLayout } from '@/lib/eventLayout';
import { addMinutes } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth for user ID

const statusColors: Record<SessionStatus, string> = {
  rascunho: 'bg-muted text-muted-foreground border-border/50',
  pendente: 'bg-[#3399cd] text-white border-[#3399cd]',
  confirmada: 'bg-[#4EA380] text-white border-[#4EA380]',
  recusada: 'bg-[#A35339] text-white border-[#A35339]',
};

// Removed 'rascunho' to hide from legend
const statusLabels: Record<string, string> = {
  pendente: 'Pendente',
  confirmada: 'Confirmada',
  recusada: 'Recusada',
};

const statusDots: Record<string, string> = {
  pendente: 'bg-[#3399cd]',
  confirmada: 'bg-[#4EA380]',
  recusada: 'bg-[#A35339]',
};

const Horarios = () => {
  const { profile } = useProfile();
  const { user } = useAuth(); // Get current user
  const [filterMode, setFilterMode] = useState<'all' | 'mine'>(profile === 'mentor' ? 'mine' : 'all');
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'list'>('week');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<AulaAPI | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [viewSession, setViewSession] = useState<AulaAPI | null>(null);

  const queryClient = useQueryClient();

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

  // Fetch Curriculo (Disciplinas + Atividades)
  const { data: curriculo } = useQuery({
    queryKey: ['curriculo'],
    queryFn: () => api.get<any[]>('/api/curriculo'),
    enabled: !!apiUrl,
  });

  // Fetch Equipamento
  const { data: equipamentos } = useQuery({
    queryKey: ['equipamento'],
    queryFn: () => api.get<any[]>('/api/equipamento'),
    enabled: !!apiUrl,
  });

  const [formData, setFormData] = useState<Partial<AulaCreate>>({
    duracao_minutos: 120,
    tipo: 'ensaio',
    atividade_id: null,
    equipamento_id: '',
    observacoes: ''
  });

  // Helper to get activities for selected discipline
  const [selectedDisciplinaId, setSelectedDisciplinaId] = useState<number | null>(null);

  const availableActivities = selectedDisciplinaId
    ? curriculo?.find(d => d.id === selectedDisciplinaId)?.atividades || []
    : [];

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

    let filtered = aulasApi.filter(a => isSameDay(new Date(a.data_hora), date));

    // Filter by "My Classes"
    if (filterMode === 'mine' && user) {
      // Assuming we can match by user_id or similar. 
      // The API returns mentor_user_id (UUID) which should match user.id
      filtered = filtered.filter(a => a.mentor_user_id === user.id);
    }

    return filtered;
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

  const createSessionMutation = useMutation({
    mutationFn: (data: AulaCreate) => api.post('/api/aulas', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aulas'] });
      setIsDialogOpen(false);
      resetForm();
      toast.success('Sessão criada com sucesso!');
    },
    onError: () => toast.error('Erro ao criar sessão.'),
  });

  const updateSessionMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AulaCreate> }) =>
      api.put(`/api/aulas/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aulas'] });
      setIsDialogOpen(false);
      resetForm();
      toast.success('Sessão atualizada com sucesso!');
    },
    onError: () => toast.error('Erro ao atualizar sessão.'),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/aulas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aulas'] });
      setIsDialogOpen(false);
      resetForm();
      toast.success('Sessão removida com sucesso!');
    },
    onError: () => toast.error('Erro ao remover sessão.'),
  });

  const resetForm = () => {
    setEditingSession(null);
    setFormData({
      duracao_minutos: 120,
      tipo: 'ensaio',
      atividade_id: null,
      equipamento_id: '',
      observacoes: ''
    });
    setSelectedDisciplinaId(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (session: AulaAPI) => {
    setEditingSession(session);
    setFormData({
      turma_id: session.turma_id,
      duracao_minutos: session.duracao_minutos,
      mentor_id: session.mentor_id,
      local: session.local,
      tema: session.tema,
      tipo: session.tipo,
      observacoes: session.observacoes,
      atividade_id: session.atividade_id,
      equipamento_id: session.equipamento_id
    });

    // Find discipline for the activity to populate dropdown
    if (session.atividade_id && curriculo) {
      const disc = curriculo.find(d => d.atividades.some((a: any) => a.id === session.atividade_id));
      if (disc) {
        setSelectedDisciplinaId(disc.id);
      }
    }
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    const dateStr = (document.getElementById('date') as HTMLInputElement)?.value;
    const timeStr = (document.getElementById('time') as HTMLInputElement)?.value;

    if (!dateStr || !timeStr) {
      toast.error("Data e Hora são obrigatórios");
      return;
    }

    if (!formData.turma_id) {
      toast.error("Turma é obrigatória");
      return;
    }

    const finalDateTime = `${dateStr} ${timeStr}`;

    const payload: AulaCreate = {
      turma_id: Number(formData.turma_id),
      data_hora: finalDateTime,
      duracao_minutos: Number(formData.duracao_minutos),
      mentor_id: formData.mentor_id ? Number(formData.mentor_id) : null,
      local: formData.local,
      tema: formData.tema || 'Sessão Regular',
      tipo: formData.tipo || 'plano_aula',
      observacoes: formData.observacoes || '',
      atividade_id: formData.atividade_id,
      equipamento_id: formData.equipamento_id
    };

    if (editingSession) {
      updateSessionMutation.mutate({ id: editingSession.id, data: payload });
    } else {
      createSessionMutation.mutate(payload);
    }
  };

  const handleDelete = () => {
    if (editingSession && confirm('Tem a certeza que deseja apagar esta sessão?')) {
      deleteSessionMutation.mutate(editingSession.id);
    }
  };

  const openDetailView = (session: AulaAPI) => {
    setViewSession(session);
    setIsDetailOpen(true);
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
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Sessão
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-card">
              <DialogHeader>
                <DialogTitle className="font-display">
                  {editingSession ? 'Editar Sessão' : 'Criar Nova Sessão'}
                </DialogTitle>
                <DialogDescription>
                  {editingSession
                    ? 'Altere os detalhes da sessão existente.'
                    : 'Preenche os detalhes da sessão. O mentor será notificado para confirmar.'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Data</Label>
                    <Input
                      id="date"
                      type="date"
                      defaultValue={editingSession ? format(new Date(editingSession.data_hora), 'yyyy-MM-dd') : ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Hora de início</Label>
                    <Input
                      id="time"
                      type="time"
                      defaultValue={editingSession ? format(new Date(editingSession.data_hora), 'HH:mm') : ''}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duração (min)</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={formData.duracao_minutos}
                      onChange={(e) => setFormData({ ...formData, duracao_minutos: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mentor">Mentor</Label>
                    <Select
                      value={formData.mentor_id ? String(formData.mentor_id) : undefined}
                      onValueChange={(v) => setFormData({ ...formData, mentor_id: Number(v) })}
                    >
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
                  <Select
                    value={formData.turma_id ? String(formData.turma_id) : undefined}
                    onValueChange={(v) => setFormData({ ...formData, turma_id: Number(v) })}
                  >
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
                      value={formData.local || ''}
                      onChange={(e) => setFormData({ ...formData, local: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="theme">Tema</Label>
                    <Input
                      id="theme"
                      placeholder="Ex: Sessão Regular"
                      value={formData.tema || ''}
                      onChange={(e) => setFormData({ ...formData, tema: e.target.value })}
                    />
                  </div>
                </div>

                {/* Disciplina & Atividade */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="disciplina">Disciplina</Label>
                    <Select
                      value={selectedDisciplinaId ? String(selectedDisciplinaId) : undefined}
                      onValueChange={(v) => {
                        const id = Number(v);
                        setSelectedDisciplinaId(id);
                        setFormData({ ...formData, atividade_id: null }); // Reset activity
                      }}
                    >
                      <SelectTrigger id="disciplina">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {curriculo?.map((d: any) => (
                          <SelectItem key={d.id} value={String(d.id)}>{d.disciplina}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="atividade">Atividade</Label>
                    <Select
                      disabled={!selectedDisciplinaId}
                      value={formData.atividade_id ? String(formData.atividade_id) : undefined}
                      onValueChange={(v) => setFormData({ ...formData, atividade_id: Number(v) })}
                    >
                      <SelectTrigger id="atividade">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableActivities.map((algo: any) => (
                          <SelectItem key={algo.id} value={String(algo.id)}>{algo.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Equipamento */}
                <div className="space-y-2">
                  <Label htmlFor="equipamento">Kit de Material</Label>
                  <Select
                    value={formData.equipamento_id || undefined}
                    onValueChange={(v) => setFormData({ ...formData, equipamento_id: v })}
                  >
                    <SelectTrigger id="equipamento">
                      <SelectValue placeholder="Selecione equipamento..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {equipamentos?.map((eq: any) => (
                        <SelectItem key={eq.id} value={eq.id}>{eq.name} ({eq.status})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Observações */}
                <div className="space-y-2">
                  <Label htmlFor="obs">Observações</Label>
                  <Input
                    id="obs"
                    placeholder="Notas adicionais..."
                    value={formData.observacoes || ''}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter className="flex sm:justify-between w-full">
                {editingSession ? (
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Apagar
                  </Button>
                ) : <div />}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSave}>
                    <Save className="h-4 w-4 mr-2" />
                    {editingSession ? 'Atualizar' : 'Criar Sessão'}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filter Controls */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
          <Filter className="h-4 w-4" />
          Filtro:
        </span>
        <div className="flex items-center rounded-md border border-input bg-transparent p-1">
          <Button
            variant={filterMode === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilterMode('all')}
            className="h-7 text-xs"
          >
            Todas as Aulas
          </Button>
          <Button
            variant={filterMode === 'mine' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilterMode('mine')}
            className="h-7 text-xs"
          >
            Minhas Aulas
          </Button>
        </div>
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
      {
        viewMode === 'week' && (
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const daySessions = getSessionsForDay(day);
              const isToday = isSameDay(day, new Date());

              // Prepare for layout
              const eventsForLayout = daySessions.map(session => ({
                ...session,
                id: session.id, // Explicitly ensure ID
                start: new Date(session.data_hora),
                end: addMinutes(new Date(session.data_hora), session.duracao_minutos)
              }));

              const layoutEvents = computeEventLayout(eventsForLayout);

              return (
                <div key={day.toISOString()} className="flex flex-col h-full">
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
                  <div className="bg-card rounded-b-lg relative border border-t-0 border-border h-[800px] overflow-hidden">
                    {/* Grid lines for hours (optional, simplified) */}
                    <div className="absolute inset-0 pointer-events-none">
                      {Array.from({ length: 24 }).map((_, i) => (
                        <div key={i} className="border-t border-border/20 h-[4.16%] w-full" />
                      ))}
                    </div>

                    {layoutEvents.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4 relative z-10">
                        Sem sessões
                      </p>
                    ) : (
                      layoutEvents.map((event) => (
                        <div
                          key={event.id}
                          onClick={() => openDetailView(event)}
                          style={{
                            top: event.top,
                            height: event.height,
                            left: event.left,
                            width: event.width,
                            position: 'absolute',
                            zIndex: event.zIndex || 10
                          }}
                          className={cn(
                            'p-1 text-[10px] leading-tight rounded-md border cursor-pointer hover:opacity-90 transition-opacity overflow-hidden flex flex-col',
                            statusColors[event.estado as SessionStatus] || 'bg-secondary'
                          )}
                          title={`${format(event.start, 'HH:mm')} - ${event.turma_nome}`}
                        >
                          <div className="font-bold flex justify-between items-center">
                            {format(event.start, 'HH:mm')}
                            {profile === 'coordenador' && (
                              <Edit2
                                className="h-3 w-3 opacity-50 hover:opacity-100 cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); handleOpenEdit(event); }}
                              />
                            )}
                          </div>
                          <div className="truncate font-semibold text-[10px]">
                            {event.turma_nome}
                            <span className="opacity-75 font-normal ml-1">
                              ({event.estabelecimento_nome})
                            </span>
                          </div>
                          <div className="truncate opacity-90 text-[9px] mt-0.5 flex items-center gap-1">
                            <User className="h-2 w-2" />
                            {event.mentor_nome?.split(' ')[0] ?? 'S/ Mentor'}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      }

      {/* Month View */}
      {
        viewMode === 'month' && (
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
        )
      }

      {/* List View */}
      {
        viewMode === 'list' && (
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
                          <Button variant="outline" size="sm" onClick={() => handleOpenEdit(session)}>
                            <Edit2 className="h-3 w-3 mr-1" />
                            Editar
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        )
      }

      {/* DETAIL VIEW MODAL */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Detalhes da Sessão</span>
              {viewSession && (
                <Badge className={statusColors[viewSession.estado as SessionStatus]}>
                  {viewSession.estado}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {viewSession && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground font-medium">Data/Hora</p>
                  <p className="font-semibold flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(viewSession.data_hora), 'EEE, d MMM HH:mm', { locale: pt })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium">Duração</p>
                  <p>{viewSession.duracao_minutos} min</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium uppercase">Turma & Local</p>
                <div className="p-2 bg-secondary/30 rounded-md">
                  <p className="font-bold text-base">{viewSession.turma_nome}</p>
                  <p className="text-sm text-muted-foreground">{viewSession.estabelecimento_nome}</p>
                  {viewSession.local && (
                    <p className="text-xs mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {viewSession.local}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium uppercase">Currículo</p>
                <div className="p-2 bg-secondary/30 rounded-md space-y-1">
                  <div className="flex justify-between">
                    <span className="text-sm font-semibold">Disciplina:</span>
                    <span className="text-sm">{viewSession.disciplina_nome || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-semibold">Atividade:</span>
                    <span className="text-sm">{viewSession.atividade_nome || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-semibold">Tema:</span>
                    <span className="text-sm">{viewSession.tema || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-2 bg-secondary/30 rounded-md">
                  <p className="text-xs text-muted-foreground font-medium mb-1 flex items-center gap-1">
                    <User className="w-3 h-3" /> Mentor
                  </p>
                  <p className="text-sm font-semibold">{viewSession.mentor_nome || 'Não atribuído'}</p>
                </div>
                <div className="p-2 bg-secondary/30 rounded-md">
                  <p className="text-xs text-muted-foreground font-medium mb-1 flex items-center gap-1">
                    <Package className="w-3 h-3" /> Material
                  </p>
                  <p className="text-sm">{viewSession.equipamento_nome || 'Nenhum'}</p>
                </div>
              </div>

              {viewSession.observacoes && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase mb-1">Observações</p>
                  <p className="text-sm bg-muted/40 p-2 rounded italic font-serif">
                    {viewSession.observacoes}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {profile === 'coordenador' && viewSession && (
              <Button onClick={() => { setIsDetailOpen(false); handleOpenEdit(viewSession); }} variant="outline" className="w-full sm:w-auto">
                <Edit2 className="w-4 h-4 mr-2" />
                Editar Sessão
              </Button>
            )}
            <Button onClick={() => setIsDetailOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
};

export default Horarios;
