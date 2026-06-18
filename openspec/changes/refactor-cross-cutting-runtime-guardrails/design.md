## Context

Die Befunde konzentrieren sich nicht auf einzelne Defekte, sondern auf Vertragslücken zwischen Auth-Runtime, Plugin-SDK, Host-Routing und CI-Governance. Das gemeinsame Muster ist, dass Konventionen bereits existieren, aber nicht deterministisch zur Build- oder Boot-Zeit erzwungen werden.

Ein erster report-only Sichtbarkeits-Slice ist inzwischen implementiert. Er verdrahtet additive Guardrail-Checks in `env:doctor:studio`, `env:precheck:studio` und `pnpm check:guardrails:report`, ohne bestehende Exit-Codes oder harte Qualitäts-Gates zu verändern. Damit gibt es jetzt echte Laufzeit- und Architektur-Befunde aus dem Workspace, noch bevor Enforcement aktiviert wurde.

## Goals / Non-Goals

- Goals:
  - Serielle, deterministische Token-Refresh-Semantik für geteilte Redis-Sessions
  - Ein expliziter, hostvalidierter Plugin-Vertrag für Routen, Permissions, Übersetzungen und SDK-Versionen
  - Harte Architektur-Gates für cross-cutting Regeln, die heute nur dokumentiert oder implizit getestet sind
  - Schwächere Qualitätszonen in Auth- und Registry-Pfaden messbar und schrittweise auf Zielniveau anheben
- Non-Goals:
  - Vollständige Runtime-Nachladung externer Plugins ohne App-Build
  - Eine neue IAM-Engine oder ein neues Routing-System einführen
  - Sämtliche Komplexitätshotspots in einem einzigen Delivery-Slice beseitigen

## Decisions

- Decision: Der Change wird in mindestens zwei Delivery-Slices umgesetzt: zuerst Sichtbarkeit ohne Blockade, danach schrittweise Enforcement der neuen Verträge.
- Decision: Session-Refresh bleibt serverseitig und Redis-basiert, wird aber pro `sessionId` serialisiert, sodass für parallele Requests genau ein Refresh-Schreiber gewinnt und konkurrierende Requests das Ergebnis wiederverwenden.
- Decision: `/auth/me` bleibt der kanonische Auth-Read, gibt aber nur eine explizite Allowlist stabiler Felder aus; neue interne Session- oder Profilfelder werden nicht per Object-Spread exponiert.
- Decision: Der Host validiert Plugin-Beiträge vor Snapshot-Publikation gegen einen kanonischen Preflight-Vertrag für Namespace, SDK-SemVer, Routen, Permission-Referenzen, Translation-Ownership und Aktivierungsstatus.
- Decision: Build-linked Plugins bleiben Teil des Host-Builds, müssen aber über hostkontrollierte Aktivierungsflags pro Instanz oder Umgebung deaktivierbar sein, damit Canary- und Rollback-Slices ohne Code-Fork möglich werden.
- Decision: Typsichere Plugin-Routen werden über einen deklarativen Vertrag für Search-Params, Path-Params und Route-Component-Bindings beschrieben; der Host behält Parsing-, Guard- und Route-Ownership.
- Decision: Mutationen emittieren hostvalidierte Invalidation-Tags, damit Core-App und Plugins denselben Cache-Invalidierungsvertrag nutzen können.
- Decision: Produktionsnahe Boots und Releases failen vor dem ersten Traffic bei OTEL-Unreadiness, Architekturdrift oder Migrationsdrift.
- Decision: Kritische Module dürfen bei offenen Hotspots weder Coverage-Floors absenken noch Komplexität weiter steigern; stattdessen gilt Ratcheting plus dokumentierter Refactoring-Backlog.

## Workstreams

0. Sichtbarkeit ohne Blockade
   - Report-only Guardrail-Runner
   - Einbindung in `doctor` und `precheck`
   - Maschinenlesbare Guardrail-Befunde mit `wouldFailInEnforcement`
   - Erste Triage von Drift, False Positives und funktionalem Risiko

1. Auth- und Runtime-Härtung
   - Session-Refresh serialisieren
   - `/auth/me` minimieren
   - Session-Store-Adapter auf denselben Codec- und Konkurrenzvertrag bringen
   - OTEL vor Request-Annahme initialisieren
   - Boot- und Readiness-Prüfung auf Migrationsstand ausweiten

2. Plugin-Vertrag stabilisieren
   - Routen- und Translation-Kollisionen fail-fast behandeln
   - Plugin-Permissions mit IAM-Manifest kreuzvalidieren
   - SDK-Kompatibilität per SemVer-Range erzwingen
   - Typisierten Route- und Aktivierungsvertrag einführen
   - Vollqualifizierte Action-IDs statisch erzwingen

3. CI- und Architektur-Gates verankern
   - Dependency-Graph-Snapshot in CI
   - i18n-Key-Extraktion und Missing-Key-Gate
   - `.server.ts`- und server-only Leak-Gates inklusive `interfaces-api`
   - Kritische Coverage- und Komplexitätsregeln verschärfen

4. Datenkonsistenz über UI-Grenzen
   - Hostvalidierte Invalidation-Tags für Mutationen
   - Gemeinsame Cache-Invalidierung über Core und Plugins

