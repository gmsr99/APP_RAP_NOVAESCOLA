// User Profiles
export type UserProfile = 'coordenador' | 'mentor' | 'produtor' | 'mentor_produtor' | 'direcao' | 'it_support';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserProfile;
  avatar?: string;
}

// Sessions / Classes
export type SessionStatus = 'rascunho' | 'agendada' | 'pendente' | 'confirmada' | 'recusada' | 'terminada';

export interface PublicProfile {
  id: string;
  email: string;
  full_name: string;
  role: string | 'coordenador' | 'mentor' | 'produtor';
  avatar_url?: string;
}

export interface Session {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  duration: number; // in minutes
  mentor: User;
  institution: string;
  location: string;
  turma: string;
  status: SessionStatus;
  equipment: string[];
  notes?: string;
}

// Session Records
export interface SessionRecord {
  id: string;
  sessionId: string;
  session: Session;
  completed: boolean;
  exceptions?: string;
  observations?: string;
  submittedAt: Date;
  submittedBy: User;
}

// Music Production
export type MusicStage = 'gravacao' | 'edicao' | 'mistura' | 'feedback' | 'finalizacao';

export interface Music {
  id: string;
  title: string;
  turma: string;
  project: string;
  responsible: User;
  stage: MusicStage;
  progress: number; // 0-100
  createdAt: Date;
  updatedAt: Date;
  feedback?: string[];
}

// Equipment
export interface KitItem {
  id: number;
  nome: string;
  identificador?: string;
  estado?: string;
}

export interface KitCategoria {
  id: number;
  nome: string;
  itens: KitItem[];
}

export interface AulaEquipItem {
  id: number;
  nome: string;
  identificador?: string;
  categoria_id: number;
  categoria_nome: string;
  estado?: string;
}

export interface EquipamentoItem {
  id: number;
  nome: string;
  identificador: string;
  estado: string;
  observacoes: string | null;
  categoria_id: number;
  categoria_nome: string;
  uuid: string | null;
  // Localização resolvida (manual > estabelecimento > mentor)
  localizacao_id: number | null;
  localizacao_nome: string | null;
  localizacao_tipo: 'estabelecimento' | 'mentor' | 'estudio' | null;
  ultimo_responsavel_id: string | null;
  responsavel_nome: string | null;
  ultima_utilizacao: string | null;
}

export interface EquipamentoLocalizacao {
  tipo: 'estabelecimento' | 'mentor' | 'estudio';
  ref_id: string | number | null;
  nome: string;
}

export interface EquipamentoStats {
  total: number;
  categorias: number;
  por_estado: Record<string, number>;
  disponiveis: number;
}

export interface EquipamentoHistorico {
  tipo: 'sessao' | 'manual';
  id: number;
  user_id: string | null;
  user_nome: string | null;
  data_utilizacao: string | null;
  aula_id: number | null;
  local_nome: string | null;
  observacoes: string | null;
}

export interface EquipamentoOcupacao {
  aula_id: number;
  data_hora: string;
  duracao_minutos: number;
  turma_nome: string | null;
  estabelecimento_nome: string | null;
  mentor_nome: string | null;
}

// Notifications
export type NotificationType = 'info' | 'action' | 'urgent';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  link?: string;
  metadados?: any;
}

// Dashboard Stats
export interface DashboardStats {
  sessionsThisWeek: number;
  activeLocations: number;
  activeMentors: number;
  pendingConfirmations: number;
  equipmentConflicts: number;
  musicInProduction: number;
}

// Aula (formato da API FastAPI / Supabase)
export interface AulaAPI {
  id: number;
  tipo: string;
  data_hora: string;
  duracao_minutos: number;
  estado: string;
  tema: string | null;
  local: string | null;
  observacoes: string | null;
  turma_nome: string | null;
  turma_id: number | null;
  mentor_nome: string | null;
  mentor_id: number | null;
  mentor_user_id: string | null;
  estabelecimento_nome: string | null;
  atividade_nome?: string;
  atividade_uuid?: string;
  disciplina_nome?: string;
  equipamento_nome?: string;
  objetivos?: string | null;
  sumario?: string | null;
  codigo_sessao?: string | null;
  // Trabalho Autónomo
  is_autonomous?: boolean;
  is_realized?: boolean;
  tipo_atividade?: string | null;
  responsavel_user_id?: string | null;
  musica_id?: number | null;
  projeto_id?: number | null;
  // Trabalho Interno
  tarefa_id?: number | null;
  tarefa_titulo?: string | null;
}

export interface Turma {
  id: number;
  nome: string;
  estabelecimento_nome: string; // Renamed
  estabelecimento_id: number; // Renamed
  display_name: string;
}

export interface Projeto {
  id: number;
  nome: string;
  descricao?: string;
  estado?: string;
}

export interface ContactoEstabelecimento {
  id: number;
  estabelecimento_id: number;
  tipo: 'telefone' | 'email' | 'maps' | 'website' | 'outro';
  valor: string;
  descricao?: string;
}

export interface Estabelecimento { // Renamed form Instituicao
  id: number;
  nome: string;
  sigla?: string;
  morada?: string;
  latitude?: number;
  longitude?: number;
}

export interface AulaCreate {
  turma_id?: number | null;
  data_hora: string;
  duracao_minutos: number;
  mentor_id?: number | null;
  local?: string;
  tema?: string;
  observacoes?: string;
  tipo: string;
  atividade_uuid?: string | null;
  projeto_id?: number | null;
  is_autonomous?: boolean;
  is_realized?: boolean;
  tipo_atividade?: string | null;
  responsavel_user_id?: string | null;
  musica_id?: number | null;
  objetivos?: string | null;
  sumario?: string | null;
  codigo_sessao?: string | null;
  tarefa_id?: number | null;
}

export interface PublicProfileEquipa {
  id: string;
  email: string;
  full_name: string;
  role: string;
  avatar_url?: string;
}

// Chat
export interface ChatChannel {
  id: string;
  name: string;
  description?: string | null;
  type: 'channel' | 'dm';
  created_at: string;
}

export interface ChatMessage {
  id: number;
  channel_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface ChatChannelWithMeta extends ChatChannel {
  unread_count: number;
  dm_partner?: PublicProfile;
}
