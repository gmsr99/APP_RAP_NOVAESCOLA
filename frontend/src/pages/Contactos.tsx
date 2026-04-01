import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Phone, Mail, MapPin, Globe, Plus, Edit2, Trash2, Save, Building2 } from 'lucide-react';
import { toast } from 'sonner';

interface Estabelecimento {
  id: number;
  nome: string;
  sigla?: string;
}

interface Contacto {
  id: number;
  estabelecimento_id: number;
  tipo: 'telefone' | 'email' | 'maps' | 'website' | 'outro';
  valor: string;
  descricao?: string;
}

const tipoConfig = {
  telefone: { icon: Phone, color: 'text-green-500', label: 'Telefone' },
  email:    { icon: Mail,  color: 'text-blue-500',  label: 'Email' },
  maps:     { icon: MapPin,  color: 'text-red-500',   label: 'Maps' },
  website:  { icon: Globe,  color: 'text-purple-500', label: 'Website' },
  outro:    { icon: Phone,  color: 'text-muted-foreground', label: 'Outro' },
};

function contactoHref(c: Contacto): string | undefined {
  if (c.tipo === 'telefone') return `tel:${c.valor.replace(/\s/g, '')}`;
  if (c.tipo === 'email') return `mailto:${c.valor}`;
  if (c.tipo === 'maps' || c.tipo === 'website') return c.valor;
  return undefined;
}

export default function Contactos() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isCoordinator = user?.role === 'coordenador' || user?.role === 'direcao' || user?.role === 'it_support';

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContacto, setEditingContacto] = useState<Contacto | null>(null);
  const [targetEstabId, setTargetEstabId] = useState<number | null>(null);
  const [form, setForm] = useState({ tipo: 'telefone', valor: '', descricao: '' });

  // Confirm state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const { data: estabelecimentos = [] } = useQuery({
    queryKey: ['estabelecimentos'],
    queryFn: async () => (await api.get('/api/estabelecimentos')).data as Estabelecimento[],
  });

  const { data: contactos = [] } = useQuery({
    queryKey: ['contactos-estabelecimentos'],
    queryFn: async () => (await api.get('/api/estabelecimentos/contactos')).data as Contacto[],
  });

  const contactosPorEstab = contactos.reduce<Record<number, Contacto[]>>((acc, c) => {
    if (!acc[c.estabelecimento_id]) acc[c.estabelecimento_id] = [];
    acc[c.estabelecimento_id].push(c);
    return acc;
  }, {});

  const saveMutation = useMutation({
    mutationFn: (data: { tipo: string; valor: string; descricao?: string }) => {
      if (editingContacto) return api.put(`/api/contactos/${editingContacto.id}`, data);
      return api.post(`/api/estabelecimentos/${targetEstabId}/contactos`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contactos-estabelecimentos'] });
      toast.success(editingContacto ? 'Contacto atualizado!' : 'Contacto adicionado!');
      setIsDialogOpen(false);
    },
    onError: () => toast.error('Erro ao guardar contacto.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/contactos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contactos-estabelecimentos'] });
      toast.success('Contacto removido!');
    },
  });

  const openNew = (estabId: number) => {
    setEditingContacto(null);
    setTargetEstabId(estabId);
    setForm({ tipo: 'telefone', valor: '', descricao: '' });
    setIsDialogOpen(true);
  };

  const openEdit = (c: Contacto) => {
    setEditingContacto(c);
    setTargetEstabId(c.estabelecimento_id);
    setForm({ tipo: c.tipo, valor: c.valor, descricao: c.descricao || '' });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    setPendingDeleteId(id);
    setConfirmOpen(true);
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4 pb-24 md:pb-6">
      <div>
        <h1 className="text-xl font-bold">Contactos</h1>
        <p className="text-sm text-muted-foreground">Contactos das instituições parceiras.</p>
      </div>

      {estabelecimentos.length === 0 ? (
        <p className="text-sm text-muted-foreground italic text-center py-10">Nenhuma instituição registada.</p>
      ) : (
        <div className="space-y-3">
          {estabelecimentos.map((estab) => {
            const lista = contactosPorEstab[estab.id] || [];
            return (
              <div key={estab.id} className="border rounded-xl bg-card overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-muted/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-semibold text-sm truncate">{estab.nome}</span>
                    {estab.sigla && (
                      <Badge variant="secondary" className="text-xs shrink-0">{estab.sigla}</Badge>
                    )}
                  </div>
                  {isCoordinator && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 shrink-0"
                      onClick={() => openNew(estab.id)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Contact list */}
                {lista.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-muted-foreground italic">
                    Sem contactos registados.
                  </div>
                ) : (
                  <ul className="divide-y">
                    {lista.map((c) => {
                      const cfg = tipoConfig[c.tipo] ?? tipoConfig.outro;
                      const Icon = cfg.icon;
                      const href = contactoHref(c);
                      return (
                        <li key={c.id} className="flex items-center gap-3 px-4 py-3 group">
                          <Icon className={`h-5 w-5 shrink-0 ${cfg.color}`} />
                          <div className="flex-1 min-w-0">
                            {c.descricao && (
                              <p className="text-xs text-muted-foreground leading-tight mb-0.5">{c.descricao}</p>
                            )}
                            {href ? (
                              <a
                                href={href}
                                target={c.tipo === 'maps' || c.tipo === 'website' ? '_blank' : undefined}
                                rel="noopener noreferrer"
                                className="text-sm font-medium hover:underline break-all"
                              >
                                {c.tipo === 'maps' ? 'Ver no mapa' : c.valor}
                              </a>
                            ) : (
                              <span className="text-sm font-medium break-all">{c.valor}</span>
                            )}
                          </div>
                          {isCoordinator && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => openEdit(c)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog add/edit */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle>{editingContacto ? 'Editar Contacto' : 'Novo Contacto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="telefone">Telefone</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="maps">Google Maps</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Valor</Label>
              <Input
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
                placeholder={
                  form.tipo === 'telefone' ? '244 829 720' :
                  form.tipo === 'email' ? 'contacto@instituicao.pt' :
                  form.tipo === 'maps' ? 'https://maps.app.goo.gl/...' :
                  form.tipo === 'website' ? 'https://...' : ''
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Descrição (opcional)</Label>
              <Input
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Ex: Gonçalo Salema (coordenador projeto)"
              />
            </div>
          </div>
          <DialogFooter className="flex-row sm:justify-between gap-2">
            {editingContacto ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setIsDialogOpen(false);
                  handleDelete(editingContacto.id);
                }}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Apagar
              </Button>
            ) : <div />}
            <Button
              onClick={() => saveMutation.mutate({ tipo: form.tipo, valor: form.valor, descricao: form.descricao || undefined })}
              disabled={!form.valor.trim() || saveMutation.isPending}
            >
              <Save className="h-4 w-4 mr-1" /> Gravar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar contacto?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação é irreversível.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDeleteId) deleteMutation.mutate(pendingDeleteId);
                setConfirmOpen(false);
              }}
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
