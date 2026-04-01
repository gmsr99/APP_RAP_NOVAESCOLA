import { useEffect, useRef, useState } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { api } from '@/lib/api';
import { AuthProvider } from "@/contexts/AuthContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";
import { Preloader } from "@/components/Preloader";
import { useAuth } from "@/contexts/AuthContext";
import Dashboard from "./pages/Dashboard";
import Horarios from "./pages/Horarios";
import Producao from "./pages/Producao";
import Estudio from "./pages/Estudio";
import Registos from "./pages/Registos";
import Equipa from "./pages/Equipa";
import Equipamento from "./pages/Equipamento";
import Formacao from "./pages/Formacao";
import Chat from "./pages/Chat";
import Chatbot from "./pages/Chatbot";
import MySpace from "./pages/MySpace";
import Login from "./pages/Login";
import UpdatePassword from "./pages/UpdatePassword";
import NotFound from "./pages/NotFound";
import Wiki from "./pages/Wiki";
import Estatisticas from "./pages/Estatisticas";
import Atalhos from "./pages/Atalhos";
import Contactos from "./pages/Contactos";
import Tarefas from "./pages/Tarefas";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PushAutoPrompt } from "@/components/PushAutoPrompt";

const queryClient = new QueryClient();

// Inner component — has access to AuthContext and Router
function AppContent() {
  const { loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [navLoading, setNavLoading] = useState(false);
  const isFirstNav = useRef(true);
  const queryClient = useQueryClient();

  // Quando o Supabase redireciona o recovery email para a raiz com #type=recovery,
  // reencaminhar para /update-password preservando o hash com o token.
  useEffect(() => {
    if (window.location.hash.includes('type=recovery')) {
      navigate('/update-password' + window.location.hash, { replace: true });
    }
  }, []);

  // Marcar notificação como lida quando o utilizador clica numa push notification
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'mark_notification_read' && event.data?.id) {
        api.put(`/api/notifications/${event.data.id}/read`).then(() => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }).catch(() => {});
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [queryClient]);

  // Show preloader briefly on every page navigation (skip first render)
  useEffect(() => {
    if (isFirstNav.current) {
      isFirstNav.current = false;
      return;
    }
    setNavLoading(true);
    const t = setTimeout(() => setNavLoading(false), 900);
    return () => clearTimeout(t);
  }, [location.pathname]);

  return (
    <>
      <Preloader visible={authLoading || navLoading} />
      <Toaster />
      <Sonner />
      <PushAutoPrompt />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/update-password" element={<UpdatePassword />} />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/horarios" element={
            <ErrorBoundary>
              <Horarios />
            </ErrorBoundary>
          } />
          <Route path="/producao" element={<Producao />} />
          <Route path="/estudio" element={<Estudio />} />
          <Route path="/registos" element={<Registos />} />
          <Route path="/equipa" element={<Equipa />} />
          <Route path="/equipamento" element={<Equipamento />} />
          <Route path="/formacao" element={<Formacao />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/chatbot" element={<Chatbot />} />
          <Route path="/myspace" element={<MySpace />} />
          <Route path="/wiki" element={<Wiki />} />
          <Route path="/estatisticas" element={<Estatisticas />} />
          <Route path="/atalhos" element={<Atalhos />} />
          <Route path="/contactos" element={<Contactos />} />
          <Route path="/tarefas" element={<Tarefas />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <ProfileProvider>
            <AppContent />
          </ProfileProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
