"""Generate an interactive self-contained HTML style gallery for slide themes."""

from __future__ import annotations

import argparse
import html
import json
import sys
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from themes import THEMES, SlideTheme, resolve_theme


DEFAULT_SAMPLE_THEMES = (
    "executive-navy",
    "modern-clay",
    "dark-tech",
    "editorial-minimal",
)


def extract_preview_content(
    deck_path: Path | None,
    title: str | None,
    subtitle: str | None,
    sample_heading: str | None,
    sample_points: list[str] | None,
) -> dict[str, Any]:
    """Build preview text from a deck JSON file or CLI arguments."""
    resolved_title = title or "Your Presentation Title"
    resolved_subtitle = subtitle or "Data-backed insights, strategic pillars, and clear next steps"
    resolved_heading = sample_heading or "Key Strategic Pillars"
    resolved_points = sample_points or [
        "Clear takeaway headline grounded in verified insights",
        "Structured 3-pillar layout for effortless visual scanning",
        "Consistent typography and high-contrast accent hierarchy",
    ]

    if deck_path is not None:
        raw = json.loads(deck_path.read_text(encoding="utf-8"))
        deck_title = raw.get("title")
        deck_subtitle = raw.get("subtitle")
        slides = raw.get("slides", [])
        if deck_title and not title:
            resolved_title = str(deck_title)
        if deck_subtitle and not subtitle:
            resolved_subtitle = str(deck_subtitle)
        for slide in slides:
            layout = slide.get("layout", "bullets")
            if layout in ("title", "closing"):
                if not title and slide.get("title"):
                    resolved_title = str(slide["title"])
                if not subtitle and slide.get("subtitle"):
                    resolved_subtitle = str(slide["subtitle"])
                continue
            if not sample_heading and slide.get("title"):
                resolved_heading = str(slide["title"])
            if not sample_points:
                extracted = _extract_slide_snippets(slide)
                if extracted:
                    resolved_points = extracted[:3]
            break

    return {
        "title": resolved_title,
        "subtitle": resolved_subtitle,
        "sample_heading": resolved_heading,
        "sample_points": resolved_points[:3],
    }


def _extract_slide_snippets(slide: dict[str, Any]) -> list[str]:
    """Pull up to 3 concise preview snippets from any supported slide layout."""
    if slide.get("bullets"):
        return [str(item) for item in slide["bullets"][:3]]
    if slide.get("cards"):
        return [
            f"{card.get('title', 'Pillar')}: {card.get('body', '')}".strip(": ")
            for card in slide["cards"][:3]
        ]
    if slide.get("items"):
        return [
            f"{item.get('title', 'Item')}: {item.get('description', '')}".strip(": ")
            for item in slide["items"][:3]
        ]
    if slide.get("metrics"):
        return [
            f"{m.get('value', '')} — {m.get('label', '')}".strip(" —")
            for m in slide["metrics"][:3]
        ]
    return []


