# Archify Bridge Walkthrough Example

This example shows how an agent uses the `AI-Usage` `archify` bridge skill together with the local Archify installation at `D:\IT\archify\archify`.

---

## Scenario
**User**: *"Use archify to draw a sequence diagram for our login flow: Browser calls API, API checks Redis session cache, and on cache miss queries PostgreSQL."*

---

## 1. Resolve Local Engine & Read Upstream Contract
Verify the bridge resolves to `D:\IT\archify\archify`:
```powershell
powershell -File C:\Users\admin\.gemini\config\skills\archify\scripts\invoke-archify.ps1 -ResolveOnly
```
Read:
- `D:\IT\archify\archify\SKILL.md`
- `D:\IT\archify\archify\references\authoring-defaults.md`
- `D:\IT\archify\archify\schemas\sequence.schema.json`
- `D:\IT\archify\archify\schemas\common.schema.json`
- `D:\IT\archify\archify\examples\cache-miss-request.sequence.json` (shape reference only)

---

## 2. Author Candidate JSON in Dedicated Output Folder
Create `.archify\sequence-login-session-20261110-204500\candidate.json` (with `meta.output` set to `.archify/sequence-login-session-20261110-204500/login-session.html`, or `outputs/diagrams/login-session/login-session.html` for a published `AI-Usage` artifact) following `sequence.schema.json` and `authoring-defaults.md`.

---

## 3. Run `finalize` via Upstream CLI
```powershell
node D:\IT\archify\archify\bin\archify.mjs finalize sequence .archify/sequence-login-session-20261110-204500/candidate.json .archify/sequence-login-session-20261110-204500/login-session.html --quality showcase --json
```
Or via the wrapper script:
```powershell
powershell -File C:\Users\admin\.gemini\config\skills\archify\scripts\invoke-archify.ps1 finalize sequence .archify/sequence-login-session-20261110-204500/candidate.json .archify/sequence-login-session-20261110-204500/login-session.html --quality showcase --json
```

If `finalize` exits non-zero, read the JSON diagnostic summary, edit only the affected neighborhood in `candidate.json`, and rerun `finalize` (using `--out-dir .../review-2` if `browser-check` already ran for that output path).

---

## 4. Report Result
Reply concisely with a clickable link to the verified HTML file:
> Created [Login session sequence diagram](file:///D:/IT/AI-Usage/.archify/sequence-login-session-20261110-204500/login-session.html).

