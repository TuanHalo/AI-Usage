# Slide Layouts & Deck JSON Schema

`scripts/generate_pptx.py` builds 16:9 (`13.333" × 7.5"`) decks from a structured `deck.json` specification.

## Top-Level Schema

```json
{
  "title": "Deck Footer Title",
  "subtitle": "Optional subtitle used in previews",
  "theme": "executive-navy",
  "slides": [
    { "layout": "title", "...": "..." }
  ]
}
```

---

## Supported Layouts

### 1. `title` (Cover Slide)
```json
{
  "layout": "title",
  "eyebrow": "QUARTERLY BRIEFING",
  "title": "Scaling Agent Workflows Across Engineering",
  "subtitle": "Lessons from 6 months of production deployment",
  "author": "Platform Team",
  "date": "2026-11-10",
  "notes": "Welcome everyone and frame the scope of today's session."
}
```

### 2. `agenda` (Numbered Roadmap)
Up to 6 items rendered in 1 or 2 clean columns.
```json
{
  "layout": "agenda",
  "eyebrow": "AGENDA",
  "title": "What We Will Cover Today",
  "items": [
    { "title": "Current Bottlenecks", "description": "Where manual setup slows teams down" },
    { "title": "Unified Architecture", "description": "Single source of truth for skills & rules" },
    { "title": "Rollout Metrics", "description": "Velocity and error-rate impact" },
    { "title": "Next Quarter Plan", "description": "Milestones and ownership" }
  ]
}
```

### 3. `bullets` (Key Takeaways + Optional Callout)
Include `callout` to render a highlighted right-hand insight box. Prefixing items with `Label: detail` automatically bolds the label.
```json
{
  "layout": "bullets",
  "eyebrow": "PROBLEM",
  "title": "Fragmented Tooling Creates Configuration Drift",
  "bullets": [
    "Duplicated prompts: Teams maintain 4 separate rule formats manually",
    "Silent regressions: Outdated instructions break onboarding workflows",
    "No validation: Schema mismatches only surface during live execution"
  ],
  "callout": {
    "title": "Core Impact",
    "body": "Engineers lose ~2.5 hours per week reconciling conflicting local setups."
  }
}
```

### 4. `two_column` (Side-by-Side Comparison / Split)
```json
{
  "layout": "two_column",
  "eyebrow": "APPROACH",
  "title": "Before vs. After Canonical Authoring",
  "left": {
    "heading": "Ad-Hoc Files",
    "bullets": ["Manual copy-paste per tool", "Inconsistent conventions"]
  },
  "right": {
    "heading": "Canonical Pipeline",
    "bullets": ["Single YAML source", "Automated schema checks"]
  }
}
```

### 5. `cards` (2, 3, or 4 Structured Pillar Cards)
```json
{
  "layout": "cards",
  "eyebrow": "SOLUTION",
  "title": "Three Core Pillars of the New Workflow",
  "cards": [
    { "badge": "01", "title": "Canonical YAML", "body": "Author once with strict contract metadata." },
    { "badge": "02", "title": "Zero-Drift Sync", "body": "Transform automatically to every IDE target." },
    { "badge": "03", "title": "Visual Hub", "body": "Publish searchable catalogs on GitHub Pages." }
  ]
}
```

### 6. `metrics` (KPI Strip + Optional Native Chart or Bullets)
```json
{
  "layout": "metrics",
  "eyebrow": "IMPACT",
  "title": "Measurable Gains After Rollout",
  "metrics": [
    { "value": "68%", "label": "Faster Onboarding", "delta": "+24 pts QoQ" },
    { "value": "0", "label": "Schema Errors", "delta": "100% validated" },
    { "value": "4", "label": "Synced Targets", "delta": "Single command" }
  ],
  "chart": {
    "title": "Weekly Setup Hours Saved per Team",
    "categories": ["Q1", "Q2", "Q3", "Q4"],
    "series": [
      { "name": "Manual", "values": [12, 11, 12, 13] },
      { "name": "Automated", "values": [12, 6, 3, 2] }
    ]
  }
}
```

### 7. `comparison` (Native Table or Two-Column Fallback)
```json
{
  "layout": "comparison",
  "eyebrow": "EVALUATION",
  "title": "Tooling Options at a Glance",
  "columns": ["Capability", "Manual Setup", "Canonical Sync"],
  "rows": [
    ["Schema Validation", "None", "Automated pre-sync"],
    ["Multi-Tool Parity", "Drifts weekly", "Guaranteed"],
    ["Documentation Site", "Separate effort", "Auto-generated JSON"]
  ]
}
```

### 8. `timeline` (Up to 5 Sequential Phases)
```json
{
  "layout": "timeline",
  "eyebrow": "ROADMAP",
  "title": "Phased Rollout Plan",
  "steps": [
    { "phase": "Week 1", "title": "Audit", "description": "Inventory existing rules & prompts." },
    { "phase": "Week 2", "title": "Migrate", "description": "Convert core assets to YAML." },
    { "phase": "Week 3", "title": "Validate", "description": "Enable CI validation checks." },
    { "phase": "Week 4", "title": "Launch", "description": "Sync across engineering teams." }
  ]
}
```

### 9. `quote` (Pull Quote / Core Thesis)
```json
{
  "layout": "quote",
  "quote": "Treat prompts and agent workflows with the same rigor as production APIs.",
  "attribution": "Engineering Architecture Review, 2026"
}
```

### 10. `closing` (Summary / Next Steps / Q&A)
```json
{
  "layout": "closing",
  "eyebrow": "NEXT STEPS",
  "title": "Ready to Roll Out This Sprint",
  "next_steps": [
    "Approve canonical asset list by Friday",
    "Run sync script across pilot engineering squad",
    "Review adoption metrics at next monthly sync"
  ],
  "contact": "Questions? Reach #platform-ai-tooling"
}
```

---

## Readability & Density Guidelines
- **One takeaway per slide**: Write titles as insights (`"Automated Validation Eliminates Drift"`), not vague labels (`"Validation"`).
- **Scannable text**: Keep bullet lists to 3–5 points (~10–15 words each); push deeper narrative into `notes`.
- **Visual variety**: Alternate layouts (`cards` -> `metrics` -> `two_column` -> `timeline`) rather than stacking 5 plain `bullets` slides in a row.

