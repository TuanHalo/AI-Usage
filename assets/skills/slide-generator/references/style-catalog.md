# Slide Style Catalog

Each preset below maps directly to a built-in theme ID in `scripts/themes.py` and `scripts/preview_styles.py`.

## Built-In Theme Presets

| Theme ID | Display Name | Palette (Canvas / Primary / Accent / Text) | Typography (Heading / Body) | Visual Vibe & Best Fit |
| :--- | :--- | :--- | :--- | :--- |
| `executive-navy` | **Executive Navy** | `#F8FAFC` / `#0F172A` / `#2563EB` / `#0F172A` | Segoe UI / Segoe UI | Crisp corporate structure, sharp corners. Ideal for board decks, QBRs, and enterprise strategy. |
| `modern-clay` | **Modern Clay** | `#F0F0F7` / `#7C3AED` / `#0D9488` / `#2E1065` | Segoe UI / Segoe UI | Friendly soft lavender & mint surfaces, rounded cards. Ideal for product showcases, UX, and workshops. |
| `dark-tech` | **Dark Tech** | `#0B0F19` / `#06B6D4` / `#8B5CF6` / `#F1F5F9` | Segoe UI / Segoe UI | Sleek dark obsidian canvas with cyan & violet highlights. Ideal for AI/dev talks and architecture reviews. |
| `editorial-minimal` | **Editorial Minimal** | `#FAF8F5` / `#C2410C` / `#78350F` / `#1C1917` | Georgia / Segoe UI | Warm alabaster paper feel with classic serif headings. Ideal for research reports and consulting memos. |
| `emerald-growth` | **Emerald Growth** | `#F4FBF7` / `#065F46` / `#10B981` / `#064E3B` | Segoe UI / Segoe UI | Clean sage & deep forest palette. Ideal for FinTech, sustainability, healthcare, and growth metrics. |
| `vibrant-startup` | **Vibrant Startup** | `#FFFFFF` / `#4F46E5` / `#E11D48` / `#1E1B4B` | Segoe UI / Segoe UI | High-energy indigo & coral contrast. Ideal for startup pitches, launches, and marketing proposals. |

---

## Recommending Styles by Topic

Pick **3–4 contrasting options** from the catalog so the user has genuine visual variety rather than four near-identical palettes:
- **Business / Executive / Strategy**: `executive-navy`, `editorial-minimal`, `emerald-growth`, `modern-clay`
- **Software / AI / Engineering**: `dark-tech`, `executive-navy`, `modern-clay`, `vibrant-startup`
- **Startup Pitch / Product / Marketing**: `vibrant-startup`, `modern-clay`, `dark-tech`, `executive-navy`
- **Research / Education / Policy**: `editorial-minimal`, `modern-clay`, `executive-navy`, `emerald-growth`

---

## Custom Brand Overrides

If the user provides custom brand colors or fonts, set `theme` in `deck.json` to an override object referencing any `base` preset:

```json
{
  "theme": {
    "base": "executive-navy",
    "name": "Acme Brand",
    "primary_hex": "#1E3A8A",
    "accent_hex": "#F59E0B",
    "corner_style": "rounded"
  }
}
```

### Supported Override Keys
- `base`: Preset ID to inherit defaults from (`executive-navy`, `modern-clay`, `dark-tech`, `editorial-minimal`, `emerald-growth`, `vibrant-startup`)
- `bg_hex`, `surface_hex`, `surface_alt_hex`, `border_hex`, `primary_hex`, `accent_hex`, `text_hex`, `muted_hex`, `on_primary_hex`
- `heading_font`, `body_font`
- `corner_style`: `"rounded"` or `"sharp"`

