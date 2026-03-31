import { useState } from 'react';
import * as XLSX from 'xlsx-js-style';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FileSpreadsheet,
  Download,
  Layers,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Projeto {
  id: number;
  nome: string;
}

interface ExportAtividadesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se fornecido (página de Estatísticas), salta a etapa de seleção de projeto. */
  projetoId?: number | null;
  projetoNome?: string | null;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const TIPO_SESSAO_OPTIONS = [
  { value: 'todas', label: 'Todas (presenciais + autónomas)' },
  { value: 'presenciais', label: 'Apenas presenciais' },
  { value: 'autonomas', label: 'Apenas autónomas' },
];

const ESTADO_OPTIONS = [
  { value: 'terminada',  label: 'Terminadas'  },
  { value: 'confirmada', label: 'Confirmadas' },
  { value: 'pendente',   label: 'Pendentes'   },
  { value: 'recusada',   label: 'Recusadas'   },
  { value: 'cancelada',  label: 'Canceladas'  },
  { value: 'rascunho',   label: 'Rascunhos'   },
  { value: 'concluida',  label: 'Concluídas'  },
];

const TIPO_LABELS: Record<string, string> = {
  teorica:            'Teórica',
  pratica_escrita:    'Prática Escrita',
  pratica_gravacao:   'Prática Gravação',
  producao_musical:   'Produção Musical',
  ensaio:             'Ensaio',
  showcase:           'Showcase',
  trabalho_autonomo:  'Trabalho Autónomo',
};

const ESTADO_LABELS: Record<string, string> = {
  rascunho:  'Rascunho',
  pendente:  'Pendente',
  confirmada:'Confirmada',
  recusada:  'Recusada',
  em_curso:  'Em Curso',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  terminada: 'Terminada',
};

type ExportRow = {
  atividade_codigo?: string | null;
  data_fmt?: string | null;
  hora_inicio?: string | null;
  hora_fim?: string | null;
  duracao_horas?: number | null;
  tipo?: string | null;
  estado?: string | null;
  is_autonomous?: boolean | null;
  colaborador?: string | null;
  turma_nome?: string | null;
  estabelecimento_nome?: string | null;
  tema?: string | null;
  tipo_atividade?: string | null;
  objetivos?: string | null;
  sumario?: string | null;
  avaliacao?: number | null;
  obs_termino?: string | null;
  observacoes?: string | null;
};

// ─── Geração do XLSX ─────────────────────────────────────────────────────────

