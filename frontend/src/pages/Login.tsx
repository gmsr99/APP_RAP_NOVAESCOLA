import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp && role === 'coordenador') {
        if (token !== 'RNE2026') {
          throw new Error('Token de validação inválido para Coordenador.');
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
            {isSignUp ? 'Criar conta' : 'Entrar na aplicação'}
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                    </SelectContent>
                  </Select>
                </div>

                {role === 'coordenador' && (
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
                    <p className="text-xs text-muted-foreground">Necessário para criar conta de Coordenador.</p>
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
