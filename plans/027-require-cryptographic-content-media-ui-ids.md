# Plan 027: Kryptografisch sichere Content-Media-UI-IDs erzwingen

> **Executor**: Arbeite ausschließlich im angegebenen Scope. Führe Baseline und neue Characterization zuerst gegen den Altcode aus. STOP-Bedingungen haben Vorrang vor Improvisation.

## Status

- **Priorität**: P0
- **Aufwand**: S
- **Risiko**: mittel
- **Abhängigkeit**: keine; separat zuerst mergen
- **Kategorie**: Security
- **Geplant auf**: `960955af8`, 15. August 2026
- **Sonar**: `AZ_MufJ-6Sn7SUF7x3qN`, `typescript:S2245`, BLOCKER/Vulnerability

## Warum das wichtig ist

`createContentMediaUiId` fällt bei fehlendem `crypto.randomUUID` auf `Math.random()` zurück. Die ID ist zwar UI-lokal, aber der unsichere Fallback erzeugt die einzige offene Vulnerability und hält das Main-Quality-Gate über New-Code Security Rating C rot. Der Vertrag soll klar fail-closed auf Web Crypto beruhen, ohne einen zweiten selbstgebauten Zufallsgenerator.

## Aktueller Zustand

- `packages/studio-ui-react/src/content-media-usage.ts:25-26`: `globalThis.crypto?.randomUUID?.() ?? media-${Date.now()}-${Math.random()...}`.
- `packages/studio-ui-react/src/content-media-usage.test.ts`: prüft Reihenfolge, URLs und Referenzen, aber nicht den Runtime-Vertrag der ID-Erzeugung.
- Workspace: `studio-ui-react`; vorhandene Targets: `test:unit`, `test:types`, `lint`, `build`.

## Scope

**In Scope**: die beiden oben genannten Dateien; falls nötig eine vorhandene deutsche Fach-Dokumentation oder Changelog-Entry nach Repository-Konvention.

**Out of Scope**: persistierte Asset-IDs, Media-Upload, URL-Sicherheitslogik, Crypto-Polyfills, Sonar-Transition/Suppression, Quality-Profile.

## Schritte und Characterization

1. Baseline: `pnpm nx run studio-ui-react:test:unit --testFiles=src/content-media-usage.test.ts` muss grün sein.
2. Tests zuerst: eindeutige Rückgabe von `crypto.randomUUID`; fehlendes `crypto.randomUUID` muss den expliziten Runtime-Vertrag zeigen (kein stiller schwacher Fallback). Neue Tests gegen Altcode ausführen und den erwarteten roten Fall dokumentieren.
3. Minimal implementieren: Web-Crypto-Vertrag direkt und typsicher verwenden; keine lokale Zufallslogik und keine ID-Verhaltensänderung außerhalb dieses Konstruktors.
4. Gates: fokussierte Unit-Tests, `pnpm nx run studio-ui-react:test:types`, `pnpm nx run studio-ui-react:lint`, `pnpm nx run studio-ui-react:build`, `pnpm exec fallow audit --base origin/main --workspace studio-ui-react --explain --format json`, `pnpm check:file-placement`, `pnpm test:changelog:pr`, `pnpm exec openspec validate --all --strict`, `git diff --check`.

## Erwartete Wirkung

- Sonar: Ziel-Key verschwindet; Vulnerabilities 1→0, New-Code Security C→A, Gate ERROR→OK nach Main-Scan.
- Fallow: PASS; keine eingeführte Complexity, Dead Code oder Duplikation; keine moderate neue CRAP-Stelle.

## STOP-Bedingungen

- Ein unterstützter Produktionsruntime besitzt nachweislich kein `crypto.randomUUID` und ein Polyfill wäre erforderlich.
- Der Fix müsste persistierte oder serverseitig interpretierte IDs ändern.
- Baseline rot oder aktive Source-/Vertragsüberschneidung.

