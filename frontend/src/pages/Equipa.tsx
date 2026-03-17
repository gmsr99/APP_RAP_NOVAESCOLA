
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import type { PublicProfile } from '@/types';
import { Loader2, Mail, Shield, Trash2, Pencil } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';
import { toast } from 'sonner';

const ROLES = [
    { value: 'mentor', label: 'Mentor' },
    { value: 'produtor', label: 'Produtor' },
    { value: 'mentor_produtor', label: 'Mentor / Produtor' },
    { value: 'coordenador', label: 'Coordenador' },
    { value: 'direcao', label: 'Direção' },
    { value: 'it_support', label: 'IT Support' },
];

const ROLE_BADGE: Record<string, string> = {
    coordenador: 'default',
    mentor: 'secondary',
    direcao: 'destructive',
    it_support: 'outline',
};

const Equipa = () => {
    const { profile, user } = useProfile();
    const queryClient = useQueryClient();

    const [deleteTarget, setDeleteTarget] = useState<PublicProfile | null>(null);
    const [editTarget, setEditTarget] = useState<PublicProfile | null>(null);
    const [editForm, setEditForm] = useState({ full_name: '', role: '', avatar_url: '' });

    const { data: profiles, isLoading, error } = useQuery({
        queryKey: ['equipa'],
        queryFn: () => api.get<PublicProfile[]>('/api/equipa'),
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
            setEditTarget(null);
        },
        onError: (err: Error) => toast.error(err.message || 'Erro ao atualizar membro.'),
    });

    const openEdit = (p: PublicProfile) => {
        setEditTarget(p);
        setEditForm({
            full_name: p.full_name || '',
            role: p.role || '',
            avatar_url: p.avatar_url || '',
        });
    };

    const handleSubmitEdit = () => {
        if (!editTarget || !editForm.full_name.trim() || !editForm.role) {
            toast.error('Nome e cargo são obrigatórios.');
            return;
        }
        const data: Record<string, string> = {
            full_name: editForm.full_name.trim(),
            role: editForm.role,
        };
        if (editForm.avatar_url.trim()) {
            data.avatar_url = editForm.avatar_url.trim();
        }
        updateMutation.mutate({ userId: editTarget.id, data });
    };

    const isDirecao = profile === 'direcao' || profile === 'it_support';

    if (isLoading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
            <div>
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
                                    {ROLES.find(r => r.value === p.role)?.label || p.role}
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
                            <Select
                                value={editForm.role}
                                onValueChange={(val) => setEditForm({ ...editForm, role: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecionar cargo" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ROLES.map(r => (
                                        <SelectItem key={r.value} value={r.value}>
                                            {r.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditTarget(null)}>Cancelar</Button>
                        <Button onClick={handleSubmitEdit} disabled={updateMutation.isPending}>
                            {updateMutation.isPending ? 'A guardar...' : 'Guardar'}
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
