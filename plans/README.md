# Implementierungspläne zur Fallow-Sanierung

Erste Runde erstellt am 14. August 2026. Die zweite Runde wurde am
15. August 2026 auf dem live gefetchten `origin/main`-Commit `067e7a8e6`
geplant.
Jeder Plan wird in einem eigenen Worktree umgesetzt, geprüft und über einen
eigenen Pull Request ausgeliefert.

## Live-Ausgangswert der zweiten Runde

- Health: 3.439 Dateien, 42.970 Funktionen, 943 Findings oberhalb der
  Schwellen (173 critical, 284 high, 486 moderate), durchschnittliche
  Maintainability 90,9.
- Production-Dead-Code/Dependency: 800 Findings; keine Importzyklen,
  Re-export-Zyklen oder konfigurierten Boundary-Verstöße.
- Duplikation: 694 Gruppen, 27.833 von 329.401 analysierten Zeilen bzw. 8,45 %.
- Offene Pull Requests bei Planung: #983 und #984. Plan 017-021 überschneiden
  deren Source-Dateien nicht; die Instance-Interface- und Waste-Schema-Hotspots
  wurden deshalb nicht ausgewählt.
- Alle zehn Ziel-Dateien sind per Fallow-Trace produktiv erreichbar. Dead-Code-
  Löschung ist nicht Bestandteil dieser Top 10.

## Reihenfolge und Status

