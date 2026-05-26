import { useState } from 'react';
import * as XLSX from 'xlsx-js-style';
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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Music, Download } from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExportMusicasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projetoId?: number | null;
  projetoNome?: string;
}

type MusicaExportRow = {
  titulo?: string | null;
  disciplina?: string | null;
  turma_nome?: string | null;
  estabelecimento_nome?: string | null;
  projeto_nome?: string | null;
  criado_em?: string | null;
  arquivado_em?: string | null;
  deadline?: string | null;
  criador_nome?: string | null;
  misturado_por_nome?: string | null;
  revisto_por_nome?: string | null;
  finalizado_por_nome?: string | null;
  notas?: string | null;
  feedback?: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Geração do XLSX ─────────────────────────────────────────────────────────

function gerarXLSX(rows: MusicaExportRow[], labelProjeto: string, labelDatas: string) {
  const wb = XLSX.utils.book_new();
  wb.Props = {
    Title: `Músicas Concluídas - ${labelProjeto}`,
    Subject: 'Export de Músicas RAP Nova Escola',
    Author: 'RAP Nova Escola',
    CreatedDate: new Date(),
  };

  const dataGerado = new Date().toLocaleString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const headerRows = [
    ['RAP Nova Escola — Músicas Concluídas'],
    [`Projeto: ${labelProjeto}`],
    [`Período de conclusão: ${labelDatas}`],
    [`Gerado em: ${dataGerado}    Total: ${rows.length} música(s)`],
    [],
  ];

  const colHeaders = [
    'Título', 'Disciplina', 'Turma', 'Estabelecimento', 'Projeto',
    'Data de Início', 'Data de Conclusão', 'Deadline',
    'Criado por', 'Misturado por', 'Revisto por', 'Finalizado por',
    'Notas', 'Feedback',
  ];

  const dataRows = rows.map((r) => [
    r.titulo                ?? '',
    r.disciplina            ?? '',
    r.turma_nome            ?? '',
    r.estabelecimento_nome  ?? '',
    r.projeto_nome          ?? '',
    fmtDate(r.criado_em),
    fmtDate(r.arquivado_em),
    fmtDate(r.deadline),
    r.criador_nome          ?? '',
    r.misturado_por_nome    ?? '',
    r.revisto_por_nome      ?? '',
    r.finalizado_por_nome   ?? '',
    r.notas                 ?? '',
    r.feedback              ?? '',
  ]);

  const footerRows = [
    [],
    [`Total de músicas exportadas: ${rows.length}`],
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
    { wch: 28 }, { wch: 20 }, { wch: 20 }, { wch: 24 }, { wch: 20 },
    { wch: 14 }, { wch: 16 }, { wch: 12 },
    { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
    { wch: 36 }, { wch: 36 },
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
    top:    { style: 'thin', color: withColor(palette.line) },
    bottom: { style: 'thin', color: withColor(palette.line) },
    left:   { style: 'thin', color: withColor(palette.line) },
    right:  { style: 'thin', color: withColor(palette.line) },
  };
  const setStyle = (cellRef: string, style: object) => { if (ws[cellRef]) ws[cellRef].s = style; };
  const styleRowRange = (rowIndex: number, styleFactory: (colIndex: number) => object) => {
    for (let c = 0; c <= lastColumnIndex; c++) {
      const ref = XLSX.utils.encode_cell({ r: rowIndex, c });
      if (!ws[ref]) ws[ref] = { t: 's', v: '' };
      ws[ref].s = styleFactory(c);
    }
  };

  setStyle('A1', {
    font:      { bold: true, sz: 16, color: withColor(palette.white) },
    fill:      { fgColor: withColor(palette.ink) },
    alignment: { horizontal: 'center', vertical: 'center' },
    border:    { ...borderAll, bottom: { style: 'medium', color: withColor(palette.cyan) } },
  });
  for (let i = 1; i <= 3; i++) {
    setStyle(`A${i + 1}`, {
      font:      { bold: i === 1, sz: i === 1 ? 11 : 10, color: withColor(i === 3 ? palette.slate : palette.ink) },
      fill:      { fgColor: withColor(i === 3 ? palette.paper : palette.cyanSoft) },
      alignment: { horizontal: 'left', vertical: 'center' },
      border:    borderAll,
    });
  }
  styleRowRange(tableHeaderRowIndex, () => ({
    font:      { bold: true, sz: 10, color: withColor(palette.white) },
    fill:      { fgColor: withColor(palette.inkSoft) },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top:    { style: 'thin',   color: withColor(palette.lineDark) },
      bottom: { style: 'medium', color: withColor(palette.cyan) },
      left:   { style: 'thin',   color: withColor(palette.lineDark) },
      right:  { style: 'thin',   color: withColor(palette.lineDark) },
    },
  }));
  // centrar colunas de datas (5,6,7) e nomes de pessoas (8,9,10,11)
  const centeredCols = [5, 6, 7];
  for (let r = firstDataRowIndex; r <= lastDataRowIndex; r++) {
    styleRowRange(r, (c) => ({
      font:      { sz: 10, color: withColor(palette.ink), bold: c === 0 },
      fill:      { fgColor: withColor(r % 2 === 0 ? palette.white : palette.paper) },
      alignment: { vertical: 'top', horizontal: centeredCols.includes(c) ? 'center' : 'left', wrapText: true },
      border:    borderAll,
    }));
  }
  [footerStartRowIndex, footerStartRowIndex + 1].forEach(r => {
    setStyle(XLSX.utils.encode_cell({ r, c: 0 }), {
      font:      { bold: r === footerStartRowIndex, sz: 10, color: withColor(palette.white) },
      fill:      { fgColor: withColor(palette.ink) },
      alignment: { horizontal: 'left', vertical: 'center' },
      border:    borderAll,
    });
  });

  XLSX.utils.book_append_sheet(wb, ws, 'Músicas');
  const safeProjeto = labelProjeto.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 40);
  XLSX.writeFile(wb, `Musicas_Concluidas_${safeProjeto}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─── Componente ──────────────────────────────────────────────────────────────

export function ExportMusicasModal({ open, onOpenChange, projetoId, projetoNome }: ExportMusicasModalProps) {
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(false);

  function handleClose() {
    setDataInicio('');
    setDataFim('');
    onOpenChange(false);
  }

  async function handleExport() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (projetoId)   params.set('projeto_id',  String(projetoId));
      if (dataInicio)  params.set('data_inicio',  dataInicio);
      if (dataFim)     params.set('data_fim',     dataFim);

      const res = await api.get(`/api/musicas/export?${params.toString()}`);
      const data = res.data as MusicaExportRow[];

      if (data.length === 0) {
        toast.info('Nenhuma música encontrada com os filtros selecionados.');
        setLoading(false);
        return;
      }

      const labelProjeto = projetoNome ?? 'Todos os Projetos';
      const labelDatas = dataInicio || dataFim
        ? `${dataInicio || '…'} → ${dataFim || '…'}`
        : 'Sem limite';

      gerarXLSX(data, labelProjeto, labelDatas);
      toast.success(`${data.length} música(s) exportadas com sucesso.`);
      handleClose();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((e: unknown) => (e as { msg?: string })?.msg ?? String(e)).join('; ')
        : (typeof detail === 'string' ? detail : 'Ocorreu um erro inesperado.');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="h-5 w-5 text-violet-500" />
            Exportar Músicas Concluídas
          </DialogTitle>
          <DialogDescription>
            Exporta para Excel todas as músicas arquivadas
            {projetoNome ? ` do projeto "${projetoNome}"` : ''}.
            Filtra por janela temporal de conclusão.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Período de conclusão</Label>
            <p className="text-xs text-muted-foreground">
              Deixa em branco para exportar todas as músicas concluídas.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">De</p>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={e => setDataInicio(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Até</p>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={e => setDataFim(e.target.value)}
                  min={dataInicio}
                />
              </div>
            </div>
          </div>

          <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            O ficheiro Excel incluirá: título, disciplina, turma, estabelecimento, projeto,
            datas de início e conclusão, deadline, criado por, misturado por, revisto por,
            finalizado por, notas e feedback.
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleExport} disabled={loading} className="gap-2">
            {loading ? 'A exportar…' : <><Download className="h-4 w-4" />Exportar Excel</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
