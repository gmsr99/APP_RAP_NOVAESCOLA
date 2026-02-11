import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';

export function Layout() {
  const handleOpenChatbot = () => {
    window.open('https://chat-nova-escola-bice.vercel.app/', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
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
