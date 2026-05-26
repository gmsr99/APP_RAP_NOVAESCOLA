
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
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
import type { PublicProfile, RoleDefinition, Projeto } from '@/types';
import { Mail, Shield, Trash2, Pencil } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';
import { toast } from 'sonner';

const PAGE_LABELS: Record<string, string> = {
    dashboard: 'Dashboard', horarios: 'Horários', producao: 'Produção',
    tarefas: 'Tarefas', estudio: 'Estúdio', chat: 'Chat', equipa: 'Equipa',
    wiki: 'Wiki', contactos: 'Contactos', atalhos: 'Atalhos', registos: 'Registos',
    equipamento: 'Material', estatisticas: 'Estatísticas', formacao: 'Formação', admin: 'Admin',
};
const ALL_SLUGS = Object.keys(PAGE_LABELS);

const ROLE_BADGE: Record<string, string> = {
    coordenador: 'default',
    mentor: 'secondary',
    direcao: 'destructive',
    it_support: 'outline',
};

const Equipa = () => {
    const { profile, user, allowedPages } = useProfile();
    const queryClient = useQueryClient();
    const isAdmin = allowedPages.has('admin');

    const [deleteTarget, setDeleteTarget] = useState<PublicProfile | null>(null);
    const [editTarget, setEditTarget] = useState<PublicProfile | null>(null);
    const [editForm, setEditForm] = useState({ full_name: '', role: '', avatar_url: '' });

    // Advanced permissions state
    const [advPerms, setAdvPerms] = useState<{
        is_root: boolean;
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
                    is_root: permsData.is_root,
                    is_coordenacao: permsData.is_coordenacao ?? false,
                    page_overrides: permsData.page_overrides || {},
                    project_ids: permsData.project_ids || [],
                    role_pages: found ? found.pages : [],
                });
            } catch {
                setAdvPerms({ is_root: false, is_coordenacao: false, page_overrides: {}, project_ids: [], role_pages: [] });
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
                    is_root: advPerms.is_root,
                    is_coordenacao: advPerms.is_coordenacao,
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
            setAdvPerms(prev => prev ? { ...prev, role_pages: found ? found.pages : [], page_overrides: {} } : prev);
        }
    };

    const isDirecao = profile === 'direcao' || profile === 'it_support';

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="space-y-2">
                    <div className="h-8 w-32 rounded-md bg-muted animate-pulse" />
                    <div className="h-4 w-64 rounded-md bg-muted animate-pulse" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Card key={i}>
                            <CardHeader className="flex flex-row items-center gap-4 pb-2">
                                <div className="h-12 w-12 rounded-full bg-muted animate-pulse shrink-0" />
                                <div className="space-y-2 flex-1">
                                    <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                                    <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 text-center text-destructive">
                Erro ao carregar a equipa. Tenta novamente mais tarde.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="hidden sm:block">
                <h1 className="text-2xl sm:text-3xl font-display font-bold">Equipa</h1>
                <p className="text-muted-foreground mt-1">
                    Membros registados na plataforma e os seus cargos.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {profiles?.map((p) => (
                    <Card key={p.id}>
                        <CardHeader className="flex flex-row items-center gap-4 pb-2">
                            <Avatar className="h-12 w-12 shrink-0">
                                <AvatarImage src={p.avatar_url} />
                                <AvatarFallback>
                                    {p.full_name?.substring(0, 2).toUpperCase() || 'U'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col flex-1 min-w-0">
                                <CardTitle className="text-base">{p.full_name || 'Utilizador'}</CardTitle>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Mail className="h-3 w-3 shrink-0" />
                                    <span className="truncate" title={p.email}>{p.email}</span>
                                </div>
                            </div>
                            {isDirecao && p.id !== user.id && (
                                <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                        onClick={() => openEdit(p)}
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        onClick={() => setDeleteTarget(p)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                                <Badge
                                    variant={(ROLE_BADGE[p.role] as any) || 'outline'}
                                    className="capitalize"
                                >
                                    {roles.find(r => r.name === p.role)?.label || p.role}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Edit Dialog */}
            <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
                <DialogContent className="w-full sm:max-w-md max-h-[95dvh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Pencil className="h-4 w-4" />
                            Editar membro
                        </DialogTitle>
                        <DialogDescription>
                            Altera o nome, cargo ou foto de <strong>{editTarget?.full_name}</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Avatar preview */}
                        <div className="flex items-center gap-4">
                            <Avatar className="h-16 w-16 shrink-0">
                                <AvatarImage src={editForm.avatar_url || editTarget?.avatar_url} />
                                <AvatarFallback className="text-lg">
                                    {editForm.full_name?.substring(0, 2).toUpperCase() || 'U'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 space-y-1.5">
                                <Label>URL da foto</Label>
                                <Input
                                    placeholder="https://..."
                                    value={editForm.avatar_url}
                                    onChange={(e) => setEditForm({ ...editForm, avatar_url: e.target.value })}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Link direto para a imagem (HTTPS).
                                </p>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Nome completo <span className="text-destructive">*</span></Label>
                            <Input
                                value={editForm.full_name}
                                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                                placeholder="Nome do membro"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label>Cargo <span className="text-destructive">*</span></Label>
                            <Select value={editForm.role} onValueChange={handleRoleChange}>
                                <SelectTrigger>
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

                        {/* Advanced permissions (admin only) */}
                        {isAdmin && advPerms && (
                            <>
                                <div className="space-y-2 pt-2 border-t">
                                    <Label className="text-sm font-semibold">Acesso a páginas</Label>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {ALL_SLUGS.map(slug => (
                                            <label key={slug} className="flex items-center gap-2 cursor-pointer select-none">
                                                <Checkbox
                                                    checked={getPageAccess(slug)}
                                                    onCheckedChange={() => togglePage(slug)}
                                                    disabled={advPerms.is_root}
                                                />
                                                <span className="text-sm">{PAGE_LABELS[slug]}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {projetos.length > 0 && (
                                    <div className="space-y-2 pt-2 border-t">
                                        <Label className="text-sm font-semibold">Acesso a projetos</Label>
                                        <p className="text-xs text-muted-foreground">Vazio = acesso a todos.</p>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {projetos.map(p => (
                                                <label key={p.id} className="flex items-center gap-2 cursor-pointer select-none">
                                                    <Checkbox
                                                        checked={advPerms.project_ids.includes(p.id)}
                                                        onCheckedChange={() => toggleProject(p.id)}
                                                        disabled={advPerms.is_root}
                                                    />
                                                    <span className="text-sm">{p.nome}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center justify-between pt-2 border-t">
                                    <div>
                                        <p className="text-sm font-semibold">Acesso de Coordenação</p>
                                        <p className="text-xs text-muted-foreground">Coordena sessões, turmas e exportações, independentemente do cargo.</p>
                                    </div>
                                    <Switch
                                        checked={advPerms.is_coordenacao}
                                        onCheckedChange={v => setAdvPerms(prev => prev ? { ...prev, is_coordenacao: v } : prev)}
                                        disabled={advPerms.is_root}
                                    />
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t">
                                    <div>
                                        <p className="text-sm font-semibold">Acesso root</p>
                                        <p className="text-xs text-muted-foreground">Contorna todas as permissões.</p>
                                    </div>
                                    <Switch
                                        checked={advPerms.is_root}
                                        onCheckedChange={v => setAdvPerms(prev => prev ? { ...prev, is_root: v } : prev)}
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setEditTarget(null); setAdvPerms(null); }}>Cancelar</Button>
                        <Button onClick={handleSubmitEdit} disabled={updateMutation.isPending || updatePermsMutation.isPending}>
                            {updateMutation.isPending || updatePermsMutation.isPending ? 'A guardar...' : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
