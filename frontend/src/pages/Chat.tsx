import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Hash, MessageCircle, Send, Users, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ChatMessage, ChatChannelWithMeta, PublicProfile } from '@/types';

export default function Chat() {
  const { user } = useAuth();
  const userId = user?.id;

  const [channels, setChannels] = useState<ChatChannelWithMeta[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({});
  const [teamMembers, setTeamMembers] = useState<PublicProfile[]>([]);
  const [isDmDialogOpen, setIsDmDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const selectedChannel = channels.find(c => c.id === selectedChannelId) || null;
  const groupChannels = channels.filter(c => c.type === 'channel');
  const dmChannels = channels.filter(c => c.type === 'dm');

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, []);

  // ── Load channels on mount ──
  useEffect(() => {
    if (!userId) return;
    loadChannels();
    loadTeamMembers();
  }, [userId]);

  async function loadTeamMembers() {
    try {
      const res = await api.get('/api/equipa');
      setTeamMembers(res.data);
      // Also populate profiles cache
      const map: Record<string, PublicProfile> = {};
      res.data.forEach((p: PublicProfile) => { map[p.id] = p; });
      setProfiles(prev => ({ ...prev, ...map }));
    } catch (e) {
      console.error('Erro ao carregar equipa:', e);
    }
  }

  async function loadChannels() {
    if (!userId) return;
    setLoading(true);

    try {
      // 1. Get channel IDs the user belongs to
      const { data: memberships } = await supabase
        .from('chat_members')
        .select('channel_id')
        .eq('user_id', userId);

      const channelIds = memberships?.map(m => m.channel_id) || [];
      if (channelIds.length === 0) {
        setChannels([]);
        setLoading(false);
        return;
      }

      // 2. Get channel details
      const { data: channelData } = await supabase
        .from('chat_channels')
        .select('*')
        .in('id', channelIds);

      // 3. Get read receipts
      const { data: receipts } = await supabase
        .from('chat_read_receipts')
        .select('*')
        .eq('user_id', userId);

      // 4. Enrich each channel with unread count + DM partner
      const enriched: ChatChannelWithMeta[] = await Promise.all(
        (channelData || []).map(async (ch) => {
          const receipt = receipts?.find(r => r.channel_id === ch.id);
          const lastReadAt = receipt?.last_read_at || '1970-01-01T00:00:00Z';

          // Count unread messages (not sent by me, after my last read)
          const { count } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('channel_id', ch.id)
            .gt('created_at', lastReadAt)
            .neq('sender_id', userId);

          // For DMs, get the partner's profile
          let dm_partner: PublicProfile | undefined;
          if (ch.type === 'dm') {
            const { data: members } = await supabase
              .from('chat_members')
              .select('user_id')
              .eq('channel_id', ch.id)
              .neq('user_id', userId);
            if (members?.[0]) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('id, email, full_name, role, avatar_url')
                .eq('id', members[0].user_id)
                .single();
              if (profile) dm_partner = profile;
            }
          }

          return {
            ...ch,
            unread_count: count || 0,
            dm_partner,
          };
        })
      );

      // Sort: channels first, then DMs
      const sorted = enriched.sort((a, b) => {
        if (a.type === 'channel' && b.type === 'dm') return -1;
        if (a.type === 'dm' && b.type === 'channel') return 1;
        return 0;
      });

      setChannels(sorted);

      // Auto-select first channel if none selected
      if (!selectedChannelId && sorted.length > 0) {
        setSelectedChannelId(sorted[0].id);
      }
    } catch (e) {
      console.error('Erro ao carregar canais:', e);
    } finally {
      setLoading(false);
    }
  }

  // ── Load messages + subscribe when channel changes ──
  useEffect(() => {
    if (!selectedChannelId || !userId) return;

    loadMessages(selectedChannelId);
    markChannelAsRead(selectedChannelId);

    // Subscribe to new messages via Supabase Realtime
    const channel = supabase
      .channel(`chat:${selectedChannelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${selectedChannelId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          // Load sender profile if not cached
          loadSenderProfile(newMsg.sender_id);
          scrollToBottom();
          // Mark as read since user is viewing this channel
          markChannelAsRead(selectedChannelId);
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      subscriptionRef.current = null;
    };
  }, [selectedChannelId, userId]);

  async function loadMessages(channelId: string) {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(200);

    setMessages(data || []);

    // Load sender profiles
    const senderIds = [...new Set((data || []).map(m => m.sender_id))];
    if (senderIds.length > 0) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, avatar_url')
        .in('id', senderIds);
      const map: Record<string, PublicProfile> = {};
      (profileData || []).forEach(p => { map[p.id] = p; });
      setProfiles(prev => ({ ...prev, ...map }));
    }

    scrollToBottom();
  }

  async function loadSenderProfile(senderId: string) {
    if (profiles[senderId]) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, avatar_url')
      .eq('id', senderId)
      .single();
    if (data) {
      setProfiles(prev => ({ ...prev, [data.id]: data }));
    }
  }

  async function markChannelAsRead(channelId: string) {
    if (!userId) return;
    try {
      await supabase
        .from('chat_read_receipts')
        .upsert(
          { user_id: userId, channel_id: channelId, last_read_at: new Date().toISOString() },
          { onConflict: 'user_id,channel_id' }
        );

      // Clear singleton notification
      await api.post('/api/chat/mark-read');

      // Update unread count locally
      setChannels(prev =>
        prev.map(ch =>
          ch.id === channelId ? { ...ch, unread_count: 0 } : ch
        )
      );
    } catch (e) {
      console.error('Erro ao marcar como lido:', e);
    }
  }

  // ── Send message ──
  async function handleSendMessage() {
    if (!messageInput.trim() || !selectedChannelId || !userId) return;

    const content = messageInput.trim();
    setMessageInput('');

    const { error } = await supabase
      .from('chat_messages')
      .insert({
        channel_id: selectedChannelId,
        sender_id: userId,
        content,
      });

    if (error) {
      console.error('Erro ao enviar mensagem:', error);
      setMessageInput(content); // restore on failure
      return;
    }

    // Trigger singleton notification for other members (fire-and-forget)
    api.post('/api/chat/notify', { channel_id: selectedChannelId }).catch(() => {});
  }

  // ── Start DM ──
  async function startDM(otherUserId: string) {
    try {
      const res = await api.post('/api/chat/dm', { other_user_id: otherUserId });
      const channelId = res.data.channel_id;
      setIsDmDialogOpen(false);
      await loadChannels();
      setSelectedChannelId(channelId);
    } catch (e) {
      console.error('Erro ao criar DM:', e);
    }
  }

  // ── Helpers ──
  function formatTime(isoString: string) {
    return new Date(isoString).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  }

  function getSenderName(senderId: string): string {
    if (senderId === userId) return user?.name || 'Eu';
    return profiles[senderId]?.full_name || 'Utilizador';
  }

  function getSenderInitial(senderId: string): string {
    const name = getSenderName(senderId);
    return name.charAt(0).toUpperCase();
  }

  function getChannelDisplayName(ch: ChatChannelWithMeta): string {
    if (ch.type === 'dm') return ch.dm_partner?.full_name || 'Utilizador';
    return ch.name;
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-7rem)] -m-6 bg-background items-center justify-center">
        <p className="text-muted-foreground">A carregar chat...</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] -m-6 bg-background">
      {/* Channels Sidebar */}
      <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="p-4 border-b border-sidebar-border">
          <h2 className="font-semibold text-sidebar-foreground flex items-center gap-2">
            <Users className="h-5 w-5" />
            Chat de Equipa
          </h2>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3">
            {/* Channels */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2 px-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Canais
                </span>
              </div>
              {groupChannels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => setSelectedChannelId(channel.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                    selectedChannelId === channel.id
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                  )}
                >
                  <Hash className="h-4 w-4 shrink-0" />
                  <span className={cn('truncate', channel.unread_count > 0 && 'font-semibold')}>{channel.name}</span>
                  {channel.unread_count > 0 && (
                    <span className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />
                  )}
                </button>
              ))}
            </div>

            {/* Direct Messages */}
            <div>
              <div className="flex items-center justify-between mb-2 px-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Mensagens Diretas
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => setIsDmDialogOpen(true)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {dmChannels.map((dm) => (
                <button
                  key={dm.id}
                  onClick={() => setSelectedChannelId(dm.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                    selectedChannelId === dm.id
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                  )}
                >
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[10px] bg-muted">
                      {getChannelDisplayName(dm).charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className={cn('truncate', dm.unread_count > 0 && 'font-semibold')}>{getChannelDisplayName(dm)}</span>
                  {dm.unread_count > 0 && (
                    <span className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Channel Header */}
        <div className="h-14 px-4 border-b border-border flex items-center gap-2 bg-card">
          {selectedChannel ? (
            <>
              {selectedChannel.type === 'channel' ? (
                <Hash className="h-5 w-5 text-muted-foreground" />
              ) : (
                <MessageCircle className="h-5 w-5 text-muted-foreground" />
              )}
              <h3 className="font-semibold">{getChannelDisplayName(selectedChannel)}</h3>
            </>
          ) : (
            <h3 className="font-semibold text-muted-foreground">Seleciona um canal</h3>
          )}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {!selectedChannel ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <p className="text-muted-foreground">Seleciona um canal para ver as mensagens.</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  {selectedChannel.type === 'channel' ? (
                    <Hash className="h-6 w-6 text-muted-foreground" />
                  ) : (
                    <MessageCircle className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <p className="text-muted-foreground">
                  {selectedChannel.type === 'channel'
                    ? `Este é o início do canal #${selectedChannel.name}`
                    : `Inicia uma conversa com ${getChannelDisplayName(selectedChannel)}`
                  }
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="flex gap-3 group">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {getSenderInitial(message.sender_id)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-sm">{getSenderName(message.sender_id)}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(message.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/90 mt-0.5">{message.content}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Message Input */}
        {selectedChannel && (
          <div className="p-4 border-t border-border bg-card">
            <div className="flex gap-2">
              <Input
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                placeholder={`Escreve uma mensagem em ${selectedChannel.type === 'channel' ? '#' : ''}${getChannelDisplayName(selectedChannel)}...`}
                className="flex-1"
              />
              <Button onClick={handleSendMessage} size="icon" disabled={!messageInput.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* New DM Dialog */}
      <Dialog open={isDmDialogOpen} onOpenChange={setIsDmDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Nova Mensagem Direta</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {teamMembers
              .filter(m => m.id !== userId)
              .map(member => (
                <button
                  key={member.id}
                  onClick={() => startDM(member.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted transition-colors text-left"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {member.full_name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{member.full_name}</p>
                    <p className="text-xs text-muted-foreground">{member.role}</p>
                  </div>
                </button>
              ))
            }
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
