
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from '@/components/ui/sheet';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { api } from '@/services/api';
import type { PublicProfile, RoleDefinition, Projeto, PermissionLevel } from '@/types';
import { Mail, Shield, Trash2, Pencil, Search, UserCircle, Key, Award } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';
import { toast } from 'sonner';

const PAGE_LABELS: Record<string, string> = {
    dashboard: 'Dashboard', horarios: 'Horários', producao: 'Produção',
    tarefas: 'Tarefas', estudio: 'Estúdio', chat: 'Chat', equipa: 'Equipa',
    wiki: 'Wiki', contactos: 'Contactos', atalhos: 'Atalhos', registos: 'Registos',
    equipamento: 'Material', estatisticas: 'Estatísticas', formacao: 'Formação',
    financeiro: 'Financeiro', admin: 'Admin',
};
const ALL_SLUGS = Object.keys(PAGE_LABELS);

const ROLE_BADGE: Record<string, string> = {
    coordenador: 'default',
    mentor: 'secondary',
    direcao: 'destructive',
    it_support: 'outline',
};

const Equipa = () => {
    const { profile, user, allowedPages, isDirecao } = useProfile();
    const queryClient = useQueryClient();
    const isAdmin = allowedPages.has('admin');

    const [deleteTarget, setDeleteTarget] = useState<PublicProfile | null>(null);
    const [editTarget, setEditTarget] = useState<PublicProfile | null>(null);
    const [editForm, setEditForm] = useState({ full_name: '', role: '', avatar_url: '' });

    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');


    // Advanced permissions state
    const [advPerms, setAdvPerms] = useState<{
        permission_level_id: number | null;
        is_root: boolean;
        is_direcao: boolean;
        is_coordenacao: boolean;
        page_overrides: Record<string, boolean>;
        project_ids: number[];
        role_pages: string[];
    } | null>(null);

    const { data: profiles, isLoading, error } = useQuery({
        queryKey: ['equipa'],
        queryFn: () => api.get<PublicProfile[]>('/api/equipa'),
    });

    const { data: roles = [] } = useQuery<RoleDefinition[]>({
        queryKey: ['admin-roles'],
        queryFn: () => api.get('/api/admin/roles'),
    });

    const { data: projetos = [] } = useQuery<Projeto[]>({
        queryKey: ['projetos'],
        queryFn: () => api.get('/api/projetos'),
        enabled: isAdmin,
    });

    const { data: patentes = [] } = useQuery<PermissionLevel[]>({
        queryKey: ['admin-patentes'],
        queryFn: () => api.get('/api/admin/patentes'),
        enabled: isAdmin,
    });

    const deleteMutation = useMutation({
        mutationFn: (userId: string) => api.delete(`/api/equipa/${userId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['equipa'] });
            toast.success('Utilizador apagado com sucesso.');
            setDeleteTarget(null);
        },
        onError: (err: Error) => toast.error(err.message || 'Erro ao apagar utilizador.'),
    });

    const updateMutation = useMutation({
        mutationFn: ({ userId, data }: { userId: string; data: Record<string, string> }) =>
            api.patch(`/api/equipa/${userId}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['equipa'] });
            toast.success('Membro atualizado.');
        },
        onError: (err: Error) => toast.error(err.message || 'Erro ao atualizar membro.'),
    });

    const updatePermsMutation = useMutation({
        mutationFn: ({ userId, data }: { userId: string; data: object }) =>
            api.put(`/api/admin/users/${userId}/permissions`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['equipa'] });
            toast.success('Permissões actualizadas.');
            setEditTarget(null);
            setAdvPerms(null);
        },
        onError: (err: Error) => toast.error(err.message || 'Erro ao actualizar permissões.'),
    });

    const openEdit = async (p: PublicProfile) => {
        setEditTarget(p);
        setEditForm({
            full_name: p.full_name || '',
            role: p.role || '',
            avatar_url: p.avatar_url || '',
        });
        if (isAdmin) {
            try {
                const permsData: any = await api.get(`/api/admin/users/${p.id}/permissions`);
                const found = roles.find(r => r.name === permsData.role);
                setAdvPerms({
                    permission_level_id: permsData.permission_level_id ?? null,
                    is_root: permsData.is_root,
                    is_direcao: permsData.is_direcao ?? false,
                    is_coordenacao: permsData.is_coordenacao ?? false,
                    page_overrides: permsData.page_overrides || {},
                    project_ids: permsData.project_ids || [],
                    role_pages: found ? found.pages : [],
                });
            } catch {
                setAdvPerms({ permission_level_id: null, is_root: false, is_direcao: false, is_coordenacao: false, page_overrides: {}, project_ids: [], role_pages: [] });
            }
        }
    };

    const handleSubmitEdit = async () => {
        if (!editTarget || !editForm.full_name.trim() || !editForm.role) {
            toast.error('Nome e cargo são obrigatórios.');
            return;
        }
        const basicData: Record<string, string> = {
            full_name: editForm.full_name.trim(),
            role: editForm.role,
        };
        if (editForm.avatar_url.trim()) basicData.avatar_url = editForm.avatar_url.trim();

        // Always update basic info
        await updateMutation.mutateAsync({ userId: editTarget.id, data: basicData });

        // If admin, also save permissions
        if (isAdmin && advPerms) {
            updatePermsMutation.mutate({
                userId: editTarget.id,
                data: {
                    role: editForm.role,
                    page_overrides: advPerms.page_overrides,
                    project_ids: advPerms.project_ids,
                    permission_level_id: advPerms.permission_level_id,
                },
            });
        } else {
            setEditTarget(null);
            setAdvPerms(null);
        }
    };

    const getPageAccess = (slug: string): boolean => {
        if (!advPerms) return false;
        if (advPerms.page_overrides[slug] !== undefined) return advPerms.page_overrides[slug];
        return advPerms.role_pages.includes(slug);
    };

    const togglePage = (slug: string) => {
        if (!advPerms) return;
        const current = getPageAccess(slug);
        setAdvPerms(prev => prev ? { ...prev, page_overrides: { ...prev.page_overrides, [slug]: !current } } : prev);
    };

    const toggleProject = (id: number) => {
        if (!advPerms) return;
        setAdvPerms(prev => {
            if (!prev) return prev;
            const ids = prev.project_ids.includes(id)
                ? prev.project_ids.filter(p => p !== id)
                : [...prev.project_ids, id];
            return { ...prev, project_ids: ids };
        });
    };

    const handleRoleChange = (val: string) => {
        setEditForm(f => ({ ...f, role: val }));
        if (advPerms) {
            const found = roles.find(r => r.name === val);
            setAdvPerms(prev => prev ? {
                ...prev,
                role_pages: found ? found.pages : [],
                page_overrides: {},
                permission_level_id: found?.default_permission_level_id ?? prev.permission_level_id,
            } : prev);
        }
    };

    if (isLoading) return null;

    const filteredProfiles = profiles?.filter(p => {
        const matchesSearch = (p.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
                              (p.email?.toLowerCase() || '').includes(searchQuery.toLowerCase());
        const matchesRole = roleFilter === 'all' || p.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-display font-bold">Equipa</h1>
                    <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                        Membros registados na plataforma e os seus cargos.
                    </p>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-4 bg-card p-3 rounded-xl border">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Pesquisar por nome ou email..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-background/50 border-muted"
                    />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-full sm:w-[220px] bg-background/50 border-muted">
                        <SelectValue placeholder="Filtrar por cargo" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os cargos</SelectItem>
                        {roles.map(r => (
                            <SelectItem key={r.name} value={r.name}>{r.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {filteredProfiles?.length === 0 ? (
                <div className="text-center py-16 bg-card border border-dashed rounded-xl">
                    <UserCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">Nenhum membro encontrado com os filtros atuais.</p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredProfiles?.map((p) => {
                        const isHighLevel = p.role === 'direcao' || p.role === 'coordenador';
                        return (
                            <Card key={p.id} className={`overflow-hidden transition-all hover:shadow-md ${isHighLevel ? 'border-primary/30 shadow-sm' : ''}`}>
                                <CardHeader className="flex flex-row items-start gap-4 pb-4">
                                    <Avatar className="h-14 w-14 shrink-0 border-2 border-background shadow-sm">
                                        <AvatarImage src={p.avatar_url} />
                                        <AvatarFallback className="bg-primary/5 text-primary">
                                            {p.full_name?.substring(0, 2).toUpperCase() || 'U'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col flex-1 min-w-0 pt-1">
                                        <CardTitle className="text-base leading-tight truncate" title={p.full_name || 'Utilizador'}>{p.full_name || 'Utilizador'}</CardTitle>
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
                                            <Mail className="h-3.5 w-3.5 shrink-0 opacity-70" />
                                            <span className="truncate" title={p.email}>{p.email}</span>
                                        </div>
                                    </div>
                                    {isDirecao && p.id !== user.id && (
                                        <div className="flex flex-col gap-1 shrink-0 -mr-2 -mt-2">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary" onClick={() => openEdit(p)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteTarget(p)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </CardHeader>
                                <CardContent className="bg-muted/10 pt-3 pb-3 border-t flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Shield className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                                        <Badge variant={(ROLE_BADGE[p.role] as any) || 'outline'} className="capitalize text-[10px] font-medium tracking-wide">
                                            {roles.find(r => r.name === p.role)?.label || p.role}
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* Edit Sheet */}
            <Sheet open={!!editTarget} onOpenChange={(open) => { if (!open) { setEditTarget(null); setAdvPerms(null); } }}>
                <SheetContent className="w-full sm:max-w-md md:max-w-lg overflow-y-auto p-0 flex flex-col h-full border-l-0 sm:border-l">
                    <SheetHeader className="p-6 pb-2 shrink-0">
                        <SheetTitle className="flex items-center gap-2 text-xl">
                            <Pencil className="h-5 w-5 text-primary" />
                            Editar membro
                        </SheetTitle>
                        <SheetDescription>
                            A alterar configurações de <strong>{editTarget?.full_name}</strong>.
                        </SheetDescription>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto px-6">
                        <Tabs defaultValue="perfil" className="mt-4 pb-6">
                            <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-3' : 'grid-cols-1'} bg-muted/50`}>
                                <TabsTrigger value="perfil" className="text-xs sm:text-sm"><UserCircle className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" /> Perfil</TabsTrigger>
                                {isAdmin && <TabsTrigger value="acessos" className="text-xs sm:text-sm"><Key className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" /> Acessos</TabsTrigger>}
                                {isAdmin && <TabsTrigger value="avancado" className="text-xs sm:text-sm"><Award className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" /> Privilégios</TabsTrigger>}
                            </TabsList>
                            
                            <TabsContent value="perfil" className="space-y-6 pt-4 outline-none">
                                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-xl border bg-muted/20">
                                    <Avatar className="h-20 w-20 shrink-0 border-4 border-background shadow-sm">
                                        <AvatarImage src={editForm.avatar_url || editTarget?.avatar_url} />
                                        <AvatarFallback className="text-xl font-medium bg-primary/10 text-primary">
                                            {editForm.full_name?.substring(0, 2).toUpperCase() || 'U'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 space-y-2 w-full">
                                        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">URL da Foto</Label>
                                        <Input
                                            placeholder="https://..."
                                            value={editForm.avatar_url}
                                            onChange={(e) => setEditForm({ ...editForm, avatar_url: e.target.value })}
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">Nome completo <span className="text-destructive">*</span></Label>
                                    <Input
                                        value={editForm.full_name}
                                        onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                                        placeholder="Nome do membro"
                                        className="bg-background"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">Cargo <span className="text-destructive">*</span></Label>
                                    <Select value={editForm.role} onValueChange={handleRoleChange}>
                                        <SelectTrigger className="bg-background">
                                            <SelectValue placeholder="Selecionar cargo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(roles.length > 0 ? roles : [
                                                { name: 'mentor', label: 'Mentor' },
                                                { name: 'produtor', label: 'Produtor' },
                                                { name: 'mentor_produtor', label: 'Mentor / Produtor' },
                                                { name: 'coordenador', label: 'Coordenador' },
                                                { name: 'direcao', label: 'Direção' },
                                                { name: 'it_support', label: 'IT Support' },
                                            ]).map(r => (
                                                <SelectItem key={r.name} value={r.name}>{r.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </TabsContent>

                            {isAdmin && advPerms && (
                                <TabsContent value="acessos" className="space-y-6 pt-4 outline-none">
                                    <div className="space-y-3">
                                        <div>
                                            <Label className="text-base font-semibold">Páginas</Label>
                                            <p className="text-xs text-muted-foreground mb-3">Define a que separadores da plataforma o utilizador tem acesso.</p>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-muted/20 p-3 rounded-lg border">
                                            {ALL_SLUGS.map(slug => (
                                                <label key={slug} className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${getPageAccess(slug) ? 'bg-background shadow-sm border' : 'hover:bg-muted/50 border border-transparent'}`}>
                                                    <Checkbox
                                                        checked={getPageAccess(slug)}
                                                        onCheckedChange={() => togglePage(slug)}
                                                        disabled={advPerms.is_root}
                                                    />
                                                    <span className="text-sm font-medium">{PAGE_LABELS[slug]}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {projetos.length > 0 && (
                                        <div className="space-y-3">
                                            <div>
                                                <Label className="text-base font-semibold">Projetos</Label>
                                                <p className="text-xs text-muted-foreground mb-3">Limitar o acesso apenas a certos projetos (vazio = todos).</p>
                                            </div>
                                            <div className="grid grid-cols-1 gap-2 bg-muted/20 p-3 rounded-lg border">
                                                {projetos.map(p => (
                                                    <label key={p.id} className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${advPerms.project_ids.includes(p.id) ? 'bg-background shadow-sm border' : 'hover:bg-muted/50 border border-transparent'}`}>
                                                        <Checkbox
                                                            checked={advPerms.project_ids.includes(p.id)}
                                                            onCheckedChange={() => toggleProject(p.id)}
                                                            disabled={advPerms.is_root}
                                                        />
                                                        <span className="text-sm font-medium">{p.nome}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </TabsContent>
                            )}

                            {isAdmin && advPerms && (
                                <TabsContent value="avancado" className="space-y-4 pt-4 outline-none">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold flex items-center gap-2">
                                            <Award className="h-4 w-4 text-muted-foreground" />
                                            Privilégios
                                        </Label>
                                        <p className="text-xs text-muted-foreground">Nível hierárquico de permissões. Define que páginas e ações estão disponíveis para este utilizador.</p>
                                        <Select
                                            value={advPerms.permission_level_id?.toString() ?? '__none__'}
                                            onValueChange={v => setAdvPerms(prev => prev ? { ...prev, permission_level_id: v === '__none__' ? null : parseInt(v) } : prev)}
                                        >
                                            <SelectTrigger className="bg-background">
                                                <SelectValue placeholder="Selecionar privilégios" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__none__">
                                                    <span className="text-muted-foreground">Sem privilégios (legado)</span>
                                                </SelectItem>
                                                {[...patentes].sort((a, b) => a.level_order - b.level_order).map(p => (
                                                    <SelectItem key={p.id} value={p.id.toString()}>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color ?? '#6b7280' }} />
                                                            <span>{p.label}</span>
                                                            <span className="text-xs text-muted-foreground">nível {p.level_order}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {advPerms.permission_level_id && (() => {
                                        const pat = patentes.find(p => p.id === advPerms.permission_level_id);
                                        if (!pat) return null;
                                        return (
                                            <div className="p-3 rounded-lg border bg-muted/20 text-sm text-muted-foreground space-y-1">
                                                <p className="font-medium text-foreground flex items-center gap-2">
                                                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: pat.color ?? '#6b7280' }} />
                                                    {pat.label}
                                                </p>
                                                <p>{pat.allowed_pages.length} páginas · {Object.values(pat.allowed_actions).filter(Boolean).length} ações permitidas</p>
                                            </div>
                                        );
                                    })()}
                                </TabsContent>
                            )}
                        </Tabs>
                    </div>
                    
                    <SheetFooter className="p-6 pt-4 border-t shrink-0 bg-background mt-auto">
                        <div className="flex gap-3 w-full sm:w-auto">
                            <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => { setEditTarget(null); setAdvPerms(null); }}>Cancelar</Button>
                            <Button className="flex-1 sm:flex-none" onClick={handleSubmitEdit} disabled={updateMutation.isPending || updatePermsMutation.isPending}>
                                {updateMutation.isPending || updatePermsMutation.isPending ? 'A guardar...' : 'Guardar Alterações'}
                            </Button>
                        </div>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            {/* Delete Dialog */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Apagar utilizador</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tens a certeza que queres apagar permanentemente <strong>{deleteTarget?.full_name}</strong>?
                            Esta ação não pode ser revertida.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={deleteMutation.isPending}
                            onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
                        >
                            {deleteMutation.isPending ? 'A apagar...' : 'Apagar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );

};

export default Equipa;
