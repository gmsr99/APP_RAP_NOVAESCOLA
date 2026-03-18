import { useEffect, useRef, useState } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
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
import MySpace from "./pages/MySpace";
import Login from "./pages/Login";
import UpdatePassword from "./pages/UpdatePassword";
import NotFound from "./pages/NotFound";
import Wiki from "./pages/Wiki";
import Estatisticas from "./pages/Estatisticas";
import Atalhos from "./pages/Atalhos";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const queryClient = new QueryClient();

// Inner component — has access to AuthContext and Router
function AppContent() {
  const { loading: authLoading } = useAuth();
  const location = useLocation();
  const [navLoading, setNavLoading] = useState(false);
  const isFirstNav = useRef(true);

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
          <Route path="/myspace" element={<MySpace />} />
          <Route path="/wiki" element={<Wiki />} />
          <Route path="/estatisticas" element={<Estatisticas />} />
          <Route path="/atalhos" element={<Atalhos />} />
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
