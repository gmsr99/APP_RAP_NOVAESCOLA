/**
 * pdfFiller.ts — Preenche os templates PDF de registo de atividade
 * usando pdf-lib (overlay de texto sobre o PDF flat existente).
 *
 * Dois templates:
 *   - "atividade presencial.pdf"  → aulas regulares (inclui lista de participantes)
 *   - "trabalho autónomo.pdf"     → trabalho autónomo (inclui resumo da atividade)
 *
 * Coordenadas extraídas com pypdf (origem = canto inferior-esquerdo, A4 595×842pt).
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// ─── Data structures ────────────────────────────────────────────────────────

export interface RegistoFormData {
  atividade: string;
  numero_sessao: string;
  data: string;          // "dd/MM/yyyy"
  local: string;
  horario: string;       // "Das XXhXXm às XXhXXm"
  tecnicos: string;
  objetivos_gerais: string;
  sumario: string;
  participantes?: { nome_completo: string }[];
}

// ─── Coordinate maps ────────────────────────────────────────────────────────
// x = after the colon of each label, y = label baseline

// Coordinates derived from bounding boxes: baseline y = box.y + (box.h - fontSize) / 2
// Multi-line: first line y = box.y + box.h - fontSize - 2, then descend by lineHeight

const PRESENCIAL = {
  atividade:      { x: 167, y: 642 },   // box {165,627,201,39}
  numero_sessao:  { x: 440, y: 652 },   // box {438,647,127,20}
  data:           { x: 440, y: 632 },   // box {438,627,126,19}
  local:          { x: 167, y: 608 },   // box {165,600,201,26}
  horario:        { x: 440, y: 608 },   // box {438,600,127,26}
  tecnicos:       { x: 166, y: 579 },   // box {164,569,201,30}
  // Multi-line areas
  objetivos:      { x: 167, y: 555, maxWidth: 396 },   // box {165,484,400,83}
  sumario:        { x: 167, y: 506, maxWidth: 396 },   // box {165,472,400,46}
  // Participants table — 17 rows, starting at y=407
  participantes:  { x: 56, startY: 407, lineHeight: 17.5 },
};

const AUTONOMO = {
  atividade:      { x: 167, y: 642 },   // box {165,627,201,39}
  numero_sessao:  { x: 440, y: 652 },   // box {438,647,127,20}
  data:           { x: 440, y: 632 },   // box {438,627,126,19}
  local:          { x: 167, y: 608 },   // box {165,600,201,26}
  horario:        { x: 440, y: 608 },   // box {438,600,127,26}
  tecnicos:       { x: 166, y: 579 },   // box {164,569,201,30}
  // Multi-line areas
  objetivos:      { x: 167, y: 555, maxWidth: 396 },   // box {165,484,400,83}
  sumario:        { x: 167, y: 506, maxWidth: 396 },   // box {165,472,400,46}
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Sanitize text for WinAnsi encoding (used by StandardFonts.Helvetica).
 * Replaces common non-WinAnsi characters with safe alternatives.
 */
function sanitize(text: string): string {
  return text
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/•/g, '-')
    .replace(/…/g, '...')
    .replace(/–/g, '-')
    .replace(/—/g, '-')
    .replace(/"/g, '"')
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/'/g, "'")
    // Remove any remaining non-WinAnsi chars (keep Latin-1 range)
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x00-\xFF]/g, '');
}

/**
 * Simple word-wrap: breaks text into lines of maxWidth pt.
 * Uses approximate char width (Helvetica ~5.5pt at 10pt).
 */
function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const charWidth = fontSize * 0.52;
  const maxChars = Math.floor(maxWidth / charWidth);
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    // Handle explicit newlines inside the word
    const parts = word.split('\n');
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        lines.push(current);
        current = '';
      }
      const test = current ? `${current} ${parts[i]}` : parts[i];
      if (test.length > maxChars && current) {
        lines.push(current);
        current = parts[i];
      } else {
        current = test;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ─── Main fill function ─────────────────────────────────────────────────────

export async function fillPdf(
  data: RegistoFormData,
  isAutonomous: boolean,
): Promise<Uint8Array> {
  // 1. Fetch the correct template
  const templatePath = isAutonomous
    ? '/templates/trabalho-autonomo.pdf'
    : '/templates/atividade-presencial.pdf';

  const res = await fetch(templatePath);
  if (!res.ok) throw new Error(`Não foi possível carregar o template PDF (${res.status})`);
  const templateBytes = await res.arrayBuffer();
  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPages()[0];

  // 2. Embed font
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 10;
  const lineHeight = 13;
  const color = rgb(0, 0, 0);

  const coords = isAutonomous ? AUTONOMO : PRESENCIAL;

  // 3. Draw single-line fields
  const singleFields: { key: keyof typeof coords; value: string }[] = [
    { key: 'atividade',     value: data.atividade },
    { key: 'numero_sessao', value: data.numero_sessao },
    { key: 'data',          value: data.data },
    { key: 'local',         value: data.local },
    { key: 'horario',       value: data.horario },
    { key: 'tecnicos',      value: data.tecnicos },
  ];

  for (const { key, value } of singleFields) {
    const c = coords[key] as { x: number; y: number };
    if (c && value) {
      page.drawText(sanitize(value), { x: c.x, y: c.y, size: fontSize, font, color });
    }
  }

  // 4. Draw multi-line fields
  const multiFields: { key: 'objetivos' | 'sumario'; value: string }[] = [
    { key: 'objetivos', value: data.objetivos_gerais },
    { key: 'sumario',   value: data.sumario },
  ];

  for (const { key, value } of multiFields) {
    const c = coords[key] as { x: number; y: number; maxWidth: number };
    if (c && value) {
      const lines = wrapText(sanitize(value), c.maxWidth, fontSize);
      lines.forEach((line, i) => {
        page.drawText(line, {
          x: c.x,
          y: c.y - i * lineHeight,
          size: fontSize,
          font,
          color,
        });
      });
    }
  }

  // 5. Draw participants (presencial only)
  if (!isAutonomous && data.participantes && 'participantes' in coords) {
    const pc = PRESENCIAL.participantes;
    data.participantes.forEach((p, i) => {
      if (p.nome_completo) {
        page.drawText(sanitize(p.nome_completo), {
          x: pc.x,
          y: pc.startY - i * pc.lineHeight,
          size: fontSize,
          font,
          color,
        });
      }
    });
  }

  // 6. Serialize and return
  return pdfDoc.save();
}

// ─── Download helper ────────────────────────────────────────────────────────

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
