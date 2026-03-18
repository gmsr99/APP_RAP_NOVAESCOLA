
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, Trash2, Bell, BellOff, Info, CheckCircle, XCircle, Calendar, MessageCircle, Share, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Notification } from '@/types';
import { useProfile } from '@/contexts/ProfileContext';
import { useNavigate } from 'react-router-dom';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface NotificationSidebarProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function NotificationSidebar({ open, onOpenChange }: NotificationSidebarProps) {
    const queryClient = useQueryClient();
    const { user } = useProfile();
    const navigate = useNavigate();
    const { isSupported, isIOS, isStandalone, isSubscribed, isLoading: pushLoading, permission, subscribe, unsubscribe } = usePushNotifications();

    const { data: notifications = [] } = useQuery<Notification[]>({
        queryKey: ['notifications', 'current-user'],
        queryFn: async () => {
            try {
                const res = await api.get('/api/notifications');
                const rawData = Array.isArray(res.data) ? res.data : [];

                // Map backend (Portuguese) to frontend (English) keys
                return rawData.map((item: any) => ({
                    id: item.id,
                    type: item.tipo,
                    title: item.titulo,
                    message: item.mensagem,
                    read: item.lida,
                    createdAt: item.criado_em,
                    link: item.link,
                    metadados: item.metadados
                }));
            } catch (error) {
                console.error("Failed to fetch notifications:", error);
                return [];
            }
        },
        enabled: open, // Fetch when opened
        refetchInterval: 30000, // Poll every 30s
    });

    const markReadMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.put(`/api/notifications/${id}/read`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/api/notifications/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    const clearAllMutation = useMutation({
        mutationFn: async () => {
            await api.delete('/api/notifications');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    const getIcon = (type: string) => {
        switch (type) {
            case 'session_created': return <Calendar className="h-5 w-5 text-blue-500" />;
            case 'session_confirmed': return <CheckCircle className="h-5 w-5 text-green-500" />;
            case 'session_rejected': return <XCircle className="h-5 w-5 text-red-500" />;
            case 'session_terminada': return <CheckCircle className="h-5 w-5 text-gray-500" />;
            case 'session_updated': return <Calendar className="h-5 w-5 text-orange-500" />;
            case 'chat_unread': return <MessageCircle className="h-5 w-5 text-blue-500" />;
            default: return <Info className="h-5 w-5 text-gray-500" />;
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                    <div className="flex items-center justify-between">
                        <SheetTitle>Notificações</SheetTitle>
                        {notifications.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                                onClick={() => clearAllMutation.mutate()}
                                disabled={clearAllMutation.isPending}
                            >
                                <Trash2 className="h-3 w-3 mr-1" />
                                {clearAllMutation.isPending ? 'A limpar...' : 'Limpar tudo'}
                            </Button>
                        )}
                    </div>
                    <SheetDescription>
                        Acompanhe as atualizações das suas sessões e atividades.
                    </SheetDescription>
                </SheetHeader>

                {/* Banner iOS: instruções para adicionar ao ecrã principal */}
                {isIOS && !isStandalone && (
                    <div className="mx-0 mt-3 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-3 text-sm text-blue-800 dark:text-blue-300">
                        <p className="font-medium mb-1">Ativa notificações no iPhone/iPad</p>
                        <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                            Para receber notificações, instala esta app:
                            toca em <Share className="inline h-3.5 w-3.5 mx-0.5" /> e depois em{' '}
                            <strong>"Adicionar ao Ecrã Principal"</strong> <Plus className="inline h-3.5 w-3.5 mx-0.5" />.
                        </p>
                    </div>
                )}

                {/* Toggle de push notifications */}
                {isSupported && permission !== 'denied' && (
                    <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                        <div className="flex items-center gap-2 text-sm">
                            {isSubscribed
                                ? <Bell className="h-4 w-4 text-primary" />
                                : <BellOff className="h-4 w-4 text-muted-foreground" />
                            }
                            <span className={isSubscribed ? 'text-foreground' : 'text-muted-foreground'}>
                                {isSubscribed ? 'Notificações ativas' : 'Notificações desativadas'}
                            </span>
                        </div>
                        <Button
                            variant={isSubscribed ? 'outline' : 'default'}
                            size="sm"
                            className="h-7 px-3 text-xs"
                            disabled={pushLoading}
                            onClick={isSubscribed ? unsubscribe : subscribe}
                        >
                            {pushLoading ? 'A processar...' : isSubscribed ? 'Desativar' : 'Ativar'}
                        </Button>
                    </div>
                )}

                {/* Mensagem se permissão foi negada */}
                {isSupported && permission === 'denied' && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300">
                        Notificações bloqueadas nas definições do browser.
                    </div>
                )}

                <ScrollArea className="h-[calc(100vh-180px)] mt-4 pr-4">
                    <div className="space-y-4">
                        {notifications.length === 0 ? (
                            <div className="text-center text-muted-foreground py-10">
                                <Bell className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                <p>Sem novas notificações</p>
                            </div>
                        ) : (
                            notifications.map((notif) => (
                                <div
                                    key={notif.id}
                                    className={cn(
                                        "p-4 rounded-lg border transition-colors relative group",
                                        notif.read ? "bg-background border-border" : "bg-muted/30 border-primary/20",
                                        "hover:bg-muted/50",
                                        notif.link && "cursor-pointer"
                                    )}
                                    onClick={() => {
                                        if (notif.link) {
                                            if (!notif.read) markReadMutation.mutate(notif.id);
                                            onOpenChange(false);
                                            navigate(notif.link);
                                        }
                                    }}
                                >
                                    <div className="flex gap-3">
                                        <div className="mt-1 shrink-0">
                                            {getIcon(notif.type)}
                                        </div>
                                        <div className="space-y-1 flex-1">
                                            <div className="flex justify-between items-start gap-2">
                                                <p className={cn("text-sm font-medium leading-none", !notif.read && "text-primary")}>
                                                    {notif.title}
                                                </p>
                                                <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                                                    {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: pt })}
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground line-clamp-2">
                                                {notif.message}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                        {!notif.read && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 px-2 text-xs"
                                                onClick={() => markReadMutation.mutate(notif.id)}
                                            >
                                                <Check className="h-3 w-3 mr-1" />
                                                Marcar como lida
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 px-2 text-xs hover:text-destructive"
                                            onClick={() => deleteMutation.mutate(notif.id)}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}
