import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { MessageCircle, MapPin, X } from 'lucide-react';
import { api } from '@/lib/api';

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showLocationBanner, setShowLocationBanner] = useState(false);

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

  const handleOpenChatbot = () => {
    window.open('https://chat-nova-escola-bice.vercel.app/', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
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
        <main className="flex-1 overflow-auto p-6 scrollbar-thin">
          <Outlet />
        </main>
      </div>

      {/* Chatbot FAB */}
      <Button
        size="icon"
        onClick={handleOpenChatbot}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all z-50 bg-accent hover:bg-accent/80"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    </div>
  );
}
