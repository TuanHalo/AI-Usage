"""Shared presentation theme definitions and color helpers for slide-generator."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True)
class SlideTheme:
    """Immutable color, typography, and surface tokens for a slide deck theme."""

    id: str
    name: str
    tagline: str
    best_for: str
    bg_hex: str
    surface_hex: str
    surface_alt_hex: str
    border_hex: str
    primary_hex: str
    accent_hex: str
    text_hex: str
    muted_hex: str
    on_primary_hex: str
    heading_font: str = "Segoe UI"
    body_font: str = "Segoe UI"
    is_dark: bool = False
    corner_style: str = "rounded"

    def to_dict(self) -> dict[str, Any]:
        """Serialize theme attributes as a plain dictionary."""
        return asdict(self)


THEMES: dict[str, SlideTheme] = {
    "executive-navy": SlideTheme(
        id="executive-navy",
        name="Executive Navy",
        tagline="Authoritative navy structure with crisp royal-blue accents.",
        best_for="Board updates, enterprise strategy, quarterly business reviews",
        bg_hex="#F8FAFC",
        surface_hex="#FFFFFF",
        surface_alt_hex="#EFF6FF",
        border_hex="#CBD5E1",
        primary_hex="#0F172A",
        accent_hex="#2563EB",
        text_hex="#0F172A",
        muted_hex="#475569",
        on_primary_hex="#FFFFFF",
        heading_font="Segoe UI",
        body_font="Segoe UI",
        is_dark=False,
        corner_style="sharp",
    ),
    "modern-clay": SlideTheme(
        id="modern-clay",
        name="Modern Clay",
        tagline="Soft pastel surfaces with lavender & mint depth inspired by Claymorphism.",
        best_for="Product roadmaps, UX showcases, internal team workshops",
        bg_hex="#F0F0F7",
        surface_hex="#FFFFFF",
        surface_alt_hex="#E4DFFD",
        border_hex="#D4CEF7",
        primary_hex="#7C3AED",
        accent_hex="#0D9488",
        text_hex="#2E1065",
        muted_hex="#5B4B8A",
        on_primary_hex="#FFFFFF",
        heading_font="Segoe UI",
        body_font="Segoe UI",
        is_dark=False,
        corner_style="rounded",
    ),
    "dark-tech": SlideTheme(
        id="dark-tech",
        name="Dark Tech",
        tagline="High-contrast obsidian canvas with electric cyan & violet accents.",
        best_for="AI/engineering talks, system architecture, developer keynotes",
        bg_hex="#0B0F19",
        surface_hex="#151C2C",
        surface_alt_hex="#1E293B",
        border_hex="#2D3B54",
        primary_hex="#06B6D4",
        accent_hex="#8B5CF6",
        text_hex="#F1F5F9",
        muted_hex="#94A3B8",
        on_primary_hex="#0B0F19",
        heading_font="Segoe UI",
        body_font="Segoe UI",
        is_dark=True,
        corner_style="rounded",
    ),
    "editorial-minimal": SlideTheme(
        id="editorial-minimal",
        name="Editorial Minimal",
        tagline="Warm alabaster whitespace paired with classic serif headings & terracotta.",
        best_for="Research briefings, consulting memos, thought leadership",
        bg_hex="#FAF8F5",
        surface_hex="#FFFFFF",
        surface_alt_hex="#F3ECE4",
        border_hex="#E2D9CE",
        primary_hex="#C2410C",
        accent_hex="#78350F",
        text_hex="#1C1917",
        muted_hex="#57534E",
        on_primary_hex="#FFFFFF",
        heading_font="Georgia",
        body_font="Segoe UI",
        is_dark=False,
        corner_style="sharp",
    ),
    "emerald-growth": SlideTheme(
        id="emerald-growth",
        name="Emerald Growth",
        tagline="Fresh sage-tinted clarity anchored by deep forest and emerald accents.",
        best_for="FinTech, healthcare, sustainability, financial growth decks",
        bg_hex="#F4FBF7",
        surface_hex="#FFFFFF",
        surface_alt_hex="#ECFDF5",
        border_hex="#A7F3D0",
        primary_hex="#065F46",
        accent_hex="#10B981",
        text_hex="#064E3B",
        muted_hex="#3F6E5F",
        on_primary_hex="#FFFFFF",
        heading_font="Segoe UI",
        body_font="Segoe UI",
        is_dark=False,
        corner_style="rounded",
    ),
    "vibrant-startup": SlideTheme(
        id="vibrant-startup",
        name="Vibrant Startup",
        tagline="Bold indigo & coral-rose energy built to stand out in pitch meetings.",
        best_for="Investor pitches, product launches, growth marketing decks",
        bg_hex="#FFFFFF",
        surface_hex="#F8FAFC",
        surface_alt_hex="#EEF2FF",
        border_hex="#E2E8F0",
        primary_hex="#4F46E5",
        accent_hex="#E11D48",
        text_hex="#1E1B4B",
        muted_hex="#475569",
        on_primary_hex="#FFFFFF",
        heading_font="Segoe UI",
        body_font="Segoe UI",
        is_dark=False,
        corner_style="rounded",
    ),
}


def hex_to_rgb_tuple(hex_color: str) -> tuple[int, int, int]:
    """Convert a #RRGGBB hex string into an (R, G, B) integer tuple."""
    cleaned = hex_color.strip().lstrip("#")
    if len(cleaned) != 6:
        raise ValueError(f"Expected 6-digit hex color, got '{hex_color}'")
    return (
        int(cleaned[0:2], 16),
        int(cleaned[2:4], 16),
        int(cleaned[4:6], 16),
    )


def resolve_theme(
    theme_spec: str | dict[str, Any] | None,
    fallback_id: str = "executive-navy",
) -> SlideTheme:
    """Resolve a theme preset ID or partial custom override dict into a SlideTheme."""
    if theme_spec is None:
        return THEMES[fallback_id]

    if isinstance(theme_spec, str):
        key = theme_spec.strip().lower()
        if key not in THEMES:
            valid = ", ".join(sorted(THEMES.keys()))
            raise ValueError(f"Unknown theme '{theme_spec}'. Valid presets: {valid}")
        return THEMES[key]

    if isinstance(theme_spec, dict):
        base_id = str(theme_spec.get("base", fallback_id)).strip().lower()
        if base_id not in THEMES:
            valid = ", ".join(sorted(THEMES.keys()))
            raise ValueError(f"Unknown base theme '{base_id}'. Valid presets: {valid}")
        merged = THEMES[base_id].to_dict()
        for field_name in merged:
            if field_name in theme_spec and theme_spec[field_name] is not None:
                merged[field_name] = theme_spec[field_name]
        if "id" not in theme_spec:
            merged["id"] = f"{base_id}-custom"
        return SlideTheme(**merged)

    raise TypeError(f"Unsupported theme specification type: {type(theme_spec).__name__}")

