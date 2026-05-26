import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import type { RoleDefinition, Projeto } from '@/types';
import { toast } from 'sonner';
import { Shield, Plus, Save, Eye, EyeOff, Users, BookOpen } from 'lucide-react';
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

// ── Roles Tab ─────────────────────────────────────────────────────────────

function RolesTab() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<RoleDefinition | null>(null);
  const [editedPages, setEditedPages] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newPages, setNewPages] = useState<string[]>([]);

  const { data: roles = [], isLoading } = useQuery<RoleDefinition[]>({
    queryKey: ['admin-roles'],
    queryFn: () => api.get('/api/admin/roles'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, pages }: { id: number; pages: string[] }) =>
      api.put(`/api/admin/roles/${id}`, { pages }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      toast.success('Permissões de páginas actualizadas.');
      setSelected(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; label: string; pages: string[] }) =>
      api.post('/api/admin/roles', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      toast.success('Role criado.');
      setCreating(false);
      setNewName(''); setNewLabel(''); setNewPages([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (role: RoleDefinition) => {
    setSelected(role);
    setEditedPages([...role.pages]);
  };

  const togglePage = (slug: string, pages: string[], setter: (p: string[]) => void) => {
    setter(pages.includes(slug) ? pages.filter(p => p !== slug) : [...pages, slug]);
  };

  if (isLoading) return <p className="text-muted-foreground py-4">A carregar roles…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Roles de sistema são protegidos (não podem ser apagados). Podes editar as páginas de qualquer role.
        </p>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Role
        </Button>
      </div>

      <div className="grid gap-3">
        {roles.map(role => (
          <Card key={role.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => openEdit(role)}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <p className="font-medium">{role.label}</p>
                  <p className="text-xs text-muted-foreground font-mono">{role.name}</p>
                </div>
                {role.is_system && <Badge variant="outline" className="text-xs">Sistema</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">{role.pages.length} páginas</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit role pages dialog */}
      <Dialog open={!!selected} onOpenChange={v => !v && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Páginas — {selected?.label}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 py-2">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancelar</Button>
            <Button onClick={() => updateMutation.mutate({ id: selected!.id, pages: editedPages })}
              disabled={updateMutation.isPending}>
              <Save className="h-4 w-4 mr-1" /> Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create role dialog */}
      <Dialog open={creating} onOpenChange={v => !v && setCreating(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar novo role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome interno (slug)</Label>
                <Input placeholder="ex: editor_conteudo" value={newName}
                  onChange={e => setNewName(e.target.value.toLowerCase().replace(/\s/g, '_'))} />
              </div>
              <div>
                <Label>Label (visível)</Label>
                <Input placeholder="ex: Editor de Conteúdo" value={newLabel}
                  onChange={e => setNewLabel(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Páginas com acesso</Label>
              <div className="grid grid-cols-2 gap-2">
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
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate({ name: newName, label: newLabel, pages: newPages })}
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
    is_root: false,
    is_direcao: false,
    is_coordenacao: false,
  });
  const [customRoleName, setCustomRoleName] = useState('');
  const [customRoleLabel, setCustomRoleLabel] = useState('');
  const [isCustomRole, setIsCustomRole] = useState(false);
  const [pageOverrides, setPageOverrides] = useState<Record<string, boolean>>({});
  const [selectedProjects, setSelectedProjects] = useState<number[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [rolePages, setRolePages] = useState<string[]>([]);

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
    setPageOverrides({}); setSelectedProjects([]); setRolePages([]);
  };

  const handleRoleChange = (value: string) => {
    if (value === '__custom__') {
      setIsCustomRole(true);
      setForm(f => ({ ...f, role: '' }));
      setRolePages([]);
    } else {
      setIsCustomRole(false);
      setForm(f => ({
        ...f,
        role: value,
        is_direcao: ['direcao', 'it_support'].includes(value),
        is_coordenacao: ['coordenador'].includes(value),
      }));
      const found = roles.find(r => r.name === value);
      setRolePages(found ? found.pages : []);
      setPageOverrides({});
    }
  };

  const togglePage = (slug: string) => {
    const currentAccess = pageOverrides[slug] !== undefined
      ? pageOverrides[slug]
      : rolePages.includes(slug);
    setPageOverrides(prev => ({ ...prev, [slug]: !currentAccess }));
  };

  const toggleProject = (id: number) => {
    setSelectedProjects(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
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

    // Build page_overrides: only include differences from role defaults
    const overrides: Record<string, boolean> = {};
    ALL_SLUGS.forEach(slug => {
      if (pageOverrides[slug] !== undefined) {
        const roleDefault = (isCustomRole ? [] : rolePages).includes(slug);
        if (pageOverrides[slug] !== roleDefault) {
          overrides[slug] = pageOverrides[slug];
        }
      }
    });

    createMutation.mutate({
      email: form.email,
      password: form.password,
      full_name: form.full_name,
      role: roleName,
      is_root: form.is_root,
      is_direcao: form.is_direcao,
      is_coordenacao: form.is_coordenacao,
      page_overrides: overrides,
      project_ids: selectedProjects,
    });
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); resetForm(); }}}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar nova conta</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Basic info */}
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
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="pr-10"
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword(v => !v)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Role */}
          <div className="space-y-3">
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
          </div>

          {/* Page access */}
          <div className="space-y-2">
            <Label>Acesso a páginas</Label>
            {!isCustomRole && form.role && (
              <p className="text-xs text-muted-foreground">
                Pré-preenchido com as páginas do role. Altera individualmente se necessário.
              </p>
            )}
            {isCustomRole && (
              <p className="text-xs text-muted-foreground">
                Role novo — todas as páginas começam desmarcadas.
              </p>
            )}
            <div className="grid grid-cols-3 gap-2 p-3 border rounded-md">
              {ALL_SLUGS.map(slug => (
                <label key={slug} className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox
                    checked={getPageAccess(slug)}
                    onCheckedChange={() => togglePage(slug)}
                    disabled={form.is_root}
                  />
                  <span className={`text-sm ${form.is_root ? 'text-muted-foreground' : ''}`}>
                    {PAGE_LABELS[slug]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Project access */}
          {projetos.length > 0 && (
            <div className="space-y-2">
              <Label>Acesso a projetos</Label>
              <p className="text-xs text-muted-foreground">
                Deixa vazio para acesso a todos os projetos. Selecciona para limitar (project scoping).
              </p>
              <div className="grid grid-cols-2 gap-2 p-3 border rounded-md">
                {projetos.map(p => (
                  <label key={p.id} className="flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox
                      checked={selectedProjects.includes(p.id)}
                      onCheckedChange={() => toggleProject(p.id)}
                      disabled={form.is_root}
                    />
                    <span className="text-sm">{p.nome}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Coordination access toggle */}
          <div className="flex items-center justify-between p-3 border rounded-md">
            <div>
              <p className="font-medium text-sm">Acesso de Coordenação</p>
              <p className="text-xs text-muted-foreground">
                Coordena sessões, turmas e exportações, independentemente do cargo.
              </p>
            </div>
            <Switch
              checked={form.is_coordenacao}
              onCheckedChange={v => setForm(f => ({ ...f, is_coordenacao: v }))}
              disabled={form.is_direcao || form.is_root}
            />
          </div>

          {/* Direction access toggle */}
          <div className="flex items-center justify-between p-3 border rounded-md">
            <div>
              <p className="font-medium text-sm">Acesso de Direção</p>
              <p className="text-xs text-muted-foreground">
                Acesso total à app exceto painel de administração de sistema.
              </p>
            </div>
            <Switch
              checked={form.is_direcao}
              onCheckedChange={v => setForm(f => ({ ...f, is_direcao: v }))}
              disabled={form.is_root}
            />
          </div>

          {/* Root toggle */}
          <div className="flex items-center justify-between p-3 border rounded-md">
            <div>
              <p className="font-medium text-sm">Acesso root</p>
              <p className="text-xs text-muted-foreground">
                Contorna todas as verificações de permissões. Usar apenas para IT.
              </p>
            </div>
            <Switch
              checked={form.is_root}
              onCheckedChange={v => setForm(f => ({ ...f, is_root: v }))}
            />
          </div>
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

      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles">
            <BookOpen className="h-4 w-4 mr-1" /> Roles
          </TabsTrigger>
        </TabsList>

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
