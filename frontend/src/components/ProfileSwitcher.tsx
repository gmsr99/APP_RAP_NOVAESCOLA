import { useProfile } from '@/contexts/ProfileContext';
import { UserProfile } from '@/types';
import { cn } from '@/lib/utils';
import { User, Users, Music } from 'lucide-react';

const profiles: { value: UserProfile; label: string; icon: React.ElementType }[] = [
  { value: 'coordenador', label: 'Coordenador', icon: Users },
  { value: 'mentor', label: 'Mentor', icon: User },
  { value: 'produtor', label: 'Produtor', icon: Music },
];

export function ProfileSwitcher() {
  const { profile, setProfile, user } = useProfile();

  // Only show switcher for Coordinators
  if (user?.role !== 'coordenador') {
    return null;
  }

  return (
    <div className="flex items-center gap-1 rounded-lg bg-secondary/50 p-1">
      {profiles.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setProfile(value)}
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
            profile === value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
          )}
        >
          <Icon className="h-4 w-4" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
