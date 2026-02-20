import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, Lock, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';

export default function MySpace() {
  const { user } = useProfile();
  const { session } = useAuth();

  // Avatar state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user.avatar || '');

  // Password reset state
  const [sendingReset, setSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const userId = session?.user?.id;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor seleciona um ficheiro de imagem.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem não pode ter mais de 2 MB.');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const filePath = `${userId}/avatar.${ext}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Add cache-buster to force refresh
      const urlWithCacheBuster = `${publicUrl}?t=${Date.now()}`;

      // Update Supabase auth metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: urlWithCacheBuster },
      });
      if (updateError) throw updateError;

      // Update profiles table via API
      await api.patch('/api/profile/avatar', { avatar_url: urlWithCacheBuster });

      setAvatarUrl(urlWithCacheBuster);
      toast.success('Foto de perfil atualizada!');
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      toast.error(err.message || 'Erro ao atualizar foto de perfil.');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleResetPassword = async () => {
    setSendingReset(true);
    try {
      const redirectUrl = `${window.location.origin}/update-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: redirectUrl,
      });
      if (error) throw error;

      setResetSent(true);
      toast.success('Email de reposição enviado! Verifica a tua caixa de correio.');
    } catch (err: any) {
      console.error('Password reset error:', err);
      toast.error(err.message || 'Erro ao enviar email de reposição.');
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">A minha Conta</h1>
        <p className="text-muted-foreground mt-1">Gere o teu perfil e definições de segurança.</p>
      </div>

      {/* Foto de Perfil */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Foto de Perfil</CardTitle>
          <CardDescription>A tua foto é visível para toda a equipa.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <div className="relative group">
            <div className="h-24 w-24 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-3xl font-medium overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt={user.name} className="h-24 w-24 rounded-full object-cover" />
              ) : (
                user.name.charAt(0)
              )}
            </div>
            {uploading && (
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Camera className="w-4 h-4 mr-2" />
              {uploading ? 'A enviar...' : 'Alterar Foto'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Repor Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Repor Password
          </CardTitle>
          <CardDescription>
            Envia um email com um link seguro para definires uma nova password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resetSent ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/40 p-4 rounded-lg">
              <Mail className="h-5 w-5 shrink-0 text-green-600" />
              <p>
                Email enviado para <span className="font-medium text-foreground">{user.email}</span>.
                Verifica a tua caixa de correio e clica no link para definir a nova password.
              </p>
            </div>
          ) : (
            <Button
              onClick={handleResetPassword}
              disabled={sendingReset}
              variant="outline"
            >
              {sendingReset ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  A enviar...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Enviar Email de Reposição
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
