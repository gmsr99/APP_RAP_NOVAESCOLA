import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useProfile } from '@/contexts/ProfileContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit2, Trash2, ExternalLink, FolderOpen, Link2 } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Atalho {
  id: number;
  titulo: string;
  descricao: string | null;
  url: string;
  imagem_url: string | null;
  ordem: number;
}

interface AtalhoForm {
  titulo: string;
  descricao: string;
  url: string;
  imagem_url: string;
  ordem: number;
}

const EMPTY_FORM: AtalhoForm = {
  titulo: '',
  descricao: '',
  url: '',
  imagem_url: '',
  ordem: 0,
};

// Gradient palette for cards without image
const CARD_GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-500',
  'from-violet-500 to-purple-600',
  'from-rose-500 to-pink-600',
  'from-sky-500 to-cyan-500',
  'from-lime-500 to-green-600',
  'from-fuchsia-500 to-pink-600',
];

// ─── Card component ───────────────────────────────────────────────────────────

function AtalhoCard({
  atalho,
  index,
  isEditor,
  onEdit,
  onDelete,
}: {
  atalho: Atalho;
  index: number;
  isEditor: boolean;
  onEdit: (a: Atalho) => void;
  onDelete: (a: Atalho) => void;
}) {
  const [imgError, setImgError] = useState(false);
  const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
  const showImage = atalho.imagem_url && !imgError;

  return (
    <div className="group flex flex-col rounded-xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Image / Placeholder */}
      <div className="relative h-36 sm:h-40 shrink-0 overflow-hidden">
        {showImage ? (
          <img
            src={atalho.imagem_url!}
            alt={atalho.titulo}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <FolderOpen className="h-14 w-14 text-white/80" />
          </div>
        )}

        {/* Editor actions overlay */}
        {isEditor && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(atalho)}
              className="p-1.5 rounded-md bg-black/50 text-white hover:bg-black/70 transition-colors"
              title="Editar"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(atalho)}
              className="p-1.5 rounded-md bg-black/50 text-white hover:bg-red-600/80 transition-colors"
              title="Eliminar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        <h3 className="font-semibold text-sm leading-snug line-clamp-2">{atalho.titulo}</h3>
        {atalho.descricao && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4 flex-1">
            {atalho.descricao}
          </p>
        )}
        <a
          href={atalho.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Abrir
        </a>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Atalhos() {
  const { profile } = useProfile();
  const isEditor = ['direcao', 'it_support'].includes(profile);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Atalho | null>(null);
  const [form, setForm] = useState<AtalhoForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Atalho | null>(null);

  // ── Queries & mutations ──────────────────────────────────────────────────

  const { data: atalhos = [], isLoading } = useQuery<Atalho[]>({
    queryKey: ['atalhos'],
    queryFn: () => api.get('/api/atalhos').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: AtalhoForm) => api.post('/api/atalhos', data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atalhos'] });
      setDialogOpen(false);
      toast({ title: 'Atalho criado com sucesso.' });
    },
    onError: () => toast({ title: 'Erro ao criar atalho.', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: AtalhoForm) =>
      api.put(`/api/atalhos/${editTarget!.id}`, data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atalhos'] });
      setDialogOpen(false);
      toast({ title: 'Atalho atualizado com sucesso.' });
    },
    onError: () => toast({ title: 'Erro ao atualizar atalho.', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/atalhos/${id}`).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atalhos'] });
      setDeleteTarget(null);
      toast({ title: 'Atalho eliminado.' });
    },
    onError: () => toast({ title: 'Erro ao eliminar atalho.', variant: 'destructive' }),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(atalho: Atalho) {
    setEditTarget(atalho);
    setForm({
      titulo: atalho.titulo,
      descricao: atalho.descricao ?? '',
      url: atalho.url,
      imagem_url: atalho.imagem_url ?? '',
      ordem: atalho.ordem,
    });
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      imagem_url: form.imagem_url.trim() || null,
      descricao: form.descricao.trim() || null,
      ordem: Number(form.ordem),
    } as unknown as AtalhoForm;

    if (editTarget) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link2 className="h-6 w-6 text-primary shrink-0" />
          <div>
            <h1 className="text-xl font-bold">Atalhos</h1>
            <p className="text-sm text-muted-foreground">Acesso rápido a recursos e pastas do projeto</p>
          </div>
        </div>
        {isEditor && (
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Adicionar</span>
          </Button>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-muted/30 animate-pulse h-64" />
          ))}
        </div>
      ) : atalhos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <Link2 className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">Ainda não existem atalhos.</p>
          {isEditor && (
            <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Adicionar primeiro atalho
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {atalhos.map((atalho, i) => (
            <AtalhoCard
              key={atalho.id}
              atalho={atalho}
              index={i}
              isEditor={isEditor}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Editar atalho' : 'Novo atalho'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                value={form.titulo}
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                required
                placeholder="Ex: 01. Músicas em Produção"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="url">Hiperligação *</Label>
              <Input
                id="url"
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                required
                placeholder="https://..."
                type="url"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                rows={3}
                placeholder="Breve descrição do recurso..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imagem_url">URL da imagem <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input
                id="imagem_url"
                value={form.imagem_url}
                onChange={e => setForm(f => ({ ...f, imagem_url: e.target.value }))}
                placeholder="https://... (deixar vazio para usar gradiente)"
                type="url"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ordem">Ordem</Label>
              <Input
                id="ordem"
                value={form.ordem}
                onChange={e => setForm(f => ({ ...f, ordem: Number(e.target.value) }))}
                type="number"
                min={0}
                className="w-24"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'A guardar...' : editTarget ? 'Guardar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar atalho</AlertDialogTitle>
            <AlertDialogDescription>
              Tens a certeza que queres eliminar <strong>{deleteTarget?.titulo}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