def _render_theme_card(theme: SlideTheme, content: dict[str, Any], index: int) -> str:
    """Render one theme option with swatches and miniature Title + Content slides."""
    radius = "12px" if theme.corner_style == "rounded" else "2px"
    pill_radius = "999px" if theme.corner_style == "rounded" else "3px"

    esc_id = html.escape(theme.id)
    esc_name = html.escape(theme.name)
    esc_tagline = html.escape(theme.tagline)
    esc_best = html.escape(theme.best_for)
    esc_title = html.escape(content["title"])
    esc_subtitle = html.escape(content["subtitle"])
    esc_heading = html.escape(content["sample_heading"])
    esc_hfont = html.escape(theme.heading_font)
    esc_bfont = html.escape(theme.body_font)

    cards_html = "".join(
        f"""
        <div class="mini-card" style="background:{theme.surface_hex};border:1px solid {theme.border_hex};border-radius:{radius};">
          <div class="mini-card-bar" style="background:{theme.primary_hex if i != 1 else theme.accent_hex};"></div>
          <div class="mini-card-num" style="color:{theme.accent_hex};">0{i + 1}</div>
          <div class="mini-card-text" style="color:{theme.text_hex};font-family:'{esc_bfont}',sans-serif;">
            {html.escape(point)}
          </div>
        </div>
        """
        for i, point in enumerate(content["sample_points"])
    )

    swatches = [
        ("Canvas", theme.bg_hex),
        ("Surface", theme.surface_hex),
        ("Primary", theme.primary_hex),
        ("Accent", theme.accent_hex),
        ("Text", theme.text_hex),
    ]
    swatch_html = "".join(
        f'<span class="swatch" title="{label}: {color}"><i style="background:{color};"></i>{color}</span>'
        for label, color in swatches
    )

    return f"""
    <article class="theme-option" data-theme-id="{esc_id}" onclick="selectTheme('{esc_id}')">
      <div class="theme-header">
        <div>
          <div class="theme-title-row">
            <span class="option-num">Option {index}</span>
            <h2>{esc_name}</h2>
            <code class="theme-id">{esc_id}</code>
          </div>
          <p class="theme-tagline">{esc_tagline}</p>
          <p class="theme-best"><strong>Best for:</strong> {esc_best}</p>
        </div>
        <button type="button" class="pick-btn" onclick="event.stopPropagation(); selectTheme('{esc_id}')">
          Choose Style
        </button>
      </div>

      <div class="slides-pair">
        <div class="slide-frame" style="background:{theme.bg_hex};border:1px solid {theme.border_hex};border-radius:{radius};">
          <div class="slide-top-strip" style="background:{theme.primary_hex};"></div>
          <div class="slide-body title-slide">
            <span class="eyebrow-pill" style="background:{theme.surface_alt_hex};color:{theme.primary_hex};border-radius:{pill_radius};font-family:'{esc_bfont}',sans-serif;">
              DECK PREVIEW
            </span>
            <h3 style="color:{theme.text_hex};font-family:'{esc_hfont}',sans-serif;">{esc_title}</h3>
            <p style="color:{theme.muted_hex};font-family:'{esc_bfont}',sans-serif;">{esc_subtitle}</p>
            <div class="title-accent-line" style="background:{theme.accent_hex};"></div>
          </div>
          <div class="slide-footer" style="color:{theme.muted_hex};border-top:1px solid {theme.border_hex};">
            <span>Cover Slide</span><span>1</span>
          </div>
        </div>

        <div class="slide-frame" style="background:{theme.bg_hex};border:1px solid {theme.border_hex};border-radius:{radius};">
          <div class="slide-top-strip" style="background:{theme.accent_hex};"></div>
          <div class="slide-body content-slide">
            <div class="content-heading" style="color:{theme.text_hex};font-family:'{esc_hfont}',sans-serif;">
              {esc_heading}
            </div>
            <div class="mini-cards-grid">
              {cards_html}
            </div>
          </div>
          <div class="slide-footer" style="color:{theme.muted_hex};border-top:1px solid {theme.border_hex};">
            <span>Content Slide</span><span>2</span>
          </div>
        </div>
      </div>

      <div class="theme-meta">
        <div class="swatches">{swatch_html}</div>
        <div class="fonts-meta">Fonts: <strong>{esc_hfont}</strong> / {esc_bfont}</div>
      </div>
    </article>
    """


