import { useState, useEffect, useCallback, useRef } from 'react';
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
  ChevronDown,
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
  XCircle,
  Wrench,
  Users,
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
  addDays,
  subDays,
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
  agendada: 'bg-[#d99426] text-white border-[#d99426]',
  pendente: 'bg-[#d99426] text-white border-[#d99426]',
  confirmada: 'bg-[#3399ce] text-white border-[#3399ce]',
  recusada: 'bg-[#A35339] text-white border-[#A35339]',
  terminada: 'bg-[#4ea381] text-white border-[#4ea381]',
};

// Estilos para eventos autónomos
const autonomousPlannedClass = 'bg-muted/60 text-muted-foreground border-muted-foreground/40 border-dashed opacity-80';
const autonomousRealizedClass = 'bg-[#4EA380]/20 text-[#2d7a5c] border-[#4EA380] border-solid';
const outroClass = 'bg-pink-500/15 border border-pink-400/50 text-pink-700 dark:text-pink-300';

// Removed 'rascunho' and 'agendada' from legend (agendada renders same as pendente)
const statusLabels: Record<string, string> = {
  pendente: 'Pendente',
  confirmada: 'Confirmada',
  recusada: 'Recusada',
  terminada: 'Terminada',
};

const statusDots: Record<string, string> = {
  agendada: 'bg-[#d99426]',
  pendente: 'bg-[#d99426]',
  confirmada: 'bg-[#3399ce]',
  recusada: 'bg-[#A35339]',
  terminada: 'bg-[#4ea381]',
};

