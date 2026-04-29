# Mainserver-Plugin-Listen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Listenansichten von News, Events und POI auf serverseitige Pagination und `StudioDataTable` harmonisieren.

**Architecture:** Ein gemeinsamer Host-Vertrag fuehrt `page`, `pageSize` und ehrliche Pagination-Metadaten durch `@sva/sva-mainserver`, Host-Routen, Plugin-API-Wrapper und Plugin-Pages. Die UI zeigt Prev/Next auf Basis von `hasNextPage` und verzichtet ohne belastbaren Upstream-Count auf fingierte Totalseiten.

**Tech Stack:** TypeScript strict mode, React, TanStack Router, Nx, Vitest, Playwright, `StudioDataTable`

---

## Datei-Schnitt

- `packages/sva-mainserver/src/server/service.ts`
  - paginierte News-/Events-/POI-List-Adapter
- `apps/sva-studio-react/src/lib/mainserver-news-api.server.ts`
  - Query-Normalisierung und paginierte News-Route
- `apps/sva-studio-react/src/lib/mainserver-events-poi-api.server.ts`
  - Query-Normalisierung und paginierte Events-/POI-Routen
- `packages/plugin-news/src/news.api.ts`
  - paginierter Browser-Client fuer News
- `packages/plugin-events/src/events.api.ts`
  - paginierter Browser-Client fuer Events
- `packages/plugin-poi/src/poi.api.ts`
  - paginierter Browser-Client fuer POI
- `packages/plugin-news/src/news.pages.tsx`
  - `StudioDataTable`-basierte News-Liste
- `packages/plugin-events/src/events.pages.tsx`
  - `StudioDataTable`-basierte Events-Liste
- `packages/plugin-poi/src/poi.pages.tsx`
  - `StudioDataTable`-basierte POI-Liste
- `packages/studio-ui-react/src/studio-data-table.tsx`
  - generische Tabellen-Erweiterungen, falls fuer die Harmonisierung noetig

## Umsetzungsbloecke

- [ ] Test- und Typ-Basis fuer paginierte List-Contracts zuerst ergaenzen
- [ ] Mainserver- und Host-Vertrag anschliessend umstellen
- [ ] Plugin-API-Wrapper migrieren
- [ ] Plugin-Pages auf `StudioDataTable` + Prev/Next umstellen
- [ ] Unit-, Typ- und E2E-Gates grün ziehen
