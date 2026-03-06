import { useState, useEffect, useCallback } from 'react';
import AIAgentChat from '@/components/AIAgentChat';
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
  Sparkles,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { AulaAPI, Turma, AulaCreate, PublicProfileEquipa, Projeto, Estabelecimento } from '@/types';
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
  const { data } = useQuery<{ id: number; nome: string; identificador?: string; categoria_nome: string; estado?: string }[]>({
    queryKey: ['aula-equipamento', aulaId],
    queryFn: () => api.get(`/api/aulas/${aulaId}/equipamento`).then((r: any) => r.data ?? r),
  });
  if (!data || data.length === 0) return <p className="text-sm">Nenhum</p>;
  const grouped = data.reduce<Record<string, typeof data>>((acc, item) => {
    const cat = item.categoria_nome;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});
  return (
    <div className="space-y-1">
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat}>
          <p className="text-xs font-medium text-muted-foreground">{cat}</p>
          {items.map(item => (
            <p key={item.id} className="text-sm">
              {'\u2022'} {item.identificador || item.nome}
              {item.estado && item.estado !== 'excelente' && (
                <span className="text-xs text-warning ml-1">({item.estado})</span>
              )}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
};

const Horarios = () => {
  const { profile } = useProfile();
  const isAdmin = profile === 'coordenador' || profile === 'direcao' || profile === 'it_support';
  const { user } = useAuth(); // Get current user
  const [filterMode, setFilterMode] = useState<'all' | 'mine'>(profile === 'mentor' ? 'mine' : 'all');
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'list'>('week');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAgentOpen, setIsAgentOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<AulaAPI | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [viewSession, setViewSession] = useState<AulaAPI | null>(null);

  // Confirmação para ações em sessões de outros users
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

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
  interface Mentor { id: number; nome: string; latitude: number | null; longitude: number | null; }
  const { data: mentoresApi } = useQuery({
    queryKey: ['mentores'],
    queryFn: () => api.get<Mentor[]>('/api/mentores'),
    enabled: !!apiUrl,
  });

  // Fetch estabelecimentos (para coordenadas GPS)
  interface EstabGeo { id: number; nome: string; latitude: number | null; longitude: number | null; }
  const { data: estabelecimentos } = useQuery({
    queryKey: ['estabelecimentos'],
    queryFn: () => api.get<EstabGeo[]>('/api/estabelecimentos'),
    enabled: !!apiUrl,
  });

  // Distâncias mentor→estabelecimento
  const [mentorDistances, setMentorDistances] = useState<Record<string, number>>({});

  // Fetch Curriculo (Disciplinas + Atividades)
  const { data: curriculo } = useQuery({
    queryKey: ['curriculo'],
    queryFn: () => api.get<any[]>('/api/curriculo'),
    enabled: !!apiUrl,
  });

  // Fetch Equipamento (categorias com itens individuais)
  const { data: kitCategorias } = useQuery<{ id: number; nome: string; itens: { id: number; nome: string; identificador?: string; estado?: string }[] }[]>({
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

  // Projeto → Estabelecimento → Turma cascading
  const [selectedProjetoId, setSelectedProjetoId] = useState<number | null>(null);
  const [selectedEstabId, setSelectedEstabId] = useState<number | null>(null);

  const { data: projetos } = useQuery({
    queryKey: ['projetos'],
    queryFn: () => api.get<Projeto[]>('/api/projetos'),
    enabled: !!apiUrl,
  });

  const { data: projetoEstabs } = useQuery({
    queryKey: ['projeto-estabs', selectedProjetoId],
    queryFn: () => api.get<Estabelecimento[]>(`/api/projetos/${selectedProjetoId}/estabelecimentos`),
    enabled: !!selectedProjetoId,
  });

  // Turmas filtradas pelo estabelecimento selecionado
  const filteredTurmas = selectedEstabId
    ? turmas?.filter(t => t.estabelecimento_id === selectedEstabId)
    : turmas;

  const [formData, setFormData] = useState<Partial<AulaCreate> & { repetir_semanalmente?: boolean; semanas?: number }>({
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
    projeto_id: '' as string,
    tema: '',
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

  // Disciplinas da turma selecionada (filtra o dropdown de disciplinas)
  const { data: turmaDisciplinas = [] } = useQuery({
    queryKey: ['turma-disciplinas', formData.turma_id],
    queryFn: async () => (await api.get(`/api/turmas/${formData.turma_id}/disciplinas`)).data,
    enabled: !!formData.turma_id,
  });

  const filteredDisciplinas = turmaDisciplinas.length > 0
    ? curriculo?.filter((d: any) => turmaDisciplinas.some((td: any) => td.id === d.id))
    : curriculo;

  // Stats por instituição (para pré-preencher Nº Sessão)
  const { data: statsInstituicao } = useQuery({
    queryKey: ['producao-stats-inst', selectedProjetoId],
    queryFn: async () => (await api.get(`/api/producao/stats/instituicao?projeto_id=${selectedProjetoId}`)).data as {
      estabelecimento_id: number; estabelecimento_nome: string;
      turmas: { turma_id: number; disciplina_id: number | null; sessoes_realizadas: number }[];
    }[],
    enabled: !!selectedProjetoId,
  });

  // Helper to get activities for selected discipline
  const [selectedDisciplinaId, setSelectedDisciplinaId] = useState<number | null>(null);

  const availableActivities = selectedDisciplinaId
    ? curriculo?.find(d => d.id === selectedDisciplinaId)?.atividades || []
    : [];

  // Pré-preencher Nº Sessão (N+1) — N = total de sessões aula na turma (todos os estados)
  useEffect(() => {
    if (!formData.turma_id || !aulasApi || editingSession) return;
    const n = aulasApi.filter(a => !a.is_autonomous && a.turma_id === formData.turma_id).length;
    setFormData(prev => ({ ...prev, tema: String(n + 1) }));
  }, [formData.turma_id, aulasApi, editingSession]);

  // Pré-preencher Nº Sessão autónoma (N+1) — N = total de sessões do responsável (todos os estados)
  useEffect(() => {
    if (!autonomousForm.responsavel_user_id || !aulasApi) return;
    const userId = autonomousForm.responsavel_user_id;
    const n = aulasApi.filter(a =>
      (a.is_autonomous && a.responsavel_user_id === userId) ||
      (!a.is_autonomous && a.mentor_user_id === userId)
    ).length;
    setAutonomousForm(prev => ({ ...prev, tema: String(n + 1) }));
  }, [autonomousForm.responsavel_user_id, aulasApi]);

  // Calcular distâncias mentor→estabelecimento quando turma muda
  const calcDistances = useCallback(async (turmaId: number) => {
    if (!mentoresApi || !turmas || !estabelecimentos) return;
    const turma = turmas.find(t => t.id === turmaId);
    if (!turma) return;
    const estab = estabelecimentos.find(e => e.id === turma.estabelecimento_id);
    if (!estab?.latitude || !estab?.longitude) return;

    for (const mentor of mentoresApi) {
      if (!mentor.latitude || !mentor.longitude) continue;
      const key = `${mentor.id}_${turma.estabelecimento_id}`;
      if (mentorDistances[key] !== undefined) continue; // already cached

      try {
        const res = await api.get(`/api/distance?lat1=${mentor.latitude}&lng1=${mentor.longitude}&lat2=${estab.latitude}&lng2=${estab.longitude}`);
        const data = res.data ?? res;
        if (data.distance_km != null) {
          setMentorDistances(prev => ({ ...prev, [key]: data.distance_km }));
        }
      } catch {
        // ignore distance calculation errors
      }
    }
  }, [mentoresApi, turmas, estabelecimentos, mentorDistances]);

  useEffect(() => {
    if (formData.turma_id) {
      calcDistances(formData.turma_id);
    }
  }, [formData.turma_id, calcDistances]);

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

  const saveEquipamento = async (aulaId: number, dataHora?: string, duracaoMinutos?: number) => {
    const itemIds = Array.from(checkedItemIds);
    if (itemIds.length === 0) return;

    // Verificar conflitos antes de guardar (inclui margem de 1h)
    if (dataHora && duracaoMinutos) {
      try {
        const conflitosRes = await api.post('/api/equipamento/verificar-conflitos', {
          item_ids: itemIds,
          data_hora: dataHora,
          duracao_minutos: duracaoMinutos,
          excluir_aula_id: aulaId,
        });
        const conflitos = conflitosRes?.data?.conflitos ?? conflitosRes?.conflitos ?? [];
        if (conflitos.length > 0) {
          const msgs = conflitos.map((c: any) =>
            `${c.item_identificador || c.item_nome}: ${c.motivo || 'Conflito temporal'}`
          );
          toast.error(`Conflitos de material:\n${msgs.join('\n')}`);
          return;
        }
      } catch {
        // Se falhar a verificacao, continuar com a atribuicao
      }
    }

    await api.put(`/api/aulas/${aulaId}/equipamento`, { item_ids: itemIds });
  };

  const createSessionMutation = useMutation({
    mutationFn: (data: AulaCreate) => api.post('/api/aulas', data),
    onSuccess: async (response: any, payload: AulaCreate) => {
      const aulaId = response?.data?.id ?? response?.id;
      if (aulaId) await saveEquipamento(aulaId, payload.data_hora, payload.duracao_minutos);
      queryClient.invalidateQueries({ queryKey: ['aulas'] });
      setIsDialogOpen(false);
      resetForm();
      toast.success('Sessão criada com sucesso!');
    },
    onError: () => toast.error('Erro ao criar sessão.'),
  });

  const createRecurringSessionMutation = useMutation({
    mutationFn: (data: { payload: AulaCreate; semanas: number }) => {
      const payload = { ...data.payload, semanas: data.semanas };
      return api.post('/api/aulas/recorrentes', payload);
    },
    onSuccess: async (response: any, vars) => {
      const sessoes = response?.data?.sessoes || [];
      for (const sessao of sessoes) {
        if (sessao.id) {
          await saveEquipamento(sessao.id, sessao.data_hora, sessao.duracao_minutos);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['aulas'] });
      setIsDialogOpen(false);
      resetForm();
      const count = vars.semanas > 1 ? `${vars.semanas} sessões criadas!` : 'Sessão criada!';
      toast.success(count);
    },
    onError: () => toast.error('Erro ao criar sessões recorrentes.'),
  });

  const updateSessionMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AulaCreate> }) =>
      api.put(`/api/aulas/${id}`, data),
    onSuccess: async (_: any, variables: { id: number; data: Partial<AulaCreate> }) => {
      await saveEquipamento(variables.id, variables.data.data_hora, variables.data.duracao_minutos);
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

  const realizeMutation = useMutation({
    mutationFn: (id: number) => api.post(`/api/aulas/${id}/realize`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aulas'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setIsDetailOpen(false);
      toast.success('Trabalho marcado como realizado!');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || 'Erro ao marcar como realizado.';
      toast.error(msg);
    },
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
          tema: data.payload.tema,
          projeto_id: data.payload.projeto_id,
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
    setSelectedProjetoId(null);
    setSelectedEstabId(null);
    setFormData({
      duracao_minutos: 120,
      tipo: 'ensaio',
      atividade_id: null,
      observacoes: '',
      repetir_semanalmente: false,
      semanas: 4,
    });
    setAutonomousForm({
      responsavel_user_id: '',
      date: '',
      hora_inicio: '',
      hora_fim: '',
      tipo_atividade: 'Produção Musical',
      projeto_id: '',
      tema: '',
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
        projeto_id: autonomousForm.projeto_id ? parseInt(autonomousForm.projeto_id) : null,
        responsavel_user_id: autonomousForm.responsavel_user_id,
        tema: autonomousForm.tema || '',
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
    const timeEndStr = (document.getElementById('time-end') as HTMLInputElement)?.value;

    if (!dateStr || !timeStr || !timeEndStr) {
      toast.error("Data, Hora de início e Hora de fim são obrigatórios");
      return;
    }

    // Calculate duration from start and end times
    const [startH, startM] = timeStr.split(':').map(Number);
    const [endH, endM] = timeEndStr.split(':').map(Number);
    const duracao = (endH * 60 + endM) - (startH * 60 + startM);
    if (duracao <= 0) {
      toast.error("A hora de fim deve ser posterior à hora de início");
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
      duracao_minutos: duracao,
      mentor_id: formData.mentor_id ? Number(formData.mentor_id) : null,
      local: formData.local,
      tema: formData.tema || '',
      tipo: formData.tipo || 'plano_aula',
      observacoes: formData.observacoes || '',
      atividade_id: formData.atividade_id,
      projeto_id: selectedProjetoId,
    };

    if (editingSession) {
      updateSessionMutation.mutate({ id: editingSession.id, data: payload });
    } else {
      if ((formData as any).repetir_semanalmente) {
        createRecurringSessionMutation.mutate({
          payload: { ...payload, is_autonomous: false },
          semanas: (formData as any).semanas || 4,
        });
      } else {
        createSessionMutation.mutate(payload);
      }
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
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsAgentOpen(true)}>
              <Sparkles className="h-4 w-4 mr-2" />
              Com Agente
            </Button>
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
                        {/* Projeto → Estabelecimento → Turma (Cascading) */}
                        <div className="space-y-2">
                          <Label htmlFor="projeto">Projeto</Label>
                          <Select
                            value={selectedProjetoId ? String(selectedProjetoId) : undefined}
                            onValueChange={(v) => {
                              setSelectedProjetoId(Number(v));
                              setSelectedEstabId(null);
                              setFormData({ ...formData, turma_id: undefined, atividade_id: null });
                              setSelectedDisciplinaId(null);
                            }}
                          >
                            <SelectTrigger id="projeto">
                              <SelectValue placeholder="Selecionar Projeto" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover">
                              {projetos?.map((p) => (
                                <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="estabelecimento">Estabelecimento</Label>
                            <Select
                              disabled={!selectedProjetoId}
                              value={selectedEstabId ? String(selectedEstabId) : undefined}
                              onValueChange={(v) => {
                                setSelectedEstabId(Number(v));
                                setFormData({ ...formData, turma_id: undefined });
                              }}
                            >
                              <SelectTrigger id="estabelecimento">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent className="bg-popover">
                                {projetoEstabs?.map((e) => (
                                  <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="turma">Turma</Label>
                            <Select
                              disabled={!selectedEstabId}
                              value={formData.turma_id ? String(formData.turma_id) : undefined}
                              onValueChange={(v) => {
                                setFormData({ ...formData, turma_id: Number(v), atividade_id: null });
                                setSelectedDisciplinaId(null);
                              }}
                            >
                              <SelectTrigger id="turma">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent className="bg-popover">
                                {filteredTurmas?.map((t) => (
                                  <SelectItem key={t.id} value={String(t.id)}>{t.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="date">Data</Label>
                          <Input id="date" type="date" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="time">Hora de início</Label>
                            <Input id="time" type="time" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="time-end">Hora de fim</Label>
                            <Input id="time-end" type="time" />
                          </div>
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
                              {mentoresApi?.map((mentor) => {
                                const turma = turmas?.find(t => t.id === formData.turma_id);
                                const key = turma ? `${mentor.id}_${turma.estabelecimento_id}` : '';
                                const dist = mentorDistances[key];
                                return (
                                  <SelectItem key={mentor.id} value={String(mentor.id)}>
                                    {mentor.nome}{dist != null ? ` (${dist} km)` : ''}
                                  </SelectItem>
                                );
                              })}
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
                                {filteredDisciplinas?.map((d: any) => (
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
                                if (cat) setCheckedItemIds(new Set(cat.itens.filter(i => i.estado !== 'indisponivel' && i.estado !== 'em_manutencao').map(i => i.id)));
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
                                {cat.itens.map(item => {
                                  const isUnavailable = item.estado === 'indisponivel' || item.estado === 'em_manutencao';
                                  return (
                                    <label key={item.id} className={`flex items-center gap-2 text-sm cursor-pointer ${isUnavailable ? 'opacity-50' : ''}`}>
                                      <input
                                        type="checkbox"
                                        checked={checkedItemIds.has(item.id)}
                                        disabled={isUnavailable}
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
                                      {item.identificador || item.nome}
                                      {isUnavailable && <span className="text-xs text-destructive ml-1">({item.estado})</span>}
                                    </label>
                                  );
                                })}
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
                        {/* Recorrência */}
                        <div className="space-y-3 rounded-md border border-dashed border-border p-3">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="aula-recorr"
                              checked={(formData as any).repetir_semanalmente || false}
                              onCheckedChange={(v) =>
                                setFormData({ ...formData, repetir_semanalmente: !!v })
                              }
                            />
                            <Label htmlFor="aula-recorr" className="cursor-pointer font-normal">
                              Repetir semanalmente
                            </Label>
                          </div>
                          {(formData as any).repetir_semanalmente && (
                            <div className="flex items-center gap-2 pl-6">
                              <Label htmlFor="aula-semanas" className="text-sm text-muted-foreground whitespace-nowrap">
                                Nº de semanas:
                              </Label>
                              <Input
                                id="aula-semanas"
                                type="number"
                                min={2}
                                max={52}
                                className="w-20"
                                value={(formData as any).semanas || 4}
                                onChange={(e) =>
                                  setFormData({ ...formData, semanas: Number(e.target.value) })
                                }
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </TabsContent>

                    {/* ── Tab: Trabalho Autónomo ── */}
                    <TabsContent value="autonomo">
                      <div className="grid gap-4 py-4">
                        {/* Projeto */}
                        <div className="space-y-2">
                          <Label htmlFor="auto-projeto">Projeto <span className="text-destructive">*</span></Label>
                          <Select
                            value={autonomousForm.projeto_id || 'none'}
                            onValueChange={(v) => setAutonomousForm({ ...autonomousForm, projeto_id: v === 'none' ? '' : v })}
                          >
                            <SelectTrigger id="auto-projeto">
                              <SelectValue placeholder="Selecionar projeto" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover">
                              <SelectItem value="none">Selecionar projeto</SelectItem>
                              {projetos?.map((p) => (
                                <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

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

                        {/* Nº Sessão (auto-preenchido) */}
                        <div className="space-y-2">
                          <Label htmlFor="auto-tema">Nº Sessão</Label>
                          <Input
                            id="auto-tema"
                            placeholder="Nº Sessão"
                            value={autonomousForm.tema}
                            onChange={(e) => setAutonomousForm({ ...autonomousForm, tema: e.target.value })}
                          />
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
                    <div className="space-y-2">
                      <Label htmlFor="date">Data</Label>
                      <Input
                        id="date"
                        type="date"
                        defaultValue={format(new Date(editingSession.data_hora), 'yyyy-MM-dd')}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="time">Hora de início</Label>
                        <Input
                          id="time"
                          type="time"
                          defaultValue={format(new Date(editingSession.data_hora), 'HH:mm')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="time-end">Hora de fim</Label>
                        <Input
                          id="time-end"
                          type="time"
                          defaultValue={format(addMinutes(new Date(editingSession.data_hora), editingSession.duracao_minutos), 'HH:mm')}
                        />
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
                          {mentoresApi?.map((mentor) => {
                            const turma = turmas?.find(t => t.id === formData.turma_id);
                            const key = turma ? `${mentor.id}_${turma.estabelecimento_id}` : '';
                            const dist = mentorDistances[key];
                            return (
                              <SelectItem key={mentor.id} value={String(mentor.id)}>
                                {mentor.nome}{dist != null ? ` (${dist} km)` : ''}
                              </SelectItem>
                            );
                          })}
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
                      disabled={createSessionMutation.isPending || createAutonomousMutation.isPending || updateSessionMutation.isPending || createRecurringSessionMutation.isPending}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {editingSession ? 'Atualizar' : modalTab === 'autonomo' ? 'Agendar Trabalho' : 'Criar Sessão'}
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
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
                    {/* Grid lines for hours 07:00–21:00 (14 hours) */}
                    <div className="absolute inset-0 pointer-events-none">
                      {Array.from({ length: 14 }).map((_, i) => (
                        <div key={i} className="border-t border-border/20 w-full" style={{ height: `${100 / 14}%` }} />
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
                              {isAdmin && !isAutonomous && (
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
                                <div className="truncate opacity-90 text-[9px] mt-0.5 flex items-center gap-1">
                                  <User className="h-2 w-2" />
                                  {equipa?.find(p => p.id === event.responsavel_user_id)?.full_name?.split(' ')[0] ?? '?'}
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
                      {isAdmin && (
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
                viewSession.is_autonomous ? (
                  <Badge className={viewSession.is_realized ? 'bg-green-100 text-green-800 border-green-300' : 'bg-muted text-muted-foreground border-dashed'}>
                    {viewSession.is_realized ? 'Trabalho Realizado' : 'Trabalho Planeado'}
                  </Badge>
                ) : (
                  <Badge className={statusColors[viewSession.estado as SessionStatus]}>
                    {viewSession.estado}
                  </Badge>
                )
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

              {viewSession.is_autonomous ? (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs font-medium uppercase">Trabalho Autónomo</p>
                  <div className="p-2 bg-secondary/30 rounded-md space-y-1">
                    <div className="flex justify-between">
                      <span className="text-sm font-semibold">Tipo de Atividade:</span>
                      <span className="text-sm">{viewSession.tipo_atividade || '-'}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <>
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
                </>
              )}

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
            {(() => {
              if (!viewSession) return null;
              // Determine if the session belongs to someone else
              const isOwnSession = viewSession.is_autonomous
                ? viewSession.responsavel_user_id === user?.id
                : viewSession.mentor_user_id === user?.id;
              const isOtherUser = isAdmin && !isOwnSession;

              const handleWithConfirmation = (action: () => void) => {
                if (isOtherUser) {
                  setPendingAction(() => action);
                } else {
                  action();
                }
              };

              const greenClass = isOtherUser
                ? 'w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white'
                : 'w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white';
              const greyClass = isOtherUser
                ? 'w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white'
                : 'w-full sm:w-auto bg-[#6B7280] hover:bg-[#555e68] text-white';

              return (
                <>
                  {/* Botão Confirmar — sessões pendentes (mentor atribuído ou coordenador) */}
                  {viewSession.estado === 'pendente' && !viewSession.is_autonomous &&
                    (isAdmin || isOwnSession) && (
                      <Button
                        onClick={() => handleWithConfirmation(() => confirmMutation.mutate(viewSession.id))}
                        disabled={confirmMutation.isPending}
                        className={greenClass}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        {confirmMutation.isPending ? 'A confirmar...' : 'Confirmar Sessão'}
                      </Button>
                    )}
                  {/* Botão Marcar como Realizado — trabalho autónomo planeado (responsável ou coordenador) */}
                  {viewSession.is_autonomous && !viewSession.is_realized &&
                    (isAdmin || isOwnSession) && (
                      <Button
                        onClick={() => handleWithConfirmation(() => realizeMutation.mutate(viewSession.id))}
                        disabled={realizeMutation.isPending}
                        className={greenClass}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        {realizeMutation.isPending ? 'A marcar...' : 'Marcar como Realizado'}
                      </Button>
                    )}
                  {/* Botão Terminar — sessões confirmadas presenciais cuja hora já passou (mentor ou coordenador) */}
                  {viewSession.estado === 'confirmada' && !viewSession.is_autonomous && new Date(viewSession.data_hora) <= new Date() &&
                    (isAdmin || isOwnSession) && (
                      <Button
                        onClick={() => handleWithConfirmation(() => { setIsDetailOpen(false); openTerminarModal(viewSession.id); })}
                        className={greyClass}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Terminar Sessão
                      </Button>
                    )}
                  {isAdmin && (
                    <Button onClick={() => { setIsDetailOpen(false); handleOpenEdit(viewSession); }} variant="outline" className="w-full sm:w-auto">
                      <Edit2 className="w-4 h-4 mr-2" />
                      Editar Sessão
                    </Button>
                  )}
                </>
              );
            })()}
            <Button onClick={() => setIsDetailOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRMAÇÃO — ação em sessão de outro user */}
      <AlertDialog open={!!pendingAction} onOpenChange={(open) => { if (!open) setPendingAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar sessão de outro membro</AlertDialogTitle>
            <AlertDialogDescription>
              Estás prestes a alterar uma sessão atribuída a outro membro da equipa. Pretendes continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction onClick={() => { pendingAction?.(); setPendingAction(null); }}>
              Sim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* AI Agent Sidebar */}
      <AIAgentChat open={isAgentOpen} onClose={() => setIsAgentOpen(false)} />
    </div >
  );
};

export default Horarios;
