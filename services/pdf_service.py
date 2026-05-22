"""
PDF generation service for pre-registration sheets.
Generates official 'Registo de Atividade' PDFs with configurable header/footer logos per project.
"""
import io
import logging
import os
from typing import Optional

import requests
from supabase import create_client

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

logger = logging.getLogger(__name__)

ASSETS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets")

_supabase_url = os.environ.get("SUPABASE_URL", "")
_supabase_key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_ANON_KEY", "")
_supabase = create_client(_supabase_url, _supabase_key) if _supabase_url else None

# ---------------------------------------------------------------------------
# Image loading helpers
# ---------------------------------------------------------------------------

def _load_image(storage_path: Optional[str], default_filename: Optional[str]) -> Optional[bytes]:
    """Load image bytes from Supabase public storage or local fallback."""
    if storage_path and _supabase:
        try:
            url = _supabase.storage.from_("project-assets").get_public_url(storage_path)
            resp = requests.get(url, timeout=10)
            if resp.status_code == 200:
                return resp.content
        except Exception as e:
            logger.warning("Could not load asset from storage (%s): %s", storage_path, e)

    if not default_filename:
        return None
    local = os.path.join(ASSETS_DIR, default_filename)
    if os.path.exists(local):
        with open(local, "rb") as f:
            return f.read()
    return None


# ---------------------------------------------------------------------------
# Header / footer canvas callbacks
# ---------------------------------------------------------------------------

def _draw_header(c, logo_esq: Optional[bytes], logo_dir: Optional[bytes]) -> None:
    W, H = A4
    margin = 30
    logo_h = 60  # max logo height
    top = H - margin  # top of header area

    # Left logo
    if logo_esq:
        try:
            img = ImageReader(io.BytesIO(logo_esq))
            iw, ih = img.getSize()
            scale = min(150 / iw, logo_h / ih)
            dw, dh = iw * scale, ih * scale
            c.drawImage(img, margin, top - logo_h + (logo_h - dh) / 2,
                        width=dw, height=dh, mask="auto")
        except Exception as e:
            logger.warning("Could not draw left logo: %s", e)

    # Right logo
    if logo_dir:
        try:
            img = ImageReader(io.BytesIO(logo_dir))
            iw, ih = img.getSize()
            scale = min(100 / iw, 55 / ih)
            dw, dh = iw * scale, ih * scale
            c.drawImage(img, W - margin - dw, top - logo_h + (logo_h - dh) / 2,
                        width=dw, height=dh, mask="auto")
        except Exception as e:
            logger.warning("Could not draw right logo: %s", e)

    # Separator line below header
    c.setLineWidth(0.5)
    c.setStrokeColor(colors.black)
    c.line(margin, top - logo_h - 5, W - margin, top - logo_h - 5)


def _draw_footer(c, footer_img: Optional[bytes]) -> None:
    W, _ = A4
    margin = 30
    footer_line_y = margin + 45

    # Separator line
    c.setLineWidth(0.5)
    c.setStrokeColor(colors.black)
    c.line(margin, footer_line_y, W - margin, footer_line_y)

    if footer_img:
        try:
            img = ImageReader(io.BytesIO(footer_img))
            iw, ih = img.getSize()
            max_w = W - 2 * margin
            max_h = 38
            scale = min(max_w / iw, max_h / ih)
            dw, dh = iw * scale, ih * scale
            c.drawImage(img, margin, margin + (45 - dh) / 2,
                        width=dw, height=dh, mask="auto")
        except Exception as e:
            logger.warning("Could not draw footer image: %s", e)


# ---------------------------------------------------------------------------
# Paragraph styles
# ---------------------------------------------------------------------------

_TITLE = ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=13,
                         alignment=TA_CENTER, spaceAfter=4)
_CELL = ParagraphStyle("cell", fontName="Helvetica", fontSize=8.5, leading=11,
                        alignment=TA_LEFT)
_CELL_BOLD = ParagraphStyle("cellb", fontName="Helvetica-Bold", fontSize=8.5, leading=11)
_PART_HEADER = ParagraphStyle("ph", fontName="Helvetica-Bold", fontSize=9,
                               alignment=TA_CENTER, spaceAfter=0)


def _p(text: str, bold: bool = False) -> Paragraph:
    style = _CELL_BOLD if bold else _CELL
    return Paragraph(text or "", style)


def _lv(label: str, value: str) -> Paragraph:
    """Bold label followed by regular value in the same paragraph."""
    safe_val = (value or "").replace("&", "&amp;").replace("<", "&lt;")
    return Paragraph(f"<b>{label}</b> {safe_val}", _CELL)


def _multiline_cell(label: str, value: str) -> Paragraph:
    """Label on first line (bold), value below."""
    safe_val = (value or "").replace("&", "&amp;").replace("<", "&lt;")
    if safe_val:
        return Paragraph(f"<b>{label}</b><br/>{safe_val}", _CELL)
    return Paragraph(f"<b>{label}</b>", _CELL)


# ---------------------------------------------------------------------------
# Main story builder
# ---------------------------------------------------------------------------

