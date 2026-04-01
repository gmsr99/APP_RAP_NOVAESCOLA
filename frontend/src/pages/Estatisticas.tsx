import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, Clock, Music, Star, MessageSquare, Building2, Calendar, Layers, FileSpreadsheet, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, Tooltip, Legend } from 'recharts';
import { useProfile } from '@/contexts/ProfileContext';
import { ExportAtividadesModal } from '@/components/ExportAtividadesModal';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Projeto { id: number; nome: string }

interface TurmaStats {
  turma_id: number;
  turma_nome: string;
  disciplina_id: number | null;
  disciplina_nome: string | null;
  horas_previstas: number | null;
  musicas_previstas: number | null;
  horas_realizadas: number;
  sessoes_realizadas: number;
  sessoes_previstas: number;
  musicas_em_curso: number;
  musicas_concluidas: number;
}

interface EstabStats {
  estabelecimento_id: number;
  estabelecimento_nome: string;
  turmas: TurmaStats[];
}

interface EquipaHoras {
  user_id: string;
  nome: string;
  horas_aulas: number;
  horas_autonomo: number;
  sessoes_aulas: number;
  sessoes_autonomo: number;
}

interface FeedbackItem {
  id: number;
  avaliacao: number;
  obs_termino: string | null;
  data_hora: string;
  duracao_minutos: number;
  turma_id: number | null;
  turma_nome: string | null;
  estab_id: number | null;
  estab_nome: string | null;
  mentor_nome: string | null;
  mentor_user_id: string | null;
  disciplina_id: number | null;
  disciplina_nome: string | null;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function Estatisticas() {
  const { profile } = useProfile();
  const canExport = profile === 'direcao' || profile === 'it_support';

  const [selectedProjetoId, setSelectedProjetoId] = useState<string>('');
  const [mentorFilter, setMentorFilter] = useState('all');
  const [disciplinaFilter, setDisciplinaFilter] = useState('all');
  const [instituicaoFilter, setInstituicaoFilter] = useState('all');
  const [exportOpen, setExportOpen] = useState(false);

  // ─── Queries ────────────────────────────────────────────────────────────────

  const { data: projetos = [] } = useQuery({
    queryKey: ['projetos'],
    queryFn: async () => (await api.get('/api/projetos')).data as Projeto[],
  });

  const projetoId = selectedProjetoId ? parseInt(selectedProjetoId) : null;

  const { data: statsInstituicao = [] } = useQuery({
    queryKey: ['producao-stats-inst', projetoId],
    queryFn: async () => {
      const url = projetoId
        ? `/api/producao/stats/instituicao?projeto_id=${projetoId}`
        : '/api/producao/stats/instituicao';
      return (await api.get(url)).data as EstabStats[];
    },
    enabled: !!projetoId,
  });

  const { data: feedbackData = [] } = useQuery({
    queryKey: ['stats-feedback', projetoId],
    queryFn: async () => {
      const url = projetoId
        ? `/api/stats/feedback?projeto_id=${projetoId}`
        : '/api/stats/feedback';
      return (await api.get(url)).data as FeedbackItem[];
    },
    enabled: !!projetoId,
  });

  const { data: equipaHoras = [] } = useQuery({
    queryKey: ['stats-equipa-horas', projetoId],
    queryFn: async () => {
      const url = projetoId
        ? `/api/stats/equipa-horas?projeto_id=${projetoId}`
        : '/api/stats/equipa-horas';
      return (await api.get(url)).data as EquipaHoras[];
    },
    enabled: !!projetoId,
  });

  // ─── Computed KPIs ──────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const allTurmas = statsInstituicao.flatMap(e => e.turmas);
    const totalHoras = allTurmas.reduce((s, t) => s + (t.horas_previstas || 0), 0);
    const totalHorasRealizadas = allTurmas.reduce((s, t) => s + t.horas_realizadas, 0);
    const totalMusicasPrev = allTurmas.reduce((s, t) => s + (t.musicas_previstas || 0), 0);
    const totalConcluidas = allTurmas.reduce((s, t) => s + t.musicas_concluidas, 0);
    const totalEmCurso = allTurmas.reduce((s, t) => s + t.musicas_em_curso, 0);
    const avgRating = feedbackData.length > 0
      ? feedbackData.reduce((s, f) => s + f.avaliacao, 0) / feedbackData.length
      : 0;
    return { totalHoras, totalHorasRealizadas, totalMusicasPrev, totalConcluidas, totalEmCurso, avgRating, totalSessoes: feedbackData.length };
  }, [statsInstituicao, feedbackData]);

  // ─── Feedback filters ───────────────────────────────────────────────────────

  const mentors = useMemo(() => {
    const map = new Map<string, string>();
    feedbackData.forEach(f => { if (f.mentor_user_id && f.mentor_nome) map.set(f.mentor_user_id, f.mentor_nome); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [feedbackData]);

  const disciplinas = useMemo(() => {
    const map = new Map<number, string>();
    feedbackData.forEach(f => { if (f.disciplina_id && f.disciplina_nome) map.set(f.disciplina_id, f.disciplina_nome); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [feedbackData]);

  const instituicoes = useMemo(() => {
    const map = new Map<number, string>();
    feedbackData.forEach(f => { if (f.estab_id && f.estab_nome) map.set(f.estab_id, f.estab_nome); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [feedbackData]);

  const filteredFeedback = useMemo(() => {
    return feedbackData.filter(f => {
      if (mentorFilter !== 'all' && f.mentor_user_id !== mentorFilter) return false;
      if (disciplinaFilter !== 'all' && String(f.disciplina_id) !== disciplinaFilter) return false;
      if (instituicaoFilter !== 'all' && String(f.estab_id) !== instituicaoFilter) return false;
      return true;
    });
  }, [feedbackData, mentorFilter, disciplinaFilter, instituicaoFilter]);

  const ratingDistribution = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    filteredFeedback.forEach(f => { if (f.avaliacao >= 1 && f.avaliacao <= 5) counts[f.avaliacao - 1]++; });
    return [1, 2, 3, 4, 5].map(r => ({ rating: `${r}`, count: counts[r - 1] }));
  }, [filteredFeedback]);

  const filteredAvgRating = useMemo(() => {
    if (filteredFeedback.length === 0) return 0;
    return filteredFeedback.reduce((s, f) => s + f.avaliacao, 0) / filteredFeedback.length;
  }, [filteredFeedback]);

  const RATING_COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (!projetoId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" /> Estatísticas
          </h1>
        </div>

        <div className="max-w-4xl mx-auto mt-8 space-y-8">
          <div className="text-center space-y-2">
            <BarChart3 className="h-12 w-12 mx-auto mb-2 text-primary/60" />
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Bem-vindo(a) às Estatísticas</h2>
            <p className="text-muted-foreground text-sm sm:text-base">Por favor, selecione um projeto na lista abaixo para visualizar o seu progresso, feedback e detalhes.</p>
          </div>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {projetos.map((projeto) => (
              <Card
                key={projeto.id}
                className="cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all duration-200 group"
                onClick={() => setSelectedProjetoId(String(projeto.id))}
              >
                <CardContent className="h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Layers className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg line-clamp-2">{projeto.nome}</h3>
                </CardContent>
              </Card>
            ))}
          </div>

          {projetos.length === 0 && (
            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
              Não existem projetos disponíveis.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" /> Estatísticas
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          {canExport && projetoId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportOpen(true)}
              className="gap-2 text-green-600 border-green-600/40 hover:bg-green-50 dark:hover:bg-green-950/30"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Exportar Dados
            </Button>
          )}
          <ProjetoSelect projetos={projetos} value={selectedProjetoId} onChange={setSelectedProjetoId} />
        </div>
      </div>

      {/* Modal de Export */}
      {canExport && (
        <ExportAtividadesModal
          open={exportOpen}
          onOpenChange={setExportOpen}
        />
      )}

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Horas</p>
                <p className="text-2xl font-bold">{kpis.totalHorasRealizadas}<span className="text-sm font-normal text-muted-foreground">h / {kpis.totalHoras}h</span></p>
              </div>
            </div>
            <Progress value={kpis.totalHoras > 0 ? (kpis.totalHorasRealizadas / kpis.totalHoras) * 100 : 0} className="mt-3 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Music className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Músicas</p>
                <p className="text-2xl font-bold">{kpis.totalConcluidas}<span className="text-sm font-normal text-muted-foreground"> / {kpis.totalMusicasPrev}</span></p>
              </div>
            </div>
            <Progress value={kpis.totalMusicasPrev > 0 ? (kpis.totalConcluidas / kpis.totalMusicasPrev) * 100 : 0} className="mt-3 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Star className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avaliação Média</p>
                <p className="text-2xl font-bold">{kpis.avgRating > 0 ? kpis.avgRating.toFixed(1) : '—'}<span className="text-sm font-normal text-muted-foreground"> / 5</span></p>
              </div>
            </div>
            <div className="flex gap-0.5 mt-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} className={cn('h-4 w-4', i <= Math.round(kpis.avgRating) ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/30')} />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sessões Terminadas</p>
                <p className="text-2xl font-bold">{kpis.totalSessoes}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">{kpis.totalEmCurso} música{kpis.totalEmCurso !== 1 ? 's' : ''} em curso</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="aulas" className="w-full">
        <TabsList>
          <TabsTrigger value="aulas" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Aulas
          </TabsTrigger>
          <TabsTrigger value="equipa" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Equipa
          </TabsTrigger>
          <TabsTrigger value="feedback" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" /> Feedback
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab: Aulas ─────────────────────────────────────────────────── */}
        <TabsContent value="aulas" className="mt-4 space-y-4">
          {statsInstituicao.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Sem dados de progresso.
            </div>
          ) : (
            statsInstituicao.map(estab => {
              const totalHoras = estab.turmas.reduce((s, t) => s + (t.horas_previstas || 0), 0);
              const totalHorasR = estab.turmas.reduce((s, t) => s + t.horas_realizadas, 0);
              const totalMusicasPrev = estab.turmas.reduce((s, t) => s + (t.musicas_previstas || 0), 0);
              const totalConcluidas = estab.turmas.reduce((s, t) => s + t.musicas_concluidas, 0);
              const pctHoras = totalHoras > 0 ? Math.round((totalHorasR / totalHoras) * 100) : 0;
              const pctMusicas = totalMusicasPrev > 0 ? Math.round((totalConcluidas / totalMusicasPrev) * 100) : 0;

              return (
                <Card key={estab.estabelecimento_id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {estab.estabelecimento_nome}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center gap-1.5 font-medium"><Clock className="h-3.5 w-3.5" /> Horas</span>
                          <span className="text-muted-foreground">{totalHorasR}h / {totalHoras || '?'}h ({pctHoras}%)</span>
                        </div>
                        <Progress value={pctHoras} className="h-2.5" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center gap-1.5 font-medium"><Music className="h-3.5 w-3.5" /> Músicas</span>
                          <span className="text-muted-foreground">{totalConcluidas} / {totalMusicasPrev || '?'} ({pctMusicas}%)</span>
                        </div>
                        <Progress value={pctMusicas} className="h-2.5" />
                      </div>
                    </div>

                    <div className="border rounded-md overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="text-xs">Turma / Disciplina</TableHead>
                            <TableHead className="text-xs text-center">Horas</TableHead>
                            <TableHead className="text-xs text-center">Sessões</TableHead>
                            <TableHead className="text-xs text-center">%</TableHead>
                            <TableHead className="text-xs text-center">Músicas</TableHead>
                            <TableHead className="text-xs text-center">%</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {estab.turmas.map(t => {
                            const pH = t.horas_previstas ? Math.round((t.horas_realizadas / t.horas_previstas) * 100) : 0;
                            const pM = t.musicas_previstas ? Math.round((t.musicas_concluidas / t.musicas_previstas) * 100) : 0;
                            return (
                              <TableRow key={`${t.turma_id}-${t.disciplina_id ?? 'none'}`}>
                                <TableCell className="text-xs font-medium">
                                  {t.turma_nome}
                                  {t.disciplina_nome && <span className="text-muted-foreground font-normal"> — {t.disciplina_nome}</span>}
                                </TableCell>
                                <TableCell className="text-xs text-center">
                                  {t.horas_realizadas}h / {t.horas_previstas != null ? `${t.horas_previstas}h` : '?'}
                                </TableCell>
                                <TableCell className="text-xs text-center">{t.sessoes_realizadas} / {t.sessoes_previstas || '?'}</TableCell>
                                <TableCell className="text-xs text-center">
                                  <Badge variant="secondary" className={cn('text-xs', pH >= 75 ? 'bg-green-100 text-green-700' : pH >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-muted')}>
                                    {pH}%
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-center">
                                  {t.musicas_concluidas} / {t.musicas_previstas ?? '?'}
                                </TableCell>
                                <TableCell className="text-xs text-center">
                                  <Badge variant="secondary" className={cn('text-xs', pM >= 75 ? 'bg-green-100 text-green-700' : pM >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-muted')}>
                                    {pM}%
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ─── Tab: Equipa ─────────────────────────────────────────────────── */}
        <TabsContent value="equipa" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Horas por Colaborador
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Sessões-aula vs. trabalho autónomo
              </p>
            </CardHeader>
            <CardContent>
              {equipaHoras.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Sem dados de equipa.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(300, equipaHoras.length * 56)}>
                  <BarChart
                    data={equipaHoras}
                    layout="vertical"
                    margin={{ left: 10, right: 50, top: 5, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(213 15% 30%)" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 12, fill: 'hsl(213 10% 60%)' }}
                      unit="h"
                      axisLine={{ stroke: 'hsl(213 15% 30%)' }}
                      tickLine={{ stroke: 'hsl(213 15% 30%)' }}
                    />
                    <YAxis
                      type="category"
                      dataKey="nome"
                      tick={{ fontSize: 12, fill: 'hsl(0 0% 90%)' }}
                      width={140}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={false}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload as EquipaHoras;
                        return (
                          <div className="rounded-lg border border-border/50 bg-[hsl(213_24%_16%)] px-3 py-2 text-xs shadow-xl">
                            <p className="font-medium text-foreground mb-1.5">{d.nome}</p>
                            <div className="space-y-1">
                              <p><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5" style={{ backgroundColor: 'hsl(186 64% 57%)' }} />Sessões Aula: <strong>{d.sessoes_aulas}</strong> sessões / <strong>{d.horas_aulas.toFixed(1)}</strong>h</p>
                              <p><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5" style={{ backgroundColor: 'hsl(12 85% 55%)' }} />Trabalho Autónomo: <strong>{d.sessoes_autonomo}</strong> sessões / <strong>{d.horas_autonomo.toFixed(1)}</strong>h</p>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 12, color: 'hsl(213 10% 60%)' }}
                      formatter={(value) =>
                        value === 'horas_aulas' ? 'Sessões Aula' : 'Trabalho Autónomo'
                      }
                    />
                    <Bar
                      dataKey="horas_aulas"
                      name="horas_aulas"
                      stackId="horas"
                      fill="hsl(186 64% 57%)"
                      radius={[0, 0, 0, 0]}
                      maxBarSize={28}
                    />
                    <Bar
                      dataKey="horas_autonomo"
                      name="horas_autonomo"
                      stackId="horas"
                      fill="hsl(12 85% 55%)"
                      radius={[0, 4, 4, 0]}
                      maxBarSize={28}
                      label={{
                        position: 'right',
                        fontSize: 11,
                        fill: 'hsl(213 10% 60%)',
                        formatter: (_: unknown, __: unknown, index: number) => {
                          const item = equipaHoras[index];
                          if (!item) return '';
                          const total = item.horas_aulas + item.horas_autonomo;
                          return `${total.toFixed(1)}h`;
                        },
                      } as any}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab: Feedback ───────────────────────────────────────────────── */}
        <TabsContent value="feedback" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select value={mentorFilter} onValueChange={setMentorFilter}>
              <SelectTrigger><SelectValue placeholder="Mentor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os mentores</SelectItem>
                {mentors.map(([uid, name]) => <SelectItem key={uid} value={uid}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={disciplinaFilter} onValueChange={setDisciplinaFilter}>
              <SelectTrigger><SelectValue placeholder="Disciplina" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as disciplinas</SelectItem>
                {disciplinas.map(([id, name]) => <SelectItem key={id} value={String(id)}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={instituicaoFilter} onValueChange={setInstituicaoFilter}>
              <SelectTrigger><SelectValue placeholder="Instituição" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as instituições</SelectItem>
                {instituicoes.map(([id, name]) => <SelectItem key={id} value={String(id)}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Rating Distribution Chart */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Distribuição de Avaliações
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {filteredFeedback.length} sessão(ões) — Média: <strong>{filteredAvgRating > 0 ? filteredAvgRating.toFixed(1) : '—'}</strong>/5
                </p>
              </CardHeader>
              <CardContent>
                {filteredFeedback.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem dados de avaliação.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={ratingDistribution} layout="vertical" margin={{ left: 10, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(213 15% 30%)" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: 'hsl(213 10% 60%)' }} axisLine={{ stroke: 'hsl(213 15% 30%)' }} tickLine={{ stroke: 'hsl(213 15% 30%)' }} />
                      <YAxis type="category" dataKey="rating" tick={{ fontSize: 12, fill: 'hsl(0 0% 90%)' }} width={20} tickFormatter={(v) => `${v}`} axisLine={false} tickLine={false} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
                        {ratingDistribution.map((_, i) => (
                          <Cell key={i} fill={RATING_COLORS[i]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Feedback List */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Observações das Sessões
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {filteredFeedback.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Sem feedback disponível.</p>
                  ) : (
                    filteredFeedback.map(f => (
                      <div key={f.id} className="border rounded-md p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm">
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map(i => (
                                <Star key={i} className={cn('h-3 w-3', i <= f.avaliacao ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/30')} />
                              ))}
                            </div>
                            <span className="font-medium">{f.mentor_nome || 'Desconhecido'}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {f.data_hora ? format(new Date(f.data_hora), "d MMM yyyy", { locale: pt }) : '—'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {f.turma_nome && <Badge variant="outline" className="text-xs">{f.turma_nome}</Badge>}
                          {f.disciplina_nome && <Badge variant="outline" className="text-xs">{f.disciplina_nome}</Badge>}
                          {f.estab_nome && <Badge variant="secondary" className="text-xs">{f.estab_nome}</Badge>}
                        </div>
                        {f.obs_termino ? (
                          <p className="text-sm text-muted-foreground">{f.obs_termino}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Sem observações.</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

function ProjetoSelect({ projetos, value, onChange }: { projetos: Projeto[]; value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value || 'none'} onValueChange={(v) => onChange(v === 'none' ? '' : v)}>
      <SelectTrigger className="w-full sm:w-[220px]">
        <SelectValue placeholder="Selecionar projeto" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Selecionar projeto</SelectItem>
        {projetos.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
