import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Music, MessageSquare, Users, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useProfile } from '@/contexts/ProfileContext';

const quickLinks = [
  { label: 'Horários', href: '/horarios', icon: Calendar, description: 'Consultar sessões agendadas' },
  { label: 'Produção', href: '/producao', icon: Music, description: 'Acompanhar músicas em curso' },
  { label: 'Chat', href: '/chat', icon: MessageSquare, description: 'Comunicar com a equipa' },
  { label: 'Equipa', href: '/equipa', icon: Users, description: 'Contactos da equipa' },
];

export function VideomakerDashboard() {
  const { user } = useProfile();

  const { data: musicasData } = useQuery({
    queryKey: ['musicas-count-videomaker'],
    queryFn: async () => {
      const res = await api.get('/api/musicas');
      return res.data;
    },
  });

  const total = Array.isArray(musicasData) ? musicasData.length : 0;
  const emCurso = Array.isArray(musicasData)
    ? musicasData.filter((m: { estado?: string }) => m.estado !== 'concluído').length
    : 0;

  const firstName = user?.name?.split(' ')[0] ?? 'Videomaker';

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Olá, {firstName}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {emCurso > 0
            ? `${emCurso} música${emCurso !== 1 ? 's' : ''} em produção de um total de ${total}.`
            : 'Sem músicas em produção de momento.'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {quickLinks.map(({ label, href, icon: Icon, description }) => (
          <Link key={href} to={href}>
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground truncate">{description}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