def _build_story(form_data: dict, projeto_config: dict, is_autonomous: bool, cw: float) -> list:
    """Build the platypus story (list of flowables)."""
    story = []

    # --- Title ---
    story.append(Paragraph("REGISTO DE ATIVIDADE", _TITLE))
    story.append(Spacer(1, 3))

    # --- Field values ---
    nome = projeto_config.get("nome") or ""
    codigo = projeto_config.get("codigo_projeto") or ""
    atividade = form_data.get("atividade") or ""
    num_sessao = form_data.get("numero_sessao") or ""
    data_val = form_data.get("data") or ""
    local = form_data.get("local") or ""
    horario = form_data.get("horario") or ""
    tecnicos = form_data.get("tecnicos") or ""
    objetivos = form_data.get("objetivos_gerais") or ""
    sumario = form_data.get("sumario") or ""
    participantes = form_data.get("participantes") or []

    # --- Column widths: simple 2-column layout [59% | 41%] ---
    col_l = round(cw * 0.59)
    col_r = cw - col_l
    col_widths = [col_l, col_r]

    # Row heights
    rh_s = 26   # single-line row
    rh_d = 38   # Atividade row (2 lines in right cell: Nº Sessão + Data)
    rh_m = 52   # multi-line row (Objetivos / Sumário)

    summary_label = "Resumo da atividade desenvolvida:" if is_autonomous else "Sumário:"

    # Row layout: 6 rows × 2 cols
    # Row 0: Designação do Projeto | Cód. do Projeto
    # Row 1: Atividade | Nº Sessão\nData  (stacked in right cell)
    # Row 2: Local | Horário
    # Row 3: Técnico | Assinatura
    # Row 4: Objetivos Gerais (full width SPAN)
    # Row 5: Sumário / Resumo (full width SPAN)

    ns_data = f"<b>Nº Sessão:</b> {num_sessao}<br/><b>Data:</b> {data_val}"

    tdata = [
        [_lv("Designação do Projeto:", nome), _lv("Cód. do Projeto:", codigo)],
        [_multiline_cell("Atividade:", atividade), Paragraph(ns_data, _CELL)],
        [_lv("Local:", local), _lv("Horário:", horario)],
        [_lv("Técnico(s)/a(s):", tecnicos), _lv("Assinatura(s):", "")],
        [_multiline_cell("Objetivos Gerais:", objetivos), ""],
        [_multiline_cell(summary_label, sumario), ""],
    ]

    span_cmds = [
        ("SPAN", (0, 4), (1, 4)),   # Objetivos full width
        ("SPAN", (0, 5), (1, 5)),   # Sumário full width
    ]

    tstyle = TableStyle(
        [
            ("BOX", (0, 0), (-1, -1), 0.5, colors.black),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.black),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ]
        + span_cmds
    )

    row_heights = [rh_s, rh_d, rh_s, rh_s, rh_m, rh_m]
    main_table = Table(tdata, colWidths=col_widths, rowHeights=row_heights, style=tstyle)
    story.append(main_table)

    # --- Participant list (presencial only) ---
    if not is_autonomous:
        story.append(Spacer(1, 6))
        story.append(Paragraph("LISTA DE PARTICIPANTES", _PART_HEADER))

        pcol_widths = [round(cw * 0.60), cw - round(cw * 0.60)]
        pdata = [[_p("Nome completo:", bold=True), _p("Assinatura:", bold=True)]]
        for i in range(17):
            nome_val = ""
            if i < len(participantes):
                nome_val = participantes[i].get("nome_completo", "")
            pdata.append([_p(nome_val), _p("")])

        pstyle = TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, colors.black),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.black),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ])
        part_table = Table(pdata, colWidths=pcol_widths,
                           rowHeights=[18] + [13] * 17, style=pstyle)
        story.append(part_table)

    return story


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def gerar_pdf_pre_registo(form_data: dict, projeto_config: dict) -> bytes:
    """
    Generate a pre-registration PDF.

    form_data keys: atividade, numero_sessao, data, local, horario, tecnicos,
                    objetivos_gerais, sumario, participantes[], is_autonomous
    projeto_config keys: nome, codigo_projeto, logo_esq_path, logo_dir_path, footer_path
    """
    is_autonomous = bool(form_data.get("is_autonomous", False))

    logo_esq = _load_image(projeto_config.get("logo_esq_path"), None)
    logo_dir = _load_image(projeto_config.get("logo_dir_path"), "logo_rap_nova_escola.png")
    footer_img = _load_image(projeto_config.get("footer_path"), None)

    W, _ = A4
    margin = 30
    cw = W - 2 * margin  # content width

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=margin,
        rightMargin=margin,
        topMargin=100,   # 30 margin + 60 logo + 10 gap
        bottomMargin=75,  # 30 margin + 40 footer + 5 gap
    )

    def on_page(canvas_obj, doc_obj):
        _draw_header(canvas_obj, logo_esq, logo_dir)
        _draw_footer(canvas_obj, footer_img)

    story = _build_story(form_data, projeto_config, is_autonomous, cw)
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)

    return buffer.getvalue()
