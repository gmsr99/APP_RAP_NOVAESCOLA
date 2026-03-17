import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Sidebar, MobileSidebar, BottomNav } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { MapPin, X } from 'lucide-react';
import { api } from '@/lib/api';

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showLocationBanner, setShowLocationBanner] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const checkMentorLocation = async () => {
      try {
        const res = await api.get('/api/mentores/me');
        const data = res.data as { latitude: number | null; longitude: number | null };
        if (!data.latitude || !data.longitude) {
          setShowLocationBanner(true);
        }
      } catch {
        // Not a mentor — no banner needed
      }
    };
    checkMentorLocation();
  }, []);

  // Hide banner when user navigates to /myspace
  useEffect(() => {
    if (location.pathname === '/myspace') {
      setShowLocationBanner(false);
    }
  }, [location.pathname]);

  // Close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile drawer */}
      <MobileSidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header onMenuToggle={() => setMobileNavOpen(true)} />

        {showLocationBanner && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-sm text-amber-800">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>
                Ainda não definiste a tua morada de residência.{' '}
                <button
                  onClick={() => navigate('/myspace')}
                  className="font-medium underline hover:no-underline"
                >
                  Definir agora
                </button>
              </span>
            </div>
            <button
              onClick={() => setShowLocationBanner(false)}
              className="text-amber-600 hover:text-amber-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Main content — extra bottom padding on mobile for bottom nav */}
        <main className="flex-1 overflow-auto p-3 sm:p-6 pb-24 md:pb-6 scrollbar-thin">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav onMoreClick={() => setMobileNavOpen(true)} />
    </div>
  );
}
