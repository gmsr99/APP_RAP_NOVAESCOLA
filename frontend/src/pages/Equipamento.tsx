import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Plus, Layers, CheckCircle2, AlertTriangle, Wrench, XCircle, Edit2, Trash2, History, MapPin, User, Building2, Mic2, Navigation, Search, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import type { EquipamentoItem, EquipamentoStats, EquipamentoHistorico, EquipamentoOcupacao, EquipamentoLocalizacao, KitCategoria } from '@/types';

const ESTADOS = [
  { value: 'Novo', label: 'Novo', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { value: 'excelente', label: 'Excelente', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  { value: 'Bom', label: 'Bom', icon: CheckCircle2, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { value: 'Médio', label: 'Médio', icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-400/10' },
  { value: 'Mau', label: 'Mau', icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-400/10' },
  { value: 'em_manutencao', label: 'Em manutenção', icon: Wrench, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  { value: 'indisponivel', label: 'Indisponível', icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
];

function getEstadoInfo(estado: string) {
  return ESTADOS.find(e => e.value === estado) ?? { value: estado, label: estado || '—', icon: AlertTriangle, color: 'text-muted-foreground', bg: 'bg-muted/10' };
}

function EstadoBadge({ estado }: { estado: string }) {
  const info = getEstadoInfo(estado);
  const Icon = info.icon;
  return (
    <Badge variant="outline" className={`gap-1 ${info.color} border-current/20 ${info.bg} font-semibold`}>
      <Icon className="h-3.5 w-3.5" />
      {info.label}
    </Badge>
  );
}

const LOC_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  estabelecimento: Building2,
  mentor: User,
  estudio: Mic2,
};

function LocationBadge({ tipo, nome }: { tipo: string | null; nome: string | null }) {
  if (!nome) return <span className="text-muted-foreground text-sm">-</span>;
  const Icon = (tipo && LOC_ICON[tipo]) || MapPin;
  return (
    <span className="flex items-center gap-1.5 text-sm min-w-0 w-full font-medium">
      <Icon className="h-4 w-4 shrink-0 text-slate-400" />
      <span className="truncate">{nome}</span>
    </span>
  );
}

const Equipamento = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filtroCategoria, setFiltroCategoria] = useState('all');
  const [filtroEstado, setFiltroEstado] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EquipamentoItem | null>(null);
  const [activeTab, setActiveTab] = useState('detalhes');
  const [locSearch, setLocSearch] = useState('');
  const [locSelected, setLocSelected] = useState<EquipamentoLocalizacao | null>(null);

  const [formData, setFormData] = useState({
    nome: '',
    identificador: '',
    categoria_id: '',
    estado: 'Novo',
    observacoes: '',
  });

  const { data: itens = [], isLoading, isError } = useQuery<EquipamentoItem[]>({
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
    queryKey: ['equipamento-historico', selectedItem?.id],
    queryFn: () => api.get(`/api/equipamento/itens/${selectedItem?.id}/historico`).then(r => r.data),
    enabled: !!selectedItem && activeTab === 'historico',
  });

  const { data: ocupacoes = [] } = useQuery<EquipamentoOcupacao[]>({
    queryKey: ['equipamento-ocupacoes', selectedItem?.id],
    queryFn: () => api.get(`/api/equipamento/itens/${selectedItem?.id}/ocupacoes`).then(r => r.data),
    enabled: !!selectedItem && activeTab === 'historico',
  });

  const { data: localizacoes = [] } = useQuery<EquipamentoLocalizacao[]>({
    queryKey: ['equipamento-localizacoes'],
    queryFn: () => api.get('/api/equipamento/localizacoes').then(r => r.data),
    enabled: !!selectedItem && activeTab === 'localizacao',
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/api/equipamento/itens', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipamento-itens'] });
      queryClient.invalidateQueries({ queryKey: ['equipamento-stats'] });
      queryClient.invalidateQueries({ queryKey: ['equipamento-categorias'] });
      toast({ title: 'Item criado', description: 'Equipamento adicionado com sucesso.' });
      setIsCreateOpen(false);
    },
    onError: () => toast({ title: 'Erro', description: 'Não foi possível criar o item.', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/api/equipamento/itens/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipamento-itens'] });
      queryClient.invalidateQueries({ queryKey: ['equipamento-stats'] });
      toast({ title: 'Item atualizado', description: 'Equipamento atualizado com sucesso.' });
    },
    onError: () => toast({ title: 'Erro', description: 'Não foi possível atualizar o item.', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/equipamento/itens/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipamento-itens'] });
      queryClient.invalidateQueries({ queryKey: ['equipamento-stats'] });
      queryClient.invalidateQueries({ queryKey: ['equipamento-categorias'] });
      toast({ title: 'Item removido', description: 'Equipamento removido com sucesso.' });
      setIsSheetOpen(false);
    },
    onError: () => toast({ title: 'Erro', description: 'Não foi possível remover o item.', variant: 'destructive' }),
  });

  const locMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { tipo: string; ref_id: string | number | null; nome: string } }) =>
      api.patch(`/api/equipamento/itens/${id}/localizacao`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipamento-itens'] });
      toast({ title: 'Localização atualizada', description: 'A localização do equipamento foi registada.' });
      setLocSelected(null);
    },
    onError: () => toast({ title: 'Erro', description: 'Não foi possível atualizar a localização.', variant: 'destructive' }),
  });

  const estadoMutation = useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: string }) =>
      api.patch(`/api/equipamento/itens/${id}`, { estado }), // assuming PATCH for partial update
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipamento-itens'] });
      queryClient.invalidateQueries({ queryKey: ['equipamento-stats'] });
      toast({ title: 'Estado atualizado', description: 'O estado foi alterado com sucesso.' });
    },
    onError: () => toast({ title: 'Erro', description: 'Não foi possível atualizar o estado.', variant: 'destructive' }),
  });

  const openCreate = () => {
    setFormData({ nome: '', identificador: '', categoria_id: '', estado: 'Novo', observacoes: '' });
    setIsCreateOpen(true);
  };

  const openItemDetail = (item: EquipamentoItem, tab = 'detalhes') => {
    setSelectedItem(item);
    setActiveTab(tab);
    setLocSelected(null);
    setLocSearch('');
    
    setFormData({
      nome: item.nome,
      identificador: item.identificador,
      categoria_id: String(item.categoria_id),
      estado: item.estado,
      observacoes: item.observacoes || '',
    });

    setIsSheetOpen(true);
  };

  const handleSubmitCreate = () => {
    if (!formData.nome || !formData.identificador || !formData.categoria_id) {
      toast({ title: 'Campos obrigatórios', description: 'Preenche nome, identificador e categoria.', variant: 'destructive' });
      return;
    }
    createMutation.mutate({ ...formData, categoria_id: Number(formData.categoria_id) });
  };

  const handleSubmitEdit = () => {
    if (!selectedItem) return;
    if (!formData.nome || !formData.identificador || !formData.categoria_id) {
      toast({ title: 'Campos obrigatórios', description: 'Preenche nome, identificador e categoria.', variant: 'destructive' });
      return;
    }
    updateMutation.mutate({ id: selectedItem.id, data: { ...formData, categoria_id: Number(formData.categoria_id) } });
  };

  const handleSubmitLoc = () => {
    if (!selectedItem || !locSelected) return;
    locMutation.mutate({
      id: selectedItem.id,
      data: { tipo: locSelected.tipo, ref_id: locSelected.ref_id, nome: locSelected.nome },
    });
  };

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

  if (isLoading) {
    return <div className="p-8 text-center text-slate-400">A carregar inventário...</div>;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <XCircle className="h-8 w-8 text-destructive" />
        <p className="font-medium">Erro ao carregar equipamento.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 pb-24 pt-6 md:px-6 md:pb-8 md:pt-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20 text-primary shadow-inner shadow-primary/20">
            <Package className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-white">Inventário</h1>
            <p className="text-sm font-medium text-slate-400">Gerir equipamentos, localização e estado.</p>
          </div>
        </div>
        <Button onClick={openCreate} className="h-11 w-full sm:w-auto shrink-0 rounded-xl px-5 font-semibold shadow-lg shadow-primary/20">
          <Plus className="mr-2 h-5 w-5" />
          Novo Equipamento
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="rounded-2xl shadow-sm border-border/40 bg-muted/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/20">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-400">{stats?.disponiveis ?? 0}</p>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Disponíveis</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-yellow-500/20">
              <Wrench className="h-6 w-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-500">{stats?.por_estado?.em_manutencao ?? 0}</p>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Em Manutenção</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm border-border/40 bg-muted/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-slate-500/20">
              <Layers className="h-6 w-6 text-slate-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-300">{stats?.categorias ?? 0}</p>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Categorias</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main List Area (Borderless) */}
      <div className="space-y-4">
        {/* Inline Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Pesquisar equipamento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-white/5 border-white/10 rounded-xl"
            />
          </div>
          <div className="flex w-full sm:w-auto gap-3">
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="w-full sm:w-[160px] bg-white/5 border-white/10 rounded-xl">
                <Filter className="mr-2 h-4 w-4 text-slate-400" />
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Categorias</SelectItem>
                {categorias.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-full sm:w-[160px] bg-white/5 border-white/10 rounded-xl">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Estados</SelectItem>
                {ESTADOS.map(e => (
                  <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* The List/Grid */}
        {filteredItens.length === 0 ? (
          <div className="rounded-2xl border-dashed border-2 border-border/60 p-12 text-center text-slate-400">
            <Package className="mx-auto h-12 w-12 opacity-50 mb-4" />
            <p className="text-lg font-medium text-white">Nenhum equipamento encontrado</p>
            <p className="text-sm">Tenta ajustar os teus filtros de pesquisa.</p>
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredItens.map(item => {
              const isProblematic = item.estado === 'em_manutencao' || item.estado === 'Mau' || item.estado === 'indisponivel';
              return (
                <div 
                  key={item.id} 
                  onClick={() => openItemDetail(item, 'detalhes')}
                  className={`group cursor-pointer rounded-2xl border p-5 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 ${
                    isProblematic ? 'border-red-500/30 bg-red-500/5' : 'border-border/40 bg-card/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="min-w-0">
                      <p className="text-lg font-bold text-white truncate">{item.identificador}</p>
                      <p className="text-sm text-slate-400 truncate">{item.nome}</p>
                    </div>
                    <EstadoBadge estado={item.estado} />
                  </div>

                  <div className="space-y-3 mt-4 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="rounded-md bg-white/10 text-slate-300 font-medium">
                        {item.categoria_nome}
                      </Badge>
                    </div>

                    <div className="flex items-center text-sm text-slate-300 gap-2">
                      <LocationBadge tipo={item.localizacao_tipo} nome={item.localizacao_nome} />
                    </div>

                    {item.responsavel_nome && (
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <User className="h-4 w-4 text-slate-400" />
                        <span className="truncate">{item.responsavel_nome}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-xs text-slate-500 font-medium">
                      {item.ultima_utilizacao ? `Ult. uso ${formatDistanceToNow(parseISO(item.ultima_utilizacao), { locale: pt })}` : 'Sem uso registado'}
                    </p>
                    <span className="text-xs font-bold text-primary flex items-center gap-1">
                      Ver detalhes &rarr;
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Creation Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Adicionar Equipamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome Genérico</Label>
              <Input placeholder="Ex: Microfone Condensador" value={formData.nome} onChange={(e) => setFormData(p => ({...p, nome: e.target.value}))} />
            </div>
            <div className="space-y-2">
              <Label>Identificador Único</Label>
              <Input placeholder="Ex: MIC-001" value={formData.identificador} onChange={(e) => setFormData(p => ({...p, identificador: e.target.value}))} />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={formData.categoria_id} onValueChange={(v) => setFormData(p => ({...p, categoria_id: v}))}>
                <SelectTrigger><SelectValue placeholder="Escolher categoria..." /></SelectTrigger>
                <SelectContent>
                  {categorias.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmitCreate} disabled={createMutation.isPending}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto border-l border-white/10 bg-background/95 backdrop-blur-xl">
          {selectedItem && (
            <div className="flex flex-col h-full">
              <SheetHeader className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="secondary" className="bg-white/10">{selectedItem.categoria_nome}</Badge>
                  <EstadoBadge estado={selectedItem.estado} />
                </div>
                <SheetTitle className="text-2xl font-bold">{selectedItem.identificador}</SheetTitle>
                <SheetDescription className="text-base text-slate-400">{selectedItem.nome}</SheetDescription>
              </SheetHeader>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                <TabsList className="grid grid-cols-3 w-full mb-6 bg-white/5 rounded-xl p-1">
                  <TabsTrigger value="detalhes" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Detalhes</TabsTrigger>
                  <TabsTrigger value="localizacao" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Local</TabsTrigger>
                  <TabsTrigger value="historico" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Histórico</TabsTrigger>
                </TabsList>

                {/* Detalhes Tab */}
                <TabsContent value="detalhes" className="space-y-5 flex-1">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-slate-400">Nome</Label>
                      <Input value={formData.nome} onChange={(e) => setFormData(p => ({...p, nome: e.target.value}))} className="bg-white/5 border-white/10" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400">Identificador</Label>
                      <Input value={formData.identificador} onChange={(e) => setFormData(p => ({...p, identificador: e.target.value}))} className="bg-white/5 border-white/10" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400">Estado Atual</Label>
                      <Select value={formData.estado} onValueChange={(v) => setFormData(p => ({...p, estado: v}))}>
                        <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ESTADOS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400">Observações</Label>
                      <Textarea value={formData.observacoes} onChange={(e) => setFormData(p => ({...p, observacoes: e.target.value}))} className="bg-white/5 border-white/10" rows={4} />
                    </div>
                  </div>
                  
                  <div className="flex gap-3 pt-6 border-t border-white/10 mt-auto">
                    <Button onClick={handleSubmitEdit} className="flex-1 font-semibold" disabled={updateMutation.isPending}>Guardar Alterações</Button>
                    <Button variant="destructive" size="icon" onClick={() => deleteMutation.mutate(selectedItem.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TabsContent>

                {/* Localizacao Tab */}
                <TabsContent value="localizacao" className="space-y-6">
                  <div className="p-4 rounded-xl border border-white/10 bg-white/5">
                    <p className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">Localização Atual</p>
                    <LocationBadge tipo={selectedItem.localizacao_tipo} nome={selectedItem.localizacao_nome || 'Não definida'} />
                    {selectedItem.responsavel_nome && (
                      <div className="flex items-center gap-2 text-sm text-slate-300 mt-3 pt-3 border-t border-white/10">
                        <User className="h-4 w-4" /> Em posse de: {selectedItem.responsavel_nome}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-white">Atualizar Local</h3>
                    <Input placeholder="Pesquisar..." value={locSearch} onChange={e => setLocSearch(e.target.value)} className="bg-white/5 border-white/10" />
                    <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                      {localizacoes.filter(l => l.nome.toLowerCase().includes(locSearch.toLowerCase())).map((loc, idx) => {
                        const Icon = LOC_ICON[loc.tipo] || MapPin;
                        const isSelected = locSelected?.tipo === loc.tipo && locSelected?.ref_id === loc.ref_id;
                        return (
                          <button
                            key={`${loc.tipo}-${loc.ref_id ?? idx}`}
                            onClick={() => setLocSelected(loc)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${isSelected ? 'border-primary bg-primary/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}
                          >
                            <Icon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-slate-400'}`} />
                            <span className="flex-1 text-sm font-medium">{loc.nome}</span>
                            {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                          </button>
                        );
                      })}
                    </div>
                    <Button onClick={handleSubmitLoc} disabled={!locSelected || locMutation.isPending} className="w-full font-semibold">
                      Confirmar Transferência
                    </Button>
                  </div>
                </TabsContent>

                {/* Historico Tab */}
                <TabsContent value="historico" className="space-y-6">
                  {ocupacoes.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-primary">Próximas Sessões Reservadas</p>
                      {ocupacoes.map(o => (
                        <div key={o.aula_id} className="p-3 rounded-xl border border-primary/20 bg-primary/5 text-sm">
                          <p className="font-semibold">{o.estabelecimento_nome}</p>
                          <p className="text-slate-400 mt-1">{o.data_hora ? formatDistanceToNow(parseISO(o.data_hora), { locale: pt, addSuffix: true }) : '-'}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Histórico Passado</p>
                    {historico.length === 0 ? (
                      <p className="text-sm text-slate-400 py-4">Sem histórico registado.</p>
                    ) : (
                      <div className="space-y-3 border-l-2 border-white/10 pl-4 ml-2">
                        {historico.map((h, i) => (
                          <div key={i} className="relative">
                            <div className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-background bg-slate-400" />
                            <p className="text-sm font-medium">{h.user_nome}</p>
                            <p className="text-xs text-slate-500">{h.data_utilizacao ? formatDistanceToNow(parseISO(h.data_utilizacao), { locale: pt, addSuffix: true }) : '-'}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Equipamento;