def build_preview_html(themes: list[SlideTheme], content: dict[str, Any]) -> str:
    """Assemble a complete standalone HTML page comparing selected slide themes."""
    cards = "\n".join(
        _render_theme_card(theme, content, idx + 1)
        for idx, theme in enumerate(themes)
    )
    esc_title = html.escape(content["title"])

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Slide Style Samples — {esc_title}</title>
  <style>
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      padding: 32px 24px 64px;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: #f1f5f9;
      color: #0f172a;
    }}
    .container {{ max-width: 1120px; margin: 0 auto; }}
    .page-header {{
      margin-bottom: 28px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      flex-wrap: wrap;
      gap: 16px;
    }}
    .page-header h1 {{ margin: 0 0 6px; font-size: 1.75rem; }}
    .page-header p {{ margin: 0; color: #475569; }}
    .selection-banner {{
      position: sticky;
      top: 12px;
      z-index: 10;
      display: none;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 18px;
      margin-bottom: 20px;
      border-radius: 14px;
      background: #0f172a;
      color: #f8fafc;
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.25);
    }}
    .selection-banner.visible {{ display: flex; }}
    .themes-list {{ display: grid; gap: 24px; }}
    .theme-option {{
      background: #ffffff;
      border: 2px solid #e2e8f0;
      border-radius: 18px;
      padding: 20px;
      transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
      cursor: pointer;
    }}
    .theme-option:hover {{
      border-color: #94a3b8;
      transform: translateY(-2px);
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
    }}
    .theme-option.selected {{
      border-color: #2563eb;
      box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.16);
    }}
    .theme-header {{
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 16px;
    }}
    .theme-title-row {{ display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }}
    .theme-title-row h2 {{ margin: 0; font-size: 1.25rem; }}
    .option-num {{
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 3px 9px;
      border-radius: 999px;
      background: #e2e8f0;
      color: #334155;
    }}
    .theme-id {{
      font-size: 0.8rem;
      padding: 2px 8px;
      border-radius: 6px;
      background: #f1f5f9;
      color: #475569;
    }}
    .theme-tagline {{ margin: 6px 0 4px; color: #334155; font-size: 0.95rem; }}
    .theme-best {{ margin: 0; color: #64748b; font-size: 0.85rem; }}
    .pick-btn {{
      border: none;
      border-radius: 10px;
      padding: 9px 16px;
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
      background: #0f172a;
      color: #ffffff;
      white-space: nowrap;
    }}
    .theme-option.selected .pick-btn {{ background: #2563eb; }}
    .slides-pair {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 16px;
    }}
    .slide-frame {{
      aspect-ratio: 16 / 9;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
    }}
    .slide-top-strip {{ height: 5px; width: 100%; flex-shrink: 0; }}
    .slide-body {{
      flex: 1;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      overflow: hidden;
    }}
    .title-slide {{ align-items: flex-start; gap: 8px; }}
    .eyebrow-pill {{
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      padding: 3px 9px;
    }}
    .title-slide h3 {{
      margin: 0;
      font-size: 1.25rem;
      line-height: 1.2;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }}
    .title-slide p {{
      margin: 0;
      font-size: 0.82rem;
      line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }}
    .title-accent-line {{ width: 44px; height: 4px; border-radius: 999px; margin-top: 4px; }}
    .content-slide {{ justify-content: flex-start; gap: 10px; }}
    .content-heading {{ font-size: 1rem; font-weight: 700; }}
    .mini-cards-grid {{
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      flex: 1;
    }}
    .mini-card {{
      padding: 10px 8px;
      display: flex;
      flex-direction: column;
      gap: 5px;
      overflow: hidden;
    }}
    .mini-card-bar {{ height: 3px; width: 28px; border-radius: 999px; }}
    .mini-card-num {{ font-size: 0.72rem; font-weight: 800; }}
    .mini-card-text {{
      font-size: 0.68rem;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 4;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }}
    .slide-footer {{
      display: flex;
      justify-content: space-between;
      padding: 4px 16px;
      font-size: 0.68rem;
    }}
    .theme-meta {{
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid #f1f5f9;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      font-size: 0.8rem;
      color: #475569;
    }}
    .swatches {{ display: flex; flex-wrap: wrap; gap: 10px; }}
    .swatch {{ display: inline-flex; align-items: center; gap: 5px; font-family: monospace; }}
    .swatch i {{
      width: 14px;
      height: 14px;
      border-radius: 4px;
      border: 1px solid rgba(15, 23, 42, 0.2);
      display: inline-block;
    }}
  </style>
</head>
<body>
  <div class="container">
    <header class="page-header">
      <div>
        <h1>Slide Style Samples</h1>
        <p>Live 16:9 visual previews for <strong>{esc_title}</strong>. Click any option to select it.</p>
      </div>
    </header>

    <div id="selection-banner" class="selection-banner">
      <span>Selected style: <strong id="selected-label"></strong> — reply in chat with this style ID to generate your PPTX.</span>
    </div>

    <main class="themes-list">
      {cards}
    </main>
  </div>

  <script>
    function selectTheme(id) {{
      document.querySelectorAll('.theme-option').forEach((el) => {{
        el.classList.toggle('selected', el.dataset.themeId === id);
      }});
      const banner = document.getElementById('selection-banner');
      const label = document.getElementById('selected-label');
      label.textContent = id;
      banner.classList.add('visible');
    }}
  </script>
</body>
</html>
"""


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse CLI arguments for the style preview generator."""
    parser = argparse.ArgumentParser(
        description="Generate visual HTML slide style previews from built-in presets."
    )
    parser.add_argument("--deck", type=Path, help="Optional deck.json to extract title & sample content.")
    parser.add_argument("--title", help="Presentation title for the sample cover slide.")
    parser.add_argument("--subtitle", help="Presentation subtitle for the sample cover slide.")
    parser.add_argument("--sample-heading", help="Heading for the sample content slide.")
    parser.add_argument(
        "--sample-points",
        nargs="*",
        help="Up to 3 short bullet strings for the sample content slide.",
    )
    parser.add_argument(
        "--themes",
        default=",".join(DEFAULT_SAMPLE_THEMES),
        help="Comma-separated preset IDs or 'all' (default: 4 curated styles).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("style-preview.html"),
        help="Output HTML file path (default: style-preview.html).",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print resolved themes and sample content as JSON instead of writing HTML.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Entrypoint for preview generation."""
    args = parse_args(argv)
    if args.themes.strip().lower() == "all":
        theme_ids = list(THEMES.keys())
    else:
        theme_ids = [item.strip() for item in args.themes.split(",") if item.strip()]

    resolved_themes = [resolve_theme(tid) for tid in theme_ids]
    content = extract_preview_content(
        deck_path=args.deck,
        title=args.title,
        subtitle=args.subtitle,
        sample_heading=args.sample_heading,
        sample_points=args.sample_points,
    )

    if args.json:
        payload = {
            "content": content,
            "themes": [t.to_dict() for t in resolved_themes],
        }
        print(json.dumps(payload, indent=2))
        return 0

    output_html = build_preview_html(resolved_themes, content)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(output_html, encoding="utf-8")
    print(f"[OK] Generated visual style preview ({len(resolved_themes)} styles): {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

