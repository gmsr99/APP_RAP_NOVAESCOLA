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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { FileSpreadsheet, Download } from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Projeto { id: number; nome: string; }
interface Mentor  { id: number; nome: string; }

export interface ExportAtividadesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const TIPO_SESSAO_OPTIONS = [
  { value: 'todas',       label: 'Todas (presenciais + autónomas)' },
  { value: 'presenciais', label: 'Apenas presenciais' },
  { value: 'autonomas',   label: 'Apenas autónomas' },
];

const ESTADO_OPTIONS = [
  { value: 'terminada',  label: 'Terminadas'  },
  { value: 'confirmada', label: 'Confirmadas' },
  { value: 'pendente',   label: 'Pendentes'   },
  { value: 'recusada',   label: 'Recusadas'   },
  { value: 'cancelada',  label: 'Canceladas'  },
  { value: 'rascunho',   label: 'Rascunhos'   },
];

const TIPO_LABELS: Record<string, string> = {
  teorica:           'Teórica',
  pratica_escrita:   'Prática Escrita',
  pratica_gravacao:  'Prática Gravação',
  producao_musical:  'Produção Musical',
  ensaio:            'Ensaio',
  showcase:          'Showcase',
  trabalho_autonomo: 'Trabalho Autónomo',
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
  projeto_nome?: string | null;
  tema?: string | null;
  tipo_atividade?: string | null;
  objetivos?: string | null;
  sumario?: string | null;
  avaliacao?: number | null;
  obs_termino?: string | null;
  observacoes?: string | null;
};

// ─── Geração do XLSX ─────────────────────────────────────────────────────────

