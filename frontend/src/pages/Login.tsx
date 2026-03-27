import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle2 } from 'lucide-react';
import { UserProfile } from '@/types';

export default function Login() {
  const navigate = useNavigate();
  const { signIn, signUp, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserProfile>('mentor');
  const [token, setToken] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Recuperação de password ──────────────────────────────────────────────

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/update-password`;
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (err) throw err;
      setForgotPasswordSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar email de recuperação.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Login / Registo ──────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp && (role === 'coordenador' || role === 'direcao')) {
        if (token !== 'RNE2026') {
          throw new Error('Token de validação inválido.');
        }
      }
      if (isSignUp && role === 'it_support') {
        if (token !== 'RNE2027') {
          throw new Error('Token de validação inválido.');
        }
      }

      const { error: err } = isSignUp
        ? await signUp(email, password, name || undefined, role)
        : await signIn(email, password);

      if (err) {
        setError(err.message);
        return;
      }
      navigate('/', { replace: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed')) {
        setError(
          'Não foi possível contactar o Supabase. Verifica: (1) VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (ou VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY) no frontend/.env; (2) URL sem barra no fim (https://xxx.supabase.co); (3) Reinicia o servidor (npm run dev) após alterar .env.'
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    navigate('/', { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>RAP Nova Escola</CardTitle>
          <CardDescription>
            {isForgotPassword
              ? 'Recuperar password'
              : isSignUp
              ? 'Criar conta'
              : 'Entrar na aplicação'}
          </CardDescription>
        </CardHeader>
        <CardContent>

          {/* ── Modo: Esqueceu a password? ── */}
          {isForgotPassword && (
            forgotPasswordSent ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 text-sm bg-green-50 text-green-800 p-4 rounded-lg border border-green-200">
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                  <p>
                    Email enviado para <strong>{email}</strong>.<br />
                    Verifica a caixa de entrada e clica no link para definir a nova password.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setForgotPasswordSent(false);
                    setError(null);
                  }}
                >
                  Voltar ao login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Introduz o teu email e receberás um link para definir uma nova password.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="email-forgot">Email</Label>
                  <Input
                    id="email-forgot"
                    type="email"
                    placeholder="email@exemplo.pt"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'A enviar...' : 'Enviar link de recuperação'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => { setIsForgotPassword(false); setError(null); }}
                >
                  Voltar ao login
                </Button>
              </form>
            )
          )}

          {/* ── Modo: Login / Registo ── */}
          {!isForgotPassword && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="O teu nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Papel</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as UserProfile)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleciona a tua função" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mentor">Mentor</SelectItem>
                      <SelectItem value="produtor">Produtor</SelectItem>
                      <SelectItem value="mentor_produtor">Mentor & Produtor</SelectItem>
                      <SelectItem value="coordenador">Coordenador</SelectItem>
                      <SelectItem value="direcao">Direção</SelectItem>
                      <SelectItem value="it_support">IT Support</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(role === 'coordenador' || role === 'direcao' || role === 'it_support') && (
                  <div className="space-y-2">
                    <Label htmlFor="token" className="text-primary font-bold">Token de Validação</Label>
                    <Input
                      id="token"
                      type="text"
                      placeholder="Código de segurança (RNE...)"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">Necessário para criar conta de {role === 'direcao' ? 'Direção' : role === 'it_support' ? 'IT Support' : 'Coordenador'}.</p>
                  </div>
                )}
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@exemplo.pt"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'A processar...' : isSignUp ? 'Criar conta' : 'Entrar'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
            >
              {isSignUp ? 'Já tenho conta. Entrar.' : 'Criar conta'}
            </Button>

            {!isSignUp && (
              <button
                type="button"
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => { setIsForgotPassword(true); setError(null); }}
              >
                Esqueceu a password?
              </button>
            )}
          </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
