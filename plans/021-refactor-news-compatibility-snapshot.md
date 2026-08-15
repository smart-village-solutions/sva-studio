# Plan 021: News-Kompatibilitäts-Snapshot entflechten

> **Executor-Anweisung:** Legacy-Kompatibilität ist ein laufender Datenvertrag. Vor Änderungen jede touched-/untouched-Kombination gegen Altcode charakterisieren.

## Status

- **Priorität:** P1
- **Aufwand:** M
- **Risiko:** HOCH
- **Abhängigkeit:** keine
- **Kategorie:** News-Datenintegrität, CRAP
- **Geplant auf:** `067e7a8e6`, 15. August 2026
- **Fallow vorher:** `syncSnapshotFromCompatibilityValues` in `news.detail-form.ts:674` — cyclomatic 28, cognitive 27, 49 Zeilen, CRAP 197,3 critical; drei Findings, Datei 828 Zeilen, sechs direkte Konsumenten und 22 Commits.

## Warum

Der Snapshot bewahrt Legacy-Felder nur dann, wenn die jeweilige Compatibility-Alias-Eingabe als touched markiert ist, und kann den Publication Mode zurücksynchronisieren. Fehler hier verlieren redaktionelle Daten oder überschreiben neue Felder mit Defaults. Feldregeln sollen deklarativ und getrennt von den Sonderfällen bleiben.

## Ist-Zustand

- `packages/plugin-news/src/news.detail-form.ts:649-724` normalisiert Editorialwerte und mutiert Snapshot/Values anhand vieler `touched`-Flags.
- `mapNewsDetailFormValuesToMutation` ruft Normalisierung und Snapshot-Sync vor Payloadbau auf.
- Vorhandene Tests decken Compatibility-Aliase, PublicationDate vs. PublishedAt und Simplified-vs-Legacy-Konflikte bereits teilweise ab.

## Scope

**In Scope:** News-Detailform-Modul, minimaler interner Helper, `tests/news.detail-form.test.ts`, OpenSpec `refactor-news-compatibility-snapshot`, Doku/Changelog.

**Out of Scope:** News-API/Mainserver, Scheduling-Verhaltenskorrektur, Waste-Targeting, Push-Versand, öffentliche Formtypen, neue Legacy-Felder.

## Schritte

1. Baseline: gezielter `news.detail-form.test.ts`-Run und `plugin-news:test:types`.
2. Characterization gegen Altcode: jedes touched-Flag true/false/fehlend; passender/falscher Laufzeittyp; mehrere gleichzeitige Änderungen; existing Snapshot; publishedAt mit draft/scheduled und leer/nichtleer; publicationDate getrennt; address/contentBlocks Referenz-/Clone-Verhalten; pushNotification; Create/Edit; simplified values gewinnen gegen widersprüchliche Compatibility-Daten.
3. Altcode-Test grün dokumentieren; OpenSpec strict validieren.
4. Gleichförmige Feldübernahmen über explizite typed descriptors oder kleine fachliche Helper reduzieren; Sonderfälle PublishedAt, Push und ContentBlocks sichtbar separat halten. Keine generische Reflection-/`any`-Lösung.
5. Unit/Types/Lint/Build, Complexity, OpenSpec strict, File Placement, Changelog, `git diff --check`.
6. Vor dem ersten Draft-Push und nach jeder relevanten Revision: `pnpm exec fallow audit --base origin/main --workspace @sva/plugin-news --explain --format json`; PASS mit Complexity/Dead Code/Duplication/Styling introduced 0; bei CRAP echte Coverage wiederholen.

## Fertig

- Ziel-Finding und weitere berührte CRAP-Findings sind weg; keine neue moderate Attribution.
- Compatibility-, Publication- und Conflict-Matrix belegt vollständige Semantikparität.
- Keine öffentliche Form-/API- oder Scheduling-Semantik geändert; Root- und unabhängiges Datenintegritätsreview freigegeben.

## STOP

- STOP bei Widerspruch zwischen Compatibility-Tests und produktivem Payloadvertrag.
- STOP, wenn Scheduling oder Waste-Targeting fachlich korrigiert werden müsste.
- STOP bei Bedarf an `any`, Reflection oder neuer öffentlicher Abstraktion.
