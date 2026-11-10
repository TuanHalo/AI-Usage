"""Generate polished 16:9 PowerPoint (.pptx) decks from a structured deck JSON spec."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Callable

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from themes import SlideTheme, hex_to_rgb_tuple, resolve_theme

VALID_LAYOUTS = frozenset(
    {
        "title",
        "agenda",
        "bullets",
        "two_column",
        "cards",
        "metrics",
        "comparison",
        "timeline",
        "quote",
        "closing",
    }
)

SLIDE_WIDTH_IN = 13.333
SLIDE_HEIGHT_IN = 7.5
MARGIN_X_IN = 0.75
CONTENT_WIDTH_IN = SLIDE_WIDTH_IN - (2 * MARGIN_X_IN)


def validate_deck_spec(deck: dict[str, Any]) -> list[str]:
    """Validate a deck JSON structure and return human-readable error messages."""
    errors: list[str] = []
    if not isinstance(deck, dict):
        return ["Deck root must be a JSON object."]

    slides = deck.get("slides")
    if not isinstance(slides, list) or len(slides) == 0:
        errors.append("Deck must include a non-empty 'slides' array.")
        return errors

    for idx, slide in enumerate(slides, start=1):
        if not isinstance(slide, dict):
            errors.append(f"Slide {idx} must be an object.")
            continue
        layout = str(slide.get("layout", "bullets")).strip().lower()
        if layout not in VALID_LAYOUTS:
            valid_list = ", ".join(sorted(VALID_LAYOUTS))
            errors.append(
                f"Slide {idx} has unsupported layout '{layout}'. Valid: {valid_list}"
            )
        if layout != "quote" and not slide.get("title"):
            errors.append(f"Slide {idx} ({layout}) is missing a 'title'.")
        chart = slide.get("chart")
        if chart is not None:
            errors.extend(_validate_chart_spec(chart, idx))

    return errors


def _validate_chart_spec(chart: Any, slide_idx: int) -> list[str]:
    """Validate optional chart payload on a slide."""
    errors: list[str] = []
    if not isinstance(chart, dict):
        return [f"Slide {slide_idx}: 'chart' must be an object."]
    categories = chart.get("categories")
    series = chart.get("series")
    if not isinstance(categories, list) or not categories:
        errors.append(f"Slide {slide_idx}: chart requires non-empty 'categories'.")
    if not isinstance(series, list) or not series:
        errors.append(f"Slide {slide_idx}: chart requires non-empty 'series'.")
    elif isinstance(categories, list):
        for s_idx, item in enumerate(series, start=1):
            values = item.get("values") if isinstance(item, dict) else None
            if not isinstance(values, list) or len(values) != len(categories):
                errors.append(
                    f"Slide {slide_idx}: chart series {s_idx} 'values' length must match 'categories'."
                )
    return errors


def _load_pptx_modules() -> dict[str, Any]:
    """Import python-pptx lazily so validation works without external dependencies."""
    try:
        from pptx import Presentation
        from pptx.chart.data import CategoryChartData
        from pptx.dml.color import RGBColor
        from pptx.enum.chart import XL_CHART_TYPE
        from pptx.enum.shapes import MSO_SHAPE
        from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
        from pptx.util import Inches, Pt
    except ImportError as exc:
        raise RuntimeError(
            "Missing dependency 'python-pptx'. Install it with: pip install python-pptx"
        ) from exc

    return {
        "Presentation": Presentation,
        "CategoryChartData": CategoryChartData,
        "RGBColor": RGBColor,
        "XL_CHART_TYPE": XL_CHART_TYPE,
        "MSO_SHAPE": MSO_SHAPE,
        "MSO_ANCHOR": MSO_ANCHOR,
        "PP_ALIGN": PP_ALIGN,
        "Inches": Inches,
        "Pt": Pt,
    }


class DeckRenderer:
    """Renders validated JSON slide specs into a styled 16:9 Presentation."""

    def __init__(self, pptx: dict[str, Any], theme: SlideTheme, deck_title: str) -> None:
        self.pptx = pptx
        self.theme = theme
        self.deck_title = deck_title
        self.RGBColor = pptx["RGBColor"]
        self.Inches = pptx["Inches"]
        self.Pt = pptx["Pt"]
        self.MSO_SHAPE = pptx["MSO_SHAPE"]
        self.PP_ALIGN = pptx["PP_ALIGN"]
        self.MSO_ANCHOR = pptx["MSO_ANCHOR"]

    def rgb(self, hex_color: str) -> Any:
        """Convert #RRGGBB string into python-pptx RGBColor."""
        r, g, b = hex_to_rgb_tuple(hex_color)
        return self.RGBColor(r, g, b)

    def render(self, deck: dict[str, Any], output_path: Path) -> int:
        """Build the presentation and save it to output_path."""
        prs = self.pptx["Presentation"]()
        prs.slide_width = self.Inches(SLIDE_WIDTH_IN)
        prs.slide_height = self.Inches(SLIDE_HEIGHT_IN)
        blank_layout = prs.slide_layouts[6]

        slides_spec: list[dict[str, Any]] = deck["slides"]
        total_slides = len(slides_spec)

        layout_map: dict[str, Callable[[Any, dict[str, Any], int, int], None]] = {
            "title": self._render_title_slide,
            "agenda": self._render_agenda_slide,
            "bullets": self._render_bullets_slide,
            "two_column": self._render_two_column_slide,
            "cards": self._render_cards_slide,
            "metrics": self._render_metrics_slide,
            "comparison": self._render_comparison_slide,
            "timeline": self._render_timeline_slide,
            "quote": self._render_quote_slide,
            "closing": self._render_closing_slide,
        }

        for index, spec in enumerate(slides_spec, start=1):
            slide = prs.slides.add_slide(blank_layout)
            self._apply_background(slide)
            layout = str(spec.get("layout", "bullets")).strip().lower()
            layout_map[layout](slide, spec, index, total_slides)

            notes = spec.get("notes")
            if notes:
                slide.notes_slide.notes_text_frame.text = str(notes)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        prs.save(str(output_path))
        return total_slides

    def _apply_background(self, slide: Any) -> None:
        """Fill canvas background and add top theme accent bar."""
        fill = slide.background.fill
        fill.solid()
        fill.fore_color.rgb = self.rgb(self.theme.bg_hex)

        top_bar = slide.shapes.add_shape(
            self.MSO_SHAPE.RECTANGLE,
            self.Inches(0),
            self.Inches(0),
            self.Inches(SLIDE_WIDTH_IN),
            self.Inches(0.08),
        )
        top_bar.fill.solid()
        top_bar.fill.fore_color.rgb = self.rgb(self.theme.primary_hex)
        top_bar.line.fill.background()

    def _add_panel(
        self,
        slide: Any,
        left: float,
        top: float,
        width: float,
        height: float,
        fill_hex: str | None = None,
        border_hex: str | None = None,
        show_border: bool = True,
        rounded: bool | None = None,
    ) -> Any:
        """Add a styled background card or rectangular container."""
        use_rounded = (
            self.theme.corner_style == "rounded" if rounded is None else rounded
        )
        shape_type = (
            self.MSO_SHAPE.ROUNDED_RECTANGLE if use_rounded else self.MSO_SHAPE.RECTANGLE
        )
        shape = slide.shapes.add_shape(
            shape_type,
            self.Inches(left),
            self.Inches(top),
            self.Inches(width),
            self.Inches(height),
        )
        if use_rounded and len(shape.adjustments) > 0:
            shape.adjustments[0] = 0.05

        shape.fill.solid()
        shape.fill.fore_color.rgb = self.rgb(fill_hex or self.theme.surface_hex)
        if not show_border:
            shape.line.fill.background()
        else:
            shape.line.color.rgb = self.rgb(border_hex or self.theme.border_hex)
            shape.line.width = self.Pt(1)
        return shape

    def _add_accent_bar(
        self,
        slide: Any,
        left: float,
        top: float,
        width: float,
        height: float,
        color_hex: str | None = None,
    ) -> Any:
        """Add a solid borderless accent strip."""
        bar = slide.shapes.add_shape(
            self.MSO_SHAPE.RECTANGLE,
            self.Inches(left),
            self.Inches(top),
            self.Inches(width),
            self.Inches(height),
        )
        bar.fill.solid()
        bar.fill.fore_color.rgb = self.rgb(color_hex or self.theme.accent_hex)
        bar.line.fill.background()
        return bar

    def _add_textbox(
        self,
        slide: Any,
        left: float,
        top: float,
        width: float,
        height: float,
        text: str = "",
        font_size: int = 16,
        color_hex: str | None = None,
        bold: bool = False,
        italic: bool = False,
        font_name: str | None = None,
        align: Any = None,
        anchor: Any = None,
    ) -> Any:
        """Create a wrapped textbox with consistent margins and typography."""
        box = slide.shapes.add_textbox(
            self.Inches(left),
            self.Inches(top),
            self.Inches(width),
            self.Inches(height),
        )
        tf = box.text_frame
        tf.word_wrap = True
        tf.margin_left = self.Inches(0.04)
        tf.margin_right = self.Inches(0.04)
        tf.margin_top = self.Inches(0.02)
        tf.margin_bottom = self.Inches(0.02)
        if anchor is not None:
            tf.vertical_anchor = anchor

        if text:
            p = tf.paragraphs[0]
            if align is not None:
                p.alignment = align
            run = p.add_run()
            run.text = text
            self._style_run(
                run,
                font_size=font_size,
                color_hex=color_hex or self.theme.text_hex,
                bold=bold,
                italic=italic,
                font_name=font_name or self.theme.body_font,
            )
        return box

    def _style_run(
        self,
        run: Any,
        font_size: int,
        color_hex: str,
        bold: bool = False,
        italic: bool = False,
        font_name: str | None = None,
    ) -> None:
        """Apply font family, size, weight, and RGB color to a text run."""
        run.font.name = font_name or self.theme.body_font
        run.font.size = self.Pt(font_size)
        run.font.bold = bold
        run.font.italic = italic
        run.font.color.rgb = self.rgb(color_hex)

    def _add_pill(
        self,
        slide: Any,
        left: float,
        top: float,
        text: str,
        bg_hex: str | None = None,
        fg_hex: str | None = None,
    ) -> None:
        """Add a compact uppercase eyebrow badge."""
        width = max(1.4, min(4.5, 0.45 + len(text) * 0.11))
        pill = slide.shapes.add_shape(
            self.MSO_SHAPE.ROUNDED_RECTANGLE,
            self.Inches(left),
            self.Inches(top),
            self.Inches(width),
            self.Inches(0.34),
        )
        if len(pill.adjustments) > 0:
            pill.adjustments[0] = 0.5
        pill.fill.solid()
        pill.fill.fore_color.rgb = self.rgb(bg_hex or self.theme.surface_alt_hex)
        pill.line.fill.background()

        tf = pill.text_frame
        tf.word_wrap = False
        tf.vertical_anchor = self.MSO_ANCHOR.MIDDLE
        p = tf.paragraphs[0]
        p.alignment = self.PP_ALIGN.CENTER
        run = p.add_run()
        run.text = text.upper()
        self._style_run(
            run,
            font_size=10,
            color_hex=fg_hex or self.theme.primary_hex,
            bold=True,
            font_name=self.theme.body_font,
        )

    def _add_slide_header(self, slide: Any, spec: dict[str, Any]) -> float:
        """Render eyebrow badge, main slide title, and optional subtitle; return content top Y."""
        y = 0.34
        eyebrow = spec.get("eyebrow") or spec.get("section")
        if eyebrow:
            self._add_pill(slide, MARGIN_X_IN, y, str(eyebrow))
            y += 0.42

        title = str(spec.get("title", ""))
        self._add_textbox(
            slide,
            MARGIN_X_IN,
            y,
            CONTENT_WIDTH_IN,
            0.7,
            text=title,
            font_size=26,
            color_hex=self.theme.text_hex,
            bold=True,
            font_name=self.theme.heading_font,
        )
        y += 0.68

        subtitle = spec.get("subtitle")
        if subtitle:
            self._add_textbox(
                slide,
                MARGIN_X_IN,
                y,
                CONTENT_WIDTH_IN,
                0.42,
                text=str(subtitle),
                font_size=14,
                color_hex=self.theme.muted_hex,
            )
            y += 0.44

        self._add_accent_bar(slide, MARGIN_X_IN, y, 1.1, 0.05, self.theme.accent_hex)
        return y + 0.22

    def _add_footer(self, slide: Any, index: int, total: int) -> None:
        """Render subtle divider, deck title, and slide counter."""
        line = slide.shapes.add_shape(
            self.MSO_SHAPE.RECTANGLE,
            self.Inches(MARGIN_X_IN),
            self.Inches(6.95),
            self.Inches(CONTENT_WIDTH_IN),
            self.Inches(0.015),
        )
        line.fill.solid()
        line.fill.fore_color.rgb = self.rgb(self.theme.border_hex)
        line.line.fill.background()

        self._add_textbox(
            slide,
            MARGIN_X_IN,
            7.02,
            8.5,
            0.3,
            text=self.deck_title,
            font_size=10,
            color_hex=self.theme.muted_hex,
        )
        self._add_textbox(
            slide,
            SLIDE_WIDTH_IN - MARGIN_X_IN - 1.5,
            7.02,
            1.5,
            0.3,
            text=f"{index} / {total}",
            font_size=10,
            color_hex=self.theme.muted_hex,
            align=self.PP_ALIGN.RIGHT,
        )

    def _write_bullets(
        self,
        tf: Any,
        items: list[Any],
        font_size: int = 16,
        space_after: int = 10,
    ) -> None:
        """Write formatted bullets into a text frame, bolding 'Label: detail' prefixes."""
        tf.word_wrap = True
        for i, raw_item in enumerate(items):
            text = str(raw_item).strip()
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.space_after = self.Pt(space_after)
            p.line_spacing = 1.2

            bullet_run = p.add_run()
            bullet_run.text = "•  "
            self._style_run(
                bullet_run,
                font_size=font_size,
                color_hex=self.theme.accent_hex,
                bold=True,
            )

            if ": " in text and text.index(": ") <= 38:
                lead, rest = text.split(": ", 1)
                lead_run = p.add_run()
                lead_run.text = f"{lead}: "
                self._style_run(
                    lead_run,
                    font_size=font_size,
                    color_hex=self.theme.text_hex,
                    bold=True,
                )
                body_run = p.add_run()
                body_run.text = rest
                self._style_run(
                    body_run,
                    font_size=font_size,
                    color_hex=self.theme.text_hex,
                )
            else:
                body_run = p.add_run()
                body_run.text = text
                self._style_run(
                    body_run,
                    font_size=font_size,
                    color_hex=self.theme.text_hex,
                )

    # --- Layout Renderers -------------------------------------------------

    def _render_title_slide(
        self, slide: Any, spec: dict[str, Any], index: int, total: int
    ) -> None:
        self._add_accent_bar(slide, 0, 0.08, 0.28, SLIDE_HEIGHT_IN - 0.08, self.theme.primary_hex)
        eyebrow = spec.get("eyebrow") or "PRESENTATION"
        self._add_pill(
            slide,
            1.05,
            1.55,
            str(eyebrow),
            bg_hex=self.theme.primary_hex,
            fg_hex=self.theme.on_primary_hex,
        )

        self._add_textbox(
            slide,
            1.05,
            2.15,
            10.9,
            1.8,
            text=str(spec.get("title", "")),
            font_size=42,
            color_hex=self.theme.text_hex,
            bold=True,
            font_name=self.theme.heading_font,
        )

        if spec.get("subtitle"):
            self._add_textbox(
                slide,
                1.05,
                4.05,
                10.5,
                1.0,
                text=str(spec["subtitle"]),
                font_size=20,
                color_hex=self.theme.muted_hex,
            )

        self._add_accent_bar(slide, 1.05, 5.3, 1.6, 0.08, self.theme.accent_hex)

        meta_parts = [
            str(spec[k]) for k in ("author", "date", "meta") if spec.get(k)
        ]
        if meta_parts:
            self._add_textbox(
                slide,
                1.05,
                5.65,
                10.5,
                0.45,
                text="   •   ".join(meta_parts),
                font_size=13,
                color_hex=self.theme.muted_hex,
            )

    def _render_agenda_slide(
        self, slide: Any, spec: dict[str, Any], index: int, total: int
    ) -> None:
        top_y = self._add_slide_header(slide, spec)
        items = spec.get("items") or spec.get("bullets") or []
        cols = 2 if len(items) > 3 else 1
        gap_x = 0.35
        gap_y = 0.24
        card_w = (CONTENT_WIDTH_IN - gap_x * (cols - 1)) / cols
        rows = max(1, (len(items) + cols - 1) // cols)
        avail_h = 6.65 - top_y
        card_h = min(1.35, (avail_h - gap_y * (rows - 1)) / rows)

        for idx_item, raw in enumerate(items[:6]):
            row = idx_item // cols
            col = idx_item % cols
            x = MARGIN_X_IN + col * (card_w + gap_x)
            y = top_y + row * (card_h + gap_y)
            self._add_panel(slide, x, y, card_w, card_h)
            self._add_accent_bar(slide, x, y, 0.1, card_h, self.theme.primary_hex)

            item_title = (
                str(raw.get("title", "")) if isinstance(raw, dict) else str(raw)
            )
            item_desc = (
                str(raw.get("description", "")) if isinstance(raw, dict) else ""
            )

            self._add_textbox(
                slide,
                x + 0.25,
                y + 0.16,
                0.65,
                0.45,
                text=f"0{idx_item + 1}",
                font_size=20,
                color_hex=self.theme.accent_hex,
                bold=True,
                font_name=self.theme.heading_font,
            )
            self._add_textbox(
                slide,
                x + 0.92,
                y + 0.16,
                card_w - 1.15,
                0.42,
                text=item_title,
                font_size=16,
                color_hex=self.theme.text_hex,
                bold=True,
            )
            if item_desc:
                self._add_textbox(
                    slide,
                    x + 0.92,
                    y + 0.56,
                    card_w - 1.15,
                    card_h - 0.65,
                    text=item_desc,
                    font_size=13,
                    color_hex=self.theme.muted_hex,
                )

        self._add_footer(slide, index, total)

    def _render_bullets_slide(
        self, slide: Any, spec: dict[str, Any], index: int, total: int
    ) -> None:
        top_y = self._add_slide_header(slide, spec)
        bullets = spec.get("bullets", [])
        callout = spec.get("callout")
        panel_h = 6.7 - top_y

        if callout:
            main_w = CONTENT_WIDTH_IN * 0.64
            call_w = CONTENT_WIDTH_IN - main_w - 0.35
            self._add_panel(slide, MARGIN_X_IN, top_y, main_w, panel_h)
            box = self._add_textbox(
                slide, MARGIN_X_IN + 0.3, top_y + 0.28, main_w - 0.6, panel_h - 0.5
            )
            self._write_bullets(box.text_frame, bullets, font_size=16)

            call_x = MARGIN_X_IN + main_w + 0.35
            self._add_panel(
                slide,
                call_x,
                top_y,
                call_w,
                panel_h,
                fill_hex=self.theme.surface_alt_hex,
            )
            self._add_accent_bar(slide, call_x, top_y, call_w, 0.08, self.theme.accent_hex)
            c_title = (
                callout.get("title", "Key Takeaway")
                if isinstance(callout, dict)
                else "Key Takeaway"
            )
            c_body = (
                callout.get("body", "") if isinstance(callout, dict) else str(callout)
            )
            self._add_textbox(
                slide,
                call_x + 0.28,
                top_y + 0.32,
                call_w - 0.56,
                0.45,
                text=str(c_title),
                font_size=17,
                color_hex=self.theme.primary_hex,
                bold=True,
                font_name=self.theme.heading_font,
            )
            self._add_textbox(
                slide,
                call_x + 0.28,
                top_y + 0.85,
                call_w - 0.56,
                panel_h - 1.1,
                text=str(c_body),
                font_size=15,
                color_hex=self.theme.text_hex,
            )
        else:
            self._add_panel(slide, MARGIN_X_IN, top_y, CONTENT_WIDTH_IN, panel_h)
            box = self._add_textbox(
                slide,
                MARGIN_X_IN + 0.35,
                top_y + 0.3,
                CONTENT_WIDTH_IN - 0.7,
                panel_h - 0.6,
            )
            self._write_bullets(box.text_frame, bullets, font_size=17)

        self._add_footer(slide, index, total)

    def _render_two_column_slide(
        self, slide: Any, spec: dict[str, Any], index: int, total: int
    ) -> None:
        top_y = self._add_slide_header(slide, spec)
        gap = 0.35
        col_w = (CONTENT_WIDTH_IN - gap) / 2
        col_h = 6.7 - top_y
        columns = [
            (MARGIN_X_IN, spec.get("left") or {}, self.theme.primary_hex),
            (MARGIN_X_IN + col_w + gap, spec.get("right") or {}, self.theme.accent_hex),
        ]

        for x, col_data, accent in columns:
            self._add_panel(slide, x, top_y, col_w, col_h)
            self._add_accent_bar(slide, x, top_y, col_w, 0.08, accent)
            heading = col_data.get("heading") or col_data.get("title") or ""
            if heading:
                self._add_textbox(
                    slide,
                    x + 0.28,
                    top_y + 0.26,
                    col_w - 0.56,
                    0.45,
                    text=str(heading),
                    font_size=18,
                    color_hex=self.theme.text_hex,
                    bold=True,
                    font_name=self.theme.heading_font,
                )
            body_top = top_y + (0.82 if heading else 0.32)
            if col_data.get("bullets"):
                box = self._add_textbox(
                    slide, x + 0.28, body_top, col_w - 0.56, col_h - 1.05
                )
                self._write_bullets(box.text_frame, col_data["bullets"], font_size=15)
            elif col_data.get("body"):
                self._add_textbox(
                    slide,
                    x + 0.28,
                    body_top,
                    col_w - 0.56,
                    col_h - 1.05,
                    text=str(col_data["body"]),
                    font_size=15,
                    color_hex=self.theme.text_hex,
                )

        self._add_footer(slide, index, total)

    def _render_cards_slide(
        self, slide: Any, spec: dict[str, Any], index: int, total: int
    ) -> None:
        top_y = self._add_slide_header(slide, spec)
        cards = (spec.get("cards") or [])[:4]
        if not cards:
            self._add_footer(slide, index, total)
            return

        count = len(cards)
        gap = 0.28
        card_w = (CONTENT_WIDTH_IN - gap * (count - 1)) / count
        card_h = 6.68 - top_y
        accents = [
            self.theme.primary_hex,
            self.theme.accent_hex,
            self.theme.primary_hex,
            self.theme.accent_hex,
        ]

        for idx_c, card in enumerate(cards):
            x = MARGIN_X_IN + idx_c * (card_w + gap)
            self._add_panel(slide, x, top_y, card_w, card_h)
            self._add_accent_bar(slide, x, top_y, card_w, 0.08, accents[idx_c % 4])

            y_cursor = top_y + 0.25
            badge = card.get("badge") or card.get("metric")
            if badge:
                self._add_textbox(
                    slide,
                    x + 0.22,
                    y_cursor,
                    card_w - 0.44,
                    0.45,
                    text=str(badge),
                    font_size=22,
                    color_hex=accents[idx_c % 4],
                    bold=True,
                    font_name=self.theme.heading_font,
                )
                y_cursor += 0.48
            else:
                self._add_textbox(
                    slide,
                    x + 0.22,
                    y_cursor,
                    card_w - 0.44,
                    0.35,
                    text=f"0{idx_c + 1}",
                    font_size=14,
                    color_hex=accents[idx_c % 4],
                    bold=True,
                )
                y_cursor += 0.36

            self._add_textbox(
                slide,
                x + 0.22,
                y_cursor,
                card_w - 0.44,
                0.62,
                text=str(card.get("title", "")),
                font_size=17 if count <= 3 else 15,
                color_hex=self.theme.text_hex,
                bold=True,
                font_name=self.theme.heading_font,
            )
            y_cursor += 0.65

            if card.get("bullets"):
                box = self._add_textbox(
                    slide,
                    x + 0.22,
                    y_cursor,
                    card_w - 0.44,
                    card_h - (y_cursor - top_y) - 0.2,
                )
                self._write_bullets(
                    box.text_frame,
                    card["bullets"],
                    font_size=13 if count >= 4 else 14,
                    space_after=7,
                )
            elif card.get("body"):
                self._add_textbox(
                    slide,
                    x + 0.22,
                    y_cursor,
                    card_w - 0.44,
                    card_h - (y_cursor - top_y) - 0.2,
                    text=str(card["body"]),
                    font_size=14 if count <= 3 else 13,
                    color_hex=self.theme.muted_hex,
                )

        self._add_footer(slide, index, total)

    def _render_metrics_slide(
        self, slide: Any, spec: dict[str, Any], index: int, total: int
    ) -> None:
        top_y = self._add_slide_header(slide, spec)
        metrics = (spec.get("metrics") or [])[:4]
        chart_spec = spec.get("chart")
        bullets = spec.get("bullets") or []

        y_cursor = top_y
        if metrics:
            count = len(metrics)
            gap = 0.25
            card_w = (CONTENT_WIDTH_IN - gap * (count - 1)) / count
            kpi_h = 1.65 if (chart_spec or bullets) else (6.65 - top_y)
            for idx_m, metric in enumerate(metrics):
                x = MARGIN_X_IN + idx_m * (card_w + gap)
                self._add_panel(
                    slide,
                    x,
                    y_cursor,
                    card_w,
                    kpi_h,
                    fill_hex=self.theme.surface_alt_hex
                    if idx_m == 0
                    else self.theme.surface_hex,
                )
                self._add_textbox(
                    slide,
                    x + 0.2,
                    y_cursor + 0.22,
                    card_w - 0.4,
                    0.65,
                    text=str(metric.get("value", "")),
                    font_size=30,
                    color_hex=self.theme.primary_hex,
                    bold=True,
                    font_name=self.theme.heading_font,
                )
                self._add_textbox(
                    slide,
                    x + 0.2,
                    y_cursor + 0.9,
                    card_w - 0.4,
                    0.45,
                    text=str(metric.get("label", "")),
                    font_size=13,
                    color_hex=self.theme.text_hex,
                    bold=True,
                )
                if metric.get("delta"):
                    self._add_textbox(
                        slide,
                        x + 0.2,
                        y_cursor + 1.28,
                        card_w - 0.4,
                        0.3,
                        text=str(metric["delta"]),
                        font_size=11,
                        color_hex=self.theme.accent_hex,
                        bold=True,
                    )
            y_cursor += kpi_h + 0.25

        remaining_h = 6.7 - y_cursor
        if chart_spec and remaining_h > 1.5:
            self._add_chart(slide, chart_spec, MARGIN_X_IN, y_cursor, CONTENT_WIDTH_IN, remaining_h)
        elif bullets and remaining_h > 1.0:
            self._add_panel(slide, MARGIN_X_IN, y_cursor, CONTENT_WIDTH_IN, remaining_h)
            box = self._add_textbox(
                slide,
                MARGIN_X_IN + 0.3,
                y_cursor + 0.2,
                CONTENT_WIDTH_IN - 0.6,
                remaining_h - 0.4,
            )
            self._write_bullets(box.text_frame, bullets, font_size=15)

        self._add_footer(slide, index, total)

    def _add_chart(
        self,
        slide: Any,
        chart_spec: dict[str, Any],
        left: float,
        top: float,
        width: float,
        height: float,
    ) -> None:
        """Render a native PowerPoint column chart inside a styled container."""
        self._add_panel(slide, left, top, width, height)
        chart_data = self.pptx["CategoryChartData"]()
        chart_data.categories = [str(c) for c in chart_spec["categories"]]
        for series in chart_spec["series"]:
            chart_data.add_series(str(series.get("name", "Series")), series["values"])

        chart_frame = slide.shapes.add_chart(
            self.pptx["XL_CHART_TYPE"].COLUMN_CLUSTERED,
            self.Inches(left + 0.2),
            self.Inches(top + 0.12),
            self.Inches(width - 0.4),
            self.Inches(height - 0.24),
            chart_data,
        )
        chart = chart_frame.chart
        chart.has_legend = len(chart_spec["series"]) > 1
        if chart_spec.get("title"):
            chart.has_title = True
            chart.chart_title.text_frame.text = str(chart_spec["title"])

        palette = [self.theme.primary_hex, self.theme.accent_hex, self.theme.muted_hex]
        for idx_s, series in enumerate(chart.series):
            series.format.fill.solid()
            series.format.fill.fore_color.rgb = self.rgb(palette[idx_s % len(palette)])

    def _render_comparison_slide(
        self, slide: Any, spec: dict[str, Any], index: int, total: int
    ) -> None:
        if spec.get("columns") and spec.get("rows"):
            top_y = self._add_slide_header(slide, spec)
            cols = spec["columns"]
            rows = spec["rows"]
            total_rows = len(rows) + 1
            table_h = min(6.65 - top_y, total_rows * 0.65 + 0.2)
            table = slide.shapes.add_table(
                total_rows,
                len(cols),
                self.Inches(MARGIN_X_IN),
                self.Inches(top_y),
                self.Inches(CONTENT_WIDTH_IN),
                self.Inches(table_h),
            ).table

            for c_idx, header in enumerate(cols):
                cell = table.cell(0, c_idx)
                cell.fill.solid()
                cell.fill.fore_color.rgb = self.rgb(self.theme.primary_hex)
                cell.vertical_anchor = self.MSO_ANCHOR.MIDDLE
                p = cell.text_frame.paragraphs[0]
                run = p.add_run()
                run.text = str(header)
                self._style_run(
                    run, font_size=14, color_hex=self.theme.on_primary_hex, bold=True
                )

            for r_idx, row_vals in enumerate(rows, start=1):
                bg = self.theme.surface_hex if r_idx % 2 == 1 else self.theme.surface_alt_hex
                for c_idx, val in enumerate(row_vals[: len(cols)]):
                    cell = table.cell(r_idx, c_idx)
                    cell.fill.solid()
                    cell.fill.fore_color.rgb = self.rgb(bg)
                    cell.vertical_anchor = self.MSO_ANCHOR.MIDDLE
                    p = cell.text_frame.paragraphs[0]
                    run = p.add_run()
                    run.text = str(val)
                    self._style_run(
                        run,
                        font_size=13,
                        color_hex=self.theme.text_hex,
                        bold=(c_idx == 0),
                    )
            self._add_footer(slide, index, total)
        else:
            self._render_two_column_slide(slide, spec, index, total)

    def _render_timeline_slide(
        self, slide: Any, spec: dict[str, Any], index: int, total: int
    ) -> None:
        top_y = self._add_slide_header(slide, spec)
        steps = (spec.get("steps") or spec.get("items") or [])[:5]
        if not steps:
            self._add_footer(slide, index, total)
            return

        count = len(steps)
        gap = 0.24
        step_w = (CONTENT_WIDTH_IN - gap * (count - 1)) / count
        line_y = top_y + 0.55

        self._add_accent_bar(
            slide,
            MARGIN_X_IN + step_w * 0.2,
            line_y,
            CONTENT_WIDTH_IN - step_w * 0.4,
            0.05,
            self.theme.border_hex,
        )

        card_top = top_y + 1.0
        card_h = 6.68 - card_top
        for idx_s, step in enumerate(steps):
            x = MARGIN_X_IN + idx_s * (step_w + gap)
            phase = (
                str(step.get("phase", f"Phase {idx_s + 1}"))
                if isinstance(step, dict)
                else f"Step {idx_s + 1}"
            )
            title = str(step.get("title", "")) if isinstance(step, dict) else str(step)
            desc = str(step.get("description", "")) if isinstance(step, dict) else ""

            self._add_pill(
                slide,
                x + 0.1,
                top_y + 0.38,
                phase,
                bg_hex=self.theme.primary_hex if idx_s == 0 else self.theme.accent_hex,
                fg_hex=self.theme.on_primary_hex,
            )
            self._add_panel(slide, x, card_top, step_w, card_h)
            self._add_textbox(
                slide,
                x + 0.18,
                card_top + 0.22,
                step_w - 0.36,
                0.65,
                text=title,
                font_size=15,
                color_hex=self.theme.text_hex,
                bold=True,
                font_name=self.theme.heading_font,
            )
            if desc:
                self._add_textbox(
                    slide,
                    x + 0.18,
                    card_top + 0.92,
                    step_w - 0.36,
                    card_h - 1.1,
                    text=desc,
                    font_size=13,
                    color_hex=self.theme.muted_hex,
                )

        self._add_footer(slide, index, total)

    def _render_quote_slide(
        self, slide: Any, spec: dict[str, Any], index: int, total: int
    ) -> None:
        self._add_panel(
            slide,
            MARGIN_X_IN + 0.4,
            1.25,
            CONTENT_WIDTH_IN - 0.8,
            4.8,
            fill_hex=self.theme.surface_alt_hex,
        )
        self._add_textbox(
            slide,
            MARGIN_X_IN + 0.8,
            1.4,
            1.2,
            1.0,
            text="“",
            font_size=72,
            color_hex=self.theme.accent_hex,
            bold=True,
            font_name=self.theme.heading_font,
        )
        quote_text = str(spec.get("quote") or spec.get("title") or "")
        self._add_textbox(
            slide,
            MARGIN_X_IN + 1.0,
            2.25,
            CONTENT_WIDTH_IN - 2.0,
            2.3,
            text=quote_text,
            font_size=26,
            color_hex=self.theme.text_hex,
            italic=True,
            font_name=self.theme.heading_font,
        )
        attribution = spec.get("attribution") or spec.get("subtitle")
        if attribution:
            self._add_textbox(
                slide,
                MARGIN_X_IN + 1.0,
                4.85,
                CONTENT_WIDTH_IN - 2.0,
                0.5,
                text=f"— {attribution}",
                font_size=16,
                color_hex=self.theme.primary_hex,
                bold=True,
            )
        self._add_footer(slide, index, total)

    def _render_closing_slide(
        self, slide: Any, spec: dict[str, Any], index: int, total: int
    ) -> None:
        self._add_accent_bar(slide, 0, 0.08, 0.28, SLIDE_HEIGHT_IN - 0.08, self.theme.accent_hex)
        self._add_pill(
            slide,
            1.05,
            1.25,
            str(spec.get("eyebrow") or "NEXT STEPS"),
            bg_hex=self.theme.primary_hex,
            fg_hex=self.theme.on_primary_hex,
        )
        self._add_textbox(
            slide,
            1.05,
            1.8,
            10.9,
            1.1,
            text=str(spec.get("title", "Thank You")),
            font_size=36,
            color_hex=self.theme.text_hex,
            bold=True,
            font_name=self.theme.heading_font,
        )

        items = spec.get("next_steps") or spec.get("bullets") or []
        if items:
            self._add_panel(slide, 1.05, 3.05, 10.9, 2.75)
            box = self._add_textbox(slide, 1.35, 3.3, 10.3, 2.3)
            self._write_bullets(box.text_frame, items, font_size=16)
        elif spec.get("subtitle"):
            self._add_textbox(
                slide,
                1.05,
                3.15,
                10.5,
                1.1,
                text=str(spec["subtitle"]),
                font_size=20,
                color_hex=self.theme.muted_hex,
            )

        if spec.get("contact"):
            self._add_textbox(
                slide,
                1.05,
                6.1,
                10.5,
                0.45,
                text=str(spec["contact"]),
                font_size=14,
                color_hex=self.theme.primary_hex,
                bold=True,
            )
        self._add_footer(slide, index, total)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse CLI arguments for PPTX deck generation."""
    parser = argparse.ArgumentParser(
        description="Build a 16:9 .pptx presentation from a validated deck.json file."
    )
    parser.add_argument("--input", "-i", type=Path, required=True, help="Path to deck.json.")
    parser.add_argument("--output", "-o", type=Path, help="Output .pptx file path.")
    parser.add_argument(
        "--theme",
        help="Optional preset theme ID override (e.g., executive-navy, dark-tech).",
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Validate deck JSON and theme without writing a .pptx file.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Entrypoint for PPTX validation and generation."""
    args = parse_args(argv)
    if not args.input.exists():
        print(f"[FAIL] Input deck file not found: {args.input}", file=sys.stderr)
        return 1

    deck = json.loads(args.input.read_text(encoding="utf-8"))
    errors = validate_deck_spec(deck)
    if errors:
        print("[FAIL] Deck validation failed:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    theme = resolve_theme(args.theme if args.theme else deck.get("theme"))
    slide_count = len(deck["slides"])
    print(f"[OK] Validated {slide_count} slide(s) with theme '{theme.id}' ({theme.name}).")

    if args.validate_only:
        return 0

    output_path = args.output or args.input.with_suffix(".pptx")
    try:
        pptx_modules = _load_pptx_modules()
    except RuntimeError as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        return 2

    deck_title = str(deck.get("title") or output_path.stem)
    renderer = DeckRenderer(pptx_modules, theme, deck_title)
    written_count = renderer.render(deck, output_path)
    size_kb = output_path.stat().st_size / 1024
    print(f"[SUCCESS] Generated {written_count}-slide PPTX: {output_path} ({size_kb:.1f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
