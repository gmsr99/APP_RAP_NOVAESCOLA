import { User, Session, SessionRecord, Music, Equipment, Notification, DashboardStats } from '@/types';

// Users
export const users: User[] = [
  { id: '1', name: 'Elton', email: 'elton@rapnovaescola.pt', role: 'coordenador' },
  { id: '2', name: 'Tomás', email: 'tomas@rapnovaescola.pt', role: 'mentor' },
  { id: '3', name: 'Constantino', email: 'constantino@rapnovaescola.pt', role: 'mentor' },
  { id: '4', name: 'Orato', email: 'orato@rapnovaescola.pt', role: 'produtor' },
  { id: '5', name: 'Rita Oliveira', email: 'rita@rapnovaescola.pt', role: 'produtor' },
];

export const currentUser: Record<string, User> = {
  coordenador: users[0],
  mentor: users[1],
  produtor: users[3],
};

// Sessions
const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);
const nextWeek = new Date(today);
nextWeek.setDate(nextWeek.getDate() + 7);

export const sessions: Session[] = [
  {
    id: '1',
    date: today,
    startTime: '10:00',
    endTime: '12:00',
    duration: 120,
    mentor: users[1],
    institution: 'Escola Secundária D. Afonso Henriques',
    location: 'Sala de Música',
    turma: '9ºA',
    status: 'confirmado',
    equipment: ['Microfone SM58', 'Interface Audio', 'Portátil'],
  },
  {
    id: '2',
    date: today,
    startTime: '14:00',
    endTime: '16:00',
    duration: 120,
    mentor: users[2],
    institution: 'Centro Educativo Santo António',
    location: 'Estúdio',
    turma: 'Turma B',
    status: 'confirmado',
    equipment: ['Microfone', 'Auscultadores'],
  },
  {
    id: '3',
    date: tomorrow,
    startTime: '09:30',
    endTime: '11:30',
    duration: 120,
    mentor: users[1],
    institution: 'Estabelecimento Prisional de Lisboa',
    location: 'Sala Multiusos',
    turma: 'Grupo RAP',
    status: 'confirmado',
    equipment: ['Kit Completo'],
  },
  {
    id: '4',
    date: tomorrow,
    startTime: '15:00',
    endTime: '17:00',
    duration: 120,
    mentor: users[2],
    institution: 'Escola EB 2,3 Vasco da Gama',
    location: 'Auditório',
    turma: '8ºC',
    status: 'rascunho',
    equipment: ['Microfone', 'Coluna Portátil'],
  },
  {
    id: '5',
    date: nextWeek,
    startTime: '11:00',
    endTime: '13:00',
    duration: 120,
    mentor: users[1],
    institution: 'Escola Secundária D. Afonso Henriques',
    location: 'Sala de Música',
    turma: '9ºA',
    status: 'pendente',
    equipment: ['Microfone SM58', 'Interface Audio'],
  },
];

// Session Records
export const sessionRecords: SessionRecord[] = [
  {
    id: '1',
    sessionId: '1',
    session: sessions[0],
    completed: true,
    observations: 'Sessão correu muito bem. Alunos muito participativos.',
    submittedAt: new Date(),
    submittedBy: users[1],
  },
];

// Music Production
export const musics: Music[] = [
  {
    id: '1',
    title: 'Sonhos de Betão',
    turma: '9ºA',
    project: 'Escola Secundária D. Afonso Henriques',
    responsible: users[3],
    stage: 'mistura',
    progress: 65,
    createdAt: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
    updatedAt: today,
  },
  {
    id: '2',
    title: 'Liberdade Interior',
    turma: 'Grupo RAP',
    project: 'EP Lisboa',
    responsible: users[4],
    stage: 'edicao',
    progress: 40,
    createdAt: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000),
    updatedAt: today,
  },
  {
    id: '3',
    title: 'Vozes do Bairro',
    turma: 'Turma B',
    project: 'Centro Educativo Santo António',
    responsible: users[3],
    stage: 'gravacao',
    progress: 15,
    createdAt: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
    updatedAt: today,
  },
  {
    id: '4',
    title: 'Recomeço',
    turma: '8ºC',
    project: 'Escola EB 2,3 Vasco da Gama',
    responsible: users[4],
    stage: 'feedback',
    progress: 80,
    createdAt: new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000),
    updatedAt: today,
    feedback: ['Ajustar volumes nos versos', 'Adicionar reverb no refrão'],
  },
  {
    id: '5',
    title: 'Caminhos',
    turma: '9ºA',
    project: 'Escola Secundária D. Afonso Henriques',
    responsible: users[3],
    stage: 'finalizacao',
    progress: 95,
    createdAt: new Date(today.getTime() - 21 * 24 * 60 * 60 * 1000),
    updatedAt: today,
  },
];

