# Slide Generator Workflow & Approval Gates

This workflow enforces three explicit human-in-the-loop checkpoints so the user controls **facts/concerns**, **slide content**, and **visual style** before any `.pptx` file is generated.

---

## Gate Summary

| Stage | Objective | Blocking Gate Before Next Stage |
| :--- | :--- | :--- |
| 1. Topic Intake | Capture topic, audience, purpose, constraints | Topic is clear |
| 2. Research & Concerns | Gather files, internet, and user context | **Gate 1**: User clears all concerns & assumptions |
| 3. Content Draft | Produce complete slide-by-slide script | **Gate 2**: User explicitly approves slide content |
| 4. Style & Samples | Suggest 3–4 styles with live visual samples | **Gate 3**: User selects and approves visual style |
| 5. PPTX Generation | Build `.pptx` via `scripts/generate_pptx.py` | Validated `deck.json` + `python-pptx` check |
| 6. Verification | Confirm output file integrity & slide count | Delivered `.pptx` path to user |

---

## Detailed Stage Rules

### Stage 1: Topic Intake
- If the user's request lacks a clear topic, ask for:
  1. **Topic / Title idea**
  2. **Target audience & goal** (e.g., executive buy-in, technical walkthrough, investor pitch, training)
  3. **Target length / language** (optional default: 8–12 slides in the user's language)
- If the user already stated the topic, acknowledge it and ask only the missing high-value scoping details (or move straight into Stage 2 research while flagging lightweight questions).

### Stage 2: Multi-Source Research & Concern Check (Gate 1)
Gather supporting material proportionally across three sources:
1. **Local Files & Workspace**: Search relevant project files, markdown notes, reports, spreadsheets, PDFs, or source code if the topic relates to local work.
2. **Internet / Web Search**: Retrieve current industry benchmarks, statistics, definitions, or case studies with credible citations when external facts improve the deck.
3. **User Knowledge**: Identify proprietary numbers, internal decisions, or angle preferences that only the user knows.

Present a compact **Research & Context Brief**:
- Key findings & data points gathered (with source attribution)
- Proposed narrative arc (3–4 core sections)
- Gaps, assumptions, or sensitive areas noticed

Then ask explicitly:
> *"Before I draft the slide content, do you have any concerns, corrections, sensitive topics to exclude, or extra context you'd like me to factor in?"*

Wait for confirmation before drafting slides.

### Stage 3: Slide Deck Content Drafting & Review (Gate 2)
Draft every slide in clean Markdown before touching colors or PowerPoint XML:

```markdown
### Slide 3 — [cards] Three Pillars Driving Adoption
- **Title**: Why Teams Adopt Unified Workflows
- **Cards**:
  1. **Speed** (`3x faster`): Reusable templates remove setup overhead.
  2. **Consistency** (`0 drift`): Shared validation catches schema bugs early.
  3. **Portability** (`4 tools`): Write once, sync to every coding assistant.
- **Speaker Notes**: Emphasize how standardization cuts onboarding from days to minutes.
```

Rules for the content draft:
- **Never skip this gate** or start styling while content is still unapproved.
- If the user asks for changes (merge slides, change tone, add metrics, rewrite bullets), update the affected slides and confirm again until approved.

### Stage 4: Style Suggestions & Visual Samples (Gate 3)
Once content is approved:
1. Recommend **3–4 themes** from `references/style-catalog.md` tailored to the topic, audience, and tone.
2. Render **visual style samples** populated with the user's actual deck title and a real sample slide:
   - **Antigravity / Interactive UI**: Create an HTML artifact showing the 3–4 recommended styles side-by-side as compact 16:9 miniature slide mockups (Cover + Sample Content slide) with color swatches and font pairings, and embed inline via `<agent-embed>` (keeping compact height) or link as a standalone artifact.
   - **CLI / Universal Fallback**: Generate a self-contained gallery HTML using:
     ```bash
     python <skill_dir>/scripts/preview_styles.py --deck deck.json --themes executive-navy,modern-clay,dark-tech,editorial-minimal --output style-preview.html
     ```
     (Or pass `--title`, `--subtitle`, `--sample-heading`, and `--sample-points` if `deck.json` isn't written yet.)
3. Present a short comparison table (Option #, Theme ID, Aesthetic Vibe, Best Fit) and ask the user to choose a style or request custom color/font adjustments.

### Stage 5 & 6: PPTX Generation & Verification
1. Verify `python-pptx` is installed: `python -c "import pptx"`.
   - If missing, install with `pip install python-pptx` (confirming with the user if package installation requires approval).
2. Save the approved deck + chosen theme ID (or custom overrides) as `deck.json`.
3. Validate first (optional) and generate:
   ```bash
   python <skill_dir>/scripts/generate_pptx.py --input deck.json --output "<deck-name>.pptx"
   ```
4. Confirm `[SUCCESS] Generated <N>-slide PPTX` output and report the exact file path and slide count.

