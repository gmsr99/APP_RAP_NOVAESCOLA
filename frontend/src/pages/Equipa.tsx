
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { api } from '@/services/api';
import type { PublicProfile } from '@/types';
import { Loader2, Mail, Shield, Trash2 } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';
import { toast } from 'sonner';

const Equipa = () => {
    const { profile, user } = useProfile();
    const queryClient = useQueryClient();
    const [deleteTarget, setDeleteTarget] = useState<PublicProfile | null>(null);

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
                <h1 className="text-3xl font-display font-bold">Equipa</h1>
                <p className="text-muted-foreground mt-1">
                    Membros registados na plataforma e os seus cargos.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {profiles?.map((p) => (
                    <Card key={p.id}>
                        <CardHeader className="flex flex-row items-center gap-4 pb-2">
                            <Avatar className="h-12 w-12">
                                <AvatarImage src={p.avatar_url} />
                                <AvatarFallback>
                                    {p.full_name?.substring(0, 2).toUpperCase() || 'U'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col flex-1 min-w-0">
                                <CardTitle className="text-base">{p.full_name || 'Utilizador'}</CardTitle>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Mail className="h-3 w-3" />
                                    <span className="truncate max-w-[150px]" title={p.email}>{p.email}</span>
                                </div>
                            </div>
                            {isDirecao && p.id !== user.id && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => setDeleteTarget(p)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-muted-foreground" />
                                <Badge variant={
                                    p.role === 'coordenador' ? 'default' :
                                        p.role === 'mentor' ? 'secondary' : 'outline'
                                }
                                    className="capitalize"
                                >
                                    {p.role}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

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
