/**
 * AIAgentChat — Sidebar lateral com chat de linguagem natural
 * para gestão de sessões via Agente AI (Gemini).
 */

import { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/services/api';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface Message {
    role: 'user' | 'model';
    text: string;
}

interface AIAgentChatProps {
    open: boolean;
    onClose: () => void;
}

export default function AIAgentChat({ open, onClose }: AIAgentChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [historico, setHistorico] = useState<any[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const queryClient = useQueryClient();

    // Auto-scroll para a última mensagem
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    // Focar no input quando abrir
    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [open]);

    const handleSend = async () => {
        const text = input.trim();
        if (!text || isLoading) return;

        // Adicionar mensagem do utilizador
        setMessages(prev => [...prev, { role: 'user', text }]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await api.post<{ resposta: string; historico: any[] }>(
                '/api/ai/agent/horarios',
                { mensagem: text, historico }
            );

            setMessages(prev => [...prev, { role: 'model', text: response.resposta }]);
            setHistorico(response.historico);

            // Invalidar queries de aulas para atualizar o calendário
            queryClient.invalidateQueries({ queryKey: ['aulas'] });
        } catch (err: any) {
            const errorMsg = err?.message || 'Erro ao comunicar com o agente.';
            setMessages(prev => [...prev, { role: 'model', text: `❌ ${errorMsg}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleClear = () => {
        setMessages([]);
        setHistorico([]);
    };

    return (
        <>
            {/* Overlay */}
            {open && (
                <div
                    className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm transition-opacity"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <div
                className={cn(
                    'fixed top-0 right-0 w-full sm:w-[440px] bg-card border-l border-border z-50',
                    'flex flex-col shadow-2xl',
                    'transition-transform duration-300 ease-in-out',
                    open ? 'translate-x-0' : 'translate-x-full'
                )}
                style={{ height: '97dvh' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Sparkles className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm">Agente AI</h3>
                            <p className="text-xs text-muted-foreground">Gestão de Horários</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {messages.length > 0 && (
                            <Button variant="ghost" size="icon" onClick={handleClear} title="Limpar conversa">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                    {messages.length === 0 && !isLoading && (
                        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-3 opacity-60">
                            <Bot className="h-12 w-12" />
                            <div>
                                <p className="font-medium text-sm">Olá! Sou o teu assistente.</p>
                                <p className="text-xs mt-1">
                                    Pede-me para criar, editar ou consultar sessões.<br />
                                    Ex: "Marca uma aula de ensaio para amanhã às 14h"
                                </p>
                            </div>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            className={cn(
                                'flex gap-2',
                                msg.role === 'user' ? 'justify-end' : 'justify-start'
                            )}
                        >
                            {msg.role === 'model' && (
                                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                    <Bot className="h-3.5 w-3.5 text-primary" />
                                </div>
                            )}
                            <div
                                className={cn(
                                    'rounded-xl px-3.5 py-2.5 text-sm max-w-[85%] whitespace-pre-wrap leading-relaxed',
                                    msg.role === 'user'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-foreground'
                                )}
                            >
                                {msg.text}
                            </div>
                            {msg.role === 'user' && (
                                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                                </div>
                            )}
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex gap-2 items-start">
                            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <Bot className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div className="bg-muted rounded-xl px-3.5 py-2.5">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="border-t border-border px-4 py-3 bg-card">
                    <div className="flex gap-2 items-end">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Escreve o que pretendes..."
                            disabled={isLoading}
                            rows={1}
                            className={cn(
                                'flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2.5',
                                'text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30',
                                'max-h-32 scrollbar-thin'
                            )}
                            style={{ minHeight: '40px' }}
                            onInput={(e) => {
                                const el = e.currentTarget;
                                el.style.height = 'auto';
                                el.style.height = Math.min(el.scrollHeight, 128) + 'px';
                            }}
                        />
                        <Button
                            size="icon"
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            className="shrink-0 h-10 w-10"
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
}
