import { useState } from 'react';
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useProfile } from '@/contexts/ProfileContext';
// import { users } from '@/data/mockData'; // Removed mock users
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  User as UserIcon,
  Music,
  Mic2,
  Calendar
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { computeEventLayout } from '@/lib/eventLayout';
import { setHours, setMinutes } from 'date-fns';

// Types matched to API
interface TeamMember {
  id: string;
  nome: string;
  role: string;
  email: string;
}

interface StudioBookingAPI {
  id: number;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  tipo: string;
  artista_turma: string;
  projeto_musica: string;
  notas: string | null;
  responsavel: {
    id: string;
    nome: string;
    role: string;
  } | null;
  criado_por: {
    id: string;
    nome: string;
  } | null;
}

// Frontend internal type (mapped)
interface StudioBooking {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  bookedBy: { id: string; name: string };
  assignedTo?: { id: string; name: string; role: string };
  artist: string;
  project: string;
  type: 'gravacao' | 'edicao' | 'mistura' | 'ensaio' | 'outro';
  notes?: string;
}

const bookingTypes = [
  { value: 'gravacao', label: 'Gravação', color: 'bg-primary' },
  { value: 'edicao', label: 'Edição', color: 'bg-info' },
  { value: 'mistura', label: 'Mistura', color: 'bg-warning' },
  { value: 'ensaio', label: 'Ensaio', color: 'bg-success' },
  { value: 'outro', label: 'Outro', color: 'bg-muted' },
];

const timeSlots = [
  '09:00', '10:00', '11:00', '12:00', '13:00', '14:00',
  '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
  '21:00', '22:00'
];

