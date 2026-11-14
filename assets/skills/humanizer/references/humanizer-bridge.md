# Humanizer Local Bridge Reference

## Architecture: Zero-Duplication Link to `D:\IT\humanizer`

Instead of copying Humanizer's 498-line prompt specification, examples, and package validation scripts into `AI-Usage`, this canonical skill acts as a **bridge** to the local Humanizer checkout:

- **Primary Local Checkout**: `D:\IT\humanizer` (MIT, upstream `v4.0.0`)
- **Resolution Priority**:
  1. `-HumanizerHome` parameter (when invoking `scripts/resolve-humanizer.ps1`)
  2. `$env:HUMANIZER_HOME` environment variable
  3. Sibling repository layout `..\humanizer`
  4. `D:\IT\humanizer`

This keeps `AI-Usage` concise under progressive disclosure and automatically picks up updates made inside `D:\IT\humanizer` (`git pull`) without resyncing upstream Markdown.

---

## Upstream File Map (`<HUMANIZER_HOME>` = `D:\IT\humanizer`)

| Purpose | Exact Upstream Path | When to Read |
| :--- | :--- | :--- |
| Authoritative Skill Prompt | `<HUMANIZER_HOME>\SKILL.md` | Always read first before rewriting prose |
| Contributor & Package Rules | `<HUMANIZER_HOME>\AGENTS.md` | Only when modifying `D:\IT\humanizer` itself |
| Pattern Overview & Examples | `<HUMANIZER_HOME>\README.md` | Optional quick table & full Lisbon example |
| Release History | `<HUMANIZER_HOME>\CHANGELOG.md` | Checking upstream behavior changes |
| Package Self-Validator | `<HUMANIZER_HOME>\scripts\validate-package.py` | Only if validating upstream package integrity |

---

## 26-Pattern Index (Authoritative Definitions in `<HUMANIZER_HOME>\SKILL.md`)

| Section | Patterns | Threshold |
| :--- | :--- | :--- |
| **A. Staging instead of stating** | §1 Not X but Y, §2 One-line closers & fragments, §3 Deep-sounding sayings, §4 Staged run-ups, §5 Arguing with no one | Act on 1 sighting |
| **B. Rhythm by rule** | §6 Forced triads, §7 Repeated sentence openings, §8 Dashes (`—`, `–`, ` -- `), §9 Stacked qualifiers, §10 Hyphenated pairs, §11 Passive voice & missing subjects | §6–§7 act directly; §8–§11 *weak alone* |
| **C. Inflation & borrowed authority** | §12 Overused AI words, §13 Inflated significance, §14 Vague association, §15 Shallow `-ing` phrases, §16 Sales language, §17 Borrowed authority, §18 Avoiding `is`/`are`/`has` | Act on context |
| **D. Formatting by rule** | §19 Bold as decoration, §20 Decorative headings (Title Case, emojis, `→`, rules), §21 Curly quotes | §21 *weak alone* |
| **E. Chat & draft leftovers** | §22 Chatbot residue, §23 Knowledge-limit disclaimers & guesses, §24 Heading repeated in first sentence, §25 Writing about the document instead of its subject | §22–§24 cut outright; single §25 *weak alone* |
| **F. Writing for the wrong reader** | §26 Re-explaining what the reader knows (replies/threads) | Lead with decision when reply context is visible |

---

## Modes & Output Contract

1. **Pasted text (default)**: Return (a) the initial draft, (b) a short list of remaining patterns, and (c) the final rewrite.
2. **File mode**: Read the full file from disk first (even if written in the same session), edit prose only (never alter code blocks, inline code, commands, paths, YAML metadata, data, or link targets), and report how many sections were reviewed (disclosing any partial pass).
3. **Embedded mode**: Return only the final rewritten text when another skill or task invokes Humanizer internally.

---

## Update & Packaging Boundaries

- Never modify files inside `D:\IT\humanizer` during normal prose-editing tasks.
- If updating `D:\IT\humanizer` intentionally, follow `<HUMANIZER_HOME>\AGENTS.md` and verify with `python scripts/validate-package.py`.
