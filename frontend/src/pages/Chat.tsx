import { useState } from 'react';
import { useProfile } from '@/contexts/ProfileContext';
import { users } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { Hash, MessageCircle, Send, Users, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface Message {
  id: string;
  content: string;
  sender: typeof users[0];
  timestamp: Date;
  channelId: string;
}

interface Channel {
  id: string;
  name: string;
  type: 'channel' | 'dm';
  participants?: typeof users;
  unread?: number;
}

const channels: Channel[] = [
  { id: 'geral', name: 'geral', type: 'channel', unread: 2 },
  { id: 'mentores', name: 'mentores', type: 'channel' },
  { id: 'producao', name: 'produção', type: 'channel', unread: 1 },
  { id: 'equipamento', name: 'equipamento', type: 'channel' },
  { id: 'anuncios', name: 'anúncios', type: 'channel' },
];

const directMessages: Channel[] = users.slice(0, 4).map(user => ({
  id: `dm-${user.id}`,
  name: user.name,
  type: 'dm' as const,
  participants: [user],
}));

const mockMessages: Message[] = [
  {
    id: '1',
    content: 'Bom dia equipa! Temos sessão hoje às 10h na Escola D. Afonso Henriques.',
    sender: users[0],
    timestamp: new Date(Date.now() - 3600000 * 2),
    channelId: 'geral',
  },
  {
    id: '2',
    content: 'Confirmado! Já tenho o equipamento preparado.',
    sender: users[1],
    timestamp: new Date(Date.now() - 3600000),
    channelId: 'geral',
  },
  {
    id: '3',
    content: 'A música "Sonhos de Betão" está quase pronta. Falta só a masterização.',
    sender: users[3],
    timestamp: new Date(Date.now() - 1800000),
    channelId: 'geral',
  },
  {
    id: '4',
    content: 'Excelente trabalho! Os miúdos vão adorar ouvir o resultado final.',
    sender: users[0],
    timestamp: new Date(Date.now() - 900000),
    channelId: 'geral',
  },
  {
    id: '5',
    content: 'Pessoal, lembrem-se de confirmar as sessões desta semana.',
    sender: users[0],
    timestamp: new Date(Date.now() - 7200000),
    channelId: 'mentores',
  },
  {
    id: '6',
    content: 'Já confirmei a minha para amanhã!',
    sender: users[2],
    timestamp: new Date(Date.now() - 3600000),
    channelId: 'mentores',
  },
];

export default function Chat() {
  const { user } = useProfile();
  const [selectedChannel, setSelectedChannel] = useState<Channel>(channels[0]);
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState<Message[]>(mockMessages);

  const channelMessages = messages.filter(m => m.channelId === selectedChannel.id);

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    
    const newMessage: Message = {
      id: Date.now().toString(),
      content: messageInput,
      sender: user,
      timestamp: new Date(),
      channelId: selectedChannel.id,
    };
    
    setMessages([...messages, newMessage]);
    setMessageInput('');
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  };

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
                <Button variant="ghost" size="icon" className="h-5 w-5">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => setSelectedChannel(channel)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                    selectedChannel.id === channel.id
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                  )}
                >
                  <Hash className="h-4 w-4 shrink-0" />
                  <span className="truncate">{channel.name}</span>
                  {channel.unread && (
                    <span className="ml-auto bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                      {channel.unread}
                    </span>
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
                <Button variant="ghost" size="icon" className="h-5 w-5">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {directMessages.map((dm) => (
                <button
                  key={dm.id}
                  onClick={() => setSelectedChannel(dm)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                    selectedChannel.id === dm.id
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                  )}
                >
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[10px] bg-muted">
                      {dm.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{dm.name}</span>
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
          {selectedChannel.type === 'channel' ? (
            <Hash className="h-5 w-5 text-muted-foreground" />
          ) : (
            <MessageCircle className="h-5 w-5 text-muted-foreground" />
          )}
          <h3 className="font-semibold">{selectedChannel.name}</h3>
        </div>
        
        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {channelMessages.length === 0 ? (
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
                    : `Inicia uma conversa com ${selectedChannel.name}`
                  }
                </p>
              </div>
            ) : (
              channelMessages.map((message) => (
                <div key={message.id} className="flex gap-3 group">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {message.sender.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-sm">{message.sender.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/90 mt-0.5">{message.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        
        {/* Message Input */}
        <div className="p-4 border-t border-border bg-card">
          <div className="flex gap-2">
            <Input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={`Escreve uma mensagem em ${selectedChannel.type === 'channel' ? '#' : ''}${selectedChannel.name}...`}
              className="flex-1"
            />
            <Button onClick={handleSendMessage} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
