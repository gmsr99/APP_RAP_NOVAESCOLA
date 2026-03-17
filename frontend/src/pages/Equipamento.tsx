import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Package,
  Plus,
  Loader2,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  XCircle,
  Edit2,
  Trash2,
  History,
  MapPin,
  User,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import type {
  EquipamentoItem,
  EquipamentoStats,
  EquipamentoHistorico,
  EquipamentoOcupacao,
  KitCategoria,
} from '@/types';

// ---------------------------------------------------------------------------
// Estado labels + badges
// ---------------------------------------------------------------------------

const ESTADOS = [
  { value: 'Novo', label: 'Novo', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { value: 'excelente', label: 'Excelente', icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
  { value: 'Bom', label: 'Bom', icon: CheckCircle2, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { value: 'Médio', label: 'Médio', icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
  { value: 'Mau', label: 'Mau', icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { value: 'em_manutencao', label: 'Em manutencao', icon: Wrench, color: 'text-info', bg: 'bg-info/10' },
  { value: 'indisponivel', label: 'Indisponivel', icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
];

function getEstadoInfo(estado: string) {
  return ESTADOS.find(e => e.value === estado) ?? { value: estado, label: estado || '—', icon: AlertTriangle, color: 'text-muted-foreground', bg: 'bg-muted/10' };
}

function EstadoBadge({ estado }: { estado: string }) {
  const info = getEstadoInfo(estado);
  const Icon = info.icon;
  return (
    <Badge variant="outline" className={`gap-1 ${info.color} border-current/20 ${info.bg}`}>
      <Icon className="h-3 w-3" />
      {info.label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Equipamento = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filters
  const [filtroCategoria, setFiltroCategoria] = useState('all');
  const [filtroEstado, setFiltroEstado] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Dialogs
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isHistoricoOpen, setIsHistoricoOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EquipamentoItem | null>(null);
  const [historicoItemId, setHistoricoItemId] = useState<number | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    nome: '',
    identificador: '',
    categoria_id: '',
    estado: 'Novo',
    observacoes: '',
  });

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  const { data: itens = [], isLoading } = useQuery<EquipamentoItem[]>({
    queryKey: ['equipamento-itens'],
    queryFn: () => api.get('/api/equipamento/itens').then(r => r.data),
  });

  const { data: stats } = useQuery<EquipamentoStats>({
    queryKey: ['equipamento-stats'],
    queryFn: () => api.get('/api/equipamento/stats').then(r => r.data),
  });

  const { data: categorias = [] } = useQuery<KitCategoria[]>({
    queryKey: ['equipamento-categorias'],
    queryFn: () => api.get('/api/equipamento/categorias').then(r => r.data),
  });

  const { data: historico = [] } = useQuery<EquipamentoHistorico[]>({
    queryKey: ['equipamento-historico', historicoItemId],
    queryFn: () => api.get(`/api/equipamento/itens/${historicoItemId}/historico`).then(r => r.data),
    enabled: !!historicoItemId,
  });

  const { data: ocupacoes = [] } = useQuery<EquipamentoOcupacao[]>({
    queryKey: ['equipamento-ocupacoes', historicoItemId],
    queryFn: () => api.get(`/api/equipamento/itens/${historicoItemId}/ocupacoes`).then(r => r.data),
    enabled: !!historicoItemId,
  });

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/api/equipamento/itens', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipamento-itens'] });
      queryClient.invalidateQueries({ queryKey: ['equipamento-stats'] });
      queryClient.invalidateQueries({ queryKey: ['equipamento-categorias'] });
      toast({ title: 'Item criado', description: 'Equipamento adicionado com sucesso.' });
      setIsFormOpen(false);
    },
    onError: () => toast({ title: 'Erro', description: 'Nao foi possivel criar o item.', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/api/equipamento/itens/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipamento-itens'] });
      queryClient.invalidateQueries({ queryKey: ['equipamento-stats'] });
      toast({ title: 'Item atualizado', description: 'Equipamento atualizado com sucesso.' });
      setIsFormOpen(false);
    },
    onError: () => toast({ title: 'Erro', description: 'Nao foi possivel atualizar o item.', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/equipamento/itens/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipamento-itens'] });
      queryClient.invalidateQueries({ queryKey: ['equipamento-stats'] });
      queryClient.invalidateQueries({ queryKey: ['equipamento-categorias'] });
      toast({ title: 'Item removido', description: 'Equipamento removido com sucesso.' });
    },
    onError: () => toast({ title: 'Erro', description: 'Nao foi possivel remover o item.', variant: 'destructive' }),
  });

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const openCreate = () => {
    setEditingItem(null);
    setFormData({ nome: '', identificador: '', categoria_id: '', estado: 'Novo', observacoes: '' });
    setIsFormOpen(true);
  };

  const openEdit = (item: EquipamentoItem) => {
    setEditingItem(item);
    setFormData({
      nome: item.nome,
      identificador: item.identificador,
      categoria_id: String(item.categoria_id),
      estado: item.estado,
      observacoes: item.observacoes || '',
    });
    setIsFormOpen(true);
  };

  const openHistorico = (itemId: number) => {
    setHistoricoItemId(itemId);
    setIsHistoricoOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.nome || !formData.identificador || !formData.categoria_id) {
      toast({ title: 'Campos obrigatorios', description: 'Preenche nome, identificador e categoria.', variant: 'destructive' });
      return;
    }

    const payload = {
      ...formData,
      categoria_id: Number(formData.categoria_id),
    };

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // ---------------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------------

  const filteredItens = itens.filter(item => {
    if (filtroCategoria !== 'all' && String(item.categoria_id) !== filtroCategoria) return false;
    if (filtroEstado !== 'all' && item.estado !== filtroEstado) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return (
        item.identificador.toLowerCase().includes(s) ||
        item.nome.toLowerCase().includes(s) ||
        (item.responsavel_nome || '').toLowerCase().includes(s)
      );
    }
    return true;
  });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Gestao de Material</h1>
          <p className="text-muted-foreground">
            Equipamento individual sincronizado com sessoes.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Item
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">{stats?.total ?? 0}</p>
              <p className="text-sm text-muted-foreground">Total de itens</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-success/10">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">{stats?.disponiveis ?? 0}</p>
              <p className="text-sm text-muted-foreground">Disponiveis</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-info/10">
              <Wrench className="h-6 w-6 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">{stats?.por_estado?.em_manutencao ?? 0}</p>
              <p className="text-sm text-muted-foreground">Em manutencao</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-muted">
              <Layers className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">{stats?.categorias ?? 0}</p>
              <p className="text-sm text-muted-foreground">Categorias</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              placeholder="Pesquisar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9"
            />
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categorias.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos estados</SelectItem>
                {ESTADOS.map(e => (
                  <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Inventário ({filteredItens.length} {filteredItens.length === 1 ? 'item' : 'itens'})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredItens.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum item encontrado.
            </p>
          ) : (
            <>
              {/* ── Mobile cards ── */}
              <div className="flex flex-col gap-3 md:hidden">
                {filteredItens.map(item => (
                  <div key={item.id} className="rounded-lg border bg-card p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{item.identificador}</p>
                        <p className="text-xs text-muted-foreground">{item.nome}</p>
                      </div>
                      <EstadoBadge estado={item.estado} />
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">{item.categoria_nome}</Badge>
                      {item.localizacao_nome && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{item.localizacao_nome}
                        </span>
                      )}
                      {item.responsavel_nome && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />{item.responsavel_nome}
                        </span>
                      )}
                    </div>
                    {item.ultima_utilizacao && (
                      <p className="text-xs text-muted-foreground">
                        Utilizado {formatDistanceToNow(parseISO(item.ultima_utilizacao), { addSuffix: true, locale: pt })}
                      </p>
                    )}
                    <div className="flex items-center gap-2 pt-1 border-t border-border">
                      <Button variant="ghost" size="sm" className="h-8 flex-1 text-xs gap-1" onClick={() => openHistorico(item.id)}>
                        <History className="h-3.5 w-3.5" /> Histórico
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 flex-1 text-xs gap-1" onClick={() => openEdit(item)}>
                        <Edit2 className="h-3.5 w-3.5" /> Editar
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => deleteMutation.mutate(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Desktop table ── */}
              <div className="hidden md:block rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Identificador</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Última Localização</TableHead>
                      <TableHead>Último responsavel</TableHead>
                      <TableHead>Última utilizacao</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItens.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.identificador}</TableCell>
                        <TableCell className="text-muted-foreground">{item.nome}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{item.categoria_nome}</Badge>
                        </TableCell>
                        <TableCell>
                          <EstadoBadge estado={item.estado} />
                        </TableCell>
                        <TableCell>
                          {item.localizacao_nome ? (
                            <span className="flex items-center gap-1 text-sm">
                              <MapPin className="h-3 w-3" />
                              {item.localizacao_nome}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.responsavel_nome ? (
                            <span className="flex items-center gap-1 text-sm">
                              <User className="h-3 w-3" />
                              {item.responsavel_nome}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.ultima_utilizacao
                            ? formatDistanceToNow(parseISO(item.ultima_utilizacao), { addSuffix: true, locale: pt })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openHistorico(item.id)} title="Historico">
                              <History className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)} title="Editar">
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(item.id)} title="Remover">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Item' : 'Novo Item de Equipamento'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome (tipo) *</Label>
                <Input
                  placeholder="Ex: Microfone"
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Identificador unico *</Label>
                <Input
                  placeholder="Ex: Microfone Scarlett 01"
                  value={formData.identificador}
                  onChange={(e) => setFormData(prev => ({ ...prev, identificador: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria *</Label>
                <Select
                  value={formData.categoria_id}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, categoria_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={formData.estado}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, estado: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS.map(e => (
                      <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observacoes</Label>
              <Textarea
                placeholder="Notas sobre o estado do equipamento..."
                value={formData.observacoes}
                onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) ? 'A guardar...' : editingItem ? 'Guardar' : 'Criar Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Historico Dialog */}
      <Dialog open={isHistoricoOpen} onOpenChange={(open) => { setIsHistoricoOpen(open); if (!open) setHistoricoItemId(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historico e Ocupacoes
            </DialogTitle>
          </DialogHeader>

          {/* Sessoes futuras */}
          {ocupacoes.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-primary">Proximas sessoes reservadas:</p>
              {ocupacoes.map(o => (
                <div key={o.aula_id} className="flex items-start gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
                  <Package className="h-4 w-4 mt-0.5 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {o.estabelecimento_nome || 'Local desconhecido'}
                      {o.turma_nome && ` — ${o.turma_nome}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {o.data_hora
                        ? formatDistanceToNow(parseISO(o.data_hora), { addSuffix: true, locale: pt })
                        : '-'}
                      {o.mentor_nome && ` · ${o.mentor_nome}`}
                      {` · ${o.duracao_minutos}min`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Historico passado */}
          <div className="max-h-[300px] overflow-y-auto">
            <p className="text-sm font-medium mb-2">Historico de utilizacao:</p>
            {historico.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">
                Sem registos de utilizacao.
              </p>
            ) : (
              <div className="space-y-3">
                {historico.map((h, idx) => (
                  <div key={`${h.tipo}-${h.id}-${idx}`} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                    <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{h.user_nome || 'Desconhecido'}</p>
                      <p className="text-xs text-muted-foreground">
                        {h.data_utilizacao
                          ? formatDistanceToNow(parseISO(h.data_utilizacao), { addSuffix: true, locale: pt })
                          : '-'}
                        {h.aula_id && ` · Sessao #${h.aula_id}`}
                        {h.local_nome && ` · ${h.local_nome}`}
                        {h.tipo === 'manual' && ' · Manual'}
                      </p>
                      {h.observacoes && (
                        <p className="text-sm text-muted-foreground mt-1 italic">"{h.observacoes}"</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Equipamento;
