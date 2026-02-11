
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { api } from '@/services/api';
import type { PublicProfile } from '@/types';
import { Loader2, Mail, Shield } from 'lucide-react';

const Equipa = () => {
    const { data: profiles, isLoading, error } = useQuery({
        queryKey: ['equipa'],
        queryFn: () => api.get<PublicProfile[]>('/api/equipa'),
    });

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
                {profiles?.map((profile) => (
                    <Card key={profile.id}>
                        <CardHeader className="flex flex-row items-center gap-4 pb-2">
                            <Avatar className="h-12 w-12">
                                <AvatarImage src={profile.avatar_url} />
                                <AvatarFallback>
                                    {profile.full_name?.substring(0, 2).toUpperCase() || 'U'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <CardTitle className="text-base">{profile.full_name || 'Utilizador'}</CardTitle>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Mail className="h-3 w-3" />
                                    <span className="truncate max-w-[150px]" title={profile.email}>{profile.email}</span>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-muted-foreground" />
                                <Badge variant={
                                    profile.role === 'coordenador' ? 'default' :
                                        profile.role === 'mentor' ? 'secondary' : 'outline'
                                }
                                    className="capitalize"
                                >
                                    {profile.role}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default Equipa;