/** Inline component to show equipment items for a session */
const EquipamentoView = ({ aulaId }: { aulaId: number }) => {
  const { data } = useQuery<{ id: number; nome: string; identificador?: string; categoria_nome: string; estado?: string }[]>({
    queryKey: ['aula-equipamento', aulaId],
    queryFn: () => api.get(`/api/aulas/${aulaId}/equipamento`).then((r: any) => r.data ?? r),
  });
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());

  if (!data || data.length === 0) return <p className="text-sm">Nenhum</p>;

  const grouped = data.reduce<Record<string, typeof data>>((acc, item) => {
    const cat = item.categoria_nome;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const toggleCat = (cat: string) =>
    setOpenCats(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });

  return (
    <div className="space-y-1">
      {Object.entries(grouped).map(([cat, items]) => {
        const isOpen = openCats.has(cat);
        return (
          <div key={cat} className="rounded-md border border-border/50 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleCat(cat)}
              className="flex w-full items-center justify-between px-2.5 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors"
            >
              <span>{cat} <span className="text-muted-foreground font-normal">({items.length})</span></span>
              <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <div className="border-t border-border/50 px-2.5 py-1.5 space-y-0.5">
                {items.map(item => (
                  <p key={item.id} className="text-xs">
                    {'\u2022'} {item.identificador || item.nome}
                    {item.estado && item.estado !== 'excelente' && (
                      <span className="text-xs text-warning ml-1">({item.estado})</span>
                    )}
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const MINUTES_5 = ['00','05','10','15','20','25','30','35','40','45','50','55'];
const HOURS_24 = Array.from({ length: 14 }, (_, i) => String(i + 7).padStart(2, '0'));

function TimePicker5Min({
  id,
  value,
  onChange,
  defaultValue,
}: {
  id: string;
  value?: string;
  onChange?: (val: string) => void;
  defaultValue?: string;
}) {
  const initial = value ?? defaultValue ?? '';
  const [hour, setHour] = useState(() => initial.split(':')[0] ?? '');
  const [minute, setMinute] = useState(() => initial.split(':')[1] ?? '');

  useEffect(() => {
    if (value !== undefined) {
      const parts = value.split(':');
      setHour(parts[0] ?? '');
      setMinute(parts[1] ?? '');
    }
  }, [value]);

  const composed = hour !== '' && minute !== '' ? `${hour}:${minute}` : '';

  const handleHour = (h: string) => {
    setHour(h);
    const m = minute || '00';
    onChange?.(`${h}:${m}`);
  };

  const handleMinute = (m: string) => {
    setMinute(m);
    const h = hour || '00';
    onChange?.(`${h}:${m}`);
  };

  return (
    <div className="flex items-center gap-1">
      <input type="hidden" id={id} value={composed} readOnly />
      <Select value={hour} onValueChange={handleHour}>
        <SelectTrigger className="w-[68px]">
          <SelectValue placeholder="--" />
        </SelectTrigger>
        <SelectContent className="bg-popover max-h-48">
          {HOURS_24.map((h) => (
            <SelectItem key={h} value={h}>{h}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground">:</span>
      <Select value={minute} onValueChange={handleMinute}>
        <SelectTrigger className="w-[68px]">
          <SelectValue placeholder="--" />
        </SelectTrigger>
        <SelectContent className="bg-popover">
          {MINUTES_5.map((m) => (
            <SelectItem key={m} value={m}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const Horarios = () => {
  const { profile } = useProfile();
  const isAdmin = profile === 'coordenador' || profile === 'direcao' || profile === 'it_support';
  const { user } = useAuth(); // Get current user
  const [filterMode, setFilterMode] = useState<'all' | 'mine'>(profile === 'mentor' ? 'mine' : 'all');
  const [filterProjectId, setFilterProjectId] = useState<number | null>(null);
  const [filterMemberId, setFilterMemberId] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'list'>('week');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAgentOpen, setIsAgentOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<AulaAPI | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [viewSession, setViewSession] = useState<AulaAPI | null>(null);

  // TI detail modal
  const [isTIDetailOpen, setIsTIDetailOpen] = useState(false);
  const [viewTISession, setViewTISession] = useState<AulaAPI | null>(null);

  // Deadline task modal (tarefa com data_limite no calendário)
  const [isDeadlineOpen, setIsDeadlineOpen] = useState(false);
  const [viewDeadlineTarefa, setViewDeadlineTarefa] = useState<{ id: number; titulo: string; prioridade: string; descricao?: string | null; estado_global?: string | null } | null>(null);

  // Confirmação para ações em sessões de outros users
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Confirmação de apagar sessão
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Mobile: dia selecionado para vista de dia único
  const [selectedDay, setSelectedDay] = useState(new Date());
  const handlePrevDay = () => setSelectedDay(prev => subDays(prev, 1));
  const handleNextDay = () => setSelectedDay(prev => addDays(prev, 1));

  // Swipe carrossel para mudar de dia no mobile
  const swipeTouchStartX = useRef<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleSwipeTouchStart = (e: React.TouchEvent) => {
    if (isAnimating) return;
    swipeTouchStartX.current = e.touches[0].clientX;
  };

  const handleSwipeTouchMove = (e: React.TouchEvent) => {
    if (swipeTouchStartX.current === null || isAnimating) return;
    setDragX(e.touches[0].clientX - swipeTouchStartX.current);
  };

  const handleSwipeTouchEnd = (e: React.TouchEvent) => {
    if (swipeTouchStartX.current === null || isAnimating) return;
    const delta = e.changedTouches[0].clientX - swipeTouchStartX.current;
    swipeTouchStartX.current = null;
    const vw = window.innerWidth;

    if (Math.abs(delta) < 50) {
      // Snap back ao centro
      setIsAnimating(true);
      setDragX(0);
      setTimeout(() => setIsAnimating(false), 250);
      return;
    }

    const goNext = delta < 0; // swipe left → próximo dia

    // Fase 1: slide out para o lado do swipe
    setIsAnimating(true);
    setDragX(goNext ? -vw : vw);

    setTimeout(() => {
      // Fase 2: muda o conteúdo + reposiciona instantaneamente no lado oposto
      setIsAnimating(false);
      setDragX(goNext ? vw : -vw);
      if (goNext) setSelectedDay(prev => addDays(prev, 1));
      else setSelectedDay(prev => subDays(prev, 1));

      // Fase 3: slide in para o centro
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
          setDragX(0);
          setTimeout(() => setIsAnimating(false), 250);
        });
      });
    }, 250);
  };

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
    queryFn: () => api.get<AulaAPI[]>('/api/aulas').then((r: any) => r.data ?? r),
    enabled: !!apiUrl,
  });
  // Fetch turmas for dropdown
  const { data: turmas } = useQuery({
    queryKey: ['turmas'],
    queryFn: () => api.get<Turma[]>('/api/turmas').then((r: any) => r.data ?? r),
    enabled: !!apiUrl,
  });

  // Fetch mentores for dropdown (Replacing mock data)
  interface Mentor { id: number; nome: string; latitude: number | null; longitude: number | null; perfil: string | null; }
  const { data: mentoresApi } = useQuery({
    queryKey: ['mentores'],
    queryFn: () => api.get<Mentor[]>('/api/mentores').then((r: any) => r.data ?? r),
    enabled: !!apiUrl,
  });

  // Fetch estabelecimentos (para coordenadas GPS)
  interface EstabGeo { id: number; nome: string; latitude: number | null; longitude: number | null; }
  const { data: estabelecimentos } = useQuery({
    queryKey: ['estabelecimentos'],
    queryFn: () => api.get<EstabGeo[]>('/api/estabelecimentos').then((r: any) => r.data ?? r),
    enabled: !!apiUrl,
  });

  // Distâncias mentor→estabelecimento
  const [mentorDistances, setMentorDistances] = useState<Record<string, number>>({});

  // Curriculo removed — now using local turma disciplinas/atividades via wiki API

  // Fetch Equipamento (categorias com itens individuais)
  const { data: kitCategorias } = useQuery<{ id: number; nome: string; itens: { id: number; nome: string; identificador?: string; estado?: string }[] }[]>({
    queryKey: ['equipamento-categorias'],
    queryFn: () => api.get('/api/equipamento/categorias').then((r: any) => r.data ?? r),
    enabled: !!apiUrl,
  });

  const [selectedKitCatId, setSelectedKitCatId] = useState<string>('');
  const [kitItemsOpen, setKitItemsOpen] = useState(false);
  const [checkedItemIds, setCheckedItemIds] = useState<Set<number>>(new Set());

  // Fetch Equipa (para dropdown do formulário autónomo)
  const { data: equipa } = useQuery({
    queryKey: ['equipa'],
    queryFn: () => api.get<PublicProfileEquipa[]>('/api/equipa').then((r: any) => r.data ?? r),
    enabled: !!apiUrl,
  });

  // Tarefas internas (para Trabalho Interno)
  interface TarefaBasic { id: number; titulo: string; prioridade: string; data_limite?: string | null; estado_global?: string | null; descricao?: string | null; }
  const { data: tarefas = [] } = useQuery<TarefaBasic[]>({
    queryKey: ['tarefas'],
    queryFn: () => api.get('/api/tarefas').then((r: any) => r.data ?? r),
    enabled: !!apiUrl,
  });

  // Projeto → Estabelecimento → Turma cascading
  const [selectedProjetoId, setSelectedProjetoId] = useState<number | null>(null);
  const [selectedEstabId, setSelectedEstabId] = useState<number | null>(null);

  const { data: projetos } = useQuery({
    queryKey: ['projetos'],
    queryFn: () => api.get<Projeto[]>('/api/projetos').then((r: any) => r.data ?? r),
    enabled: !!apiUrl,
  });

  const { data: projetoEstabs } = useQuery({
    queryKey: ['projeto-estabs', selectedProjetoId],
    queryFn: () => api.get<Estabelecimento[]>(`/api/projetos/${selectedProjetoId}/estabelecimentos`).then((r: any) => r.data ?? r),
    enabled: !!selectedProjetoId,
  });

  // Estabelecimentos do projeto selecionado no FILTRO (independente do form)
  const { data: filterProjetoEstabs } = useQuery({
    queryKey: ['projeto-estabs-filter', filterProjectId],
    queryFn: () => api.get<Estabelecimento[]>(`/api/projetos/${filterProjectId}/estabelecimentos`).then((r: any) => r.data ?? r),
    enabled: !!filterProjectId,
  });

  // Turmas filtradas pelo estabelecimento selecionado (reactive query)
  const { data: filteredTurmas = [] } = useQuery({
    queryKey: ['turmas', 'by-estab', selectedEstabId],
    queryFn: () => api.get<Turma[]>(`/api/turmas?estabelecimento_id=${selectedEstabId}`).then((r: any) => r.data ?? r),
    enabled: !!selectedEstabId,
  });

  const [formData, setFormData] = useState<Partial<AulaCreate> & { repetir_semanalmente?: boolean; semanas?: number }>({
    duracao_minutos: 120,
    tipo: 'ensaio',
    atividade_uuid: null,
    observacoes: ''
  });

  // Estado do formulário de Trabalho Autónomo
  const [modalTab, setModalTab] = useState<'aula' | 'autonomo' | 'outro'>('aula');
  const [outroForm, setOutroForm] = useState({
    titulo: '',
    participantes_ids: [] as string[],
    date: '',
    hora_inicio: '',
    hora_fim: '',
    observacoes: '',
  });
  const [autonomousForm, setAutonomousForm] = useState({
    responsavel_user_id: '',
    date: '',
    hora_inicio: '',
    hora_fim: '',
    projeto_id: '' as string,
    tema: '',
    repetir_semanalmente: false,
    semanas: 4,
    observacoes: '',
  });

  // ── Helper: filtra atividades pelo role da atividade ──
  // Coordenadores são metamórficos: podem fazer sessões de qualquer atividade.
  const COORD_ROLES_SET = new Set(['coordenador', 'direcao', 'it_support']);

  function canRoleDoActivity(actRole: string | null | undefined, userRole: string | null | undefined): boolean {
    if (!actRole) return true; // sem restrição: visível para todos
    if (!userRole) return true; // sem role definido: mostra tudo
    if (COORD_ROLES_SET.has(userRole.toLowerCase())) return true; // coordenadores vêem tudo
    return actRole.toLowerCase() === userRole.toLowerCase();
  }

  function filterActivitiesByType(activities: any[], isAutonomous: boolean, role: string | null | undefined): any[] {
    return activities.filter((a: any) => (!!a.is_autonomous) === isAutonomous && canRoleDoActivity(a.role, role));
  }

  // Disciplinas locais da turma selecionada (com atividades UUID)
  const { data: turmaDisciplinas = [] } = useQuery({
    queryKey: ['wiki-turma-disciplinas', formData.turma_id],
    queryFn: () => api.get(`/api/wiki/turma/${formData.turma_id}/disciplinas`).then((r: any) => r.data ?? r),
    enabled: !!formData.turma_id,
  });

  // Stats por instituição (para pré-preencher Nº Sessão)
  const { data: statsInstituicao } = useQuery({
    queryKey: ['producao-stats-inst', selectedProjetoId],
    queryFn: () => api.get<{
      estabelecimento_id: number; estabelecimento_nome: string;
      turmas: { turma_id: number; disciplina_id: number | null; sessoes_realizadas: number }[];
    }[]>(`/api/producao/stats/instituicao?projeto_id=${selectedProjetoId}`).then((r: any) => r.data ?? r),
    enabled: !!selectedProjetoId,
  });

  // Helper to get activities for selected discipline
  const [selectedDisciplinaId, setSelectedDisciplinaId] = useState<number | null>(null);

  // Role do mentor selecionado (tab Aula/Evento)
  const selectedMentorPerfil = formData.mentor_id
    ? mentoresApi?.find(m => m.id === formData.mentor_id)?.perfil ?? null
    : null;

  // Nome da disciplina selecionada (para filtrar códigos de sessão)
  const selectedDisciplinaNome: string | null = selectedDisciplinaId
    ? (turmaDisciplinas as any[])?.find((d: any) => d.id === selectedDisciplinaId)?.nome ?? null
    : null;

  // Role da atividade selecionada (para perfil efetivo nos códigos de sessão)
  const selectedActivityRole: string | null = formData.atividade_uuid
    ? (turmaDisciplinas as any[])
        ?.flatMap((d: any) => d.atividades || [])
        ?.find((a: any) => a.uuid === formData.atividade_uuid)?.role ?? null
    : null;

  // Perfil efetivo para códigos de sessão: coordenadores assumem o role da atividade (metamórfico)
  const effectivePerfil: string | null = selectedMentorPerfil && COORD_ROLES_SET.has(selectedMentorPerfil) && selectedActivityRole
    ? selectedActivityRole
    : selectedMentorPerfil;

  // Códigos de sessão (sumário + objetivo) filtrados por perfil efetivo + disciplina
  interface CodigoSessao { disciplina: string; codigo: string; sumario: string; objetivo: string; }
  const { data: codigosSessao = [] } = useQuery<CodigoSessao[]>({
    queryKey: ['codigos-sessao', effectivePerfil, selectedDisciplinaNome],
    queryFn: () => api.get<CodigoSessao[]>(
      `/api/codigos-sessao?perfil=${encodeURIComponent(effectivePerfil || '')}&disciplina=${encodeURIComponent(selectedDisciplinaNome || '')}`
    ).then((r: any) => r.data ?? r),
    enabled: !!formData.atividade_uuid && !!effectivePerfil && !!selectedDisciplinaNome,
  });

  // Preview do código selecionado
  const selectedCodigoPreview = formData.codigo_sessao
    ? codigosSessao.find(c => c.codigo === formData.codigo_sessao) ?? null
    : null;

  // Filtra atividades: tab Aula = is_autonomous=false + role do mentor
  const availableActivities = selectedDisciplinaId
    ? filterActivitiesByType(
      turmaDisciplinas?.find((d: any) => d.id === selectedDisciplinaId)?.atividades || [],
      false,
      selectedMentorPerfil,
    )
    : [];

  // ── Estado para tab Trabalho Autónomo: estabelecimento + turma + disciplina + atividade ──
  const [autoEstabId, setAutoEstabId] = useState<number | null>(null);
  const [autoTurmaId, setAutoTurmaId] = useState<number | null>(null);
  const [autoDisciplinaId, setAutoDisciplinaId] = useState<number | null>(null);
  const [autoAtividadeUuid, setAutoAtividadeUuid] = useState<string | null>(null);

  // Estabelecimentos do projeto autónomo
  const autoProjetoId = autonomousForm.projeto_id ? Number(autonomousForm.projeto_id) : null;
  const { data: autoProjetoEstabs } = useQuery({
    queryKey: ['projeto-estabs', autoProjetoId],
    queryFn: () => api.get<Estabelecimento[]>(`/api/projetos/${autoProjetoId}/estabelecimentos`).then((r: any) => r.data ?? r),
    enabled: !!autoProjetoId,
  });

  // Turmas do estabelecimento autónomo
  const { data: autoFilteredTurmas = [] } = useQuery({
    queryKey: ['turmas', 'by-estab', autoEstabId],
    queryFn: () => api.get<Turma[]>(`/api/turmas?estabelecimento_id=${autoEstabId}`).then((r: any) => r.data ?? r),
    enabled: !!autoEstabId,
  });

  // Disciplinas da turma autónoma
  const { data: autoDisciplinasList = [] } = useQuery({
    queryKey: ['wiki-turma-disciplinas', autoTurmaId],
    queryFn: () => api.get(`/api/wiki/turma/${autoTurmaId}/disciplinas`).then((r: any) => r.data ?? r),
    enabled: !!autoTurmaId,
  });

  // Role do membro selecionado (tab Trabalho Autónomo)
  const selectedAutoRole = autonomousForm.responsavel_user_id
    ? equipa?.find(p => p.id === autonomousForm.responsavel_user_id)?.role ?? null
    : null;

  // Filtra atividades: tab Autónomo = is_autonomous=true + role do membro
  const autoAvailableActivities = autoDisciplinaId
    ? filterActivitiesByType(
      autoDisciplinasList?.find((d: any) => d.id === autoDisciplinaId)?.atividades || [],
      true,
      selectedAutoRole,
    )
    : [];

  // Pré-preencher Nº Sessão aula (N+1) — dispara quando atividade é selecionada
  const { data: proximoNumeroAula, isFetching: fetchingNumeroAula } = useQuery({
    queryKey: ['proximo-numero-sessao', 'aula', formData.atividade_uuid],
    queryFn: () => api.get<{ proximo: number }>(
      `/api/aulas/proximo-numero?atividade_uuid=${formData.atividade_uuid}`
    ).then((r: any) => r.data ?? r),
    enabled: !!formData.atividade_uuid && !editingSession,
  });
  useEffect(() => {
    if (proximoNumeroAula?.proximo != null && !editingSession) {
      setFormData(prev => ({ ...prev, tema: String(proximoNumeroAula.proximo) }));
    }
  }, [proximoNumeroAula, editingSession]);

  // Pré-preencher Nº Sessão autónoma (N+1) — dispara quando atividade autónoma é selecionada
  const { data: proximoNumeroAutonomo, isFetching: fetchingNumeroAutonomo } = useQuery({
    queryKey: ['proximo-numero-sessao', 'autonomo', autoAtividadeUuid],
    queryFn: () => api.get<{ proximo: number }>(
      `/api/aulas/proximo-numero?atividade_uuid=${autoAtividadeUuid}&is_autonomous=true`
    ).then((r: any) => r.data ?? r),
    enabled: !!autoAtividadeUuid,
  });
  useEffect(() => {
    if (proximoNumeroAutonomo?.proximo != null) {
      setAutonomousForm(prev => ({ ...prev, tema: String(proximoNumeroAutonomo.proximo) }));
    }
  }, [proximoNumeroAutonomo]);

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
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd }).slice(0, 5);

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

  // Effective member id: 'mine' uses current user, explicit member filter uses that id
  const effectiveMemberId = filterMode === 'mine' ? (user?.id ?? null) : filterMemberId;

  const applyActiveFilters = (list: typeof aulasApi) => {
    if (!list) return [];
    let out = list;
    if (effectiveMemberId) {
      out = out.filter(a =>
        a.mentor_user_id === effectiveMemberId ||
        a.responsavel_user_id === effectiveMemberId ||
        a.participantes_ids?.includes(effectiveMemberId)
      );
    }
    if (filterProjectId !== null) {
      const estabIds = new Set((filterProjetoEstabs ?? []).map(e => e.id));
      out = out.filter(a => {
        if (a.turma_id) {
          const turma = turmas?.find(t => t.id === a.turma_id);
          if (turma) return estabIds.has(turma.estabelecimento_id);
        }
        // fallback para sessões autónomas sem turma
        return a.projeto_id === filterProjectId;
      });
    }
    return out;
  };

  const getSessionsForDay = (date: Date) => {
    if (!aulasApi || !Array.isArray(aulasApi)) return [];
    const forDay = aulasApi.filter(a => isSameDay(new Date(a.data_hora), date));
    return applyActiveFilters(forDay);
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
    setSelectedDay(new Date());
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
          atividade_uuid: data.payload.atividade_uuid,
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

  const concluirTarefaMutation = useMutation({
    mutationFn: (tarefaId: number) =>
      api.patch(`/api/tarefas/${tarefaId}/estado`, { estado: 'concluida' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] });
      setIsTIDetailOpen(false);
      toast.success('Tarefa marcada como concluída!');
    },
    onError: () => toast.error('Erro ao concluir tarefa.'),
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
      atividade_uuid: null,
      observacoes: '',
      repetir_semanalmente: false,
      semanas: 4,
    });
    setAutonomousForm({
      responsavel_user_id: '',
      date: '',
      hora_inicio: '',
      hora_fim: '',
      projeto_id: '',
      tema: '',
      repetir_semanalmente: false,
      semanas: 4,
      observacoes: '',
    });
    setOutroForm({
      titulo: '',
      participantes_ids: [],
      date: '',
      hora_inicio: '',
      hora_fim: '',
      observacoes: '',
    });
    setSelectedDisciplinaId(null);
    setAutoDisciplinaId(null);
    setAutoAtividadeUuid(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = async (session: AulaAPI) => {
    setEditingSession(session);

    // Pre-populate projeto + estabelecimento cascading
    if (session.projeto_id) {
      setSelectedProjetoId(session.projeto_id);
    } else {
      setSelectedProjetoId(null);
    }
    if (session.turma_id && turmas) {
      const turma = turmas.find(t => t.id === session.turma_id);
      if (turma) setSelectedEstabId(turma.estabelecimento_id);
      else setSelectedEstabId(null);
    } else {
      setSelectedEstabId(null);
    }

    setFormData({
      turma_id: session.turma_id,
      duracao_minutos: session.duracao_minutos,
      mentor_id: session.mentor_id,
      local: session.local,
      tema: session.tema,
      tipo: session.tipo,
      observacoes: session.observacoes,
      atividade_uuid: session.atividade_uuid || null,
      objetivos: session.objetivos || null,
      sumario: session.sumario || null,
      codigo_sessao: session.codigo_sessao || null,
    });

    // Find discipline for the activity to populate dropdown (uses UUID from local model)
    if (session.atividade_uuid && turmaDisciplinas?.length) {
      const disc = turmaDisciplinas.find((d: any) => d.atividades.some((a: any) => a.uuid === session.atividade_uuid));
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
    if (modalTab === 'outro') {
      if (!outroForm.titulo.trim()) {
        toast.error('O título é obrigatório.');
        return;
      }
      if (outroForm.participantes_ids.length === 0) {
        toast.error('Seleciona pelo menos um participante.');
        return;
      }
      if (!outroForm.date || !outroForm.hora_inicio || !outroForm.hora_fim) {
        toast.error('Data, hora de início e hora de fim são obrigatórios.');
        return;
      }
      const [hStart, mStart] = outroForm.hora_inicio.split(':').map(Number);
      const [hEnd, mEnd] = outroForm.hora_fim.split(':').map(Number);
      const duracao = (hEnd * 60 + mEnd) - (hStart * 60 + mStart);
      if (duracao <= 0) {
        toast.error('A hora de fim tem de ser posterior à hora de início.');
        return;
      }
      const payload: AulaCreate = {
        data_hora: `${outroForm.date} ${outroForm.hora_inicio}`,
        duracao_minutos: duracao,
        tipo: 'outro',
        tema: outroForm.titulo.trim(),
        observacoes: outroForm.observacoes || '',
        participantes_ids: outroForm.participantes_ids,
      };
      createSessionMutation.mutate(payload);
      return;
    }

    if (modalTab === 'autonomo') {
      if (!autonomousForm.responsavel_user_id || !autonomousForm.date || !autonomousForm.hora_inicio || !autonomousForm.hora_fim) {
        toast.error('Preenche todos os campos obrigatórios.');
        return;
      }
      if (!autoAtividadeUuid) {
        toast.error('Seleciona uma disciplina e atividade.');
        return;
      }
      const [hStart, mStart] = autonomousForm.hora_inicio.split(':').map(Number);
      const [hEnd, mEnd] = autonomousForm.hora_fim.split(':').map(Number);
      const duracao = (hEnd * 60 + mEnd) - (hStart * 60 + mStart);
      if (duracao <= 0) {
        toast.error('A hora de fim tem de ser posterior à hora de início.');
        return;
      }
      // Obter nome da atividade selecionada para tipo_atividade (backward compat)
      const selectedAutoActivity = autoAvailableActivities.find((a: any) => a.uuid === autoAtividadeUuid);
      const payload: AulaCreate = {
        data_hora: `${autonomousForm.date} ${autonomousForm.hora_inicio}`,
        duracao_minutos: duracao,
        tipo: 'trabalho_autonomo',
        is_autonomous: true,
        tipo_atividade: selectedAutoActivity?.nome || '',
        atividade_uuid: autoAtividadeUuid,
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
      atividade_uuid: formData.atividade_uuid,
      projeto_id: selectedProjetoId,
      objetivos: formData.objetivos || null,
      sumario: formData.sumario || null,
      codigo_sessao: formData.codigo_sessao || null,
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
    if (editingSession) setDeleteConfirmOpen(true);
  };

  const openDetailView = (session: AulaAPI) => {
    setViewSession(session);
    setIsDetailOpen(true);
  };

  /** Renderiza os eventos posicionados dentro de uma coluna de dia (reutilizado em desktop e mobile). */
  const renderDayEvents = (day: Date, compact = false) => {
    const daySessions = getSessionsForDay(day).filter(s => s.tipo !== 'trabalho_interno');
    const eventsForLayout = daySessions.map(session => ({
      ...session,
      start: new Date(session.data_hora),
      end: addMinutes(new Date(session.data_hora), session.duracao_minutos),
    }));
    const layoutEvents = computeEventLayout(eventsForLayout);

    if (layoutEvents.length === 0) {
      return (
        <p className="text-xs text-muted-foreground text-center py-4 relative z-10">
          Sem sessões
        </p>
      );
    }

    return layoutEvents.map((event) => {
      const isAutonomous = event.is_autonomous;
      const isRealized = event.is_realized;
      const isOutro = event.tipo === 'outro';
      const eventClass = isOutro
        ? outroClass
        : isAutonomous
          ? (isRealized ? autonomousRealizedClass : autonomousPlannedClass)
          : (statusColors[event.estado as SessionStatus] || 'bg-secondary');
      const zIdx = isRealized ? 20 : isAutonomous ? 5 : (event.zIndex || 10);
      const iconSize = compact ? 'h-3 w-3' : 'h-2 w-2';
      const subTextSize = compact ? 'text-[11px]' : 'text-[9px]';

      return (
        <div
          key={event.id}
          onClick={() => openDetailView(event)}
          style={{ top: event.top, height: event.height, left: event.left, width: event.width, position: 'absolute', zIndex: zIdx }}
          className={cn(
            'p-1 leading-tight rounded-md border cursor-pointer hover:opacity-90 transition-opacity overflow-hidden flex flex-col',
            compact ? 'text-xs' : 'text-[10px]',
            eventClass
          )}
          title={isOutro
            ? `${format(event.start, 'HH:mm')} — ${event.tema ?? 'Outro'}`
            : isAutonomous
              ? `${format(event.start, 'HH:mm')} — ${event.tipo_atividade ?? 'Trabalho Autónomo'}`
              : `${format(event.start, 'HH:mm')} - ${event.turma_nome}`
          }
        >
          <div className="font-bold flex justify-between items-center">
            <span>{format(event.start, 'HH:mm')} – {format(event.end, 'HH:mm')}</span>
            {isAdmin && !isAutonomous && !isOutro && (
              <Edit2
                className={cn(iconSize, 'opacity-50 hover:opacity-100 cursor-pointer')}
                onClick={(e) => { e.stopPropagation(); handleOpenEdit(event); }}
              />
            )}
          </div>
          {isOutro ? (
            <>
              <div className={cn('truncate font-semibold flex items-center gap-1', compact ? 'text-xs' : 'text-[10px]')}>
                <Users className={cn(iconSize, 'flex-shrink-0')} />
                {event.tema ?? 'Outro'}
              </div>
              <div className={cn('truncate opacity-90 mt-0.5', subTextSize)}>
                {(event.participantes_ids?.length ?? 0)} participante{(event.participantes_ids?.length ?? 0) !== 1 ? 's' : ''}
              </div>
            </>
          ) : isAutonomous ? (
            <>
              <div className={cn('truncate font-semibold flex items-center gap-1', compact ? 'text-xs' : 'text-[10px]')}>
                <Briefcase className={cn(iconSize, 'flex-shrink-0')} />
                {event.tipo_atividade ?? 'Trabalho Autónomo'}
              </div>
              <div className={cn('truncate opacity-90 mt-0.5 flex items-center gap-1', subTextSize)}>
                <User className={iconSize} />
                {equipa?.find(p => p.id === event.responsavel_user_id)?.full_name?.split(' ')[0] ?? '?'}
              </div>
              {isRealized && <div className={cn('mt-0.5 opacity-80', subTextSize)}>✓ Realizado</div>}
            </>
          ) : (
            <>
              <div className={cn('truncate font-semibold', compact ? 'text-xs' : 'text-[10px]')}>
                {event.turma_nome}
                <span className="opacity-75 font-normal ml-1">({event.estabelecimento_nome})</span>
              </div>
              <div className={cn('truncate opacity-90 mt-0.5 flex items-center gap-1', subTextSize)}>
                <User className={iconSize} />
                {event.mentor_nome?.split(' ')[0] ?? 'S/ Mentor'}
              </div>
            </>
          )}
        </div>
      );
    });
  };

  /** Renderiza a banda de Trabalho Interno + prazos acima da grelha de horário. */
  const renderDayInternos = (day: Date) => {
    const tiSessions = getSessionsForDay(day).filter(s => s.tipo === 'trabalho_interno');
    const dayStr = format(day, 'yyyy-MM-dd');
    const deadlineTarefas = (tarefas as TarefaBasic[]).filter(t =>
      t.data_limite === dayStr && t.estado_global !== 'concluida'
    );
    if (tiSessions.length === 0 && deadlineTarefas.length === 0) return null;
    return (
      <div className="mb-1 flex flex-col gap-1 px-1 pt-1">
        {tiSessions.map(session => {
          const tarefaTitulo = session.tarefa_titulo || (tarefas as TarefaBasic[]).find(t => t.id === session.tarefa_id)?.titulo || null;
          const horaStr = session.data_hora ? format(new Date(session.data_hora), 'HH:mm') : null;
          return (
            <div
              key={`ti-${session.id}`}
              onClick={() => { setViewTISession(session); setIsTIDetailOpen(true); }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-500/15 border border-purple-400/40 text-purple-700 dark:text-purple-300 cursor-pointer hover:bg-purple-500/25 transition-colors"
            >
              <Wrench className="h-3 w-3 shrink-0" />
              <span className="text-[11px] font-medium truncate flex-1">
                {tarefaTitulo ?? 'Trabalho Interno'}
              </span>
              {horaStr && <span className="text-[10px] opacity-70 shrink-0">{horaStr}</span>}
            </div>
          );
        })}
        {deadlineTarefas.map(tarefa => (
          <div
            key={`dl-${tarefa.id}`}
            onClick={() => { setViewDeadlineTarefa(tarefa); setIsDeadlineOpen(true); }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/15 border border-amber-400/40 text-amber-700 dark:text-amber-400 cursor-pointer hover:bg-amber-500/25 transition-colors"
          >
            <CalendarIcon className="h-3 w-3 shrink-0" />
            <span className="text-[11px] font-medium truncate flex-1">{tarefa.titulo}</span>
            <span className="text-[10px] opacity-70 shrink-0">Prazo</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* ... existing header ... */}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="hidden sm:block">
          <h1 className="text-2xl sm:text-3xl font-display font-bold">Planeamento de Horários</h1>
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
              <DialogContent className="w-full sm:max-w-[540px] bg-card max-h-[95dvh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-display">
                    {editingSession ? 'Editar Sessão' : 'Novo Agendamento'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingSession
                      ? 'Altere os detalhes da sessão existente.'
                      : 'Agenda uma aula com turma ou um bloco de trabalho autónomo.'}
                  </DialogDescription>
                </DialogHeader>

                {/* Tabs — apenas em modo de criação */}
                {!editingSession && (
                  <Tabs value={modalTab} onValueChange={(v) => setModalTab(v as 'aula' | 'autonomo' | 'outro')} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="aula">Aula / Evento</TabsTrigger>
                      <TabsTrigger value="autonomo" className="flex items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5" />
                        Autónomo
                      </TabsTrigger>
                      <TabsTrigger value="outro" className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        Outro
                      </TabsTrigger>
                    </TabsList>

                    {/* ── Tab: Aula / Evento ── */}
                    <TabsContent value="aula">
                      <div className="grid gap-4 py-4">
                        {/* Projeto → Estabelecimento → Turma (Cascading) */}
                        <div className="space-y-2">
                          <Label htmlFor="projeto">Projeto</Label>
                          <Select
                            value={selectedProjetoId ? String(selectedProjetoId) : ''}
                            onValueChange={(v) => {
                              setSelectedProjetoId(Number(v));
                              setSelectedEstabId(null);
                              setFormData({ ...formData, turma_id: undefined, atividade_uuid: null });
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
                              value={selectedEstabId ? String(selectedEstabId) : ''}
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
                              value={formData.turma_id ? String(formData.turma_id) : ''}
                              onValueChange={(v) => {
                                setFormData({ ...formData, turma_id: Number(v), atividade_uuid: null });
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
                            <Label>Hora de início</Label>
                            <TimePicker5Min id="time" />
                          </div>
                          <div className="space-y-2">
                            <Label>Hora de fim</Label>
                            <TimePicker5Min id="time-end" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="mentor">Mentor</Label>
                          <Select
                            value={formData.mentor_id ? String(formData.mentor_id) : ''}
                            onValueChange={(v) => setFormData({ ...formData, mentor_id: Number(v), atividade_uuid: null })}
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
                              value={selectedDisciplinaId ? String(selectedDisciplinaId) : ''}
                              onValueChange={(v) => {
                                setSelectedDisciplinaId(Number(v));
                                setFormData({ ...formData, atividade_uuid: null });
                              }}
                            >
                              <SelectTrigger id="disciplina">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                {turmaDisciplinas?.map((d: any) => (
                                  <SelectItem key={d.id} value={String(d.id)}>{d.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="atividade">Atividade</Label>
                            <Select
                              disabled={!selectedDisciplinaId || !formData.mentor_id}
                              value={formData.atividade_uuid || ''}
                              onValueChange={(v) => setFormData({ ...formData, atividade_uuid: v, codigo_sessao: null, sumario: null, objetivos: null })}
                            >
                              <SelectTrigger id="atividade">
                                <SelectValue placeholder={!formData.mentor_id ? "Selecione mentor..." : "Selecione..."} />
                              </SelectTrigger>
                              <SelectContent>
                                {availableActivities.map((algo: any) => (
                                  <SelectItem key={algo.uuid} value={algo.uuid}>{algo.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Código de Sessão */}
                        {formData.atividade_uuid && selectedMentorPerfil && (
                          <div className="space-y-2">
                            <Label htmlFor="codigo-sessao">Código de Sessão</Label>
                            <Select
                              value={formData.codigo_sessao || ''}
                              onValueChange={(v) => {
                                const cod = codigosSessao.find(c => c.codigo === v);
                                setFormData({
                                  ...formData,
                                  codigo_sessao: v,
                                  sumario: cod?.sumario ?? '',
                                  objetivos: cod?.objetivo ?? '',
                                });
                              }}
                            >
                              <SelectTrigger id="codigo-sessao">
                                <SelectValue placeholder={codigosSessao.length === 0 ? 'Sem códigos para esta disciplina' : 'Selecione o tema da sessão...'} />
                              </SelectTrigger>
                              <SelectContent>
                                {codigosSessao.map(c => (
                                  <SelectItem key={c.codigo} value={c.codigo}>{c.codigo}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* Preview do sumário + objetivos */}
                        {selectedCodigoPreview && (
                          <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2 text-sm">
                            <div>
                              <p className="font-medium text-muted-foreground mb-1">Sumário</p>
                              <p className="text-foreground">{selectedCodigoPreview.sumario}</p>
                            </div>
                            <div>
                              <p className="font-medium text-muted-foreground mb-1">Objetivos</p>
                              <p className="text-foreground whitespace-pre-line">{selectedCodigoPreview.objetivo}</p>
                            </div>
                          </div>
                        )}

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
                            <div className="flex items-center justify-between">
                              <Label htmlFor="nSessao">Nº Sessão</Label>
                              {fetchingNumeroAula && (
                                <span className="text-xs text-muted-foreground animate-pulse">a calcular...</span>
                              )}
                              {!fetchingNumeroAula && formData.atividade_uuid && formData.tema && (
                                <span className="text-xs text-muted-foreground">auto</span>
                              )}
                            </div>
                            <Input
                              id="nSessao"
                              type="number"
                              min={1}
                              placeholder={formData.atividade_uuid ? '...' : 'Selecione atividade'}
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
                              setKitItemsOpen(false);
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
                              <div className="rounded-md border border-border">
                                <button
                                  type="button"
                                  onClick={() => setKitItemsOpen(o => !o)}
                                  className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                                >
                                  <span>Lista de Itens ({checkedItemIds.size}/{cat.itens.length})</span>
                                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${kitItemsOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {kitItemsOpen && (
                                  <div className="space-y-1.5 border-t border-border px-3 py-2">
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
                                )}
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
                            onValueChange={(v) => {
                              setAutonomousForm({ ...autonomousForm, projeto_id: v === 'none' ? '' : v });
                              setAutoEstabId(null);
                              setAutoTurmaId(null);
                              setAutoDisciplinaId(null);
                              setAutoAtividadeUuid(null);
                            }}
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
                            onValueChange={(v) => {
                              setAutonomousForm({ ...autonomousForm, responsavel_user_id: v });
                              setAutoDisciplinaId(null);
                              setAutoAtividadeUuid(null);
                            }}
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

                        {/* Estabelecimento + Turma (cascading) */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="auto-estab">Estabelecimento</Label>
                            <Select
                              disabled={!autoProjetoId}
                              value={autoEstabId ? String(autoEstabId) : ''}
                              onValueChange={(v) => {
                                setAutoEstabId(Number(v));
                                setAutoTurmaId(null);
                                setAutoDisciplinaId(null);
                                setAutoAtividadeUuid(null);
                              }}
                            >
                              <SelectTrigger id="auto-estab">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent className="bg-popover">
                                {autoProjetoEstabs?.map((e) => (
                                  <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="auto-turma">Turma</Label>
                            <Select
                              disabled={!autoEstabId}
                              value={autoTurmaId ? String(autoTurmaId) : ''}
                              onValueChange={(v) => {
                                setAutoTurmaId(Number(v));
                                setAutoDisciplinaId(null);
                                setAutoAtividadeUuid(null);
                              }}
                            >
                              <SelectTrigger id="auto-turma">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent className="bg-popover">
                                {autoFilteredTurmas?.map((t) => (
                                  <SelectItem key={t.id} value={String(t.id)}>{t.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
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
                            <Label>Início</Label>
                            <TimePicker5Min
                              id="auto-start"
                              value={autonomousForm.hora_inicio}
                              onChange={(v) => setAutonomousForm({ ...autonomousForm, hora_inicio: v })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Fim</Label>
                            <TimePicker5Min
                              id="auto-end"
                              value={autonomousForm.hora_fim}
                              onChange={(v) => setAutonomousForm({ ...autonomousForm, hora_fim: v })}
                            />
                          </div>
                        </div>

                        {/* Disciplina + Atividade */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="auto-disciplina">Disciplina</Label>
                            <Select
                              disabled={!autoTurmaId}
                              value={autoDisciplinaId ? String(autoDisciplinaId) : ''}
                              onValueChange={(v) => {
                                setAutoDisciplinaId(Number(v));
                                setAutoAtividadeUuid(null);
                              }}
                            >
                              <SelectTrigger id="auto-disciplina">
                                <SelectValue placeholder={!autoTurmaId ? "Selecione turma..." : "Selecione..."} />
                              </SelectTrigger>
                              <SelectContent className="bg-popover">
                                {autoDisciplinasList?.map((d: any) => (
                                  <SelectItem key={d.id} value={String(d.id)}>{d.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="auto-atividade">Atividade</Label>
                            <Select
                              disabled={!autoDisciplinaId || !autonomousForm.responsavel_user_id}
                              value={autoAtividadeUuid || ''}
                              onValueChange={(v) => setAutoAtividadeUuid(v)}
                            >
                              <SelectTrigger id="auto-atividade">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent className="bg-popover">
                                {autoAvailableActivities.map((a: any) => (
                                  <SelectItem key={a.uuid} value={a.uuid}>{a.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Nº Sessão (auto-preenchido) */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="auto-tema">Nº Sessão</Label>
                            {fetchingNumeroAutonomo && (
                              <span className="text-xs text-muted-foreground animate-pulse">a calcular...</span>
                            )}
                            {!fetchingNumeroAutonomo && autoAtividadeUuid && autonomousForm.tema && (
                              <span className="text-xs text-muted-foreground">auto</span>
                            )}
                          </div>
                          <Input
                            id="auto-tema"
                            type="number"
                            min={1}
                            placeholder={autoAtividadeUuid ? '...' : 'Selecione atividade'}
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

                    {/* ── Tab: Outro (Sem Registos) ── */}
                    <TabsContent value="outro">
                      <div className="grid gap-4 py-4">

                        {/* Título */}
                        <div className="space-y-2">
                          <Label htmlFor="outro-titulo">Título <span className="text-destructive">*</span></Label>
                          <Input
                            id="outro-titulo"
                            placeholder="Ex: Reunião de equipa"
                            value={outroForm.titulo}
                            onChange={(e) => setOutroForm({ ...outroForm, titulo: e.target.value })}
                          />
                        </div>

                        {/* Quem */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Quem <span className="text-destructive">*</span></Label>
                            <button
                              type="button"
                              className="text-xs text-muted-foreground underline"
                              onClick={() => {
                                const allIds = (equipa ?? []).map(p => p.id);
                                const allSelected = allIds.length > 0 && allIds.every(id => outroForm.participantes_ids.includes(id));
                                setOutroForm({
                                  ...outroForm,
                                  participantes_ids: allSelected ? [] : allIds,
                                });
                              }}
                            >
                              {((equipa ?? []).length > 0 && (equipa ?? []).every(p => outroForm.participantes_ids.includes(p.id))) ? 'Desselecionar todos' : 'Selecionar todos'}
                            </button>
                          </div>
                          <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                            {(equipa ?? []).map((p) => (
                              <div key={p.id} className="flex items-center gap-2">
                                <Checkbox
                                  id={`outro-p-${p.id}`}
                                  checked={outroForm.participantes_ids.includes(p.id)}
                                  onCheckedChange={(checked) => {
                                    setOutroForm({
                                      ...outroForm,
                                      participantes_ids: checked
                                        ? [...outroForm.participantes_ids, p.id]
                                        : outroForm.participantes_ids.filter(id => id !== p.id),
                                    });
                                  }}
                                />
                                <label htmlFor={`outro-p-${p.id}`} className="text-sm cursor-pointer flex-1">
                                  {p.full_name}
                                  <span className="ml-1.5 text-xs text-muted-foreground capitalize">({p.role})</span>
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Data */}
                        <div className="space-y-2">
                          <Label htmlFor="outro-date">Data <span className="text-destructive">*</span></Label>
                          <input
                            id="outro-date"
                            type="date"
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                            value={outroForm.date}
                            onChange={(e) => setOutroForm({ ...outroForm, date: e.target.value })}
                          />
                        </div>

                        {/* Hora início / fim */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Início <span className="text-destructive">*</span></Label>
                            <TimePicker5Min
                              id="outro-time-start"
                              value={outroForm.hora_inicio}
                              onChange={(v) => setOutroForm({ ...outroForm, hora_inicio: v })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Fim <span className="text-destructive">*</span></Label>
                            <TimePicker5Min
                              id="outro-time-end"
                              value={outroForm.hora_fim}
                              onChange={(v) => setOutroForm({ ...outroForm, hora_fim: v })}
                            />
                          </div>
                        </div>

                        {/* Observações */}
                        <div className="space-y-2">
                          <Label htmlFor="outro-obs">Observações</Label>
                          <Textarea
                            id="outro-obs"
                            placeholder="Notas opcionais..."
                            value={outroForm.observacoes}
                            onChange={(e) => setOutroForm({ ...outroForm, observacoes: e.target.value })}
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
                        <Label>Hora de início</Label>
                        <TimePicker5Min
                          key={`edit-start-${editingSession.id}`}
                          id="time"
                          defaultValue={format(new Date(editingSession.data_hora), 'HH:mm')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Hora de fim</Label>
                        <TimePicker5Min
                          key={`edit-end-${editingSession.id}`}
                          id="time-end"
                          defaultValue={format(addMinutes(new Date(editingSession.data_hora), editingSession.duracao_minutos), 'HH:mm')}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-projeto">Projeto</Label>
                      <Select
                        value={selectedProjetoId ? String(selectedProjetoId) : ''}
                        onValueChange={(v) => {
                          setSelectedProjetoId(Number(v));
                          setSelectedEstabId(null);
                          setFormData({ ...formData, turma_id: undefined, atividade_uuid: null });
                          setSelectedDisciplinaId(null);
                        }}
                      >
                        <SelectTrigger id="edit-projeto">
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
                        <Label htmlFor="edit-estab">Estabelecimento</Label>
                        <Select
                          disabled={!selectedProjetoId}
                          value={selectedEstabId ? String(selectedEstabId) : ''}
                          onValueChange={(v) => {
                            setSelectedEstabId(Number(v));
                            setFormData({ ...formData, turma_id: undefined });
                          }}
                        >
                          <SelectTrigger id="edit-estab">
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
                          value={formData.turma_id ? String(formData.turma_id) : ''}
                          onValueChange={(v) => {
                            setFormData({ ...formData, turma_id: Number(v), atividade_uuid: null });
                            setSelectedDisciplinaId(null);
                          }}
                        >
                          <SelectTrigger id="turma">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent className="bg-popover">
                            {(selectedEstabId ? filteredTurmas : turmas)?.map((t) => (
                              <SelectItem key={t.id} value={String(t.id)}>{t.display_name ?? t.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mentor">Mentor</Label>
                      <Select
                        value={formData.mentor_id ? String(formData.mentor_id) : ''}
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
                          value={selectedDisciplinaId ? String(selectedDisciplinaId) : ''}
                          onValueChange={(v) => {
                            setSelectedDisciplinaId(Number(v));
                            setFormData({ ...formData, atividade_uuid: null });
                          }}
                        >
                          <SelectTrigger id="disciplina">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {turmaDisciplinas?.map((d: any) => (
                              <SelectItem key={d.id} value={String(d.id)}>{d.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="atividade">Atividade</Label>
                        <Select
                          disabled={!selectedDisciplinaId || !formData.mentor_id}
                          value={formData.atividade_uuid || ''}
                          onValueChange={(v) => setFormData({ ...formData, atividade_uuid: v, codigo_sessao: null, sumario: null, objetivos: null })}
                        >
                          <SelectTrigger id="atividade">
                            <SelectValue placeholder={!formData.mentor_id ? 'Selecione mentor...' : 'Selecione...'} />
                          </SelectTrigger>
                          <SelectContent>
                            {availableActivities.map((algo: any) => (
                              <SelectItem key={algo.uuid} value={algo.uuid}>{algo.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Código de Sessão */}
                    {formData.atividade_uuid && selectedMentorPerfil && (
                      <div className="space-y-2">
                        <Label htmlFor="codigo-sessao">Código de Sessão</Label>
                        <Select
                          value={formData.codigo_sessao || ''}
                          onValueChange={(v) => {
                            const cod = codigosSessao.find(c => c.codigo === v);
                            setFormData({
                              ...formData,
                              codigo_sessao: v,
                              sumario: cod?.sumario ?? '',
                              objetivos: cod?.objetivo ?? '',
                            });
                          }}
                        >
                          <SelectTrigger id="codigo-sessao">
                            <SelectValue placeholder={codigosSessao.length === 0 ? 'Sem códigos para esta disciplina' : 'Selecione o tema da sessão...'} />
                          </SelectTrigger>
                          <SelectContent>
                            {codigosSessao.map(c => (
                              <SelectItem key={c.codigo} value={c.codigo}>{c.codigo}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Preview sumário + objetivos */}
                    {selectedCodigoPreview && (
                      <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2 text-sm">
                        <div>
                          <p className="font-medium text-muted-foreground mb-1">Sumário</p>
                          <p className="text-foreground">{selectedCodigoPreview.sumario}</p>
                        </div>
                        <div>
                          <p className="font-medium text-muted-foreground mb-1">Objetivos</p>
                          <p className="text-foreground whitespace-pre-line">{selectedCodigoPreview.objetivo}</p>
                        </div>
                      </div>
                    )}

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
                          setKitItemsOpen(false);
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
                          <div className="rounded-md border border-border">
                            <button
                              type="button"
                              onClick={() => setKitItemsOpen(o => !o)}
                              className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                            >
                              <span>Lista de Itens ({checkedItemIds.size}/{cat.itens.length})</span>
                              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${kitItemsOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {kitItemsOpen && (
                              <div className="space-y-1.5 border-t border-border px-3 py-2">
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
                            )}
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
                      {editingSession ? 'Atualizar' : modalTab === 'autonomo' ? 'Agendar Autónomo' : 'Criar Sessão'}
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-sm font-medium text-muted-foreground flex items-center gap-1 shrink-0">
          <Filter className="h-4 w-4" />
          Filtro:
        </span>
        {/* Todas / Minhas */}
        <div className="flex items-center rounded-md border border-input bg-transparent p-1 shrink-0">
          <Button
            variant={filterMode === 'all' && !filterMemberId ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => { setFilterMode('all'); setFilterMemberId(null); }}
            className="h-7 text-xs"
          >
            Todas as Aulas
          </Button>
          <Button
            variant={filterMode === 'mine' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => { setFilterMode('mine'); setFilterMemberId(null); }}
            className="h-7 text-xs"
          >
            Minhas Aulas
          </Button>
        </div>
        {/* Projeto */}
        <Select
          value={filterProjectId !== null ? String(filterProjectId) : 'all'}
          onValueChange={(v) => setFilterProjectId(v === 'all' ? null : Number(v))}
        >
          <SelectTrigger className="h-8 text-xs w-auto min-w-[150px] max-w-[200px]">
            <SelectValue placeholder="Todos os Projetos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Projetos</SelectItem>
            {projetos?.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Membro da Equipa */}
        <Select
          value={filterMemberId ?? 'all'}
          onValueChange={(v) => {
            if (v === 'all') {
              setFilterMemberId(null);
            } else {
              setFilterMemberId(v);
              setFilterMode('all');
            }
          }}
        >
          <SelectTrigger className="h-8 text-xs w-auto min-w-[150px] max-w-[200px]">
            <SelectValue placeholder="Todos os Membros" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Membros</SelectItem>
            {equipa?.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* View Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {/* Mobile week view: navigate by day */}
          <Button
            variant="outline"
            size="icon"
            onClick={viewMode === 'week' ? handlePrevDay : handlePrevious}
            className="sm:hidden"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {/* Desktop: navigate by week/month */}
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevious}
            className="hidden sm:flex"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="min-w-[160px] sm:min-w-[200px] text-center">
            <p className="font-medium capitalize text-sm sm:text-base">
              {/* Mobile week view: show selected day */}
              {viewMode === 'week' ? (
                <>
                  <span className="sm:hidden">{format(selectedDay, "EEE, d MMM", { locale: pt })}</span>
                  <span className="hidden sm:inline">{getNavigationLabel()}</span>
                </>
              ) : getNavigationLabel()}
            </p>
          </div>

          {/* Mobile week view: navigate by day */}
          <Button
            variant="outline"
            size="icon"
            onClick={viewMode === 'week' ? handleNextDay : handleNext}
            className="sm:hidden"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {/* Desktop: navigate by week/month */}
          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            className="hidden sm:flex"
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

      {/* Loading / Error */}
      {aulasLoading && (
        <div className="grid grid-cols-5 gap-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-lg bg-secondary animate-pulse h-[120px]" />
          ))}
        </div>
      )}
      {aulasError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center text-destructive">
          <XCircle className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">Erro ao carregar horários. Tenta novamente.</p>
        </div>
      )}

      {/* Legend — desktop only (no mobile aparece abaixo do calendário) */}
      <div className="hidden sm:flex flex-wrap gap-4">
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
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm border-2 border-pink-400/50 bg-pink-500/15" />
          <span className="text-sm text-muted-foreground">Outro</span>
        </div>
      </div>

      {/* ... Calendar Views (using aulasApi) ... */}
      {/* Replaced sessions with aulasApi mapping */}

      {/* Week View */}
      {viewMode === 'week' && (
        <>
          {/* ── Mobile: single day view ── */}
          <div
            className="sm:hidden flex gap-1"
            onTouchStart={handleSwipeTouchStart}
            onTouchMove={handleSwipeTouchMove}
            onTouchEnd={handleSwipeTouchEnd}
          >
            {/* Hour labels — ficam fixas durante o swipe */}
            <div className="w-9 shrink-0 relative h-[600px]">
              {Array.from({ length: 14 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute text-[10px] text-muted-foreground/50 leading-none"
                  style={{ top: `${(i / 14) * 100}%`, transform: 'translateY(-50%)' }}
                >
                  {String(i + 7).padStart(2, '0')}h
                </div>
              ))}
            </div>
            {/* Wrapper que corta o cartão quando sai do ecrã */}
            <div className="flex-1 overflow-hidden">
              {/* Cartão do dia — é este que anima */}
              <div
                style={{
                  transform: `translateX(${dragX}px)`,
                  transition: isAnimating ? 'transform 0.25s ease' : 'none',
                  willChange: 'transform',
                }}
              >
                {renderDayInternos(selectedDay)}
                <div className="bg-card rounded-lg relative border border-border h-[600px] overflow-hidden">
                  {/* Grid lines */}
                  <div className="absolute inset-0 pointer-events-none">
                    {Array.from({ length: 14 }).map((_, i) => (
                      <div key={i} className="border-t border-border/20 w-full" style={{ height: `${100 / 14}%` }} />
                    ))}
                  </div>
                  {renderDayEvents(selectedDay, true)}
                </div>
              </div>
            </div>
          </div>

          {/* ── Desktop: 5-column week view ── */}
          <div className="hidden sm:flex gap-1">
            {/* Hour labels */}
            <div className="flex flex-col w-9 shrink-0">
              <div className="h-[62px]" />
              <div className="relative flex-1 h-[800px]">
                {Array.from({ length: 14 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute text-[10px] text-muted-foreground/50 leading-none"
                    style={{ top: `${(i / 14) * 100}%`, transform: 'translateY(-50%)' }}
                  >
                    {String(i + 7).padStart(2, '0')}h
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-5 gap-2 flex-1">
              {weekDays.map((day) => {
                const isToday = isSameDay(day, new Date());
                return (
                  <div key={day.toISOString()} className="flex flex-col h-full">
                    <div className={cn(
                      'text-center py-2 rounded-t-lg',
                      isToday ? 'bg-primary text-primary-foreground' : 'bg-secondary'
                    )}>
                      <p className="text-xs uppercase">{format(day, 'EEE', { locale: pt })}</p>
                      <p className="text-lg font-bold font-display">{format(day, 'd')}</p>
                    </div>
                    {renderDayInternos(day)}
                    <div className="bg-card rounded-b-lg relative border border-border h-[800px] overflow-hidden">
                      <div className="absolute inset-0 pointer-events-none">
                        {Array.from({ length: 14 }).map((_, i) => (
                          <div key={i} className="border-t border-border/20 w-full" style={{ height: `${100 / 14}%` }} />
                        ))}
                      </div>
                      {renderDayEvents(day, false)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

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
                const dayStr = format(day, 'yyyy-MM-dd');
                const dayDeadlines = (tarefas as TarefaBasic[]).filter(t =>
                  t.data_limite === dayStr && t.estado_global !== 'concluida'
                );

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
                            session.tipo === 'outro'
                              ? outroClass
                              : session.is_autonomous
                                ? (session.is_realized ? 'bg-[#4EA380]/20 text-[#2d7a5c] border border-[#4EA380]' : 'bg-muted text-muted-foreground border border-dashed border-muted-foreground/40')
                                : (statusColors[session.estado as SessionStatus] || 'bg-secondary')
                          )}
                          title={`${format(new Date(session.data_hora), 'HH:mm')} — ${session.tipo === 'outro' ? (session.tema ?? 'Outro') : session.is_autonomous ? (session.tipo_atividade ?? 'Trabalho Autónomo') : session.turma_nome}`}
                          onClick={() => openDetailView(session)}
                        >
                          <span className="font-medium">{format(new Date(session.data_hora), 'HH:mm')}</span>
                          <span className="ml-1 opacity-80">
                            {session.tipo === 'outro'
                              ? (session.tema ?? 'Outro')
                              : session.is_autonomous
                                ? (session.tipo_atividade ?? 'Autónomo')
                                : (session.mentor_nome?.split(' ')[0] ?? '—')}
                          </span>
                        </div>
                      ))}
                      {daySessions.length > 3 && (
                        <p className="text-xs text-muted-foreground text-center">
                          +{daySessions.length - 3} mais
                        </p>
                      )}
                      {dayDeadlines.map(tarefa => (
                        <div
                          key={`dl-${tarefa.id}`}
                          onClick={() => { setViewDeadlineTarefa(tarefa); setIsDeadlineOpen(true); }}
                          className="text-xs px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-400/40 flex items-center gap-1"
                        >
                          <CalendarIcon className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{tarefa.titulo}</span>
                        </div>
                      ))}
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
            {aulasApi && Array.isArray(aulasApi) && applyActiveFilters(aulasApi)
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

      {/* Legend — mobile only (abaixo do calendário) */}
      <div className="sm:hidden flex flex-wrap gap-3 pt-1">
        {Object.entries(statusLabels).map(([status, label]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={cn('w-2.5 h-2.5 rounded-full', statusDots[status as SessionStatus])} />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm border border-dashed border-muted-foreground/60 bg-muted/50" />
          <span className="text-xs text-muted-foreground">Trabalho Planeado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm border border-[#4EA380] bg-[#4EA380]/20" />
          <span className="text-xs text-muted-foreground">Trabalho Realizado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm border-2 border-pink-400/50 bg-pink-500/15" />
          <span className="text-xs text-muted-foreground">Outro</span>
        </div>
      </div>

      {/* DETAIL VIEW MODAL */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="w-full sm:max-w-[500px] max-h-[95dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Detalhes da Sessão</span>
              {viewSession && (
                viewSession.tipo === 'outro' ? (
                  <Badge className="bg-pink-500/15 border-pink-400/50 text-pink-700 dark:text-pink-300">Outro</Badge>
                ) : viewSession.is_autonomous ? (
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

              {viewSession.tipo === 'outro' ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs font-medium uppercase">Título</p>
                    <p className="font-semibold text-base">{viewSession.tema || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs font-medium uppercase flex items-center gap-1">
                      <Users className="w-3 h-3" /> Participantes
                    </p>
                    <div className="p-2 bg-secondary/30 rounded-md space-y-1">
                      {(viewSession.participantes_ids ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum participante</p>
                      ) : (
                        (viewSession.participantes_ids ?? []).map(uid => {
                          const member = equipa?.find(p => p.id === uid);
                          return (
                            <div key={uid} className="flex items-center gap-2">
                              <User className="w-3 h-3 text-muted-foreground" />
                              <span className="text-sm">{member?.full_name ?? uid}</span>
                              {member && <span className="text-xs text-muted-foreground capitalize">({member.role})</span>}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                  {viewSession.observacoes && (
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs font-medium uppercase">Observações</p>
                      <p className="text-sm">{viewSession.observacoes}</p>
                    </div>
                  )}
                </div>
              ) : viewSession.is_autonomous ? (
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

              {viewSession.tipo !== 'outro' && (
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
              )}

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

              {viewSession.tipo !== 'outro' && viewSession.observacoes && (
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
                  {/* Botão Confirmar — sessões pendentes/agendadas (mentor atribuído ou coordenador) */}
                  {(viewSession.estado === 'pendente' || viewSession.estado === 'agendada') && !viewSession.is_autonomous &&
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
                  {isAdmin && viewSession?.tipo !== 'outro' && (
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

      {/* CONFIRMAÇÃO — apagar sessão */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar sessão</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Queres apagar esta sessão?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => { if (editingSession) deleteSessionMutation.mutate(editingSession.id); }}
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
        <DialogContent className="w-full sm:max-w-[420px] max-h-[95dvh] overflow-y-auto">
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

      {/* Deadline Task Modal */}
      <Dialog open={isDeadlineOpen} onOpenChange={setIsDeadlineOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-xl bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <CalendarIcon className="h-4 w-4 text-amber-500" />
              Prazo de Tarefa
            </DialogTitle>
            <DialogDescription>
              Esta tarefa tem o prazo definido para este dia.
            </DialogDescription>
          </DialogHeader>
          {viewDeadlineTarefa && (
            <div className="space-y-3 py-1">
              <p className="font-semibold">{viewDeadlineTarefa.titulo}</p>
              {viewDeadlineTarefa.descricao && (
                <p className="text-sm text-muted-foreground">{viewDeadlineTarefa.descricao}</p>
              )}
              <span className={cn(
                'inline-block text-[10px] px-2 py-0.5 rounded-full font-medium',
                viewDeadlineTarefa.prioridade === 'urgente' ? 'bg-red-500/20 text-red-600' :
                viewDeadlineTarefa.prioridade === 'alto' ? 'bg-orange-500/20 text-orange-600' :
                viewDeadlineTarefa.prioridade === 'medio' ? 'bg-yellow-500/20 text-yellow-600' :
                'bg-muted text-muted-foreground'
              )}>
                {viewDeadlineTarefa.prioridade.charAt(0).toUpperCase() + viewDeadlineTarefa.prioridade.slice(1)}
              </span>
            </div>
          )}
          <DialogFooter>
            {viewDeadlineTarefa && (
              <Button
                onClick={() => { concluirTarefaMutation.mutate(viewDeadlineTarefa.id); setIsDeadlineOpen(false); }}
                disabled={concluirTarefaMutation.isPending}
                className="w-full"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Concluir Tarefa
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* TI Detail Modal */}
      <Dialog open={isTIDetailOpen} onOpenChange={setIsTIDetailOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-xl bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Wrench className="h-4 w-4 text-purple-500" />
              Trabalho Interno
            </DialogTitle>
          </DialogHeader>
          {viewTISession && (() => {
            const tarefa = viewTISession.tarefa_id
              ? (tarefas as any[]).find((t: any) => t.id === viewTISession.tarefa_id)
              : null;
            const hora = format(new Date(viewTISession.data_hora), 'HH:mm');
            const dataFmt = format(new Date(viewTISession.data_hora), 'd MMM yyyy', { locale: pt });
            return (
              <div className="space-y-3 py-2">
                {tarefa && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Tarefa</p>
                    <p className="font-semibold">{tarefa.titulo}</p>
                    {tarefa.prioridade && (
                      <span className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-medium',
                        tarefa.prioridade === 'urgente' ? 'bg-red-500/20 text-red-600' :
                        tarefa.prioridade === 'alto' ? 'bg-orange-500/20 text-orange-600' :
                        tarefa.prioridade === 'medio' ? 'bg-yellow-500/20 text-yellow-600' :
                        'bg-muted text-muted-foreground'
                      )}>
                        {tarefa.prioridade.charAt(0).toUpperCase() + tarefa.prioridade.slice(1)}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>{dataFmt} · {hora}{viewTISession.duracao_minutos > 0 ? ` (${viewTISession.duracao_minutos} min)` : ''}</span>
                </div>
                {viewTISession.observacoes && (
                  <p className="text-sm text-muted-foreground">{viewTISession.observacoes}</p>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            {viewTISession?.tarefa_id && (
              <Button
                onClick={() => viewTISession?.tarefa_id && concluirTarefaMutation.mutate(viewTISession.tarefa_id)}
                disabled={concluirTarefaMutation.isPending}
                className="w-full"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Concluir Tarefa
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Agent Sidebar */}
      <AIAgentChat open={isAgentOpen} onClose={() => setIsAgentOpen(false)} />
    </div >
  );
};

export default Horarios;
