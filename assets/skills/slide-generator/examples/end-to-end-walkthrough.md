# End-to-End Walkthrough Example

This example illustrates every gate from topic intake through final `.pptx` generation.

---

## Turn 1 — Topic Intake
**User**: *"Create a presentation about migrating our team to automated API contract testing."*  
**Assistant**:
- Confirms topic (`Automated API Contract Testing Migration`), asks quick scoping questions if missing (audience: engineering leadership + backend squad; target: ~8 slides).

---

## Turn 2 — Multi-Source Research & Concern Check (Gate 1)
**Assistant actions**:
1. Scans local repo (`README.md`, `contracts/`, OpenAPI specs, CI workflows) to find actual test tools and pain points.
2. Searches web benchmarks on consumer-driven contract testing (e.g., Pact / schema testing benefits) if industry data strengthens the argument.
3. Summarizes gathered facts and asks:
   > **Research Summary**:
   > - **Internal context**: Found 4 microservices in `services/` using OpenAPI 3.1 specs without automated breaking-change checks in CI.
   > - **External insight**: Contract testing catches integration mismatches locally before shared staging environments block releases.
   > - **Proposed flow**: Problem -> Why Contract Testing -> Architecture -> Rollout Plan -> Impact & Next Steps.
   >
   > **Any concerns, corrections, or constraints (e.g., tools to exclude, timeline limits, audience emphasis) before I draft the slide content?**

**User**: *"No concerns—please emphasize zero downtime and keep rollout realistic for a 4-week sprint."*

---

## Turn 3 — Slide Deck Content Draft & Review (Gate 2)
**Assistant** presents all 8 slides in Markdown (layout role, headline, concise bullets/cards/metrics, visual cues, speaker notes) and asks:
> *"Please review this slide content. Let me know if you want any changes, or approve it so I can suggest visual styles with samples."*

**User**: *"Looks great, approved! Maybe swap Slide 5's bullet list into a comparison table."*  
**Assistant** updates Slide 5 to `comparison` and confirms content is locked.

---

## Turn 4 — Style Suggestions & Visual Samples (Gate 3)
**Assistant**:
1. Recommends 3–4 best-fit presets (`dark-tech`, `executive-navy`, `modern-clay`, `emerald-growth`) suited for an engineering architecture + leadership deck.
2. Renders live visual samples populated with `"Automated API Contract Testing Migration"` (either via inline HTML widget in Antigravity or `scripts/preview_styles.py --output style-preview.html`).
3. Asks: *"Which style sample looks best to you? Pick a theme ID (or ask for color tweaks) to generate the PPTX."*

**User**: *"Let's go with `executive-navy`."*

---

## Turn 5 — PPTX Generation & Verification
**Assistant** writes `deck.json` and runs:
```powershell
python <skill_dir>/scripts/generate_pptx.py --input deck.json --output api-contract-testing.pptx
```

Sample `deck.json` excerpt:
```json
{
  "title": "Automated API Contract Testing Migration",
  "theme": "executive-navy",
  "slides": [
    {
      "layout": "title",
      "eyebrow": "ENGINEERING PROPOSAL",
      "title": "Automated API Contract Testing",
      "subtitle": "Zero-downtime integration confidence across 4 microservices",
      "author": "Platform Team",
      "date": "2026-11-10"
    },
    {
      "layout": "cards",
      "eyebrow": "WHY NOW",
      "title": "Three Bottlenecks Blocking Weekly Releases",
      "cards": [
        { "badge": "42%", "title": "Staging Delays", "body": "Integration breaks caught only after shared merges." },
        { "badge": "6 hrs", "title": "Manual Triage", "body": "Weekly debug time tracing breaking payload changes." },
        { "badge": "0", "title": "Automated Gates", "body": "OpenAPI specs exist but are never enforced in CI." }
      ]
    },
    {
      "layout": "timeline",
      "eyebrow": "4-WEEK PLAN",
      "title": "Zero-Downtime Phased Rollout",
      "steps": [
        { "phase": "Week 1", "title": "Baseline", "description": "Audit schemas across 4 services." },
        { "phase": "Week 2", "title": "Shadow CI", "description": "Run non-blocking contract checks." },
        { "phase": "Week 3", "title": "Enforce", "description": "Block breaking schema diffs on PRs." },
        { "phase": "Week 4", "title": "Expand", "description": "Add consumer contract assertions." }
      ]
    }
  ]
}
```

**Verification output**:
```text
[OK] Validated 8 slide(s) with theme 'executive-navy' (Executive Navy).
[SUCCESS] Generated 8-slide PPTX: api-contract-testing.pptx (46.8 KB)
```

