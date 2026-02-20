import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
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
  Briefcase,
  Star,
  CheckCircle2,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { AulaAPI, Turma, AulaCreate, PublicProfileEquipa } from '@/types';
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
  getDay
} from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { SessionStatus } from '@/types';
import { useProfile } from '@/contexts/ProfileContext';
import { computeEventLayout } from '@/lib/eventLayout';
import { addMinutes } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth for user ID

const statusColors: Record<SessionStatus, string> = {
  rascunho: 'bg-muted text-muted-foreground border-border/50',
  pendente: 'bg-[#3399cd] text-white border-[#3399cd]',
  confirmada: 'bg-[#4EA380] text-white border-[#4EA380]',
  recusada: 'bg-[#A35339] text-white border-[#A35339]',
  terminada: 'bg-[#6B7280] text-white border-[#6B7280]',
};

// Estilos para eventos autónomos
const autonomousPlannedClass = 'bg-muted/60 text-muted-foreground border-muted-foreground/40 border-dashed opacity-80';
const autonomousRealizedClass = 'bg-[#4EA380]/20 text-[#2d7a5c] border-[#4EA380] border-solid';

// Removed 'rascunho' to hide from legend
const statusLabels: Record<string, string> = {
  pendente: 'Pendente',
  confirmada: 'Confirmada',
  recusada: 'Recusada',
  terminada: 'Terminada',
};

const statusDots: Record<string, string> = {
  pendente: 'bg-[#3399cd]',
  confirmada: 'bg-[#4EA380]',
  recusada: 'bg-[#A35339]',
  terminada: 'bg-[#6B7280]',
};

