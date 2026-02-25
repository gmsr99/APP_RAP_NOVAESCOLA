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
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import React, { useState } from 'react';

const allProfiles = ['coordenador', 'direcao', 'it_support', 'mentor', 'produtor', 'mentor_produtor'];

type NavItem = { name: string; href: string; icon: React.ComponentType<{ className?: string }>; profiles: string[]; disabled?: boolean };
type SeparatorItem = { separator: true };
type SidebarItem = NavItem | SeparatorItem;

const navigation: SidebarItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, profiles: allProfiles },
  { name: 'Horários', href: '/horarios', icon: Calendar, profiles: allProfiles },
  { name: 'Produção', href: '/producao', icon: Music, profiles: allProfiles },
  { name: 'Estúdio', href: '/estudio', icon: Mic2, profiles: allProfiles },
  { name: 'Registos', href: '/registos', icon: ClipboardList, profiles: ['coordenador', 'direcao', 'it_support', 'mentor', 'mentor_produtor'] },
  { name: 'Chat', href: '/chat', icon: MessageSquare, profiles: allProfiles },
  { separator: true },
  { name: 'Material', href: '/equipamento', icon: Package, profiles: ['coordenador', 'direcao', 'it_support'] },
  { name: 'Equipa', href: '/equipa', icon: Users, profiles: allProfiles },
  { name: 'Wiki', href: '/wiki', icon: Database, profiles: allProfiles },
  { name: 'Formação', href: '/formacao', icon: GraduationCap, profiles: allProfiles, disabled: true },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { profile } = useProfile();

  const filteredNavigation = navigation.filter(item =>
    'separator' in item || ('profiles' in item && item.profiles.includes(profile))
  );

  return (
    <aside
      className={cn(
        'flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-20 px-4 border-b border-sidebar-border">
        {!collapsed && (
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="RAP Nova Escola" className="h-12 w-auto" />
          </Link>
        )}
        {collapsed && (
          <Link to="/" className="mx-auto">
            <img src={logo} alt="RAP Nova Escola" className="h-12 w-auto" />
          </Link>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {filteredNavigation.map((item, idx) => {
          if ('separator' in item) {
            return (
              <div key={`sep-${idx}`} className="my-2 border-t border-sidebar-border" />
            );
          }

          const isActive = location.pathname === item.href;
          const Icon = item.icon;

          if ('disabled' in item && item.disabled) {
            return (
              <div
                key={item.name}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground/50 cursor-not-allowed"
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && (
                  <>
                    <span>{item.name}</span>
                    <span className="ml-auto text-[10px] uppercase tracking-wider bg-muted px-1.5 py-0.5 rounded font-semibold">
                      Brevemente
                    </span>
                  </>
                )}
              </div>
            );
          }

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
              <Icon className="h-5 w-5 shrink-0" />
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
