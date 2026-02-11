import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";
import Dashboard from "./pages/Dashboard";
import Horarios from "./pages/Horarios";
import Producao from "./pages/Producao";
import Estudio from "./pages/Estudio";
import Registos from "./pages/Registos";
import Equipa from "./pages/Equipa";
import Equipamento from "./pages/Equipamento";
import Formacao from "./pages/Formacao";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import Turmas from "./pages/Turmas";
import NotFound from "./pages/NotFound";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <ProfileProvider>
            <Toaster />
            <Sonner />
            <Routes>
              <Route path="/login" element={<Login />} />
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
                <Route path="/turmas" element={<Turmas />} />
              </Route>
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ProfileProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