## Aktuelle Erkenntnisse aus der report-only Phase

- Plugin-Vertrag:
  - Die Workspace-Plugins `news`, `events`, `poi` und `waste-management` dokumentieren aktuell keine explizite SDK-Kompatibilitäts-Range im sichtbaren Vertrag; der report-only Check meldet dies bereits als Migrations- und Enforcement-Vorarbeit.
- Architekturdrift:
  - Der aktuelle server-only Leak-Check ist bewusst heuristisch und meldet viele Treffer.
  - Ein Teil davon ist wahrscheinlich legitim, etwa Server-Entrypoints oder bewusst serverseitige Adapter.
  - Ein anderer Teil ist echte Architekturdrift oder ein potenzieller Bundling-Risikobereich, insbesondere bei servernahen Imports in nicht explizit server-only markierten Modulen.
- Runtime-Boot:
  - Der report-only Lauf sieht aktuell keinen unmittelbaren OTEL- oder Migrations-Befund, bestätigt aber nur Sichtbarkeit, nicht Enforcement.
- Auth-Session:
  - Vorhandene Session-/Auth-Testpfade sind sichtbar, aber die eigentliche Konkurrenzsemantik für Refreshes und die adapterübergreifende Parität sind weiterhin unimplementiert.
- Cache-Vertrag:
  - Die ersten Inventar-Befunde zeigen Mutations-/Refresh-Pfade ohne zentral sichtbaren Invalidierungsvertrag; das ist eher funktionales Risiko als reine Stilabweichung.

## Standabgleich mit PR #441 vom 18.06.2026

- Der Alt-PR `smart-village-solutions/sva-studio#441` wird nicht weiter als Merge-Kandidat behandelt, weil sein report-only Slice inzwischen auf `main` gelandet ist und der Branch stark hinter `main` liegt.
- Fachlich relevante Restideen aus `#441` bleiben jedoch Bestandteil dieses Changes und sind nicht als erledigt zu verstehen:
  - Plugin-SDK-Kompatibilitätsrangen fehlen weiterhin im sichtbaren Vertrag der Workspace-Plugins und bleiben Vorarbeit fuer Task `2.3`.
  - Der server-only-Leak-Check liefert weiterhin viele Befunde; die Grundidee bleibt relevant, die aktuelle Heuristik ist aber noch nicht enforcement-tauglich und bleibt Vorarbeit fuer Task `4.3`.
  - Ein gemeinsamer Invalidation-Tag-Vertrag fuer Mutationen bleibt offen; die heutige Wortlisten-Heuristik ist nur Inventurhilfe und ersetzt den fachlichen Vertrag nicht. Das bleibt Vorarbeit fuer Tasks `3.1` und `3.2`.
  - Die Robustheit des Plugin-Contract-Checks gegen fehlerhafte Einzel-Plugins bleibt wichtig, damit ein defektes Plugin nicht den gesamten report-only Lauf entwertet. Das ist Teil der weiteren Haertung in Tasks `2.1` bis `2.3`.
- Nicht mehr als prioritaerer Rest aus `#441` betrachtet wird die reine Einfuehrung des report-only Runners; dieser Slice ist bereits umgesetzt.
- Der Auth-Session-Bereich bleibt im Change offen, aber nicht mehr wegen fehlender Sichtbarkeit. Offener Rest ist die normative Haertung von Refresh-Konkurrenz und Store-Paritaet gemaess Tasks `1.1` bis `1.4`.

## Risks / Trade-offs

- Strengere Build- und Boot-Gates können bestehende Drift sofort sichtbar machen und zunächst mehrere rote Checks freilegen.
- Die typisierte Plugin-Route-Schnittstelle ist ein öffentlicher SDK-Vertrag und braucht eine klar dokumentierte Migrationsphase für bestehende Plugins.
- Runtime-Aktivierungsflags für build-linked Plugins reduzieren nicht den Build-Kopplungsgrad, schaffen aber einen kontrollierbaren Betriebshebel ohne Vollumbau.
- Die report-only Phase reduziert Delivery-Risiko, kann aber wegen heuristischer Checks zunächst gemischte Befunde aus echten Problemen, legitimen Serverfällen und False Positives liefern; deshalb ist eine explizite Triage Teil des Changes.

## Migration Plan

1. Zuerst Guardrails einführen, die inkonsistente Zustände sichtbar machen, ohne sofort alle Callsites umzubauen. Dieser Slice ist mit report-only Checks in `doctor`, `precheck` und `check:guardrails:report` gestartet.
2. Danach die report-only Befunde triagieren: legitime Serverfälle, echte Architekturdrift und funktionales Risiko voneinander trennen.
3. Anschließend Auth- und Plugin-Hotspots auf die neuen Verträge migrieren und Characterization-Tests für Redis-, Build-time- und Host-Routing-Pfade ergänzen.
4. Danach CI-Gates und Boot-Verträge schrittweise von report-only auf fail-fast anheben und die verbleibenden Exemptions, Floors und Hotspots dokumentiert abbauen.
5. Die neuen Verträge in arc42 und mindestens einer ADR für Plugin- und Runtime-Guardrails verankern.
