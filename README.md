# 🔮 AI-Usage

> **Canonical Source of Truth for AI Assets, Multi-Tool Synchronization & Interactive Deliverables.**

[![GitHub Pages Deployment](https://img.shields.io/badge/GitHub%20Pages-Live%20Demo-7c3aed?style=flat-square&logo=github)](https://tuanhalo.github.io/AI-Usage/)
[![Style](https://img.shields.io/badge/Design-Claymorphism-fcd5ce?style=flat-square)](https://tuanhalo.github.io/AI-Usage/)
[![Tools Supported](https://img.shields.io/badge/Sync-Antigravity%20%7C%20Cursor%20%7C%20Claude%20%7C%20Gemini-d4f0e8?style=flat-square)](#-synchronization-scripts)

---

## 🌟 What is AI-Usage?

`AI-Usage` is a centralized repository that stores, validates, and syncs all AI-related configuration and knowledge assets across multiple coding tools, while hosting an interactive **Claymorphism**-styled documentation site and AI deliverables hub on **GitHub Pages**.

### Core Capabilities

1. **Canonical Authoring (Single Source of Truth)**
   Author skills, rules, agents, and engineering principles once in universal YAML/Markdown.
2. **Multi-Tool Synchronization**
   A single script transforms and syncs canonical assets into the native configuration formats of:
   - **Antigravity (AGY)** (`~/.gemini/config/skills/<name>/SKILL.md` & `AGENTS.md`)
   - **Cursor** (`~/.cursor/rules/<name>.mdc`)
   - **Claude Code** (`~/.claude/CLAUDE.md`)
   - **Gemini CLI** (`~/.gemini/GEMINI.md`)
3. **Consistency Contracts**
   Strict declarative contracts (`content-contract.yaml`, `style-contract.yaml`, `output-contract.yaml`) verified by JSON schemas to ensure uniform structure and aesthetic consistency.
4. **Rich AI Outputs & Archify Integration**
   AI research reports and visual architecture graphs (including future graph skill **Archify**) are published as rich interactive HTML pages.

---

## 📂 Repository Structure

```text
AI-Usage/
├── 📁 assets/                     # ── CANONICAL ASSETS (Source of Truth) ──
│   ├── 📁 skills/                 # Skills (e.g. deep-research)
│   ├── 📁 rules/                  # Rules (e.g. typescript-standards)
│   ├── 📁 agents/                 # Agents (e.g. research-analyst)
│   └── 📁 principles/             # Principles (e.g. progressive-disclosure)
│
├── 📁 outputs/                    # ── AI-GENERATED OUTPUTS ──
│   ├── 📁 research/               # Deep technical evaluations (rich HTML)
│   ├── 📁 reports/                # Periodic analysis reports
│   └── 📁 experiments/            # Experiment logs and metrics
│
├── 📁 contracts/                  # ── CONSISTENCY CONTRACTS ──
│   ├── content-contract.yaml      # Content structure & token limits
│   ├── style-contract.yaml        # Claymorphism tokens & shadow formula
│   ├── output-contract.yaml       # HTML structure & citation rules
│   └── 📁 schemas/                # JSON Schemas for validation
│
├── 📁 scripts/                    # ── SYNC & TRANSFORM ENGINE ──
│   ├── sync.ps1                   # Master synchronization orchestrator
│   ├── 📁 transforms/             # Per-tool transformers
│   └── 📁 utils/                  # Yaml parser & validator
│
├── 📁 site/                       # ── ASTRO GITHUB PAGES SITE ──
│   ├── src/                       # Claymorphism components, layouts & pages
│   └── astro.config.mjs
│
└── 📁 .github/workflows/
    └── deploy.yml                 # Automated Pages build & deploy
```

---

## ⚡ Synchronization Scripts

Run the master orchestrator to sync canonical assets to your local machine configurations:

```powershell
# Sync everything to all installed tools
.\scripts\sync.ps1

# Sync only to Antigravity (global skills & rules)
.\scripts\sync.ps1 -Target antigravity

# Sync only to Cursor (.mdc files)
.\scripts\sync.ps1 -Target cursor

# Dry run (preview without modifying files)
.\scripts\sync.ps1 -DryRun

# Run validation checks only
.\scripts\sync.ps1 -ValidateOnly
```

### Destination Mapping

| Tool | Format | Global Destination |
| :--- | :--- | :--- |
| **Antigravity** | `SKILL.md` + `AGENTS.md` | `~/.gemini/config/skills/<name>/SKILL.md` |
| **Cursor** | `.mdc` (with frontmatter) | `~/.cursor/rules/<name>.mdc` |
| **Claude Code** | Markdown sections | `~/.claude/CLAUDE.md` |
| **Gemini CLI** | Markdown sections | `~/.gemini/GEMINI.md` |

---

## 🎨 Claymorphism Design System

The site adheres to a dedicated **Claymorphism** design token system featuring a 3-layer shadow formula for soft, puffy 3D elements:

```css
--clay-shadow: 
  0 20px 40px -15px var(--shadow-drop),        /* 1. Outer floating drop */
  inset 0 -8px 16px var(--shadow-dark),       /* 2. Inner bottom depth */
  inset 0 8px 16px var(--shadow-light);       /* 3. Inner top highlight */
```

---

## 🚀 GitHub Pages Deployment

Deployment is 100% automated via GitHub Actions:
1. When changes are pushed to `main`, `.github/workflows/deploy.yml` triggers.
2. The workflow verifies canonical assets, bundles rich HTML outputs, and builds the Astro site.
3. The site goes live at **`https://tuanhalo.github.io/AI-Usage/`**.

To enable GitHub Pages in your repo:
1. Go to **Settings** → **Pages**.
2. Under **Build and deployment** → **Source**, select **GitHub Actions**.