function gerarXLSX(rows: ExportRow[], projetoNome: string, tipoLabel: string, estadosLabel: string) {
  const wb = XLSX.utils.book_new();

  // ── Metadados do workbook ──
  wb.Props = {
    Title: `Atividades - ${projetoNome}`,
    Subject: 'Export de Atividades RAP Nova Escola',
    Author: 'RAP Nova Escola',
    CreatedDate: new Date(),
  };

  // ── Dados da folha ──
  const dataGerado = new Date().toLocaleString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  // Cabeçalho informativo (4 linhas antes da tabela de dados)
  const headerRows = [
    ['RAP Nova Escola — Exportação de Atividades'],
    [`Projeto: ${projetoNome}`],
    [`Filtros: ${tipoLabel} · Estados: ${estadosLabel}`],
    [`Gerado em: ${dataGerado}    Total: ${rows.length} registo(s)`],
    [], // linha vazia separadora
  ];

  // Colunas da tabela de dados
  const colHeaders = [
    'Código',
    'Data',
    'Hora Início',
    'Hora Fim',
    'Duração (h)',
    'Tipo',
    'Estado',
    'Autónoma?',
    'Colaborador',
    'Turma',
    'Escola',
    'Tema / Atividade',
    'Objetivos',
    'Sumário',
    'Avaliação',
    'Observações Termino',
    'Observações Gerais',
  ];

  const dataRows = rows.map((r) => [
    r.atividade_codigo ?? '',
    r.data_fmt         ?? '',
    r.hora_inicio      ?? '',
    r.hora_fim         ?? '',
    r.duracao_horas    ?? '',
    TIPO_LABELS[r.tipo] ?? r.tipo ?? '',
    ESTADO_LABELS[r.estado] ?? r.estado ?? '',
    r.is_autonomous ? 'Sim' : 'Não',
    r.colaborador      ?? '',
    r.turma_nome       ?? '',
    r.estabelecimento_nome ?? '',
    r.tema ?? r.tipo_atividade ?? '',
    r.objetivos        ?? '',
    r.sumario          ?? '',
    r.avaliacao != null ? `${r.avaliacao}/5` : '',
    r.obs_termino      ?? '',
    r.observacoes      ?? '',
  ]);

  // Linha de rodapé
  const footerRows = [
    [],
    [`Total de registos exportados: ${rows.length}`],
    [`Exportado por: RAP Nova Escola · ${dataGerado}`],
  ];

  const allSheetData = [
    ...headerRows,
    colHeaders,
    ...dataRows,
    ...footerRows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(allSheetData);
  const tableHeaderRowIndex = headerRows.length;
  const firstDataRowIndex = tableHeaderRowIndex + 1;
  const lastDataRowIndex = firstDataRowIndex + dataRows.length - 1;
  const footerStartRowIndex = lastDataRowIndex + 2;
  const lastColumnIndex = colHeaders.length - 1;

  // ── Larguras das colunas ──
  ws['!cols'] = [
    { wch: 14 }, // Código
    { wch: 12 }, // Data
    { wch: 10 }, // Hora Início
    { wch: 10 }, // Hora Fim
    { wch: 12 }, // Duração
    { wch: 20 }, // Tipo
    { wch: 14 }, // Estado
    { wch: 10 }, // Autónoma
    { wch: 24 }, // Colaborador
    { wch: 20 }, // Turma
    { wch: 28 }, // Escola
    { wch: 30 }, // Tema
    { wch: 36 }, // Objetivos
    { wch: 36 }, // Sumário
    { wch: 12 }, // Avaliação
    { wch: 40 }, // Obs Termino
    { wch: 40 }, // Obs Gerais
  ];

  ws['!rows'] = [
    { hpt: 28 },
    { hpt: 20 },
    { hpt: 20 },
    { hpt: 20 },
    { hpt: 12 },
    { hpt: 22 },
    ...dataRows.map(() => ({ hpt: 30 })),
    { hpt: 10 },
    { hpt: 20 },
    { hpt: 20 },
  ];

  // ── Merge do título principal (linha 1, colunas A–Q) ──
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 16 } }, // RAP Nova Escola
    { s: { r: 1, c: 0 }, e: { r: 1, c: 16 } }, // Projeto
    { s: { r: 2, c: 0 }, e: { r: 2, c: 16 } }, // Filtros
    { s: { r: 3, c: 0 }, e: { r: 3, c: 16 } }, // Gerado em
    { s: { r: footerStartRowIndex, c: 0 }, e: { r: footerStartRowIndex, c: 16 } },
    { s: { r: footerStartRowIndex + 1, c: 0 }, e: { r: footerStartRowIndex + 1, c: 16 } },
  ];

  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: tableHeaderRowIndex, c: 0 },
      e: { r: Math.max(lastDataRowIndex, tableHeaderRowIndex), c: lastColumnIndex },
    }),
  };

  const palette = {
    ink: '2B3544',
    inkSoft: '334155',
    cyanSoft: 'DDF6FA',
    cyan: '4DC4D9',
    paper: 'F5F7FA',
    white: 'FFFFFF',
    slate: '667085',
    line: 'D0D7E2',
    lineDark: '425166',
  };

  const withColor = (rgb: string) => ({ rgb });
  const borderAll = {
    top: { style: 'thin', color: withColor(palette.line) },
    bottom: { style: 'thin', color: withColor(palette.line) },
    left: { style: 'thin', color: withColor(palette.line) },
    right: { style: 'thin', color: withColor(palette.line) },
  };

  const setStyle = (cellRef: string, style: any) => {
    if (!ws[cellRef]) return;
    ws[cellRef].s = style;
  };

  const styleRowRange = (rowIndex: number, styleFactory: (colIndex: number) => any) => {
    for (let colIndex = 0; colIndex <= lastColumnIndex; colIndex += 1) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
      if (!ws[cellRef]) {
        ws[cellRef] = { t: 's', v: '' };
      }
      setStyle(cellRef, styleFactory(colIndex));
    }
  };

  setStyle('A1', {
    font: { bold: true, sz: 16, color: withColor(palette.white) },
    fill: { fgColor: withColor(palette.ink) },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      ...borderAll,
      bottom: { style: 'medium', color: withColor(palette.cyan) },
    },
  });

  for (let rowIndex = 1; rowIndex <= 3; rowIndex += 1) {
    setStyle(`A${rowIndex + 1}`, {
      font: {
        bold: rowIndex === 1,
        sz: rowIndex === 1 ? 11 : 10,
        color: withColor(rowIndex === 3 ? palette.slate : palette.ink),
      },
      fill: { fgColor: withColor(rowIndex === 3 ? palette.paper : palette.cyanSoft) },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: borderAll,
    });
  }

  styleRowRange(tableHeaderRowIndex, () => ({
    font: { bold: true, sz: 10, color: withColor(palette.white) },
    fill: { fgColor: withColor(palette.inkSoft) },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: withColor(palette.lineDark) },
      bottom: { style: 'medium', color: withColor(palette.cyan) },
      left: { style: 'thin', color: withColor(palette.lineDark) },
      right: { style: 'thin', color: withColor(palette.lineDark) },
    },
  }));

  for (let rowIndex = firstDataRowIndex; rowIndex <= lastDataRowIndex; rowIndex += 1) {
    styleRowRange(rowIndex, (colIndex) => ({
      font: {
        sz: 10,
        color: withColor(palette.ink),
        bold: colIndex === 0,
      },
      fill: {
        fgColor: withColor(rowIndex % 2 === 0 ? palette.white : palette.paper),
      },
      alignment: {
        vertical: 'top',
        horizontal: [1, 2, 3, 4, 7, 14].includes(colIndex) ? 'center' : 'left',
        wrapText: true,
      },
      border: borderAll,
    }));
  }

  [footerStartRowIndex, footerStartRowIndex + 1].forEach((rowIndex) => {
    setStyle(XLSX.utils.encode_cell({ r: rowIndex, c: 0 }), {
      font: {
        bold: rowIndex === footerStartRowIndex,
        sz: 10,
        color: withColor(palette.white),
      },
      fill: { fgColor: withColor(palette.ink) },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: borderAll,
    });
  });

  XLSX.utils.book_append_sheet(wb, ws, 'Atividades');

  // ── Download ──
  const safeNome = projetoNome.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const fileName = `Atividades_${safeNome}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

// ─── Componente ──────────────────────────────────────────────────────────────

export function ExportAtividadesModal({
  open,
  onOpenChange,
  projetoId,
  projetoNome,
}: ExportAtividadesModalProps) {
  const { toast } = useToast();

  // Passo do wizard: 1 = escolher projeto (só se projetoId não vier de fora), 2 = filtros
  const [step, setStep] = useState<1 | 2>(projetoId ? 2 : 1);
  const [selectedProjetoId, setSelectedProjetoId] = useState<number | null>(projetoId ?? null);
  const [selectedProjetoNome, setSelectedProjetoNome] = useState<string>(projetoNome ?? '');

  const [tipoSessao, setTipoSessao] = useState('todas');
  const [estadosSelecionados, setEstadosSelecionados] = useState<string[]>([]);
  const [todosEstados, setTodosEstados] = useState(true);

  const [loading, setLoading] = useState(false);

  // Sincroniza quando o prop externo muda (ex: troca de projeto em Estatísticas)
  const effectiveProjetoId = projetoId ?? selectedProjetoId;
  const effectiveProjetoNome = projetoNome ?? selectedProjetoNome;

  // Carrega projetos (apenas quando o step 1 é necessário)
  const { data: projetos = [], isLoading: projetosLoading } = useQuery<Projeto[]>({
    queryKey: ['projetos'],
    queryFn: async () => (await api.get('/api/projetos')).data,
    enabled: !projetoId,
  });

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function handleClose() {
    // Reset estado interno ao fechar
    setStep(projetoId ? 2 : 1);
    setSelectedProjetoId(projetoId ?? null);
    setSelectedProjetoNome(projetoNome ?? '');
    setTipoSessao('todas');
    setEstadosSelecionados([]);
    setTodosEstados(true);
    onOpenChange(false);
  }

  function handleSelectProjeto(p: Projeto) {
    setSelectedProjetoId(p.id);
    setSelectedProjetoNome(p.nome);
    setStep(2);
  }

  function toggleEstado(estado: string) {
    setEstadosSelecionados(prev =>
      prev.includes(estado) ? prev.filter(e => e !== estado) : [...prev, estado]
    );
  }

  async function handleExport() {
    if (!effectiveProjetoId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('projeto_id', String(effectiveProjetoId));
      params.set('tipo_sessao', tipoSessao);
      if (!todosEstados && estadosSelecionados.length > 0) {
        params.set('estados', estadosSelecionados.join(','));
      }

      const res = await api.get(`/api/aulas/export?${params.toString()}`);
      const data = res.data as any[];

      if (data.length === 0) {
        toast({
          title: 'Sem resultados',
          description: 'Nenhuma atividade encontrada com os filtros selecionados.',
        });
        setLoading(false);
        return;
      }

      const tipoLabel = TIPO_SESSAO_OPTIONS.find(o => o.value === tipoSessao)?.label ?? tipoSessao;
      const estadosLabel = todosEstados
        ? 'Todos'
        : estadosSelecionados.map(e => ESTADO_LABELS[e] ?? e).join(', ');

      gerarXLSX(data, effectiveProjetoNome, tipoLabel, estadosLabel);

      toast({
        title: 'Export concluído',
        description: `${data.length} atividade(s) exportadas com sucesso.`,
      });
      handleClose();
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Erro ao exportar',
        description: err?.response?.data?.detail ?? 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full sm:max-w-lg max-h-[95dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-500" />
            Exportar Atividades
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Selecione o projeto cujas atividades pretende exportar.'
              : `Projeto: ${effectiveProjetoNome}`}
          </DialogDescription>
        </DialogHeader>

        {/* ── STEP 1: Escolha de projeto ── */}
        {step === 1 && (
          <div className="space-y-3 py-2">
            {projetosLoading ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                A carregar projetos…
              </p>
            ) : projetos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Não existem projetos disponíveis.
              </p>
            ) : (
              projetos.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleSelectProjeto(p)}
                  className={cn(
                    'w-full flex items-center justify-between gap-3 p-3 rounded-lg border',
                    'hover:border-primary/50 hover:bg-muted/40 transition-all text-left group'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <Layers className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-medium text-sm">{p.nome}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))
            )}
          </div>
        )}

        {/* ── STEP 2: Filtros ── */}
        {step === 2 && (
          <div className="space-y-5 py-2">
            {/* Tipo de sessão */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tipo de sessões</Label>
              <Select value={tipoSessao} onValueChange={setTipoSessao}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_SESSAO_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Estados */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Estados</Label>

              {/* Toggle "Todos os estados" */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="todos-estados"
                  checked={todosEstados}
                  onCheckedChange={(v) => {
                    setTodosEstados(!!v);
                    if (v) setEstadosSelecionados([]);
                  }}
                />
                <label htmlFor="todos-estados" className="text-sm cursor-pointer">
                  Todos os estados
                </label>
              </div>

              {/* Lista de estados individuais */}
              {!todosEstados && (
                <div className="grid grid-cols-2 gap-2 pl-1">
                  {ESTADO_OPTIONS.map(opt => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`estado-${opt.value}`}
                        checked={estadosSelecionados.includes(opt.value)}
                        onCheckedChange={() => toggleEstado(opt.value)}
                      />
                      <label
                        htmlFor={`estado-${opt.value}`}
                        className="text-sm cursor-pointer"
                      >
                        {opt.label}
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {/* Aviso se nenhum estado selecionado */}
              {!todosEstados && estadosSelecionados.length === 0 && (
                <p className="text-xs text-amber-500">
                  Selecione pelo menos um estado ou ative "Todos os estados".
                </p>
              )}

              {/* Badges dos estados selecionados */}
              {!todosEstados && estadosSelecionados.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {estadosSelecionados.map(e => (
                    <Badge key={e} variant="secondary" className="text-xs">
                      {ESTADO_LABELS[e] ?? e}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Nota informativa */}
            <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 p-3">
              O ficheiro Excel exportado incluirá o código de cada atividade, data,
              horário, tipo, estado, colaborador, turma, escola, tema, objetivos,
              sumário, avaliação e observações.
            </p>
          </div>
        )}

        {/* ── Footer ── */}
        <DialogFooter className="gap-2 flex-wrap sm:flex-nowrap">
          {/* Voltar ao step 1 (apenas se projeto não veio de fora) */}
          {step === 2 && !projetoId && (
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="sm:mr-auto"
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
          )}

          <Button variant="ghost" onClick={handleClose}>
            Cancelar
          </Button>

          {step === 2 && (
            <Button
              onClick={handleExport}
              disabled={
                loading ||
                !effectiveProjetoId ||
                (!todosEstados && estadosSelecionados.length === 0)
              }
              className="gap-2"
            >
              {loading ? (
                <>A exportar…</>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Exportar Dados
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