/** Inline component to show equipment items for a session */
const EquipamentoView = ({ aulaId }: { aulaId: number }) => {
  const { data } = useQuery<{ id: number; nome: string; categoria_nome: string }[]>({
    queryKey: ['aula-equipamento', aulaId],
    queryFn: () => api.get(`/api/aulas/${aulaId}/equipamento`).then((r: any) => r.data ?? r),
  });
  if (!data || data.length === 0) return <p className="text-sm">Nenhum</p>;
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground">{data[0].categoria_nome}</p>
      {data.map(item => (
        <p key={item.id} className="text-sm">• {item.nome}</p>
      ))}
    </div>
  );
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

  // Estado "Terminar sessão"
  const [isTerminarOpen, setIsTerminarOpen] = useState(false);
  const [terminarSessionId, setTerminarSessionId] = useState<number | null>(null);
  const [terminarRating, setTerminarRating] = useState(0);
  const [terminarObs, setTerminarObs] = useState('');

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

  // Fetch Equipamento (categorias com itens)
  const { data: kitCategorias } = useQuery<{ id: number; nome: string; itens: { id: number; nome: string }[] }[]>({
    queryKey: ['equipamento-categorias'],
    queryFn: () => api.get('/api/equipamento/categorias').then((r: any) => r.data ?? r),
    enabled: !!apiUrl,
  });

  const [selectedKitCatId, setSelectedKitCatId] = useState<string>('');
  const [checkedItemIds, setCheckedItemIds] = useState<Set<number>>(new Set());

  // Fetch Equipa (para dropdown do formulário autónomo)
  const { data: equipa } = useQuery({
    queryKey: ['equipa'],
    queryFn: () => api.get<PublicProfileEquipa[]>('/api/equipa'),
    enabled: !!apiUrl,
  });

  const [formData, setFormData] = useState<Partial<AulaCreate>>({
    duracao_minutos: 120,
    tipo: 'ensaio',
    atividade_id: null,
    observacoes: ''
  });

  // Estado do formulário de Trabalho Autónomo
  const [modalTab, setModalTab] = useState<'aula' | 'autonomo'>('aula');
  const [autonomousForm, setAutonomousForm] = useState({
    responsavel_user_id: '',
    date: '',
    hora_inicio: '',
    hora_fim: '',
    tipo_atividade: 'Produção Musical',
    repetir_semanalmente: false,
    semanas: 4,
    observacoes: '',
  });

  const TIPOS_ATIVIDADE = [
    'Produção Musical',
    'Preparação Aulas',
    'Edição/Captura',
    'Reunião',
    'Manutenção',
  ];

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
      filtered = filtered.filter(a =>
        a.mentor_user_id === user.id ||
        (a.is_autonomous && a.responsavel_user_id === user.id)
      );
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

  const saveEquipamento = async (aulaId: number) => {
    const itemIds = Array.from(checkedItemIds);
    if (itemIds.length > 0) {
      await api.put(`/api/aulas/${aulaId}/equipamento`, { item_ids: itemIds });
    }
  };

  const createSessionMutation = useMutation({
    mutationFn: (data: AulaCreate) => api.post('/api/aulas', data),
    onSuccess: async (response: any) => {
      const aulaId = response?.data?.id ?? response?.id;
      if (aulaId) await saveEquipamento(aulaId);
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
    onSuccess: async (_: any, variables: { id: number; data: Partial<AulaCreate> }) => {
      await saveEquipamento(variables.id);
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

  const terminarMutation = useMutation({
    mutationFn: ({ id, avaliacao, obs_termino }: { id: number; avaliacao: number; obs_termino?: string }) =>
      api.post(`/api/aulas/${id}/terminar`, { avaliacao, obs_termino }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aulas'] });
      setIsTerminarOpen(false);
      setTerminarRating(0);
      setTerminarObs('');
      setTerminarSessionId(null);
      toast.success('Sessão terminada com sucesso!');
    },
    onError: () => toast.error('Erro ao terminar sessão.'),
  });

  const openTerminarModal = (sessionId: number) => {
    setTerminarSessionId(sessionId);
    setTerminarRating(0);
    setTerminarObs('');
    setIsTerminarOpen(true);
  };

  const handleSubmitTerminar = () => {
    if (!terminarSessionId || terminarRating < 1) {
      toast.error('Seleciona uma avaliação (1 a 5 estrelas).');
      return;
    }
    terminarMutation.mutate({
      id: terminarSessionId,
      avaliacao: terminarRating,
      obs_termino: terminarObs || undefined,
    });
  };

  const confirmMutation = useMutation({
    mutationFn: (id: number) => api.post(`/api/aulas/${id}/confirm`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aulas'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setIsDetailOpen(false);
      toast.success('Sessão confirmada com sucesso!');
    },
    onError: () => toast.error('Erro ao confirmar sessão.'),
  });

  const createAutonomousMutation = useMutation({
    mutationFn: (data: { payload: AulaCreate; semanas: number }) => {
      if (data.semanas > 1) {
        return api.post('/api/aulas/recorrentes', {
          data_hora: data.payload.data_hora,
          duracao_minutos: data.payload.duracao_minutos,
          tipo_atividade: data.payload.tipo_atividade,
          responsavel_user_id: data.payload.responsavel_user_id,
          observacoes: data.payload.observacoes,
          semanas: data.semanas,
        });
      }
      return api.post('/api/aulas', data.payload);
    },
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['aulas'] });
      setIsDialogOpen(false);
      resetForm();
      const count = vars.semanas > 1 ? `${vars.semanas} sessões criadas!` : 'Sessão criada!';
      toast.success(`Trabalho Autónomo agendado — ${count}`);
    },
    onError: () => toast.error('Erro ao criar sessão autónoma.'),
  });

  const resetForm = () => {
    setEditingSession(null);
    setModalTab('aula');
    setSelectedKitCatId('');
    setCheckedItemIds(new Set());
    setFormData({
      duracao_minutos: 120,
      tipo: 'ensaio',
      atividade_id: null,
      observacoes: ''
    });
    setAutonomousForm({
      responsavel_user_id: '',
      date: '',
      hora_inicio: '',
      hora_fim: '',
      tipo_atividade: 'Produção Musical',
      repetir_semanalmente: false,
      semanas: 4,
      observacoes: '',
    });
    setSelectedDisciplinaId(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = async (session: AulaAPI) => {
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
    });

    // Find discipline for the activity to populate dropdown
    if (session.atividade_id && curriculo) {
      const disc = curriculo.find(d => d.atividades.some((a: any) => a.id === session.atividade_id));
      if (disc) {
        setSelectedDisciplinaId(disc.id);
      }
    }

    // Load session's equipment
    try {
      const res = await api.get(`/api/aulas/${session.id}/equipamento`);
      const items: { id: number; categoria_id: number }[] = res.data;
      if (items.length > 0) {
        setSelectedKitCatId(String(items[0].categoria_id));
        setCheckedItemIds(new Set(items.map(i => i.id)));
      } else {
        setSelectedKitCatId('');
        setCheckedItemIds(new Set());
      }
    } catch {
      setSelectedKitCatId('');
      setCheckedItemIds(new Set());
    }

    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (modalTab === 'autonomo') {
      if (!autonomousForm.responsavel_user_id || !autonomousForm.date || !autonomousForm.hora_inicio || !autonomousForm.hora_fim) {
        toast.error('Preenche todos os campos obrigatórios.');
        return;
      }
      const [hStart, mStart] = autonomousForm.hora_inicio.split(':').map(Number);
      const [hEnd, mEnd] = autonomousForm.hora_fim.split(':').map(Number);
      const duracao = (hEnd * 60 + mEnd) - (hStart * 60 + mStart);
      if (duracao <= 0) {
        toast.error('A hora de fim tem de ser posterior à hora de início.');
        return;
      }
      const payload: AulaCreate = {
        data_hora: `${autonomousForm.date} ${autonomousForm.hora_inicio}`,
        duracao_minutos: duracao,
        tipo: 'trabalho_autonomo',
        is_autonomous: true,
        tipo_atividade: autonomousForm.tipo_atividade,
        responsavel_user_id: autonomousForm.responsavel_user_id,
        observacoes: autonomousForm.observacoes || '',
      };
      createAutonomousMutation.mutate({
        payload,
        semanas: autonomousForm.repetir_semanalmente ? autonomousForm.semanas : 1,
      });
      return;
    }

    // Aba "Aula / Evento"
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
      tema: formData.tema || '',
      tipo: formData.tipo || 'plano_aula',
      observacoes: formData.observacoes || '',
      atividade_id: formData.atividade_id,
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
            <DialogContent className="sm:max-w-[540px] bg-card">
              <DialogHeader>
                <DialogTitle className="font-display">
                  {editingSession ? 'Editar Sessão' : 'Novo Agendamento'}
                </DialogTitle>
                <DialogDescription>
                  {editingSession
                    ? 'Altere os detalhes da sessão existente.'
                    : 'Agenda uma aula com turma ou um bloco de trabalho interno.'}
                </DialogDescription>
              </DialogHeader>

              {/* Tabs — apenas em modo de criação */}
              {!editingSession && (
                <Tabs value={modalTab} onValueChange={(v) => setModalTab(v as 'aula' | 'autonomo')} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="aula">Aula / Evento</TabsTrigger>
                    <TabsTrigger value="autonomo" className="flex items-center gap-1">
                      <Briefcase className="h-3.5 w-3.5" />
                      Trabalho Autónomo
                    </TabsTrigger>
                  </TabsList>

                  {/* ── Tab: Aula / Evento ── */}
                  <TabsContent value="aula">
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
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
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
                              <SelectItem key={t.id} value={String(t.id)}>{t.display_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="disciplina">Disciplina</Label>
                          <Select
                            value={selectedDisciplinaId ? String(selectedDisciplinaId) : undefined}
                            onValueChange={(v) => {
                              setSelectedDisciplinaId(Number(v));
                              setFormData({ ...formData, atividade_id: null });
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
                          <Label htmlFor="nSessao">Nº Sessão</Label>
                          <Input
                            id="nSessao"
                            type="number"
                            placeholder="Ex: 1"
                            value={formData.tema || ''}
                            onChange={(e) => setFormData({ ...formData, tema: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="equipamento">Kit de Material</Label>
                        <Select
                          value={selectedKitCatId}
                          onValueChange={(v) => {
                            setSelectedKitCatId(v);
                            if (v === 'none' || !v) {
                              setCheckedItemIds(new Set());
                            } else {
                              const cat = kitCategorias?.find(c => String(c.id) === v);
                              if (cat) setCheckedItemIds(new Set(cat.itens.map(i => i.id)));
                            }
                          }}
                        >
                          <SelectTrigger id="equipamento">
                            <SelectValue placeholder="Selecione kit..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            {kitCategorias?.map(cat => (
                              <SelectItem key={cat.id} value={String(cat.id)}>{cat.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedKitCatId && selectedKitCatId !== 'none' && (() => {
                          const cat = kitCategorias?.find(c => String(c.id) === selectedKitCatId);
                          if (!cat) return null;
                          return (
                            <div className="space-y-1.5 pl-1 pt-1">
                              {cat.itens.map(item => (
                                <label key={item.id} className="flex items-center gap-2 text-sm cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={checkedItemIds.has(item.id)}
                                    onChange={() => {
                                      setCheckedItemIds(prev => {
                                        const next = new Set(prev);
                                        if (next.has(item.id)) next.delete(item.id);
                                        else next.add(item.id);
                                        return next;
                                      });
                                    }}
                                    className="rounded border-border"
                                  />
                                  {item.nome}
                                </label>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
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
                  </TabsContent>

                  {/* ── Tab: Trabalho Autónomo ── */}
                  <TabsContent value="autonomo">
                    <div className="grid gap-4 py-4">
                      {/* Quem */}
                      <div className="space-y-2">
                        <Label htmlFor="autonomo-quem">Quem</Label>
                        <Select
                          value={autonomousForm.responsavel_user_id}
                          onValueChange={(v) => setAutonomousForm({ ...autonomousForm, responsavel_user_id: v })}
                        >
                          <SelectTrigger id="autonomo-quem">
                            <SelectValue placeholder="Selecionar membro da equipa" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover">
                            {equipa?.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.full_name}
                                <span className="ml-2 text-xs text-muted-foreground capitalize">({p.role})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Quando */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="auto-date">Data</Label>
                          <Input
                            id="auto-date"
                            type="date"
                            value={autonomousForm.date}
                            onChange={(e) => setAutonomousForm({ ...autonomousForm, date: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="auto-start">Início</Label>
                          <Input
                            id="auto-start"
                            type="time"
                            value={autonomousForm.hora_inicio}
                            onChange={(e) => setAutonomousForm({ ...autonomousForm, hora_inicio: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="auto-end">Fim</Label>
                          <Input
                            id="auto-end"
                            type="time"
                            value={autonomousForm.hora_fim}
                            onChange={(e) => setAutonomousForm({ ...autonomousForm, hora_fim: e.target.value })}
                          />
                        </div>
                      </div>

                      {/* O Quê */}
                      <div className="space-y-2">
                        <Label htmlFor="auto-tipo">Tipo de Atividade</Label>
                        <Select
                          value={autonomousForm.tipo_atividade}
                          onValueChange={(v) => setAutonomousForm({ ...autonomousForm, tipo_atividade: v })}
                        >
                          <SelectTrigger id="auto-tipo">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover">
                            {TIPOS_ATIVIDADE.map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Recorrência */}
                      <div className="space-y-3 rounded-md border border-dashed border-border p-3">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="auto-recorr"
                            checked={autonomousForm.repetir_semanalmente}
                            onCheckedChange={(v) =>
                              setAutonomousForm({ ...autonomousForm, repetir_semanalmente: !!v })
                            }
                          />
                          <Label htmlFor="auto-recorr" className="cursor-pointer font-normal">
                            Repetir semanalmente
                          </Label>
                        </div>
                        {autonomousForm.repetir_semanalmente && (
                          <div className="flex items-center gap-2 pl-6">
                            <Label htmlFor="auto-semanas" className="text-sm text-muted-foreground whitespace-nowrap">
                              Nº de semanas:
                            </Label>
                            <Input
                              id="auto-semanas"
                              type="number"
                              min={2}
                              max={52}
                              className="w-20"
                              value={autonomousForm.semanas}
                              onChange={(e) =>
                                setAutonomousForm({ ...autonomousForm, semanas: Number(e.target.value) })
                              }
                            />
                          </div>
                        )}
                      </div>

                      {/* Observações */}
                      <div className="space-y-2">
                        <Label htmlFor="auto-obs">Observações (opcional)</Label>
                        <Textarea
                          id="auto-obs"
                          placeholder="Notas sobre este bloco de trabalho..."
                          rows={2}
                          value={autonomousForm.observacoes}
                          onChange={(e) => setAutonomousForm({ ...autonomousForm, observacoes: e.target.value })}
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              )}

              {/* Formulário de edição (sem tabs) */}
              {editingSession && (
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="date">Data</Label>
                      <Input
                        id="date"
                        type="date"
                        defaultValue={format(new Date(editingSession.data_hora), 'yyyy-MM-dd')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="time">Hora de início</Label>
                      <Input
                        id="time"
                        type="time"
                        defaultValue={format(new Date(editingSession.data_hora), 'HH:mm')}
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
                            <SelectItem key={mentor.id} value={String(mentor.id)}>{mentor.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
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
                          <SelectItem key={t.id} value={String(t.id)}>{t.display_name}</SelectItem>
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
                      <Label htmlFor="nSessao">Nº Sessão</Label>
                      <Input
                        id="nSessao"
                        type="number"
                        placeholder="Ex: 1"
                        value={formData.tema || ''}
                        onChange={(e) => setFormData({ ...formData, tema: e.target.value })}
                      />
                    </div>
                  </div>
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
              )}

              <DialogFooter className="flex sm:justify-between w-full">
                {editingSession ? (
                  <Button variant="destructive" onClick={handleDelete}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Apagar
                  </Button>
                ) : <div />}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={createSessionMutation.isPending || createAutonomousMutation.isPending || updateSessionMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {editingSession ? 'Atualizar' : modalTab === 'autonomo' ? 'Agendar Trabalho' : 'Criar Sessão'}
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
            <div className={cn('w-3 h-3 rounded-full', statusDots[status as SessionStatus])} />
            <span className="text-sm text-muted-foreground">{label}</span>
          </div>
        ))}
        {/* Legenda — Trabalho Autónomo */}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm border-2 border-dashed border-muted-foreground/60 bg-muted/50" />
          <span className="text-sm text-muted-foreground">Trabalho Planeado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm border-2 border-[#4EA380] bg-[#4EA380]/20" />
          <span className="text-sm text-muted-foreground">Trabalho Realizado</span>
        </div>
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
                      layoutEvents.map((event) => {
                        const isAutonomous = event.is_autonomous;
                        const isRealized = event.is_realized;
                        const eventClass = isAutonomous
                          ? (isRealized ? autonomousRealizedClass : autonomousPlannedClass)
                          : (statusColors[event.estado as SessionStatus] || 'bg-secondary');
                        const zIdx = isRealized ? 20 : isAutonomous ? 5 : (event.zIndex || 10);

                        return (
                          <div
                            key={event.id}
                            onClick={() => openDetailView(event)}
                            style={{
                              top: event.top,
                              height: event.height,
                              left: event.left,
                              width: event.width,
                              position: 'absolute',
                              zIndex: zIdx,
                            }}
                            className={cn(
                              'p-1 text-[10px] leading-tight rounded-md border cursor-pointer hover:opacity-90 transition-opacity overflow-hidden flex flex-col',
                              eventClass
                            )}
                            title={isAutonomous
                              ? `${format(event.start, 'HH:mm')} — ${event.tipo_atividade ?? 'Trabalho Autónomo'}`
                              : `${format(event.start, 'HH:mm')} - ${event.turma_nome}`
                            }
                          >
                            <div className="font-bold flex justify-between items-center">
                              <span>{format(event.start, 'HH:mm')} – {format(event.end, 'HH:mm')}</span>
                              {profile === 'coordenador' && !isAutonomous && (
                                <Edit2
                                  className="h-3 w-3 opacity-50 hover:opacity-100 cursor-pointer"
                                  onClick={(e) => { e.stopPropagation(); handleOpenEdit(event); }}
                                />
                              )}
                            </div>
                            {isAutonomous ? (
                              <>
                                <div className="truncate font-semibold text-[10px] flex items-center gap-1">
                                  <Briefcase className="h-2 w-2 flex-shrink-0" />
                                  {event.tipo_atividade ?? 'Trabalho Autónomo'}
                                </div>
                                {isRealized && (
                                  <div className="text-[9px] mt-0.5 opacity-80">✓ Realizado</div>
                                )}
                              </>
                            ) : (
                              <>
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
                              </>
                            )}
                          </div>
                        );
                      })
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
                    <span className="text-sm font-semibold">Nº Sessão:</span>
                    <span className="text-sm">{viewSession.tema || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-2 bg-secondary/30 rounded-md">
                  <p className="text-xs text-muted-foreground font-medium mb-1 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {viewSession.is_autonomous ? 'Membro da Equipa' : 'Mentor'}
                  </p>
                  <p className="text-sm font-semibold">
                    {viewSession.is_autonomous
                      ? (equipa?.find(p => p.id === viewSession.responsavel_user_id)?.full_name ?? viewSession.responsavel_user_id ?? 'Não atribuído')
                      : (viewSession.mentor_nome || 'Não atribuído')}
                  </p>
                </div>
                <div className="p-2 bg-secondary/30 rounded-md">
                  <p className="text-xs text-muted-foreground font-medium mb-1 flex items-center gap-1">
                    <Package className="w-3 h-3" /> Material
                  </p>
                  <EquipamentoView aulaId={viewSession.id} />
                </div>
              </div>

              {/* Avaliação (sessões terminadas) */}
              {viewSession.estado === 'terminada' && viewSession.avaliacao && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase mb-1">Avaliação da Sessão</p>
                  <div className="p-2 bg-secondary/30 rounded-md space-y-2">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star
                          key={n}
                          className={cn('h-5 w-5', n <= viewSession.avaliacao! ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30')}
                        />
                      ))}
                      <span className="text-sm text-muted-foreground ml-2">{viewSession.avaliacao}/5</span>
                    </div>
                    {viewSession.obs_termino && (
                      <p className="text-sm italic text-muted-foreground">{viewSession.obs_termino}</p>
                    )}
                  </div>
                </div>
              )}

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
            {/* Botão Confirmar — sessões pendentes */}
            {viewSession && viewSession.estado === 'pendente' && (
              <Button
                onClick={() => confirmMutation.mutate(viewSession.id)}
                disabled={confirmMutation.isPending}
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {confirmMutation.isPending ? 'A confirmar...' : 'Confirmar Sessão'}
              </Button>
            )}
            {/* Botão Terminar — sessões confirmadas presenciais cuja hora já passou */}
            {viewSession && viewSession.estado === 'confirmada' && !viewSession.is_autonomous && new Date(viewSession.data_hora) <= new Date() && (
              <Button
                onClick={() => { setIsDetailOpen(false); openTerminarModal(viewSession.id); }}
                className="w-full sm:w-auto bg-[#6B7280] hover:bg-[#555e68] text-white"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Terminar Sessão
              </Button>
            )}
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

      {/* TERMINAR SESSÃO MODAL */}
      <Dialog open={isTerminarOpen} onOpenChange={setIsTerminarOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[#6B7280]" />
              Terminar Sessão
            </DialogTitle>
            <DialogDescription>
              Avalia a sessão e adiciona observações opcionais.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label className="font-medium">Avaliação desta Sessão</Label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <Star
                    key={n}
                    className={cn(
                      'h-8 w-8 cursor-pointer transition-colors',
                      n <= terminarRating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30 hover:text-yellow-300'
                    )}
                    onClick={() => setTerminarRating(n)}
                  />
                ))}
                {terminarRating > 0 && (
                  <span className="text-sm text-muted-foreground ml-2">{terminarRating}/5</span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-medium">Observações</Label>
              <Textarea
                placeholder="Como correu a sessão? Notas relevantes..."
                value={terminarObs}
                onChange={e => setTerminarObs(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSubmitTerminar}
              disabled={terminarRating < 1 || terminarMutation.isPending}
              className="bg-[#6B7280] hover:bg-[#555e68] text-white"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Submeter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
};

export default Horarios;
