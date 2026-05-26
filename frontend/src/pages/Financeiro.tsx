import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Download, Pencil, Euro } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Projeto {
  id: number;
  nome: string;
}

interface Membro {
  id: string;
  full_name: string;
  role: string;
  valor_hora?: number;
}

interface HonorarioGrupo {
  descricao: string;
  horas: number;
  valor_hora: number;
  valor: number;
}

interface HonorarioPreview {
  grupos: HonorarioGrupo[];
  subtotal: number;
  total_horas: number;
  valor_hora: number;
  prestador_nome: string;
  mes: number;
  ano: number;
  num_sessoes: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MESES = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

const currentYear = new Date().getFullYear();
const ANOS = [currentYear - 1, currentYear, currentYear + 1].map(String);

// ─── Component ───────────────────────────────────────────────────────────────

const Financeiro = () => {
  const { user } = useAuth();
  const { isCoordenacao, isDirecao } = useProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isCoord = isCoordenacao || isDirecao;
  const canManageRates = isDirecao;

  // Selectors state
  const [projetoId, setProjetoId] = useState<string>('');
  const [mes, setMes] = useState<string>(String(new Date().getMonth() + 1));
  const [ano, setAno] = useState<string>(String(currentYear));
  const [targetUserId, setTargetUserId] = useState<string>('');

  // Rates management
  const [ratesProjId, setRatesProjId] = useState<string>('');
  const [editingRate, setEditingRate] = useState<{ userId: string; value: string } | null>(null);

  // Financial data dialog
  const [dadosOpen, setDadosOpen] = useState(false);
  const [dadosForm, setDadosForm] = useState({ nif: '', morada: '', cod_postal: '', funcao: '' });

  // ─── Queries ───────────────────────────────────────────────────────────────

  const { data: projetos = [] } = useQuery<Projeto[]>({
    queryKey: ['projetos'],
    queryFn: async () => (await api.get('/api/projetos')).data,
  });

  const { data: equipa = [] } = useQuery<Membro[]>({
    queryKey: ['equipa'],
    queryFn: async () => (await api.get('/api/equipa')).data,
    enabled: isCoord,
  });

  const { data: myRate } = useQuery<{ valor_hora: number }>({
    queryKey: ['my-rate', projetoId],
    queryFn: async () => (await api.get(`/api/honorarios/my-rate/${projetoId}`)).data,
    enabled: !!projetoId,
  });

  const previewParams = { projeto_id: projetoId, mes, ano, target_user_id: targetUserId || undefined };
  const { data: preview, isLoading: previewLoading, error: previewError } = useQuery<HonorarioPreview>({
    queryKey: ['honorario-preview', previewParams],
    queryFn: async () => {
      const params: Record<string, string> = { projeto_id: projetoId, mes, ano };
      if (targetUserId) params.target_user_id = targetUserId;
      return (await api.get('/api/honorarios/preview', { params })).data;
    },
    enabled: !!projetoId && !!mes && !!ano,
    retry: false,
  });

  const { data: rates = [] } = useQuery<Membro[]>({
    queryKey: ['rates', ratesProjId],
    queryFn: async () => (await api.get(`/api/honorarios/rates/${ratesProjId}`)).data,
    enabled: !!ratesProjId && canManageRates,
  });

  // My own financial profile (nif, morada, funcao)
  const { data: myProfile } = useQuery({
    queryKey: ['equipa-me'],
    queryFn: async () => (await api.get('/api/equipa')).data.find((m: Membro) => m.id === user?.id),
  });

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const downloadMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { projeto_id: parseInt(projetoId), mes: parseInt(mes), ano: parseInt(ano) };
      if (targetUserId) payload.target_user_id = targetUserId;
      return api.post('/api/honorarios/gerar', payload, { responseType: 'blob' });
    },
    onSuccess: (res) => {
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `honorario_${mes.padStart(2, '0')}_${ano}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Download iniciado', description: 'O ficheiro XLSX foi gerado.' });
    },
    onError: (err: any) => toast({
      title: 'Erro',
      description: err?.response?.data?.detail || 'Falha ao gerar nota.',
      variant: 'destructive',
    }),
  });

  const saveRateMutation = useMutation({
    mutationFn: ({ userId, valor_hora }: { userId: string; valor_hora: number }) =>
      api.put(`/api/honorarios/rates/${ratesProjId}/${userId}`, { valor_hora }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rates', ratesProjId] });
      setEditingRate(null);
      toast({ title: 'Rate guardado' });
    },
    onError: () => toast({ title: 'Erro', description: 'Falha ao guardar rate.', variant: 'destructive' }),
  });

  const saveDadosMutation = useMutation({
    mutationFn: () => api.patch('/api/profile/financeiro', dadosForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipa-me'] });
      setDadosOpen(false);
      toast({ title: 'Dados financeiros guardados' });
    },
    onError: () => toast({ title: 'Erro', description: 'Falha ao guardar dados.', variant: 'destructive' }),
  });

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const openDadosDialog = () => {
    setDadosForm({
      nif: (myProfile as any)?.nif || '',
      morada: (myProfile as any)?.morada || '',
      cod_postal: (myProfile as any)?.cod_postal || '',
      funcao: (myProfile as any)?.funcao || '',
    });
    setDadosOpen(true);
  };

  const previewErrorMsg = (previewError as any)?.response?.data?.detail || null;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gera notas de honorários com pré-preenchimento automático das sessões realizadas.</p>
        </div>
      </div>

      <Tabs defaultValue="gerar">
        <TabsList>
          <TabsTrigger value="gerar">Gerar Nota</TabsTrigger>
          <TabsTrigger value="dados">Os Meus Dados</TabsTrigger>
          {canManageRates && <TabsTrigger value="rates">Gestão de Rates</TabsTrigger>}
        </TabsList>

        {/* ── Tab: Gerar Nota ── */}
        <TabsContent value="gerar" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Parâmetros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Projeto</Label>
                  <Select value={projetoId} onValueChange={setProjetoId}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecionar projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      {projetos.map(p => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Mês</Label>
                  <Select value={mes} onValueChange={setMes}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MESES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ano</Label>
                  <Select value={ano} onValueChange={setAno}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ANOS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isCoord && (
                <div className="space-y-1">
                  <Label className="text-xs">Gerar para outro utilizador (opcional)</Label>
                  <Select value={targetUserId || '__self'} onValueChange={v => setTargetUserId(v === '__self' ? '' : v)}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Próprio utilizador" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__self">Próprio utilizador</SelectItem>
                      {equipa.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {projetoId && myRate !== undefined && !targetUserId && (
                <p className="text-xs text-muted-foreground">
                  Valor/hora configurado: <span className="font-medium text-foreground">{myRate.valor_hora.toFixed(2)} €/h</span>
                  {myRate.valor_hora === 0 && <span className="text-amber-500 ml-1">— configura na aba "Gestão de Rates" ou pede ao coordenador.</span>}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Preview */}
          {projetoId && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Pré-visualização</CardTitle>
              </CardHeader>
              <CardContent>
                {previewLoading && <p className="text-sm text-muted-foreground">A carregar...</p>}
                {previewErrorMsg && (
                  <p className="text-sm text-destructive">{previewErrorMsg}</p>
                )}
                {preview && !previewLoading && (
                  <div className="space-y-3">
                    <div className="text-xs text-muted-foreground">
                      {preview.num_sessoes} sessão(ões) · {preview.total_horas.toFixed(1)}h total · prestador: {preview.prestador_nome || '—'}
                    </div>
                    {preview.grupos.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Atividade</TableHead>
                            <TableHead className="text-xs text-right w-16">Horas</TableHead>
                            <TableHead className="text-xs text-right w-20">€/h</TableHead>
                            <TableHead className="text-xs text-right w-20">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {preview.grupos.map((g, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-sm">{g.descricao}</TableCell>
                              <TableCell className="text-sm text-right">{g.horas.toFixed(2)}</TableCell>
                              <TableCell className="text-sm text-right">{g.valor_hora.toFixed(2)}</TableCell>
                              <TableCell className="text-sm text-right font-medium">{g.valor.toFixed(2)} €</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/50 font-semibold">
                            <TableCell colSpan={3} className="text-sm text-right">Subtotal</TableCell>
                            <TableCell className="text-sm text-right">{preview.subtotal.toFixed(2)} €</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhuma sessão encontrada para este mês.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Button
            disabled={!projetoId || downloadMutation.isPending}
            onClick={() => downloadMutation.mutate()}
            className="w-full sm:w-auto"
          >
            <Download className="w-4 h-4 mr-2" />
            {downloadMutation.isPending ? 'A gerar...' : 'Gerar e Descarregar XLSX'}
          </Button>
        </TabsContent>

        {/* ── Tab: Os Meus Dados ── */}
        <TabsContent value="dados" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Dados para a nota de honorários</CardTitle>
                <Button variant="outline" size="sm" onClick={openDadosDialog}>
                  <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-y-3 text-sm">
                <span className="text-muted-foreground">NIF</span>
                <span>{(myProfile as any)?.nif || <span className="text-muted-foreground italic">Não definido</span>}</span>
                <span className="text-muted-foreground">Função</span>
                <span>{(myProfile as any)?.funcao || <span className="text-muted-foreground italic">Não definida</span>}</span>
                <span className="text-muted-foreground">Morada</span>
                <span>{(myProfile as any)?.morada || <span className="text-muted-foreground italic">Não definida</span>}</span>
                <span className="text-muted-foreground">Cód. Postal</span>
                <span>{(myProfile as any)?.cod_postal || <span className="text-muted-foreground italic">Não definido</span>}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Estes dados serão incluídos automaticamente na nota de honorários. O valor/hora é configurado por projeto.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Gestão de Rates (coordenadores) ── */}
        {canManageRates && (
          <TabsContent value="rates" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Valor/hora por utilizador</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Projeto</Label>
                  <Select value={ratesProjId} onValueChange={setRatesProjId}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecionar projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      {projetos.map(p => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {ratesProjId && rates.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Utilizador</TableHead>
                        <TableHead className="text-xs">Função</TableHead>
                        <TableHead className="text-xs text-right w-28">€/hora</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rates.map(m => (
                        <TableRow key={m.id}>
                          <TableCell className="text-sm font-medium">{m.full_name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{m.role}</TableCell>
                          <TableCell className="text-sm text-right">
                            {editingRate?.userId === m.id ? (
                              <div className="flex items-center gap-1 justify-end">
                                <Input
                                  type="number"
                                  min={0}
                                  step={0.5}
                                  value={editingRate.value}
                                  onChange={e => setEditingRate(r => r ? { ...r, value: e.target.value } : r)}
                                  className="h-7 w-20 text-xs text-right"
                                  autoFocus
                                />
                                <Button
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => saveRateMutation.mutate({ userId: m.id, valor_hora: parseFloat(editingRate.value) || 0 })}
                                  disabled={saveRateMutation.isPending}
                                >
                                  OK
                                </Button>
                              </div>
                            ) : (
                              <span className="font-medium">{(m.valor_hora ?? 0).toFixed(2)} €</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingRate?.userId !== m.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setEditingRate({ userId: m.id, value: String(m.valor_hora ?? 0) })}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {ratesProjId && rates.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum utilizador com acesso a este projeto.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Edit financial data dialog */}
      <Dialog open={dadosOpen} onOpenChange={setDadosOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Euro className="h-4 w-4" /> Dados Financeiros Pessoais
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">NIF</Label>
              <Input value={dadosForm.nif} onChange={e => setDadosForm(f => ({ ...f, nif: e.target.value }))} placeholder="XXXXXXXXX" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Função</Label>
              <Input value={dadosForm.funcao} onChange={e => setDadosForm(f => ({ ...f, funcao: e.target.value }))} placeholder="Ex: Mentor de Música" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Morada</Label>
              <Input value={dadosForm.morada} onChange={e => setDadosForm(f => ({ ...f, morada: e.target.value }))} placeholder="Rua..." className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cód. Postal</Label>
              <Input value={dadosForm.cod_postal} onChange={e => setDadosForm(f => ({ ...f, cod_postal: e.target.value }))} placeholder="0000-000" className="h-9 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDadosOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveDadosMutation.mutate()} disabled={saveDadosMutation.isPending}>
              {saveDadosMutation.isPending ? 'A guardar...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Financeiro;