| Plan | Titel | Priorität | Aufwand | Abhängigkeit | Status |
|---|---|---:|---:|---|---|
| 001 | Plugin-Medien-Duplikate konsolidieren | P1 | M | keine | DONE |
| 002 | IAM-ABAC-Auswertung entflechten | P1 | M | keine | DONE |
| 003 | Backup-Agent-Requestvalidierung entflechten | P1 | M | keine | DONE |
| 004 | Keycloak-Instanz-Audit entflechten | P1 | M | 003 gemergt | DONE |
| 005 | News-Scheduling-Tests zeitstabil machen | BLOCKER | S | blockiert 001 | DONE |
| 006 | POI-Operator-Tab in Zustands- und Ansichtslogik zerlegen | P1 | L | 001 gemergt | DONE |
| 007 | Öffentliche Waste-Konfiguration normalisieren | P1 | M | PR #983/#984 geprüft | DONE |
| 008 | Mainserver-Projekterstellung entflechten | P1 | L | Projects-Worktree geprüft | DONE |
| 009 | IAM-Acceptance-Orchestrierung modularisieren | P1 | L | 002 gemergt | DONE |
| 010 | Account-Profilseite entflechten | P1 | L | IAM-Verträge stabil | DONE |
| 011 | Public-Waste-Kalender-Lader entflechten | P1 | L | Waste-Änderungen abgegrenzt | DONE |
| 012 | DSR-Persistenzprimitiven zentralisieren | P1 | M | keine | DONE (#997, `57d7bdd5e`) |
| 013 | Governance-Delegation entflechten | P1 | M | keine | DONE (#1002, `b602c9141`) |
| 014 | Account-Import-Profilreparatur entflechten | P1 | M | keine | DONE (#999, `69dbbd493`) |
| 015 | Plugin-Zugriffs- und Action-Registry modularisieren | P1 | L | keine | DONE (#998, `f02b66e5d`) |
| 016 | IAM-Runtime-Diagnostik als Prioritätsmatrix modellieren | P1 | M | keine | DONE (#1000, `57b78f9d1`) |
| 017 | Instance-Registry-Mutationswerte typsicher strukturieren | P1 | M | keine | DONE (#1001, `13c1964f3`) |
| 018 | Public-Waste-Reminder-Actions entflechten | P1 | M | keine | DONE (#1003, `be9e0bfc7`) |
| 019 | Public-Waste-App-Zustand und Actions trennen | P1 | L | keine | DONE (#1004, `07d12bb80`) |
| 020 | Event-Detailformular-Serialisierung modularisieren | P1 | L | keine | DONE (#1005, `6afcd8d52`) |
| 021 | News-Kompatibilitäts-Snapshot entflechten | P1 | M | keine | DONE (#1006, `1df0515af`) |
| 022 | POI-Formularserialisierung entflechten | P1 | M–L | Bundle A | DONE (#1009, `e17772eb3`) |
| 023 | POI-Inbound-Mapping charakterisieren und vereinfachen | P1 | M | Bundle A | REJECTED – Characterization grün, produktiver Refactor nach Ownership-Review gestoppt (#1009) |
| 024 | Realm-Operationsschritte entflechten | P1 | M–L | Bundle B | DONE (#1011, `40787abc7`) |
| 025 | Instance-Primäraktion explizit priorisieren | P1 | M | Bundle B | DONE (#1011, `40787abc7`) |
| 026 | DOI-Versandnachricht entflechten | P1 | S–M | Bundle C | DONE (#1010, `98f4911e4`) |

Statuswerte: `TODO`, `IN PROGRESS`, `DONE`, `BLOCKED`, `REJECTED`.

## Abhängigkeiten

Die drei ersten Pläne bearbeiten disjunkte Produktionsbereiche und dürfen in
getrennten Worktrees parallel umgesetzt werden. Plan 004 startet nach dem Merge
von Plan 003 auf der aktualisierten Basis und überschneidet sich nicht mit den
IAM-Core- oder Plugin-Media-Dateien.

Plan 005 war ein kleiner Voraussetzung-PR: Der Datumswechsel machte zwei bereits
auf der Basis rote News-Tests sichtbar und blockierte dadurch den Required-Unit-
Check von Plan 001. PR #988 wurde SHA-genau grün und ohne offene Threads vor
Plan 001 gemergt.

Für Runde zwei sind alle zehn Pakete fachlich unabhängig. Die Domänennähe von
018 und 019 ist keine Source- oder Vertragsüberschneidung: 018 bearbeitet den
Serverhandler, 019 ausschließlich Component-/View-State. Nach jedem Merge
werden noch laufende Branches auf den neuen `origin/main`-Stand aktualisiert
und ihre relevanten Gates erneut ausgeführt.

Empfohlene Staffelung bei drei Executor-Slots:

1. 012, 014, 015
2. 013, 016, 017
3. 018, 020, 021
4. 019

## Abnahme der zweiten Runde

Alle zehn Pakete wurden am 15. August 2026 über eigene Pull Requests mit
Merge-Commit ausgeliefert. Der abschließende Audit lief in einem sauberen,
detached Worktree auf `origin/main` `6afcd8d528956c37149016dadf27b16d343fc75c`
mit Fallow 3.10.0 und der eingecheckten `.fallowrc.json`.

| Metrik | Vorher (`067e7a8e6`) | Nachher (`6afcd8d52`) | Änderung |
|---|---:|---:|---:|
| Health-Findings | 943 | 924 | -19 |
| Critical | 173 | 163 | -10 |
| High | 284 | 277 | -7 |
| Moderate | 486 | 484 | -2 |
| Dateien | 3.439 | 3.452 | +13 |
| Funktionen | 42.970 | 43.269 | +299 |
| Maintainability | 90,9 | 90,9 | 0,0 |
| Production-Dead-Code/Dependency | 800 | 798 | -2 |
| Duplikatgruppen | 694 | 686 | -8 |
| Duplizierte Zeilen | 27.833 | 27.400 | -433 |
| Duplikationsanteil | 8,45 % | 8,30 % | -0,15 Prozentpunkte |

Der finale Production-Report enthält weiterhin drei ungelöste Imports, drei
ungenutzte und 14 nicht gelistete Dependencies sowie eine Development-
Dependency im Produktionspfad. Importzyklen, Re-export-Zyklen und alle drei
konfigurierten Boundary-Finding-Kategorien stehen jeweils bei null. Diese
Bestandsbefunde waren nicht Ziel der zehn Pakete.

Alle zehn Zielanker sind im finalen Health- beziehungsweise Duplikatreport
verschwunden. Das umfasst insbesondere die DSR-Fingerprints `dup:54714cc9` und
`dup:f9215d48`, die jeweils benannten Complexity-/CRAP-Funktionen der Pläne
013-019 und 021 sowie sämtliche sechs berührten Event-Detailformular-Findings
aus Plan 020. Der bei der Planung ausdrücklich ausgegrenzte Events-/POI-Clone
`dup:714de343` ist ebenfalls nicht mehr vorhanden; der verbleibende geerbte
Clone `dup:9b9f8261` betrifft nur einen sechszeiligen Number-to-String-Mapper
und wurde nicht durch eine Shared- oder Metrikabstraktion kaschiert.

## Dritte wirtschaftliche Runde – Live-Analyse

Die dritte Runde wurde am 15. August 2026 auf einem neuen sauberen detached
Worktree des live gefetchten `origin/main`-Commits
`98e6ca3d79f7df23674f26c5c8c8307b9da8cd82` geplant. Fallow ist im Root-
Manifest auf `3.10.0` gepinnt; die ausgeführte signierte Binary meldete ebenfalls
`fallow 3.10.0`. Das JSON-Report-Schema ist Version 7.

Die unveränderte `.fallowrc.json` hat SHA-256
`4ea365cbdc2b24f2407f16d483d8ea86440a26cbd123608c7cb9b965f8fcee40`.
Sie definiert die eingecheckten Test-/Script-/Server-Entries, drei dynamische
Entries, drei bekannte unresolved Runtime-Artefakte, vier Ignore-Patterns und
sieben Boundary-Zonen (`app`, `routing`, `server-runtime`, `auth-runtime`,
`iam-admin`, `instance-registry`, `integration`) mit den dort hinterlegten
Allow-Regeln. Es wurde weder eine Suppression noch ein Schwellenwert verändert.

Verwendete Baseline-Befehle, jeweils mit JSON, `--quiet`, `--explain`, getrenntem
stderr und Exitcode-Prüfung:

```bash
fallow health --format json --quiet --explain
fallow dead-code --production --format json --quiet --explain
fallow dupes --format json --quiet --explain
fallow dead-code --trace-file <kandidat> --format json --quiet --explain
fallow dead-code --trace-dependency <paket> --format json --quiet --explain
```

Exitcode 1 trat bei Health und Production Dead Code als normaler Finding-Zustand
auf; Dupes endete mit 0. Alle drei Reports waren valides JSON mit `kind`, Schema
7 und `_meta`. Kein Analyzerlauf endete mit Exitcode 2.

| Metrik | Live-Baseline |
|---|---:|
| Dateien / Funktionen | 3.452 / 43.269 |
| Health-Findings | 924 |
| Critical / High / Moderate | 163 / 277 / 484 |
| Maintainability | 90,9 |
| Production Dead Code/Dependencies | 798 |
| Unused files / exports / types | 58 / 533 / 141 |
| Unused / unlisted Dependencies | 3 / 14 |
| Unresolved Imports / Dev-in-Production | 3 / 1 |
| Importzyklen / Re-export-Zyklen | 0 / 0 |
| Boundary / Coverage / Call | 0 / 0 / 0 |
| Duplikatgruppen / Instanzen | 686 / 1.526 |
| Duplizierte Zeilen / Quote | 27.400 / 8,30 % |

## Kandidatenentscheidung der dritten Runde

| Kandidat | Ist-Metrik und Trace | Risiko/Wirkung | Aufwand/Testbarkeit | Überschneidung/STOP | Entscheidung |
|---|---|---|---|---|---|
| POI-Serialisierung | 6 CRAP-Funde, max. 268,2; produktiver Create/Update-Pfad | POI-Datenintegrität; hoher Wartungsgewinn | M–L; breite Formtests | STOP bei Form-/Mainserver-Vertragsänderung | **ausgewählt, Plan 022** |
| POI-Inbound-Hauptmapping | `mapPoiContentToFormValues`: CC 27/Cognitive 14/CRAP 184,5; produktiver Detail-Reset | Legacy-/Default-/Reihenfolgedaten | M; Characterization grün | Versuch erhöhte Datei-CC 96→101 und Funktionen 11→16; Source exakt revertiert | **REJECTED nach wirtschaftlichem STOP, Plan 023** |
| Instance Realm Steps | vier Funde, max. CRAP 299,6; Fan-in 4 | IAM-Status darf nicht falsch erscheinen | M–L; Status-/Fallbackmatrix | STOP bei Backend-/Fixture-Overlap | **ausgewählt, Plan 024** |
| Instance Primary Action | CC 30/Cognitive 28; produktive Detailseite | sicherheitsrelevante Aktionspriorität | M; kombinatorische Matrix | keine neue Action/Permission | **ausgewählt, Plan 025** |
| Waste DOI Message | CC 19/Cognitive 18/CRAP 97; Outbox-Pfad | Datenschutz- und Mailvertrag | S–M; fokussierter Unit-Pfad | Token/Secret/SQL explizit out | **ausgewählt, Plan 026** |
| Auth Permission Store | 17 Importer, zentraler Permissionpfad | höchster Blast Radius | M–L, HIGH | aktive OpenSpecs `use-mainserver-data-provider-as-content-author` und `centralize-scoped-ui-access` verändern Principal-, Permission- und UI-Zugriffsverträge | **zurückgestellt** |
| Media `completeUpload` | CC 22/CRAP 126,5; produktiver Uploadpfad | Storage-/Idempotenzintegrität | M, gute Tests | aktive Media-OpenSpecs | **zurückgestellt** |
| Header | CC 26/CRAP 172; AppShell | produktive Shell | M, UI/A11y | `add-account-credential-self-service` nennt Datei | **zurückgestellt** |
| Interface Healthcheck/Server | max. CRAP 367,5; produktive Interfaces | Secrets/SQL/Netzwerk | M–L | direkte PR-#983-Sourceüberschneidung | **zurückgestellt** |
| Content Projection/Sidebar | hohe Hotspots und Reichweite | IAM/Content | L | aktive DataProvider-/Scoped-Access-Verträge | **zurückgestellt** |
| Mainserver Event/News/POI | mehrere Critical/High und große Clones | öffentlicher Runtimevertrag | M–L | aktiver Service-Internals-Change; PR #1005/#1006 frisch | **zurückgestellt** |
| Root-/Deploy-Dependencies | 3 unused, 14 unlisted, 1 dev-in-production | mögliche Ownership-Lücke | S–M | kein kanonischer Workspace-Audit; Traces überwiegend Script/Debug | **verworfen** |
| Radix-/sanitize-html-Doppeldeklaration | je ein bereits korrekt besitzender Zielworkspace | geringe Ownership-Bereinigung | S, gut prüfbar | eigener PR-/CI-Aufwand überwiegt Nutzen | **verworfen** |
| große Cross-Plugin-Clones | bis 926 Zeilen nominell | unterschiedliche Fachverträge | L/unklar | neue Shared-Ownership, >2 Workspaces | **verworfen** |
| verbleibender Dead Code | 798 Findings, überwiegend nicht produktiv erreichbar | kein belegter Runtime-Nutzen | variabel | Production-Reachability fehlt | **verworfen für diese Runde** |

Die Schnittkante liegt hinter Plan 026: Auch dieses Ziel ist noch wirtschaftlich,
weil ein klarer produktiver DOI-Vertrag, ein einzelner Owner und ein kompakter
Test-/Rollback-Pfad vorliegen. Der fachlich stärkere nächste Auth-Kandidat ist
wegen der aktiven OpenSpecs `use-mainserver-data-provider-as-content-author`
und `centralize-scoped-ui-access` aktuell nicht unabhängig reviewbar: Beide
verändern Principal-/Permission- beziehungsweise darauf aufbauende UI-
Zugriffsverträge mit demselben Konsumentenradius. Kleinere Dependency- oder
Moderate-Funde rechtfertigen keinen zusätzlichen PR- und CI-Zyklus.

## Abgrenzung zu aktiven Änderungen

Die Auswahl wurde nicht allein über Domänennamen abgegrenzt, sondern gegen die
aktiven OpenSpec-Aufgaben und die beim Analysebeginn vorhandenen Branch-Deltas
geprüft:

- `refactor-shared-editor-primitives` migriert POI-UI-Section- und Repeater-
  Primitives. Der Change erklärt Mapping, Validierung und Speichern ausdrücklich
  als pluginlokal. Bundle A beansprucht nur
  `poi.detail-form.serialization.ts`, `poi.detail-form.mapping.ts` und die
  reinen Formvertragsfälle in `poi.detail-form.test.ts`; UI-Komponenten,
  Repeater und deren Tests sind ausgeschlossen.
- `add-studio-data-form-and-test-foundations` inventarisiert POI als Konsument,
  setzt seine Referenzimplementierung jedoch in Admin-Users, -Roles und Content
  um. Bundle A ändert keine Testinfrastruktur, keinen Form-Provider und keine
  Shared-Testutility. Eine spätere Änderung dieser Ownership ist eine harte
  STOP-Bedingung.
- `update-instance-detail-module-tab` besitzt den neuen Module-Tab und dessen
  Journey-/UI-Vertrag. Bundle B besitzt ausschließlich die bestehenden Realm-
  Operationsmodelle in `-instances-shared.tsx` und deren Modelltests; Tab,
  Navigation, Module-Workspace und dessen Fixtures sind ausgeschlossen.
- Die zu Analysebeginn vorhandenen Deltas der Principal-, Mainserver-, Content-
  und Instance-Module-Branches (`f6b72e7`, `8b3c6e4`, `6db1dfa`, `b2110b7`)
  enthielten keine der für Bundle A oder B ausgewählten Source-Dateien. Vor
  Delegation wird dieselbe Datei-/Vertragsprüfung gegen die dann live aktiven
  Branches, PRs und OpenSpec-Aufgaben wiederholt; bei Treffer wird das Bundle
  zurückgestellt, nicht parallel gestartet.

## Bundle-Matrix der dritten Runde

| Bundle | Problempläne | Owner/Workspace | Gemeinsamer Vertrag und Gate-Pfad | Risiko | Aufwand | Abhängigkeiten | Bündelungsgrund |
|---|---|---|---|---:|---:|---|---|
| A – POI-Formvertrag | 022 produktiv; 023 Characterization mit STOP | Plugin POI / `@sva/plugin-poi` | Serialisierung und abgesicherter Inbound-Vertrag; `plugin-poi` Unit/Coverage/Types/Lint/Build und Fallow-Audit | mittel | M–L | Vorstart-Prüfung gegen `refactor-shared-editor-primitives` und `add-studio-data-form-and-test-foundations` | gleicher Owner und Testpfad; der Inbound-Produktivrefactor wurde wegen zusätzlicher Single-use-Ownership vollständig revertiert |
| B – Instance-Realm-Operations | 024, 025 | Studio Instance UI / `sva-studio-react` | Realm-Step- und Primäraktionsmodell; gezielte Modelltests, UI-Gates und App-Audit | hoch | L | Vorstart-Prüfung gegen `update-instance-detail-module-tab` | eine Datei, eine Status-/Prioritätsmatrix und Rollback-Grenze; Module-Tab/Journey-Fixtures bleiben fremder Scope |
| C – Waste DOI Message | 026 | Studio Waste Runtime / `sva-studio-react` | DOI-Maildarstellung; fokussierter Server-Unit-/Type-/Build-Pfad und App-Audit | mittel | S–M | keine | Einzelproblem; Token, Secret, SQL, Datum und Idempotenz bleiben bewusst getrennt |

Alle Bundles starteten unabhängig auf dem jeweils aktuellen `origin/main` und
erst nach der oben benannten Ownership-Prüfung. Bundle B und C teilten zwar den
kanonischen Workspace, aber weder Source, Vertrag noch Testdateien. Die
Merge-Deltas wurden vor Ready erneut auf Interaktionen geprüft.

## Reihenfolge und Status – dritte Runde

| Plan | Titel | Priorität | Aufwand | Bundle | Status |
|---|---|---:|---:|---|---|
| 022 | POI-Formularserialisierung entflechten | P1 | M–L | A | DONE (#1009, `e17772eb3`) |
| 023 | POI-Inbound-Mapping vereinfachen | P1 | M | A | REJECTED – Refactor nach Ownership-Review gestoppt (#1009) |
| 024 | Realm-Operationsschritte entflechten | P1 | M–L | B | DONE (#1011, `40787abc7`) |
| 025 | Instance-Primäraktion explizit priorisieren | P1 | M | B | DONE (#1011, `40787abc7`) |
| 026 | DOI-Versandnachricht entflechten | P1 | S–M | C | DONE (#1010, `98f4911e4`) |

Das Gesamtrepository ist damit nicht findingfrei. Die Live-Baseline vor dieser
Runde enthielt 924 globale Health-Findings; die neue globale Abschlussmessung
erfolgt nach Merge dieses Status-PRs. In `news.detail-form.ts` sind zwei nachweislich
unveränderte, fachfremde High-Findings vorhanden; das Zielfinding
`syncSnapshotFromCompatibilityValues` aus Plan 021 ist dagegen beseitigt.

## Bewusst zurückgestellt

- `iam-content-list-projection.server.ts`: wartet auf die offenen Verträge und
  Abnahmen von `use-mainserver-data-provider-as-content-author`.
- `Sidebar.tsx` und `-content-list-page.tsx`: warten auf den Abschluss von
  `centralize-scoped-ui-access`.
- Waste-Repository und Mainserver-Projects-Route: offene Waste-PRs sowie ein
  vorhandener Projects-Worktree werden zuerst auf Überschneidungen geprüft.

## Betrachtet und für diese Runde verworfen

- Bereits erledigte Hotspots aus 001-011 und PR #988: kein Live-Rückfall in
  den jeweiligen Zielsymbolen belegt.
- `instance-interfaces-server.ts`: sehr hoher CRAP-Wert, aber direkte
  Source-Überschneidung mit offenem PR #983.
- `waste-tenant-database-provisioner.server.ts` und Waste-Repositories:
  Source-/Vertragsüberschneidung mit #983/#984 und laufender Waste-Migration.
- `iam-content-list-projection.server.ts`, `Sidebar.tsx` und
  `-content-list-page.tsx`: weiterhin offene Vertrags-/OpenSpec-Arbeit.
- Mainserver-Event-Mapping: realer Zielkonflikt mit dem aktiven OpenSpec
  `refactor-sva-mainserver-service-internals`; deshalb im unabhängigen Review
  aus Plan 017 entfernt und durch den konfliktfreien Instance-Registry-Scope
  ersetzt.
- Root-Skripte für Coverage, Sonar, Bootstrap und Migration: hohe Complexity-
  und Duplikatwerte, aber Fallow weist Root-`scripts/` keinem kanonischen
  Workspace zu. Damit wäre das verbindliche workspace-spezifische New-only-
  Audit nicht exakt erfüllbar; dies benötigt später einen expliziten
  Tooling-Workspace-Plan und wird nicht still zu den zehn Problemen gezählt.
- Fallow-Unresolved-Imports auf veröffentlichte Subpath-Exports wie
  `@sva/monitoring-client/logger-provider.server` und `@sva/plugin-surveys/api`:
  Package-Exports und produktive Type-/Runtime-Verträge sind vorhanden; ohne
  gegenteilige Runtime-Evidenz kein Fixkandidat.
