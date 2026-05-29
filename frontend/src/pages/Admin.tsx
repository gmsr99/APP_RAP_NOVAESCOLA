import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import type { RoleDefinition, Projeto, SystemSettings, AuditLog, PermissionLevel, ActionKey, DisciplinaTemplate, DisciplinaAtividadeTemplate, WorkTypeRole } from '@/types';
import { toast } from 'sonner';
import {
  Shield, Plus, Save, Eye, EyeOff, Users, BookOpen, Settings,
  ClipboardList, Download, Lock, Award, X, ChevronDown, Library,
  Pencil, Trash2, ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const PAGE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  horarios: 'Horários',
  producao: 'Produção',
  tarefas: 'Tarefas',
  estudio: 'Estúdio',
  chat: 'Chat',
  equipa: 'Equipa',
  wiki: 'Wiki',
  contactos: 'Contactos',
  atalhos: 'Atalhos',
  registos: 'Registos',
  equipamento: 'Material',
  estatisticas: 'Estatísticas',
  formacao: 'Formação',
  financeiro: 'Financeiro',
  admin: 'Admin',
};
const ALL_SLUGS = Object.keys(PAGE_LABELS);

// ── Patentes Tab ───────────────────────────────────────────────────────────

function PatentesTab() {
  const { permissions } = useAuth();
  const isRoot = permissions?.is_root ?? false;
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<PermissionLevel | null>(null);
  const [editState, setEditState] = useState<Partial<PermissionLevel>>({});
  const [creating, setCreating] = useState(false);
  const [newPatente, setNewPatente] = useState({
    name: '', label: '', level_order: 10,
    allowed_pages: [] as string[],
    allowed_actions: {} as Record<string, boolean>,
    color: '#6b7280',
  });

  const { data: patentes = [], isLoading } = useQuery<PermissionLevel[]>({
    queryKey: ['admin-patentes'],
    queryFn: () => api.get('/api/admin/patentes'),
  });

  const { data: actionKeys = [] } = useQuery<ActionKey[]>({
    queryKey: ['admin-action-keys'],
    queryFn: () => api.get('/api/admin/action-keys'),
    enabled: isRoot,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) =>
      api.put(`/api/admin/patentes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-patentes'] });
      toast.success('Privilégio actualizado.');
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/patentes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-patentes'] });
      toast.success('Privilégio apagado.');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMutation = useMutation({
    mutationFn: (data: object) => api.post('/api/admin/patentes', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-patentes'] });
      toast.success('Privilégio criado.');
      setCreating(false);
      setNewPatente({ name: '', label: '', level_order: 10, allowed_pages: [], allowed_actions: {}, color: '#6b7280' });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (p: PermissionLevel) => {
    if (!isRoot) return;
    setEditing(p);
    setEditState({
      label: p.label,
      color: p.color ?? '#6b7280',
      allowed_pages: [...p.allowed_pages],
      allowed_actions: { ...p.allowed_actions },
      level_order: p.level_order,
    });
  };

  const toggleEditPage = (slug: string) => {
    setEditState(s => {
      const pages = s.allowed_pages ?? [];
      return { ...s, allowed_pages: pages.includes(slug) ? pages.filter(p => p !== slug) : [...pages, slug] };
    });
  };

  const toggleEditAction = (key: string) => {
    setEditState(s => ({
      ...s,
      allowed_actions: { ...(s.allowed_actions ?? {}), [key]: !((s.allowed_actions ?? {})[key]) },
    }));
  };

  const groupedActions = actionKeys.reduce<Record<string, ActionKey[]>>((acc, ak) => {
    if (!acc[ak.category]) acc[ak.category] = [];
    acc[ak.category].push(ak);
    return acc;
  }, {});

  if (isLoading) return <p className="text-muted-foreground py-4 text-sm">A carregar patentes…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Patentes definem as páginas e ações acessíveis. As 5 patentes base (cadeado) não podem ser eliminadas.
        </p>
        {isRoot && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo Privilégio
          </Button>
        )}
      </div>

      <div className="grid gap-3">
        {patentes.map(p => (
          <Card key={p.id}
            className={`transition-colors ${isRoot ? 'cursor-pointer hover:border-primary/50' : ''}`}
            onClick={() => openEdit(p)}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color ?? '#6b7280' }} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.label}</span>
                    {p.is_system && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">{p.name} · nível {p.level_order}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{p.allowed_pages.length} págs</span>
                <span>{Object.values(p.allowed_actions).filter(Boolean).length} ações</span>
                {isRoot && !p.is_system && (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive"
                    onClick={e => { e.stopPropagation(); deleteMutation.mutate(p.id); }}>
                    Apagar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!isRoot && (
        <p className="text-xs text-muted-foreground">Apenas utilizadores root podem editar patentes.</p>
      )}

      {/* Edit patente dialog */}
      <Dialog open={!!editing} onOpenChange={v => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Privilégio — {editing?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Label</Label>
                <Input value={editState.label ?? ''}
                  onChange={e => setEditState(s => ({ ...s, label: e.target.value }))} />
              </div>
              <div>
                <Label>Cor</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={editState.color ?? '#6b7280'}
                    onChange={e => setEditState(s => ({ ...s, color: e.target.value }))}
                    className="h-9 w-12 rounded border cursor-pointer p-0.5" />
                  <Input value={editState.color ?? ''}
                    onChange={e => setEditState(s => ({ ...s, color: e.target.value }))} className="h-9" />
                </div>
              </div>
              {editing && !editing.is_system && (
                <div>
                  <Label>Nível (order)</Label>
                  <Input type="number" min={1} value={editState.level_order ?? ''}
                    onChange={e => setEditState(s => ({ ...s, level_order: parseInt(e.target.value) || s.level_order }))} />
                </div>
              )}
            </div>

            <div>
              <Label className="mb-2 block">Páginas acessíveis</Label>
              <div className="grid grid-cols-3 gap-2 p-3 border rounded-md">
                {ALL_SLUGS.map(slug => (
                  <label key={slug} className="flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox
                      checked={(editState.allowed_pages ?? []).includes(slug)}
                      onCheckedChange={() => toggleEditPage(slug)}
                    />
                    <span className="text-sm">{PAGE_LABELS[slug]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Ações permitidas</Label>
              <div className="space-y-4">
                {Object.entries(groupedActions).map(([category, keys]) => (
                  <div key={category}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{category}</p>
                    <div className="space-y-1">
                      {keys.map(ak => (
                        <div key={ak.key} className="flex items-center justify-between py-1.5 px-3 border rounded-md">
                          <div>
                            <p className="text-sm">{ak.label}</p>
                            <p className="text-xs text-muted-foreground font-mono">{ak.key}</p>
                          </div>
                          <Switch
                            checked={(editState.allowed_actions ?? {})[ak.key] === true}
                            onCheckedChange={() => toggleEditAction(ak.key)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button
              onClick={() => updateMutation.mutate({
                id: editing!.id,
                data: {
                  label: editState.label,
                  color: editState.color,
                  allowed_pages: editState.allowed_pages ?? [],
                  allowed_actions: editState.allowed_actions ?? {},
                  level_order: editState.level_order,
                },
              })}
              disabled={updateMutation.isPending}>
              <Save className="h-4 w-4 mr-1" /> Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create patente dialog */}
      <Dialog open={creating} onOpenChange={v => !v && setCreating(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Privilégio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome interno (slug)</Label>
                <Input placeholder="ex: tech_lead" value={newPatente.name}
                  onChange={e => setNewPatente(p => ({ ...p, name: e.target.value.toLowerCase().replace(/\s/g, '_') }))} />
              </div>
              <div>
                <Label>Label (visível)</Label>
                <Input placeholder="ex: Tech Lead" value={newPatente.label}
                  onChange={e => setNewPatente(p => ({ ...p, label: e.target.value }))} />
              </div>
              <div>
                <Label>Nível (order)</Label>
                <Input type="number" min={1} value={newPatente.level_order}
                  onChange={e => setNewPatente(p => ({ ...p, level_order: parseInt(e.target.value) || 10 }))} />
              </div>
              <div>
                <Label>Cor</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={newPatente.color}
                    onChange={e => setNewPatente(p => ({ ...p, color: e.target.value }))}
                    className="h-9 w-12 rounded border cursor-pointer p-0.5" />
                  <Input value={newPatente.color}
                    onChange={e => setNewPatente(p => ({ ...p, color: e.target.value }))} className="h-9" />
                </div>
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Páginas acessíveis</Label>
              <div className="grid grid-cols-3 gap-2 p-3 border rounded-md">
                {ALL_SLUGS.map(slug => (
                  <label key={slug} className="flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox
                      checked={newPatente.allowed_pages.includes(slug)}
                      onCheckedChange={() => setNewPatente(p => ({
                        ...p,
                        allowed_pages: p.allowed_pages.includes(slug)
                          ? p.allowed_pages.filter(s => s !== slug)
                          : [...p.allowed_pages, slug],
                      }))}
                    />
                    <span className="text-sm">{PAGE_LABELS[slug]}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Ações permitidas</Label>
              <div className="space-y-4">
                {Object.entries(groupedActions).map(([category, keys]) => (
                  <div key={category}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{category}</p>
                    <div className="space-y-1">
                      {keys.map(ak => (
                        <div key={ak.key} className="flex items-center justify-between py-1.5 px-3 border rounded-md">
                          <div>
                            <p className="text-sm">{ak.label}</p>
                            <p className="text-xs text-muted-foreground font-mono">{ak.key}</p>
                          </div>
                          <Switch
                            checked={newPatente.allowed_actions[ak.key] === true}
                            onCheckedChange={() => setNewPatente(p => ({
                              ...p,
                              allowed_actions: { ...p.allowed_actions, [ak.key]: !p.allowed_actions[ak.key] },
                            }))}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate(newPatente)}
              disabled={!newPatente.name || !newPatente.label || createMutation.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Criar Privilégio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Roles Tab ─────────────────────────────────────────────────────────────

function RolesTab() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<RoleDefinition | null>(null);
  const [editedPages, setEditedPages] = useState<string[]>([]);
  const [editedPatente, setEditedPatente] = useState<number | null>(null);
  const [editedColor, setEditedColor] = useState<string | null>(null);
  const [editPagesOpen, setEditPagesOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newPages, setNewPages] = useState<string[]>([]);
  const [newPatente, setNewPatente] = useState<number | null>(null);
  const [newColor, setNewColor] = useState('#6b7280');
  const [createPagesOpen, setCreatePagesOpen] = useState(false);
  const [slugAutoSync, setSlugAutoSync] = useState(true);

  const { data: roles = [], isLoading } = useQuery<RoleDefinition[]>({
    queryKey: ['admin-roles'],
    queryFn: () => api.get('/api/admin/roles'),
  });

  const { data: patentes = [] } = useQuery<PermissionLevel[]>({
    queryKey: ['admin-patentes'],
    queryFn: () => api.get('/api/admin/patentes'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, pages, default_permission_level_id, color }: { id: number; pages: string[]; default_permission_level_id: number | null; color: string | null }) =>
      api.put(`/api/admin/roles/${id}`, { pages, default_permission_level_id, color }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      toast.success('Role actualizado.');
      setSelected(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; label: string; pages: string[]; default_permission_level_id: number | null; color: string | null }) =>
      api.post('/api/admin/roles', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      toast.success('Role criado.');
      setCreating(false);
      setNewName(''); setNewLabel(''); setNewPages([]); setNewPatente(null);
      setNewColor('#6b7280'); setSlugAutoSync(true); setCreatePagesOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (role: RoleDefinition) => {
    setSelected(role);
    setEditedPages([...role.pages]);
    setEditedPatente(role.default_permission_level_id ?? null);
    setEditedColor(role.color ?? null);
    setEditPagesOpen(false);
  };

  const handleNewLabelChange = (val: string) => {
    setNewLabel(val);
    if (slugAutoSync) {
      setNewName(val.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));
    }
  };

  const handleNewNameChange = (val: string) => {
    setNewName(val.toLowerCase().replace(/[^a-z0-9_]/g, ''));
    setSlugAutoSync(false);
  };

  const togglePage = (slug: string, pages: string[], setter: (p: string[]) => void) => {
    setter(pages.includes(slug) ? pages.filter(p => p !== slug) : [...pages, slug]);
  };

  const getPatenteForRole = (role: RoleDefinition) => {
    const id = role.default_permission_level_id;
    return patentes.find(p => p.id === id) ?? null;
  };

  if (isLoading) return <p className="text-muted-foreground py-4">A carregar roles…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Roles são etiquetas de nomenclatura. Associa privilégios padrão para definir as permissões.
        </p>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Role
        </Button>
      </div>

      <div className="grid gap-3">
        {roles.map(role => {
          const patente = getPatenteForRole(role);
          return (
            <Card key={role.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => openEdit(role)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {role.color && <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: role.color }} />}
                  <div>
                    <p className="font-medium">{role.label}</p>
                    <p className="text-xs text-muted-foreground font-mono">{role.name}</p>
                  </div>
                  {role.is_system && <Badge variant="outline" className="text-xs">Sistema</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  {patente && (
                    <Badge style={{ backgroundColor: patente.color ?? '#6b7280', color: '#fff' }} className="text-xs border-0">
                      {patente.label}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit role dialog */}
      <Dialog open={!!selected} onOpenChange={v => !v && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Role — {selected?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-2 block">Privilégios Padrão</Label>
              <Select
                value={editedPatente?.toString() ?? '__none__'}
                onValueChange={v => setEditedPatente(v === '__none__' ? null : parseInt(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem privilégios padrão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem privilégios padrão</SelectItem>
                  {patentes.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color ?? '#6b7280' }} />
                        {p.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-2 block">Cor do role</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={editedColor ?? '#6b7280'}
                  onChange={e => setEditedColor(e.target.value)}
                  className="w-9 h-9 rounded cursor-pointer border p-0.5 bg-background" />
                <Input value={editedColor ?? ''}
                  onChange={e => setEditedColor(e.target.value || null)}
                  className="h-9" placeholder="#6b7280" />
                {editedColor && (
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setEditedColor(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div>
              <button
                type="button"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setEditPagesOpen(v => !v)}>
                <ChevronDown className={`h-4 w-4 transition-transform ${editPagesOpen ? 'rotate-180' : ''}`} />
                Páginas com acesso (legado) — {editedPages.length} selecionadas
              </button>
              {editPagesOpen && (
                <div className="grid grid-cols-2 gap-2 mt-2 border rounded-lg p-3 bg-muted/20">
                  {ALL_SLUGS.map(slug => (
                    <label key={slug} className="flex items-center gap-2 cursor-pointer select-none">
                      <Checkbox
                        checked={editedPages.includes(slug)}
                        onCheckedChange={() => togglePage(slug, editedPages, setEditedPages)}
                      />
                      <span className="text-sm">{PAGE_LABELS[slug]}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancelar</Button>
            <Button onClick={() => updateMutation.mutate({ id: selected!.id, pages: editedPages, default_permission_level_id: editedPatente, color: editedColor })}
              disabled={updateMutation.isPending}>
              <Save className="h-4 w-4 mr-1" /> Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create role dialog */}
      <Dialog open={creating} onOpenChange={v => { if (!v) { setCreating(false); setSlugAutoSync(true); setCreatePagesOpen(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar novo role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Label (nome visível)</Label>
              <Input placeholder="ex: Editor de Conteúdo" value={newLabel}
                onChange={e => handleNewLabelChange(e.target.value)} />
            </div>
            <div>
              <Label>Slug interno</Label>
              <Input placeholder="ex: editor_conteudo" value={newName}
                onChange={e => handleNewNameChange(e.target.value)}
                className="font-mono text-sm" />
              <p className="text-xs text-muted-foreground mt-1">Auto-gerado a partir da label. Editável manualmente.</p>
            </div>
            <div>
              <Label className="mb-2 block">Cor do role</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={newColor}
                  onChange={e => setNewColor(e.target.value)}
                  className="w-9 h-9 rounded cursor-pointer border p-0.5 bg-background" />
                <Input value={newColor}
                  onChange={e => setNewColor(e.target.value)} className="h-9" />
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Privilégios Padrão</Label>
              <Select value={newPatente?.toString() ?? '__none__'}
                onValueChange={v => setNewPatente(v === '__none__' ? null : parseInt(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem privilégios padrão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem privilégios padrão</SelectItem>
                  {patentes.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color ?? '#6b7280' }} />
                        {p.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <button
                type="button"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setCreatePagesOpen(v => !v)}>
                <ChevronDown className={`h-4 w-4 transition-transform ${createPagesOpen ? 'rotate-180' : ''}`} />
                Páginas com acesso (legado, opcional) — {newPages.length} selecionadas
              </button>
              {createPagesOpen && (
                <div className="grid grid-cols-2 gap-2 mt-2 border rounded-lg p-3 bg-muted/20">
                  {ALL_SLUGS.map(slug => (
                    <label key={slug} className="flex items-center gap-2 cursor-pointer select-none">
                      <Checkbox
                        checked={newPages.includes(slug)}
                        onCheckedChange={() => togglePage(slug, newPages, setNewPages)}
                      />
                      <span className="text-sm">{PAGE_LABELS[slug]}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate({ name: newName, label: newLabel, pages: newPages, default_permission_level_id: newPatente, color: newColor })}
              disabled={!newName || !newLabel || createMutation.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Criar Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Create User Dialog ─────────────────────────────────────────────────────

interface CreateUserDialogProps {
  open: boolean;
  onClose: () => void;
  roles: RoleDefinition[];
  projetos: Projeto[];
}

function CreateUserDialog({ open, onClose, roles, projetos }: CreateUserDialogProps) {
  const queryClient = useQueryClient();
  const { refreshPermissions } = useAuth();
  const [form, setForm] = useState({
    email: '', password: '', full_name: '', role: '',
    is_root: false, is_direcao: false, is_coordenacao: false,
  });
  const [customRoleName, setCustomRoleName] = useState('');
  const [customRoleLabel, setCustomRoleLabel] = useState('');
  const [isCustomRole, setIsCustomRole] = useState(false);
  const [pageOverrides, setPageOverrides] = useState<Record<string, boolean>>({});
  const [selectedProjects, setSelectedProjects] = useState<number[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [rolePages, setRolePages] = useState<string[]>([]);
  const [selectedPatente, setSelectedPatente] = useState<number | null>(null);

  const { data: patentes = [] } = useQuery<PermissionLevel[]>({
    queryKey: ['admin-patentes'],
    queryFn: () => api.get('/api/admin/patentes'),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async (data: object) => api.post('/api/admin/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipa'] });
      toast.success('Conta criada com sucesso.');
      onClose();
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetForm = () => {
    setForm({ email: '', password: '', full_name: '', role: '', is_root: false, is_direcao: false, is_coordenacao: false });
    setCustomRoleName(''); setCustomRoleLabel(''); setIsCustomRole(false);
    setPageOverrides({}); setSelectedProjects([]); setRolePages([]); setSelectedPatente(null);
  };

  const handleRoleChange = (value: string) => {
    if (value === '__custom__') {
      setIsCustomRole(true);
      setForm(f => ({ ...f, role: '' }));
      setRolePages([]);
      setSelectedPatente(null);
    } else {
      setIsCustomRole(false);
      setForm(f => ({
        ...f,
        role: value,
        is_direcao: ['direcao', 'it_support'].includes(value),
        is_coordenacao: ['coordenador'].includes(value),
      }));
      const found = roles.find(r => r.name === value) as any;
      setRolePages(found ? found.pages : []);
      setPageOverrides({});
      // Auto-select the default patente for this role
      if (found?.default_permission_level_id) {
        setSelectedPatente(found.default_permission_level_id);
      }
    }
  };

  const togglePage = (slug: string) => {
    const currentAccess = pageOverrides[slug] !== undefined ? pageOverrides[slug] : rolePages.includes(slug);
    setPageOverrides(prev => ({ ...prev, [slug]: !currentAccess }));
  };

  const toggleProject = (id: number) => {
    setSelectedProjects(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const getPageAccess = (slug: string): boolean => {
    if (pageOverrides[slug] !== undefined) return pageOverrides[slug];
    return rolePages.includes(slug);
  };

  const handleSubmit = () => {
    const roleName = isCustomRole ? customRoleName : form.role;
    if (!form.email || !form.password || !form.full_name || !roleName) {
      toast.error('Preenche todos os campos obrigatórios.');
      return;
    }
    const overrides: Record<string, boolean> = {};
    ALL_SLUGS.forEach(slug => {
      if (pageOverrides[slug] !== undefined) {
        const roleDefault = (isCustomRole ? [] : rolePages).includes(slug);
        if (pageOverrides[slug] !== roleDefault) overrides[slug] = pageOverrides[slug];
      }
    });
    createMutation.mutate({
      email: form.email, password: form.password, full_name: form.full_name,
      role: roleName, is_root: form.is_root, is_direcao: form.is_direcao,
      is_coordenacao: form.is_coordenacao, page_overrides: overrides,
      project_ids: selectedProjects, permission_level_id: selectedPatente,
    });
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); resetForm(); }}}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar nova conta</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nome completo *</Label>
              <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label>Password *</Label>
              <div className="relative">
                <Input type={showPassword ? 'text' : 'password'} value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="pr-10" />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword(v => !v)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Role *</Label>
              <Select onValueChange={handleRoleChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar role…" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(r => (
                    <SelectItem key={r.name} value={r.name}>{r.label}</SelectItem>
                  ))}
                  <SelectItem value="__custom__">+ Novo role personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Privilégios</Label>
              <Select value={selectedPatente?.toString() ?? '__none__'}
                onValueChange={v => setSelectedPatente(v === '__none__' ? null : parseInt(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Privilégios…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem privilégios</SelectItem>
                  {patentes.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color ?? '#6b7280' }} />
                        {p.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isCustomRole && (
            <div className="grid grid-cols-2 gap-3 p-3 border rounded-md bg-muted/30">
              <div>
                <Label>Slug (interno)</Label>
                <Input placeholder="ex: gestor_area" value={customRoleName}
                  onChange={e => setCustomRoleName(e.target.value.toLowerCase().replace(/\s/g, '_'))} />
              </div>
              <div>
                <Label>Label (visível)</Label>
                <Input placeholder="ex: Gestor de Área" value={customRoleLabel}
                  onChange={e => setCustomRoleLabel(e.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Acesso a páginas (override manual)</Label>
            <div className="grid grid-cols-3 gap-2 p-3 border rounded-md">
              {ALL_SLUGS.map(slug => (
                <label key={slug} className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox checked={getPageAccess(slug)} onCheckedChange={() => togglePage(slug)} disabled={form.is_root} />
                  <span className={`text-sm ${form.is_root ? 'text-muted-foreground' : ''}`}>{PAGE_LABELS[slug]}</span>
                </label>
              ))}
            </div>
          </div>

          {projetos.length > 0 && (
            <div className="space-y-2">
              <Label>Acesso a projetos</Label>
              <p className="text-xs text-muted-foreground">Deixa vazio para acesso a todos.</p>
              <div className="grid grid-cols-2 gap-2 p-3 border rounded-md">
                {projetos.map(p => (
                  <label key={p.id} className="flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox checked={selectedProjects.includes(p.id)} onCheckedChange={() => toggleProject(p.id)} disabled={form.is_root} />
                    <span className="text-sm">{p.nome}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); resetForm(); }}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            <Users className="h-4 w-4 mr-1" />
            {createMutation.isPending ? 'A criar…' : 'Criar conta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Settings Tab ──────────────────────────────────────────────────────────

const SETTING_GROUPS: { prefix: string; label: string }[] = [
  { prefix: 'app_',    label: 'Identidade' },
  { prefix: 'module_', label: 'Módulos' },
  { prefix: '',        label: 'Sistema' },
];

function SettingsTab() {
  const queryClient = useQueryClient();
  const { permissions } = useAuth();
  const isRoot = permissions?.is_root ?? false;
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { data: settings, isLoading } = useQuery<SystemSettings>({
    queryKey: ['admin-settings'],
    queryFn: () => api.get('/api/admin/settings'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      api.patch(`/api/admin/settings/${key}`, { value }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      queryClient.invalidateQueries({ queryKey: ['app-identity'] });
      setDrafts((d) => { const n = { ...d }; delete n[vars.key]; return n; });
      toast.success('Configuração guardada.');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-muted-foreground py-4 text-sm">A carregar configurações…</p>;
  if (!settings || Object.keys(settings).length === 0)
    return <p className="text-muted-foreground py-4 text-sm">Nenhuma configuração disponível.</p>;

  const grouped = SETTING_GROUPS.map(({ prefix, label }) => ({
    label,
    entries: Object.entries(settings).filter(([k]) =>
      prefix === '' ? !SETTING_GROUPS.slice(0, -1).some((g) => k.startsWith(g.prefix)) : k.startsWith(prefix)
    ),
  })).filter((g) => g.entries.length > 0);

  return (
    <div className="space-y-6">
      {grouped.map((group) => (
        <div key={group.label}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{group.label}</p>
          <div className="space-y-2">
            {group.entries.map(([key, setting]) => (
              <div key={key} className="flex items-center justify-between p-4 border rounded-lg gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{setting.label ?? key}</p>
                  {setting.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{setting.description}</p>
                  )}
                </div>
                {typeof setting.value === 'boolean' ? (
                  <Switch
                    checked={setting.value}
                    onCheckedChange={(v) => updateMutation.mutate({ key, value: v })}
                    disabled={!isRoot || updateMutation.isPending}
                  />
                ) : (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Input
                      className="h-8 text-sm w-48"
                      value={drafts[key] ?? String(setting.value ?? '')}
                      onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                      disabled={!isRoot}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && drafts[key] !== undefined)
                          updateMutation.mutate({ key, value: drafts[key] });
                      }}
                    />
                    {drafts[key] !== undefined && drafts[key] !== String(setting.value ?? '') && (
                      <Button size="sm" variant="outline" className="h-8 px-2"
                        disabled={!isRoot || updateMutation.isPending}
                        onClick={() => updateMutation.mutate({ key, value: drafts[key] })}>
                        <Save className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {!isRoot && (
        <p className="text-xs text-muted-foreground mt-1">Apenas utilizadores root podem alterar estas configurações.</p>
      )}
    </div>
  );
}

// ── Audit Tab ─────────────────────────────────────────────────────────────

function AuditTab() {
  const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ['admin-audit-logs'],
    queryFn: () => api.get('/api/admin/audit-logs?limit=200'),
  });

  function exportCsv() {
    const header = 'Data,Utilizador,Ação,Tipo,ID,Detalhes';
    const rows = logs.map((l) =>
      [l.created_at, l.user_email ?? '', l.action, l.target_type ?? '', l.target_id ?? '',
        l.details ? JSON.stringify(l.details) : '']
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) return <p className="text-muted-foreground py-4 text-sm">A carregar…</p>;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={logs.length === 0}>
          <Download className="h-4 w-4 mr-1" /> Exportar CSV
        </Button>
      </div>
      {logs.length === 0 ? (
        <p className="text-muted-foreground text-sm py-4">Nenhuma entrada no registo de auditoria.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Data</th>
                <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Utilizador</th>
                <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Ação</th>
                <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground hidden md:table-cell">Alvo</th>
                <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground hidden lg:table-cell">Detalhe</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('pt-PT')}
                  </td>
                  <td className="px-3 py-2 text-xs">{log.user_email ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{log.action}</span>
                  </td>
                  <td className="px-3 py-2 text-xs hidden md:table-cell">
                    {log.target_type && <span className="text-muted-foreground">{log.target_type}</span>}
                    {log.target_id && <span className="ml-1 font-mono">{log.target_id}</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground hidden lg:table-cell max-w-xs truncate">
                    {log.details ? JSON.stringify(log.details) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Catálogo de Disciplinas Tab ────────────────────────────────────────────

const ROLE_LABELS: Record<WorkTypeRole, string> = {
  coordenador: 'Coordenador',
  mentor: 'Mentor / Rapper',
  produtor: 'Produtor',
  videomaker: 'Videomaker',
};

const ROLE_COLORS: Record<WorkTypeRole, string> = {
  coordenador: 'bg-blue-100 text-blue-800',
  mentor: 'bg-green-100 text-green-800',
  produtor: 'bg-orange-100 text-orange-800',
  videomaker: 'bg-purple-100 text-purple-800',
};

const EMPTY_DISC = {
  nome: '', descricao: '', musicas_previstas: 0,
  sessoes: 16, duracao_minutos: 120, num_producoes: 0, ativo: true, ordem: 0,
};

const EMPTY_ATV = {
  nome: '', is_autonomous: false, horas: 0, sessoes: null as number | null,
  role: 'mentor' as WorkTypeRole, ordem: 0,
};

function DisciplinaCatalogoTab() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editingDisc, setEditingDisc] = useState<DisciplinaTemplate | null>(null);
  const [editDiscState, setEditDiscState] = useState<typeof EMPTY_DISC>(EMPTY_DISC);
  const [creatingDisc, setCreatingDisc] = useState(false);
  const [newDisc, setNewDisc] = useState<typeof EMPTY_DISC>(EMPTY_DISC);

  const [editingAtv, setEditingAtv] = useState<DisciplinaAtividadeTemplate | null>(null);
  const [editAtvState, setEditAtvState] = useState<typeof EMPTY_ATV>(EMPTY_ATV);
  const [creatingAtv, setCreatingAtv] = useState<number | null>(null); // disciplina_id
  const [newAtv, setNewAtv] = useState<typeof EMPTY_ATV>(EMPTY_ATV);

  const { data: disciplinas = [], isLoading } = useQuery<DisciplinaTemplate[]>({
    queryKey: ['admin-catalogo'],
    queryFn: () => api.get('/api/admin/disciplinas'),
  });

  const createDisc = useMutation({
    mutationFn: (data: object) => api.post('/api/admin/disciplinas', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-catalogo'] }); toast.success('Disciplina criada.'); setCreatingDisc(false); setNewDisc(EMPTY_DISC); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateDisc = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) => api.put(`/api/admin/disciplinas/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-catalogo'] }); toast.success('Disciplina actualizada.'); setEditingDisc(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteDisc = useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/disciplinas/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-catalogo'] }); toast.success('Disciplina apagada.'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createAtv = useMutation({
    mutationFn: ({ discId, data }: { discId: number; data: object }) =>
      api.post(`/api/admin/disciplinas/${discId}/atividades`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-catalogo'] }); toast.success('Atividade criada.'); setCreatingAtv(null); setNewAtv(EMPTY_ATV); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateAtv = useMutation({
    mutationFn: ({ discId, atvId, data }: { discId: number; atvId: number; data: object }) =>
      api.put(`/api/admin/disciplinas/${discId}/atividades/${atvId}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-catalogo'] }); toast.success('Atividade actualizada.'); setEditingAtv(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteAtv = useMutation({
    mutationFn: ({ discId, atvId }: { discId: number; atvId: number }) =>
      api.delete(`/api/admin/disciplinas/${discId}/atividades/${atvId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-catalogo'] }); toast.success('Atividade apagada.'); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground py-4">A carregar catálogo…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Catálogo de disciplinas disponíveis. Ao criar uma disciplina numa turma, as atividades são instanciadas automaticamente.
        </p>
        <Button size="sm" onClick={() => setCreatingDisc(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova Disciplina
        </Button>
      </div>

      <div className="space-y-2">
        {disciplinas.map(disc => (
          <div key={disc.id} className="border rounded-lg overflow-hidden">
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setExpanded(expanded === disc.id ? null : disc.id)}
            >
              <div className="flex items-center gap-3">
                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expanded === disc.id ? 'rotate-90' : ''}`} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{disc.nome}</span>
                    {!disc.ativo && <span className="text-xs text-muted-foreground border rounded px-1.5 py-0.5">inativa</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {disc.sessoes ?? '—'} sessões · {disc.duracao_minutos}min · {disc.num_producoes} prod. · {disc.atividades.length} atividades
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <Button size="sm" variant="ghost" className="h-7 px-2"
                  onClick={() => { setEditingDisc(disc); setEditDiscState({ nome: disc.nome, descricao: disc.descricao ?? '', musicas_previstas: disc.musicas_previstas, sessoes: disc.sessoes ?? 16, duracao_minutos: disc.duracao_minutos, num_producoes: disc.num_producoes, ativo: disc.ativo, ordem: disc.ordem }); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive"
                  onClick={() => { if (confirm(`Apagar "${disc.nome}"?`)) deleteDisc.mutate(disc.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Atividades expandidas */}
            {expanded === disc.id && (
              <div className="px-4 py-3 space-y-2 border-t bg-background">
                {disc.atividades.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Sem atividades definidas.</p>
                )}
                {disc.atividades.map(atv => (
                  <div key={atv.id} className="flex items-center justify-between text-sm py-1.5 px-3 rounded border">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${ROLE_COLORS[atv.role as WorkTypeRole] ?? 'bg-gray-100 text-gray-800'}`}>
                        {ROLE_LABELS[atv.role as WorkTypeRole] ?? atv.role}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${atv.is_autonomous ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'}`}>
                        {atv.is_autonomous ? 'Autónomo' : 'Presencial'}
                      </span>
                      <span className="truncate">{atv.nome}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground">{atv.horas}h{atv.sessoes ? ` / ${atv.sessoes} sess.` : ''}</span>
                      <Button size="sm" variant="ghost" className="h-6 px-1.5"
                        onClick={() => { setEditingAtv(atv); setEditAtvState({ nome: atv.nome, is_autonomous: atv.is_autonomous, horas: atv.horas, sessoes: atv.sessoes, role: atv.role, ordem: atv.ordem }); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 px-1.5 text-destructive hover:text-destructive"
                        onClick={() => { if (confirm('Apagar atividade?')) deleteAtv.mutate({ discId: disc.id, atvId: atv.id }); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button size="sm" variant="outline" className="w-full mt-1"
                  onClick={() => { setCreatingAtv(disc.id); setNewAtv(EMPTY_ATV); }}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Atividade
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Dialog: criar disciplina */}
      <Dialog open={creatingDisc} onOpenChange={v => !v && setCreatingDisc(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova Disciplina</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Nome</Label><Input value={newDisc.nome} onChange={e => setNewDisc(s => ({ ...s, nome: e.target.value }))} /></div>
            <div><Label>Descrição</Label><Input value={newDisc.descricao} onChange={e => setNewDisc(s => ({ ...s, descricao: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Sessões</Label><Input type="number" value={newDisc.sessoes} onChange={e => setNewDisc(s => ({ ...s, sessoes: +e.target.value }))} /></div>
              <div><Label>Duração (min)</Label><Input type="number" value={newDisc.duracao_minutos} onChange={e => setNewDisc(s => ({ ...s, duracao_minutos: +e.target.value }))} /></div>
              <div><Label>Produções</Label><Input type="number" value={newDisc.num_producoes} onChange={e => setNewDisc(s => ({ ...s, num_producoes: +e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Músicas previstas</Label><Input type="number" value={newDisc.musicas_previstas} onChange={e => setNewDisc(s => ({ ...s, musicas_previstas: +e.target.value }))} /></div>
              <div><Label>Ordem</Label><Input type="number" value={newDisc.ordem} onChange={e => setNewDisc(s => ({ ...s, ordem: +e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatingDisc(false)}>Cancelar</Button>
            <Button onClick={() => createDisc.mutate(newDisc)} disabled={!newDisc.nome || createDisc.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: editar disciplina */}
      <Dialog open={!!editingDisc} onOpenChange={v => !v && setEditingDisc(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar — {editingDisc?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Nome</Label><Input value={editDiscState.nome} onChange={e => setEditDiscState(s => ({ ...s, nome: e.target.value }))} /></div>
            <div><Label>Descrição</Label><Input value={editDiscState.descricao} onChange={e => setEditDiscState(s => ({ ...s, descricao: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Sessões</Label><Input type="number" value={editDiscState.sessoes} onChange={e => setEditDiscState(s => ({ ...s, sessoes: +e.target.value }))} /></div>
              <div><Label>Duração (min)</Label><Input type="number" value={editDiscState.duracao_minutos} onChange={e => setEditDiscState(s => ({ ...s, duracao_minutos: +e.target.value }))} /></div>
              <div><Label>Produções</Label><Input type="number" value={editDiscState.num_producoes} onChange={e => setEditDiscState(s => ({ ...s, num_producoes: +e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Músicas previstas</Label><Input type="number" value={editDiscState.musicas_previstas} onChange={e => setEditDiscState(s => ({ ...s, musicas_previstas: +e.target.value }))} /></div>
              <div><Label>Ordem</Label><Input type="number" value={editDiscState.ordem} onChange={e => setEditDiscState(s => ({ ...s, ordem: +e.target.value }))} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={editDiscState.ativo} onCheckedChange={v => setEditDiscState(s => ({ ...s, ativo: v }))} />
              <Label>Ativa (visível para criação de turmas)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDisc(null)}>Cancelar</Button>
            <Button onClick={() => updateDisc.mutate({ id: editingDisc!.id, data: editDiscState })} disabled={updateDisc.isPending}>
              <Save className="h-4 w-4 mr-1" /> Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: criar atividade */}
      <Dialog open={creatingAtv !== null} onOpenChange={v => !v && setCreatingAtv(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Atividade</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Nome</Label><Input value={newAtv.nome} onChange={e => setNewAtv(s => ({ ...s, nome: e.target.value }))} placeholder="ex: Sessões Presenciais — Rapper" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Role</Label>
                <Select value={newAtv.role} onValueChange={v => setNewAtv(s => ({ ...s, role: v as WorkTypeRole }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(ROLE_LABELS) as [WorkTypeRole, string][]).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={newAtv.is_autonomous ? 'autonomo' : 'presencial'} onValueChange={v => setNewAtv(s => ({ ...s, is_autonomous: v === 'autonomo' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="presencial">Presencial</SelectItem>
                    <SelectItem value="autonomo">Autónomo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Horas totais</Label><Input type="number" step="0.5" value={newAtv.horas} onChange={e => setNewAtv(s => ({ ...s, horas: +e.target.value }))} /></div>
              <div><Label>Sessões (sugestão)</Label><Input type="number" value={newAtv.sessoes ?? ''} placeholder="—" onChange={e => setNewAtv(s => ({ ...s, sessoes: e.target.value ? +e.target.value : null }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatingAtv(null)}>Cancelar</Button>
            <Button onClick={() => creatingAtv !== null && createAtv.mutate({ discId: creatingAtv, data: newAtv })} disabled={!newAtv.nome || !newAtv.horas || createAtv.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: editar atividade */}
      <Dialog open={!!editingAtv} onOpenChange={v => !v && setEditingAtv(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar Atividade</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Nome</Label><Input value={editAtvState.nome} onChange={e => setEditAtvState(s => ({ ...s, nome: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Role</Label>
                <Select value={editAtvState.role} onValueChange={v => setEditAtvState(s => ({ ...s, role: v as WorkTypeRole }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(ROLE_LABELS) as [WorkTypeRole, string][]).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={editAtvState.is_autonomous ? 'autonomo' : 'presencial'} onValueChange={v => setEditAtvState(s => ({ ...s, is_autonomous: v === 'autonomo' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="presencial">Presencial</SelectItem>
                    <SelectItem value="autonomo">Autónomo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Horas totais</Label><Input type="number" step="0.5" value={editAtvState.horas} onChange={e => setEditAtvState(s => ({ ...s, horas: +e.target.value }))} /></div>
              <div><Label>Sessões (sugestão)</Label><Input type="number" value={editAtvState.sessoes ?? ''} placeholder="—" onChange={e => setEditAtvState(s => ({ ...s, sessoes: e.target.value ? +e.target.value : null }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAtv(null)}>Cancelar</Button>
            <Button onClick={() => editingAtv && updateAtv.mutate({ discId: editingAtv.disciplina_id, atvId: editingAtv.id, data: editAtvState })} disabled={updateAtv.isPending}>
              <Save className="h-4 w-4 mr-1" /> Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main Admin Page ────────────────────────────────────────────────────────

export default function Admin() {
  const [creatingUser, setCreatingUser] = useState(false);

  const { data: roles = [] } = useQuery<RoleDefinition[]>({
    queryKey: ['admin-roles'],
    queryFn: () => api.get('/api/admin/roles'),
  });

  const { data: projetos = [] } = useQuery<Projeto[]>({
    queryKey: ['projetos'],
    queryFn: () => api.get('/api/projetos'),
  });

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Administração</h1>
        </div>
        <Button onClick={() => setCreatingUser(true)}>
          <Users className="h-4 w-4 mr-2" /> Criar Conta
        </Button>
      </div>

      <Tabs defaultValue="patentes">
        <TabsList>
          <TabsTrigger value="patentes">
            <Award className="h-4 w-4 mr-1" /> Privilégios
          </TabsTrigger>
          <TabsTrigger value="roles">
            <BookOpen className="h-4 w-4 mr-1" /> Roles
          </TabsTrigger>
          <TabsTrigger value="catalogo">
            <Library className="h-4 w-4 mr-1" /> Catálogo
          </TabsTrigger>
          <TabsTrigger value="configuracoes">
            <Settings className="h-4 w-4 mr-1" /> Configurações
          </TabsTrigger>
          <TabsTrigger value="auditoria">
            <ClipboardList className="h-4 w-4 mr-1" /> Auditoria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="patentes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hierarquia de Privilégios</CardTitle>
            </CardHeader>
            <CardContent>
              <PatentesTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gestão de Roles</CardTitle>
            </CardHeader>
            <CardContent>
              <RolesTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="catalogo" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Catálogo de Disciplinas</CardTitle>
            </CardHeader>
            <CardContent>
              <DisciplinaCatalogoTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuracoes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configurações do Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <SettingsTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auditoria" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Registo de Auditoria</CardTitle>
            </CardHeader>
            <CardContent>
              <AuditTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateUserDialog
        open={creatingUser}
        onClose={() => setCreatingUser(false)}
        roles={roles}
        projetos={projetos}
      />
    </div>
  );
}