// Equipment
export const equipment: Equipment[] = [
  { id: '1', name: 'Microfone SM58', type: 'Áudio', status: 'em_uso', lastResponsible: users[1], assignedToSession: '1' },
  { id: '2', name: 'Microfone SM58 #2', type: 'Áudio', status: 'disponivel' },
  { id: '3', name: 'Interface Audio Focusrite', type: 'Áudio', status: 'em_uso', lastResponsible: users[1], assignedToSession: '1' },
  { id: '4', name: 'Portátil MacBook Pro', type: 'Informática', status: 'em_uso', lastResponsible: users[1], assignedToSession: '1' },
  { id: '5', name: 'Portátil Dell', type: 'Informática', status: 'disponivel' },
  { id: '6', name: 'Auscultadores Audio-Technica', type: 'Áudio', status: 'disponivel' },
  { id: '7', name: 'Auscultadores Sony', type: 'Áudio', status: 'manutencao', notes: 'Almofadas a descolar' },
  { id: '8', name: 'Coluna JBL Portátil', type: 'Áudio', status: 'disponivel' },
  { id: '9', name: 'Kit Completo #1', type: 'Kit', status: 'disponivel' },
  { id: '10', name: 'Tripé Microfone', type: 'Acessórios', status: 'disponivel' },
];

// Notifications
export const notifications: Notification[] = [
  {
    id: '1',
    type: 'action',
    title: 'Sessão por confirmar',
    message: 'Tens uma sessão amanhã às 14h no Centro Educativo Santo António. Confirma a tua presença.',
    createdAt: new Date(),
    read: false,
    actionUrl: '/horarios',
    forProfile: ['mentor'],
  },
  {
    id: '2',
    type: 'urgent',
    title: 'Conflito de equipamento',
    message: 'O Microfone SM58 está reservado para duas sessões no mesmo horário.',
    createdAt: new Date(today.getTime() - 1 * 60 * 60 * 1000),
    read: false,
    actionUrl: '/equipamento',
    forProfile: ['coordenador'],
  },
  {
    id: '3',
    type: 'info',
    title: 'Música finalizada',
    message: 'A música "Caminhos" do 9ºA foi marcada como finalizada.',
    createdAt: new Date(today.getTime() - 3 * 60 * 60 * 1000),
    read: true,
    forProfile: ['coordenador', 'produtor'],
  },
  {
    id: '4',
    type: 'action',
    title: 'Feedback pendente',
    message: 'A música "Recomeço" aguarda o teu feedback para avançar.',
    createdAt: new Date(today.getTime() - 5 * 60 * 60 * 1000),
    read: false,
    actionUrl: '/producao',
    forProfile: ['mentor'],
  },
];

// Dashboard Stats
export const dashboardStats: DashboardStats = {
  sessionsThisWeek: 8,
  activeLocations: 4,
  activeMentors: 2,
  pendingConfirmations: 2,
  equipmentConflicts: 1,
  musicInProduction: 4,
};

// Helper functions
export const getSessionsByMentor = (mentorId: string) => 
  sessions.filter(s => s.mentor.id === mentorId);

export const getSessionsByStatus = (status: Session['status']) => 
  sessions.filter(s => s.status === status);

export const getMusicsByProducer = (producerId: string) => 
  musics.filter(m => m.responsible.id === producerId);

export const getMusicsByStage = (stage: Music['stage']) => 
  musics.filter(m => m.stage === stage);

export const getNotificationsByProfile = (profile: string) => 
  notifications.filter(n => !n.forProfile || n.forProfile.includes(profile as any));

export const getUnreadNotificationsCount = (profile: string) => 
  getNotificationsByProfile(profile).filter(n => !n.read).length;
