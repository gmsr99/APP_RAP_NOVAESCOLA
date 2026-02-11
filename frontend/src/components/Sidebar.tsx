import { Link, useLocation } from 'react-router-dom';
import { useProfile } from '@/contexts/ProfileContext';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.png';
import {
  LayoutDashboard,
  Calendar,
  Music,
  ClipboardList,
  Package,
  MessageSquare,
  Mic2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Users,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, profiles: ['coordenador', 'mentor', 'produtor', 'mentor_produtor'] },
  { name: 'Horários Aulas', href: '/horarios', icon: Calendar, profiles: ['coordenador', 'mentor', 'mentor_produtor'] },
  { name: 'Produção Musical', href: '/producao', icon: Music, profiles: ['coordenador', 'mentor', 'produtor', 'mentor_produtor'] },
  { name: 'Estúdio', href: '/estudio', icon: Mic2, profiles: ['coordenador', 'mentor', 'produtor', 'mentor_produtor'] },
  { name: 'Registos', href: '/registos', icon: ClipboardList, profiles: ['coordenador', 'mentor', 'mentor_produtor'] },
  { name: 'Equipa', href: '/equipa', icon: Users, profiles: ['coordenador', 'mentor', 'produtor', 'mentor_produtor'] },
  { name: 'Equipamento', href: '/equipamento', icon: Package, profiles: ['coordenador'] },
  { name: 'Formação', href: '/formacao', icon: GraduationCap, profiles: ['coordenador', 'mentor', 'produtor', 'mentor_produtor'] },
  { name: 'Turmas', href: '/turmas', icon: Building2, profiles: ['coordenador'] },
  { name: 'Chat', href: '/chat', icon: MessageSquare, profiles: ['coordenador', 'mentor', 'produtor', 'mentor_produtor'] },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { profile } = useProfile();

  const filteredNavigation = navigation.filter(item =>
    item.profiles.includes(profile)
  );

  return (
    <aside
      className={cn(
        'flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
        {!collapsed && (
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="RAP Nova Escola" className="h-8 w-auto" />
          </Link>
        )}
        {collapsed && (
          <Link to="/" className="mx-auto">
            <img src={logo} alt="RAP Nova Escola" className="h-8 w-auto" />
          </Link>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {filteredNavigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Button */}
      <div className="p-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full justify-center text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              <span>Recolher</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