export default function Estudio() {
  const { user } = useProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<StudioBooking | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    startTime: '10:00',
    endTime: '12:00',
    assignedTo: '',
    artist: '',
    project: '',
    type: 'gravacao' as StudioBooking['type'],
    notes: '',
  });

  // Fetch Team
  const { data: team = [] } = useQuery({
    queryKey: ['equipa'],
    queryFn: () => api.get<TeamMember[]>('/api/equipa').then(res => res.data),
  });

  // Fetch API Bookings
  const { data: apiBookings = [] } = useQuery({
    queryKey: ['estudio_reservas'],
    queryFn: () => api.get<StudioBookingAPI[]>('/api/estudio/reservas').then(res => res.data),
  });

  // Map API to Frontend format
  const bookings: StudioBooking[] = apiBookings.map(b => ({
    id: String(b.id),
    date: parseISO(b.data), // Assumes ISO date string YYYY-MM-DD
    startTime: b.hora_inicio.substring(0, 5),
    endTime: b.hora_fim.substring(0, 5),
    bookedBy: b.criado_por ? { id: b.criado_por.id, name: b.criado_por.nome } : { id: '0', name: 'Sistema' },
    assignedTo: b.responsavel ? { id: b.responsavel.id, name: b.responsavel.nome, role: b.responsavel.role } : undefined,
    artist: b.artista_turma,
    project: b.projeto_musica,
    type: b.tipo as any,
    notes: b.notas || '',
  }));

  const createBookingMutation = useMutation({
    mutationFn: (data: any) => api.post('/api/estudio/reservas', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estudio_reservas'] });
      toast({
        title: 'Reserva criada',
        description: `Estúdio reservado com sucesso.`,
      });
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível criar a reserva.',
        variant: 'destructive',
      });
    }
  });

  const deleteBookingMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/estudio/reservas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estudio_reservas'] });
      toast({
        title: 'Reserva cancelada',
        description: 'A reserva foi removida do calendário.',
      });
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível cancelar a reserva.',
        variant: 'destructive',
      });
    }
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  const getBookingsForDay = (date: Date) => {
    return bookings.filter(booking => isSameDay(booking.date, date))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  const handlePreviousWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  const handleNextWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  const handleToday = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const openNewBookingDialog = (date: Date) => {
    setSelectedDate(date);
    setSelectedBooking(null);
    setFormData({
      startTime: '10:00',
      endTime: '12:00',
      assignedTo: '',
      artist: '',
      project: '',
      type: 'gravacao',
      notes: '',
    });
    setIsDialogOpen(true);
  };

  const openBookingDetails = (booking: StudioBooking) => {
    setSelectedBooking(booking);
    setSelectedDate(booking.date);
    setFormData({
      startTime: booking.startTime,
      endTime: booking.endTime,
      assignedTo: booking.assignedTo?.id || '',
      artist: booking.artist,
      project: booking.project,
      type: booking.type,
      notes: booking.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.artist || !formData.project || !selectedDate) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor preenche a data, artista e projeto.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedBooking) {
      // Update logic (Not implemented in backend yet, just placeholder or todo)
      toast({
        title: 'Funcionalidade em desenvolvimento',
        description: 'Edição de reservas virá em breve.',
      });
    } else {
      // Create new booking
      createBookingMutation.mutate({
        data: format(selectedDate, 'yyyy-MM-dd'),
        hora_inicio: formData.startTime,
        hora_fim: formData.endTime,
        tipo: formData.type,
        artista_turma: formData.artist,
        projeto_musica: formData.project,
        responsavel_id: formData.assignedTo,
        notas: formData.notes,
        criado_por_id: user?.id
      });
    }
  };

  const handleDelete = () => {
    if (selectedBooking) {
      deleteBookingMutation.mutate(selectedBooking.id);
    }
  };

  const getBookingTypeInfo = (type: StudioBooking['type']) => {
    return bookingTypes.find(t => t.value === type) || bookingTypes[4];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Estúdio</h1>
          <p className="text-muted-foreground">
            Agenda e disponibilidade do estúdio
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openNewBookingDialog(new Date())}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Reserva
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {selectedBooking ? 'Detalhes da Reserva' : 'Nova Reserva de Estúdio'}
              </DialogTitle>
              <DialogDescription>
                {selectedDate && format(selectedDate, "EEEE, d 'de' MMMM", { locale: pt })}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="date">Data da Reserva</Label>
                <div className="relative">
                  <Input
                    type="date"
                    id="date"
                    value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''}
                    onChange={(e) => {
                      const date = e.target.value ? parseISO(e.target.value) : null;
                      if (date) setSelectedDate(date);
                    }}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Hora Início</Label>
                  <Select
                    value={formData.startTime}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, startTime: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map(time => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">Hora Fim</Label>
                  <Select
                    value={formData.endTime}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, endTime: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map(time => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Tipo de Sessão</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as StudioBooking['type'] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {bookingTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="artist">Artista / Turma *</Label>
                <Input
                  id="artist"
                  value={formData.artist}
                  onChange={(e) => setFormData(prev => ({ ...prev, artist: e.target.value }))}
                  placeholder="Ex: Turma 9ºA, Grupo RAP EP Lisboa"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="project">Projeto / Música *</Label>
                <Input
                  id="project"
                  value={formData.project}
                  onChange={(e) => setFormData(prev => ({ ...prev, project: e.target.value }))}
                  placeholder="Ex: Sonhos de Betão"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignedTo">Atribuir a</Label>
                <Select
                  value={formData.assignedTo}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, assignedTo: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar membro da equipa" />
                  </SelectTrigger>
                  <SelectContent>
                    {team.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nome} ({u.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Detalhes adicionais sobre a sessão..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              {selectedBooking && (
                <Button variant="destructive" onClick={handleDelete} disabled={deleteBookingMutation.isPending}>
                  {deleteBookingMutation.isPending ? 'A cancelar...' : 'Cancelar Reserva'}
                </Button>
              )}
              <Button onClick={handleSubmit} disabled={createBookingMutation.isPending}>
                {createBookingMutation.isPending ? 'A reservar...' : selectedBooking ? 'Guardar Alterações' : 'Reservar Estúdio'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {bookingTypes.map(type => (
          <div key={type.value} className="flex items-center gap-2">
            <div className={cn('w-3 h-3 rounded-full', type.color)} />
            <span className="text-sm text-muted-foreground">{type.label}</span>
          </div>
        ))}
      </div>

      {/* Week Navigation */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePreviousWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleToday}>
                Hoje
              </Button>
              <Button variant="outline" size="icon" onClick={handleNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <CardTitle className="text-lg">
              {format(currentWeekStart, "d MMM", { locale: pt })} - {format(addDays(currentWeekStart, 6), "d MMM yyyy", { locale: pt })}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const dayBookings = getBookingsForDay(day);
              const isToday = isSameDay(day, new Date());

              // Prepare for layout
              const eventsForLayout = dayBookings.map(booking => {
                const [startHour, startMinute] = booking.startTime.split(':').map(Number);
                const [endHour, endMinute] = booking.endTime.split(':').map(Number);

                const start = setMinutes(setHours(new Date(day), startHour), startMinute);
                const end = setMinutes(setHours(new Date(day), endHour), endMinute);

                return {
                  ...booking,
                  start,
                  end
                };
              });

              const layoutEvents = computeEventLayout(eventsForLayout);

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'h-[1000px] rounded-lg border flex flex-col transition-colors',
                    isToday ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  )}
                >
                  <div className="flex items-center justify-between p-2 flex-shrink-0">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground uppercase">
                        {format(day, 'EEE', { locale: pt })}
                      </p>
                      <p className={cn(
                        'text-lg font-semibold',
                        isToday && 'text-primary'
                      )}>
                        {format(day, 'd')}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => openNewBookingDialog(day)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="relative flex-grow w-full overflow-hidden border-t border-border/50">
                    {/* Grid lines for hours */}
                    <div className="absolute inset-0 pointer-events-none">
                      {Array.from({ length: 24 }).map((_, i) => (
                        <div key={i} className="border-t border-border/20 h-[4.16%] w-full box-border" />
                      ))}
                    </div>

                    {layoutEvents.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4 relative z-10">
                        Disponível
                      </p>
                    ) : (
                      layoutEvents.map((booking) => {
                        const typeInfo = getBookingTypeInfo(booking.type);
                        return (
                          <button
                            key={booking.id}
                            style={{
                              top: booking.top,
                              height: booking.height,
                              left: booking.left,
                              width: booking.width,
                              position: 'absolute',
                              zIndex: booking.zIndex || 10
                            }}
                            onClick={() => openBookingDetails(booking)}
                            className={cn(
                              'block text-left p-1 rounded-sm text-[10px] leading-tight transition-colors border overflow-hidden flex flex-col',
                              'bg-card hover:bg-secondary border-border',
                              typeInfo.color.replace('bg-', 'border-l-4 border-') // Use color as border accent
                            )}
                            title={`${booking.startTime} - ${booking.endTime} | ${booking.artist}`}
                          >
                            <div className="font-bold text-xs truncate">
                              {booking.startTime}
                            </div>
                            <div className="font-medium truncate">{booking.artist}</div>
                            <div className="text-muted-foreground truncate opacity-80">{booking.project}</div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Today's Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Reservas de Hoje
          </CardTitle>
        </CardHeader>
        <CardContent>
          {getBookingsForDay(new Date()).length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Não há reservas para hoje. O estúdio está disponível!
            </p>
          ) : (
            <div className="space-y-3">
              {getBookingsForDay(new Date()).map((booking) => {
                const typeInfo = getBookingTypeInfo(booking.type);
                return (
                  <div
                    key={booking.id}
                    className="flex items-start gap-4 p-4 rounded-lg bg-card border border-border"
                  >
                    <div className={cn('w-1 h-full min-h-[60px] rounded-full', typeInfo.color)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {booking.startTime} - {booking.endTime}
                        </span>
                        <Badge variant="secondary" className="ml-auto">
                          {typeInfo.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <Music className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{booking.artist}</span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground">{booking.project}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <UserIcon className="h-4 w-4" />
                        <span>
                          {booking.assignedTo
                            ? `Atribuído a ${booking.assignedTo.name}`
                            : `Reservado por ${booking.bookedBy.name}`
                          }
                        </span>
                      </div>
                      {booking.notes && (
                        <p className="text-sm text-muted-foreground mt-2 italic">
                          "{booking.notes}"
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openBookingDetails(booking)}
                    >
                      Ver detalhes
                    </Button>
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
