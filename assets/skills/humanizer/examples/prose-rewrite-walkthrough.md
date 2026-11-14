# Humanizer Bridge Walkthrough Example

This example shows how an agent uses the `AI-Usage` `humanizer` bridge skill together with the local Humanizer checkout at `D:\IT\humanizer`.

---

## Scenario A: Pasted Text
**User**: *"Use humanizer on this paragraph: 'Let's dive in. Our new caching layer isn't just an optimization — it's a paradigm shift that serves as the cornerstone of our robust architecture, underscoring our commitment to excellence. That is the real win.'"*

### 1. Resolve Local Package & Read Upstream Prompt
Verify the bridge resolves to `D:\IT\humanizer`:
```powershell
powershell -File C:\Users\admin\.gemini\config\skills\humanizer\scripts\resolve-humanizer.ps1 -ResolveOnly
```
Read `D:\IT\humanizer\SKILL.md` (sections: *How to work*, *Voice*, *What to return*, and *§1–§26*).

### 2. Mark Tells & Draft Rewrite
- **Tells found**: §4 staged run-up (`Let's dive in.`), §1 not-X-but-Y (`isn't just ... — it's`), §8 em dash (`—`), §18 avoiding *is* (`serves as`), §12 overused AI word (`robust`), §15 shallow `-ing` phrase (`underscoring`), §16 sales language (`commitment to excellence`), §2 one-line closer (`That is the real win.`).
- **Draft**: *Our new caching layer cuts repeat lookups and lowers request latency across the service.*
- **Check**: No facts dropped; no remaining §1, §2, §6, §8, or §19 tells.

### 3. Deliver Pasted-Text Output
Return the draft, the short list of remaining patterns (none, or any deliberate edge case), and the final rewrite.

---

## Scenario B: File Mode (`README.md` or Markdown Doc)
**User**: *"Humanize the prose in `docs/launch-post.md`."*

1. Read the entire current `docs/launch-post.md` from disk first.
2. Edit prose sections only — keep code blocks, inline code, commands, file paths, YAML frontmatter, data tables, and link targets unchanged.
3. Write only the final rewritten prose back to `docs/launch-post.md`.
4. Summarize how many sections were reviewed and explicitly report if any section could not be covered.