function gerarXLSX(rows: ExportRow[], labelProjetos: string, labelTipo: string, labelEstados: string, labelMentor: string, labelDatas: string) {
  const wb = XLSX.utils.book_new();
  wb.Props = {
    Title: `Atividades - ${labelProjetos}`,
    Subject: 'Export de Atividades RAP Nova Escola',
    Author: 'RAP Nova Escola',
    CreatedDate: new Date(),
  };

  const dataGerado = new Date().toLocaleString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const headerRows = [
    ['RAP Nova Escola — Exportação de Atividades'],
    [`Projetos: ${labelProjetos}`],
    [`Filtros: ${labelTipo} · Estados: ${labelEstados} · Mentor: ${labelMentor} · Período: ${labelDatas}`],
    [`Gerado em: ${dataGerado}    Total: ${rows.length} registo(s)`],
    [],
  ];

  const colHeaders = [
    'Código', 'Data', 'Hora Início', 'Hora Fim', 'Duração (h)',
    'Tipo', 'Estado', 'Autónoma?', 'Colaborador', 'Turma',
    'Escola', 'Projeto', 'Tema / Atividade', 'Objetivos', 'Sumário',
    'Avaliação', 'Observações Termino', 'Observações Gerais',
  ];

  const dataRows = rows.map((r) => [
    r.atividade_codigo ?? '',
    r.data_fmt         ?? '',
    r.hora_inicio      ?? '',
    r.hora_fim         ?? '',
    r.duracao_horas    ?? '',
    TIPO_LABELS[r.tipo ?? ''] ?? r.tipo ?? '',
    ESTADO_LABELS[r.estado ?? ''] ?? r.estado ?? '',
    r.is_autonomous ? 'Sim' : 'Não',
    r.colaborador      ?? '',
    r.turma_nome       ?? '',
    r.estabelecimento_nome ?? '',
    r.projeto_nome     ?? '',
    r.tema ?? r.tipo_atividade ?? '',
    r.objetivos        ?? '',
    r.sumario          ?? '',
    r.avaliacao != null ? `${r.avaliacao}/5` : '',
    r.obs_termino      ?? '',
    r.observacoes      ?? '',
  ]);

  const footerRows = [
    [],
    [`Total de registos exportados: ${rows.length}`],
    [`Exportado por: RAP Nova Escola · ${dataGerado}`],
  ];

  const allSheetData = [...headerRows, colHeaders, ...dataRows, ...footerRows];
  const ws = XLSX.utils.aoa_to_sheet(allSheetData);
  const tableHeaderRowIndex = headerRows.length;
  const firstDataRowIndex = tableHeaderRowIndex + 1;
  const lastDataRowIndex = firstDataRowIndex + dataRows.length - 1;
  const footerStartRowIndex = lastDataRowIndex + 2;
  const lastColumnIndex = colHeaders.length - 1;

  ws['!cols'] = [
    { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
    { wch: 20 }, { wch: 14 }, { wch: 10 }, { wch: 24 }, { wch: 20 },
    { wch: 28 }, { wch: 20 }, { wch: 30 }, { wch: 36 }, { wch: 36 },
    { wch: 12 }, { wch: 40 }, { wch: 40 },
  ];

  ws['!rows'] = [
    { hpt: 28 }, { hpt: 20 }, { hpt: 20 }, { hpt: 20 }, { hpt: 12 }, { hpt: 22 },
    ...dataRows.map(() => ({ hpt: 30 })),
    { hpt: 10 }, { hpt: 20 }, { hpt: 20 },
  ];

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastColumnIndex } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastColumnIndex } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: lastColumnIndex } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: lastColumnIndex } },
    { s: { r: footerStartRowIndex,     c: 0 }, e: { r: footerStartRowIndex,     c: lastColumnIndex } },
    { s: { r: footerStartRowIndex + 1, c: 0 }, e: { r: footerStartRowIndex + 1, c: lastColumnIndex } },
  ];

  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: tableHeaderRowIndex, c: 0 },
      e: { r: Math.max(lastDataRowIndex, tableHeaderRowIndex), c: lastColumnIndex },
    }),
  };

  const palette = {
    ink: '2B3544', inkSoft: '334155', cyanSoft: 'DDF6FA', cyan: '4DC4D9',
    paper: 'F5F7FA', white: 'FFFFFF', slate: '667085', line: 'D0D7E2', lineDark: '425166',
  };
  const withColor = (rgb: string) => ({ rgb });
  const borderAll = {
    top: { style: 'thin', color: withColor(palette.line) },
    bottom: { style: 'thin', color: withColor(palette.line) },
    left: { style: 'thin', color: withColor(palette.line) },
    right: { style: 'thin', color: withColor(palette.line) },
  };
  const setStyle = (cellRef: string, style: any) => { if (ws[cellRef]) ws[cellRef].s = style; };
  const styleRowRange = (rowIndex: number, styleFactory: (colIndex: number) => any) => {
    for (let c = 0; c <= lastColumnIndex; c++) {
      const ref = XLSX.utils.encode_cell({ r: rowIndex, c });
      if (!ws[ref]) ws[ref] = { t: 's', v: '' };
      ws[ref].s = styleFactory(c);
    }
  };

  setStyle('A1', {
    font: { bold: true, sz: 16, color: withColor(palette.white) },
    fill: { fgColor: withColor(palette.ink) },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: { ...borderAll, bottom: { style: 'medium', color: withColor(palette.cyan) } },
  });
  for (let i = 1; i <= 3; i++) {
    setStyle(`A${i + 1}`, {
      font: { bold: i === 1, sz: i === 1 ? 11 : 10, color: withColor(i === 3 ? palette.slate : palette.ink) },
      fill: { fgColor: withColor(i === 3 ? palette.paper : palette.cyanSoft) },
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
  for (let r = firstDataRowIndex; r <= lastDataRowIndex; r++) {
    styleRowRange(r, (c) => ({
      font: { sz: 10, color: withColor(palette.ink), bold: c === 0 },
      fill: { fgColor: withColor(r % 2 === 0 ? palette.white : palette.paper) },
      alignment: { vertical: 'top', horizontal: [1,2,3,4,7,14].includes(c) ? 'center' : 'left', wrapText: true },
      border: borderAll,
    }));
  }
  [footerStartRowIndex, footerStartRowIndex + 1].forEach(r => {
    setStyle(XLSX.utils.encode_cell({ r, c: 0 }), {
      font: { bold: r === footerStartRowIndex, sz: 10, color: withColor(palette.white) },
      fill: { fgColor: withColor(palette.ink) },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: borderAll,
    });
  });

  XLSX.utils.book_append_sheet(wb, ws, 'Atividades');
  const safeNome = labelProjetos.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 40);
  XLSX.writeFile(wb, `Atividades_${safeNome}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─── Componente ──────────────────────────────────────────────────────────────

export function ExportAtividadesModal({ open, onOpenChange }: ExportAtividadesModalProps) {

  // Projetos selecionados: [] = todos
  const [projetosSel, setProjetosSel] = useState<number[]>([]);
  const [mentorSel, setMentorSel] = useState<string>('all');
  const [tipoSessao, setTipoSessao] = useState('todas');
  const [todosEstados, setTodosEstados] = useState(true);
  const [estadosSel, setEstadosSel] = useState<string[]>([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: projetos = [] } = useQuery<Projeto[]>({
    queryKey: ['projetos'],
    queryFn: async () => (await api.get('/api/projetos')).data,
    enabled: open,
  });

  const { data: mentores = [] } = useQuery<Mentor[]>({
    queryKey: ['mentores'],
    queryFn: async () => (await api.get('/api/mentores')).data,
    enabled: open,
  });

  function handleClose() {
    setProjetosSel([]);
    setMentorSel('all');
    setTipoSessao('todas');
    setTodosEstados(true);
    setEstadosSel([]);
    setDataInicio('');
    setDataFim('');
    onOpenChange(false);
  }

  function toggleProjeto(id: number) {
    setProjetosSel(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  }

  function toggleEstado(e: string) {
    setEstadosSel(prev =>
      prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]
    );
  }

  async function handleExport() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (projetosSel.length > 0) params.set('projeto_ids', projetosSel.join(','));
      params.set('tipo_sessao', tipoSessao);
      if (!todosEstados && estadosSel.length > 0) params.set('estados', estadosSel.join(','));
      if (mentorSel !== 'all') params.set('mentor_id', mentorSel);
      if (dataInicio) params.set('data_inicio', dataInicio);
      if (dataFim)    params.set('data_fim',    dataFim);

      const res = await api.get(`/api/aulas/export?${params.toString()}`);
      const data = res.data as ExportRow[];

      if (data.length === 0) {
        toast.info('Nenhuma atividade encontrada com os filtros selecionados.');
        setLoading(false);
        return;
      }

      const labelProjetos = projetosSel.length === 0
        ? 'Todos os Projetos'
        : projetosSel.map(id => projetos.find(p => p.id === id)?.nome ?? id).join(', ');
      const labelTipo = TIPO_SESSAO_OPTIONS.find(o => o.value === tipoSessao)?.label ?? tipoSessao;
      const labelEstados = todosEstados ? 'Todos' : estadosSel.map(e => ESTADO_LABELS[e] ?? e).join(', ');
      const labelMentor = mentorSel === 'all' ? 'Todos' : (mentores.find(m => m.id === Number(mentorSel))?.nome ?? mentorSel);
      const labelDatas = dataInicio || dataFim
        ? `${dataInicio || '…'} → ${dataFim || '…'}`
        : 'Sem limite';

      gerarXLSX(data, labelProjetos, labelTipo, labelEstados, labelMentor, labelDatas);

      toast.success(`${data.length} atividade(s) exportadas.`);
      handleClose();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((e: any) => e.msg ?? String(e)).join('; ')
        : (typeof detail === 'string' ? detail : 'Ocorreu um erro inesperado.');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const canExport = todosEstados || estadosSel.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-500" />
            Exportar Atividades
          </DialogTitle>
          <DialogDescription>
            Escolhe os filtros e exporta para Excel. Deixa tudo em branco para exportar tudo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">

          {/* ── Projetos ── */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Projetos</Label>
            <p className="text-xs text-muted-foreground">Sem seleção = todos os projetos</p>
            <div className="grid grid-cols-2 gap-1.5">
              {projetos.map(p => (
                <div key={p.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`proj-${p.id}`}
                    checked={projetosSel.includes(p.id)}
                    onCheckedChange={() => toggleProjeto(p.id)}
                  />
                  <label htmlFor={`proj-${p.id}`} className="text-sm cursor-pointer leading-tight">{p.nome}</label>
                </div>
              ))}
            </div>
            {projetosSel.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {projetosSel.map(id => (
                  <Badge key={id} variant="secondary" className="text-xs">
                    {projetos.find(p => p.id === id)?.nome ?? id}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* ── Tipo de sessão ── */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Tipo de sessões</Label>
            <Select value={tipoSessao} onValueChange={setTipoSessao}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPO_SESSAO_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Mentor ── */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Mentor / Colaborador</Label>
            <Select value={mentorSel} onValueChange={setMentorSel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {mentores.map(m => (
                  <SelectItem key={m.id} value={String(m.id)}>{m.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Estados ── */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Estados</Label>
            <div className="flex items-center gap-2">
              <Checkbox
                id="todos-estados"
                checked={todosEstados}
                onCheckedChange={(v) => { setTodosEstados(!!v); if (v) setEstadosSel([]); }}
              />
              <label htmlFor="todos-estados" className="text-sm cursor-pointer">Todos os estados</label>
            </div>
            {!todosEstados && (
              <div className="grid grid-cols-2 gap-1.5 pl-1">
                {ESTADO_OPTIONS.map(opt => (
                  <div key={opt.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`estado-${opt.value}`}
                      checked={estadosSel.includes(opt.value)}
                      onCheckedChange={() => toggleEstado(opt.value)}
                    />
                    <label htmlFor={`estado-${opt.value}`} className="text-sm cursor-pointer">{opt.label}</label>
                  </div>
                ))}
              </div>
            )}
            {!todosEstados && estadosSel.length === 0 && (
              <p className="text-xs text-amber-500">Seleciona pelo menos um estado.</p>
            )}
          </div>

          {/* ── Período ── */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Período</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">De</p>
                <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Até</p>
                <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} min={dataInicio} />
              </div>
            </div>
          </div>

        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleExport} disabled={loading || !canExport} className="gap-2">
            {loading ? 'A exportar…' : <><Download className="h-4 w-4" />Exportar Excel</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
