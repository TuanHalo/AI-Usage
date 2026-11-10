# Archify Local Bridge Reference

## Architecture: Zero-Duplication Link to `D:\IT\archify`

Instead of duplicating Archify's renderers, JSON schemas, examples, and CLI scripts into `AI-Usage`, this canonical skill acts as a **bridge** to the local Archify checkout:

- **Primary Local Checkout**: `D:\IT\archify\archify` (Apache-2.0, v3.2.0)
- **Resolution Priority**:
  1. `-ArchifyHome` parameter (when invoking `scripts/invoke-archify.ps1`)
  2. `$env:ARCHIFY_HOME` environment variable
  3. Sibling repository layout `..\archify\archify`
  4. `D:\IT\archify\archify`

This keeps `AI-Usage` lightweight and automatically picks up updates made inside `D:\IT\archify` (`git pull`) without resyncing hundreds of upstream files.

---

## Upstream File Map (`<ARCHIFY_HOME>` = `D:\IT\archify\archify`)

| Purpose | Exact Upstream Path | When to Read |
| :--- | :--- | :--- |
| Authoritative Skill Contract | `<ARCHIFY_HOME>\SKILL.md` | Always read first before authoring |
| Authoring Defaults | `<ARCHIFY_HOME>\references\authoring-defaults.md` | Every new native diagram |
| Code-Backed Evidence | `<ARCHIFY_HOME>\references\repository-authoring.md` | Diagrams tracing a real repository |
| One-Page Explainer Spec | `<ARCHIFY_HOME>\references\explainer-authoring.md` | When generating an `explainer` page |
| Delivery & Repair Contract | `<ARCHIFY_HOME>\references\delivery-contract.md` | Gate failures, recovery, visual check |
| Geometry & Label Contract | `<ARCHIFY_HOME>\references\authoring-contract.md` | Geometry/field failures or dense modes |
| Architecture Route Repair | `<ARCHIFY_HOME>\references\architecture-layout-repair.md` | Tangled multi-route repairs |
| Brand Marks | `<ARCHIFY_HOME>\references\brand-marks.md` | Explicitly requested product marks |
| Viewer Runtime Features | `<ARCHIFY_HOME>\references\viewer-runtime.md` | Deep links, share cards, motion controls |
| Update Awareness | `<ARCHIFY_HOME>\references\update-awareness.md` | When `finalize` sets `update.noticeRequired` |
| JSON Schemas | `<ARCHIFY_HOME>\schemas\<type>.schema.json` + `common.schema.json` | Before choosing fields/enums |
| Showcase Examples | `<ARCHIFY_HOME>\examples\*.json` | Structural reference for each mode |

---

## Type Router Summary

| Mode | Use For | Upstream Example |
| :--- | :--- | :--- |
| `architecture` | Systems, services, trust boundaries | `examples/web-app.architecture.json` / `production-deployment.architecture.json` |
| `workflow` | Processes, approvals, CI/CD, runbooks | `examples/agent-tool-call.workflow.json` |
| `sequence` | API call chains, async traces, returns | `examples/cache-miss-request.sequence.json` |
| `dataflow` | Pipelines, ETL/ELT, lineage, stores | `examples/product-analytics.dataflow.json` |
| `lifecycle` | State/status transitions, retries | `examples/deployment-release.lifecycle.json` |
| `erd` | Database tables, columns, keys, relations | `examples/orders.erd.json` |
| `class` | Classes, interfaces, members, dependencies | `examples/payments.class.json` |
| `tree` | Single-parent hierarchies, module trees | `examples/payment-platform.tree.json` |
| `timeline` | Timestamped events across source lanes | `examples/payment-incident.timeline.json` |
| `waterfall` | Span timings, overlap, nesting | `examples/checkout-request.waterfall.json` |
| `explainer` | Conclusion-first multi-panel answer page | See `references/explainer-authoring.md` |

---

## Verified CLI Commands (`node <ARCHIFY_HOME>\bin\archify.mjs ...`)

All commands can also be run via `powershell -File scripts/invoke-archify.ps1 <subcommand> ...`:

- `doctor` — Check Node.js (`>=18`) and local environment readiness
- `guide "<scenario>" --json` — Disambiguate diagram type for a scenario
- `finalize <type> <candidate> <output.html> --quality showcase --json` — Validate, deliver atomically, check HTML, and run browser check (`--repo-root <path>` for repo-backed diagrams)
- `validate <type> <candidate> --quality showcase --json` — Focused schema/layout diagnosis
- `deliver <type> <candidate> <output.html> --quality showcase --json` — Atomic delivery with provenance sidecar
- `compare architecture <base.json> <head.json> <delta.html> --json` — Architecture Before/Delta/After diff
- `preview <diagram-type> <candidate.json> <output.html> --quality showcase` — Loopback live preview

---

## `AI-Usage` Integration & Sandbox Notes

1. **Output Paths**:
   - General workspaces: `.archify/<type>-<slug>-<YYYYMMDD-HHMMSS>/` (`candidate.json` or `candidate.archify.md` + `<slug>.html`).
   - Publishable `AI-Usage` diagrams: `outputs/diagrams/<slug>/<slug>.html` (with working candidate/receipts kept cleanly alongside or in `.archify/`).
2. **Windows Node.js / NVM in Sandboxed Agents**:
   - On Windows setups using `nvm4w` (`C:\nvm4w\nodejs` -> `%LOCALAPPDATA%\nvm`), sandboxed shells may return `Access is denied` for `node.exe`.
   - Run file authoring, candidate preparation, and `invoke-archify.ps1 -ResolveOnly` inside the sandbox; execute only the `node <ARCHIFY_HOME>\bin\archify.mjs ...` (or `invoke-archify.ps1`) step unsandboxed when required.
3. **Update & Install Boundaries**:
   - Per `D:\IT\archify\AGENTS.md`, never auto-install, overwrite unrelated unmanaged files, or auto-update `D:\IT\archify` without explicit user confirmation.

