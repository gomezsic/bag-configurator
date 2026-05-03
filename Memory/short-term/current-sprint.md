---
name: current-sprint
description: What is actively being worked on right now. Refresh per sprint.
type: short-term
updated: 2026-05-03
status: VERIFIED
priority: high
---

# Current Sprint

## Theme

Consolidating the LLM wiki under `/Memory/` (this sprint) and unifying admin UX (handle styles + textures recently merged into one page).

## Active goals

- [x] Bootstrap `/Memory/` wiki structure (router, identity, rules, long-term, short-term, skills, ADRs)
- [ ] Backfill admin auth: `user_roles` table + `has_role()` + route guard
- [ ] Tighten write-side RLS on catalog tables to admin-only

## Out of scope this sprint

- WebGL migration
- Web Worker for handle stripe pass
- Refactor of `assetPack.ts`

## Notes

The wiki replaces ad-hoc summaries that used to live in chat. Going forward, every meaningful change appends a line in `recent-changes.md` and, if architectural, updates the matching `long-term/*.md`.
