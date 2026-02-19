// User Profiles
export type UserProfile = 'coordenador' | 'mentor' | 'produtor' | 'mentor_produtor';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserProfile;
  avatar?: string;
}

// Sessions / Classes
export type SessionStatus = 'rascunho' | 'pendente' | 'confirmada' | 'recusada';

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
export type EquipmentStatus = 'Disponivel' | 'Em uso' | 'Manutencao' | 'disponivel' | 'em_uso' | 'manutencao';

export interface Equipment {
  id: string;
  name: string;
  type: string;
  status: EquipmentStatus;
  lastResponsible?: User;
  assignedToSession?: string;
  notes?: string;
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
  atividade_id?: number;
  disciplina_nome?: string;
  equipamento_id?: string;
  equipamento_nome?: string;
  // Trabalho Autónomo
  is_autonomous?: boolean;
  is_realized?: boolean;
  tipo_atividade?: string | null;
  responsavel_user_id?: string | null;
  musica_id?: number | null;
}

export interface Turma {
  id: number;
  nome: string;
  estabelecimento_nome: string; // Renamed
  estabelecimento_id: number; // Renamed
  display_name: string;
}

export interface Estabelecimento { // Renamed form Instituicao
  id: number;
  nome: string;
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
  atividade_id?: number | null;
  equipamento_id?: string | null;
  is_autonomous?: boolean;
  is_realized?: boolean;
  tipo_atividade?: string | null;
  responsavel_user_id?: string | null;
  musica_id?: number | null;
}

export interface PublicProfileEquipa {
  id: string;
  email: string;
  full_name: string;
  role: string;
  avatar_url?: string;
}
