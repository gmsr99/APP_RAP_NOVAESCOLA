import { Link, useLocation } from 'react-router-dom';
import { useProfile } from '@/contexts/ProfileContext';
import { cn } from '@/lib/utils';
const logo = '/logo2.png';
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
  BarChart3,
  X,
  MoreHorizontal,
  Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import React, { useState } from 'react';

const allProfiles = ['coordenador', 'direcao', 'it_support', 'mentor', 'produtor', 'mentor_produtor'];

const atalhosItem: NavItem = { name: 'Atalhos', href: '/atalhos', icon: Link2, profiles: allProfiles };

type NavItem = { name: string; href: string; icon: React.ComponentType<{ className?: string }>; profiles: string[]; disabled?: boolean };
type SeparatorItem = { separator: true };
type SidebarItem = NavItem | SeparatorItem;

const navigation: SidebarItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, profiles: allProfiles },
  { name: 'Horários', href: '/horarios', icon: Calendar, profiles: allProfiles },
  { name: 'Produção', href: '/producao', icon: Music, profiles: allProfiles },
  { name: 'Estúdio', href: '/estudio', icon: Mic2, profiles: allProfiles },
  { name: 'Registos', href: '/registos', icon: ClipboardList, profiles: allProfiles },
  { name: 'Chat', href: '/chat', icon: MessageSquare, profiles: allProfiles },
  { separator: true },
  { name: 'Material', href: '/equipamento', icon: Package, profiles: ['coordenador', 'direcao', 'it_support'] },
  { name: 'Equipa', href: '/equipa', icon: Users, profiles: allProfiles },
  { name: 'Estatísticas', href: '/estatisticas', icon: BarChart3, profiles: ['coordenador', 'direcao', 'it_support'] },
  { name: 'Wiki', href: '/wiki', icon: Database, profiles: allProfiles },
  { name: 'Formação', href: '/formacao', icon: GraduationCap, profiles: allProfiles, disabled: true },
];

// Bottom nav items (mobile): first 5 nav items + "Mais"
const BOTTOM_NAV_HREFS = ['/', '/horarios', '/producao', '/registos', '/chat'];

function NavItemLink({ item, collapsed, onClick }: { item: NavItem; collapsed: boolean; onClick?: () => void }) {
  const location = useLocation();
  const isActive = location.pathname === item.href;
  const Icon = item.icon;

  if (item.disabled) {
    return (
      <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground/50 cursor-not-allowed">
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
      to={item.href}
      onClick={onClick}
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
}

// ── Desktop sidebar ────────────────────────────────────────────────────────

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { profile } = useProfile();

  const filteredNavigation = navigation.filter(item =>
    'separator' in item || ('profiles' in item && item.profiles.includes(profile))
  );

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300',
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
            <img src={logo} alt="RAP Nova Escola" className="h-8 w-auto max-w-[40px] object-contain" />
          </Link>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {filteredNavigation.map((item, idx) => {
          if ('separator' in item) {
            return <div key={`sep-${idx}`} className="my-2 border-t border-sidebar-border" />;
          }
          return <NavItemLink key={item.name} item={item} collapsed={collapsed} />;
        })}
        <div className="my-2 border-t border-sidebar-border" />
        <NavItemLink item={atalhosItem} collapsed={collapsed} />
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

// ── Mobile drawer sidebar ──────────────────────────────────────────────────

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useProfile();

  const filteredNavigation = navigation.filter(item =>
    'separator' in item || ('profiles' in item && item.profiles.includes(profile))
  );

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="left" className="w-72 p-0 bg-sidebar border-sidebar-border flex flex-col" hideCloseButton>
        {/* Logo + close */}
        <div className="flex items-center justify-between h-20 px-4 border-b border-sidebar-border shrink-0">
          <Link to="/" onClick={onClose}>
            <img src={logo} alt="RAP Nova Escola" className="h-12 w-auto" />
          </Link>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-sidebar-foreground hover:bg-sidebar-accent/50">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {filteredNavigation.map((item, idx) => {
            if ('separator' in item) {
              return <div key={`sep-${idx}`} className="my-2 border-t border-sidebar-border" />;
            }
            return <NavItemLink key={item.name} item={item} collapsed={false} onClick={onClose} />;
          })}
          <div className="my-2 border-t border-sidebar-border" />
          <NavItemLink item={atalhosItem} collapsed={false} onClick={onClose} />
        </nav>
      </SheetContent>
    </Sheet>
  );
}

// ── Mobile bottom navigation bar ──────────────────────────────────────────

export function BottomNav({ onMoreClick }: { onMoreClick: () => void }) {
  const location = useLocation();
  const { profile } = useProfile();

  const bottomItems = navigation.filter(item =>
    'href' in item && BOTTOM_NAV_HREFS.includes(item.href) && item.profiles.includes(profile)
  ) as NavItem[];

  // Sort by the order defined in BOTTOM_NAV_HREFS
  bottomItems.sort((a, b) => BOTTOM_NAV_HREFS.indexOf(a.href) - BOTTOM_NAV_HREFS.indexOf(b.href));

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-sidebar border-t border-sidebar-border flex items-stretch h-16" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {bottomItems.map(item => {
        const Icon = item.icon;
        const isActive = location.pathname === item.href;
        return (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              'flex flex-col items-center justify-center flex-1 gap-0.5 text-[10px] font-medium transition-colors',
              isActive
                ? 'text-primary'
                : 'text-sidebar-foreground/60 hover:text-sidebar-foreground'
            )}
          >
            <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
            <span>{item.name}</span>
          </Link>
        );
      })}

      {/* "Mais" button */}
      <button
        onClick={onMoreClick}
        className="flex flex-col items-center justify-center flex-1 gap-0.5 text-[10px] font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
      >
        <MoreHorizontal className="h-5 w-5" />
        <span>Mais</span>
      </button>
    </nav>
  );
}
