# IAM-Abschluss-PR Vorbereitung

Stand: `2026-05-25`

## Entscheidung

Der aktuelle Branch wird **bewusst als großer IAM-Abschluss-PR aus dem gesamten Arbeitsstand** vorbereitet.

Das bedeutet:

- nicht nur der bereits commitete `WP-006`/`WP-010`-Diff ist relevant,
- sondern auch der uncommittete Working-Tree-Scope,
- einschließlich UI-, Runtime-, Reporting-, Acceptance- und Doku-Ergänzungen.

## Zielbild des PR

Der PR soll den IAM-Abschluss für Meilenstein 1 als zusammenhängenden Lieferstand zeigen:

- fachliche Vervollständigung zentraler IAM-Arbeitspakete
- Schärfung der Admin- und Account-Oberflächen
- Härtung kritischer Runtime- und Governance-Pfade
- Konsolidierung der Acceptance-, Evidence- und Angebotsdokumentation

## Enthaltener Scope

### Produkt- und Admin-Oberflächen

- IAM-Admin-Einstieg und Navigationspfade
- Benutzer-, Rollen-, Gruppen-, Organisations- und Instanz-nahe UIs
- Account-Profile und zugehörige API-Bindings
- Monitoring- und Statussicht im Host
- Project-Report-Aufbereitung für den M1-/IAM-Status

### Runtime und Backend

- Auth- und Session-Pfade
- Middleware- und Guard-Logik
- IAM-Account-Management und Assignment-nahe Pfade
- Authorize- und Governance-Pfade
- Legal-Text-Targeting, Consent-Enforcement und Consent-Export
- Bootstrap-, Routing- und Plugin-Operations-Anpassungen

### Verträge, Schema und Integrationskanten

- Core-Contracts für IAM-Detail- und Account-Management-Daten
- Routing-Definitionen und App-Route-Bindings
- DB-Snapshot und zugehörige Schema-Doku
- Acceptance- und CI-Skripte für IAM-Nachweise

### Dokumentation und Nachweise

- arc42-Abschnitte für IAM-relevante Architekturfortschreibung
- Acceptance-Runbook
- neue WP-Abnahmeberichte
- Angebotsrückrichtung und Abnahme-Checklisten
- Superpowers-/OpenSpec-Artefakte für WP-005, WP-006 und angrenzende Themen

## Empfohlene PR-Erzählung

Der PR ist am lesbarsten, wenn er in vier Blöcken beschrieben wird:

1. **IAM-Admin und Transparenz**
   Benutzer-, Rollen-, Organisationen-, Instanz- und Account-Pfade werden in Richtung abnahmefähiger Transparenz und Bedienbarkeit vervollständigt.
2. **Consent, Rechtstexte und Compliance**
   Legal-Text-Targeting, Enforcement und Export werden Ende-zu-Ende gehärtet und mit UI- sowie Runtime-Pfaden verbunden.
3. **Acceptance und Projektstatus**
   Repo-seitige Nachweise, Reports und Statusdarstellungen werden auf einen kundentauglichen Abschlussstand verdichtet.
4. **Architektur und Delivery-Härtung**
   Verträge, Routing, Schema-Referenzen und CI-/Acceptance-Skripte werden an den neuen Abschlussstand angepasst.

## Vorgeschlagener PR-Titel

`feat(iam): close out milestone-1 iam scope across admin ui, consent and acceptance evidence`

## Vorgeschlagene PR-Beschreibung

### Zusammenfassung

Dieser PR bündelt den aktuellen IAM-Abschlussstand für Meilenstein 1 in einem gemeinsamen Lieferpaket. Er umfasst UI-, Runtime-, Contract-, Doku- und Evidence-Arbeiten, die zusammen die abnahmefähige Darstellung der IAM-Kernpakete stärken.

### Schwerpunkte

- IAM-Admin- und Account-Pfade für Benutzer, Rollen, Organisationen, Instanzen und Module erweitert bzw. geschärft
- Consent-, Rechtstext- und Exportpfade durch UI-, Runtime- und Contract-Anpassungen konsolidiert
- Project-Status, WP-Abnahmeberichte, Angebotsrückrichtung und Abnahmevorbereitung ergänzt
- Architektur-, Routing-, Schema- und Acceptance-Skripte an den Abschlussstand angepasst

### Offene Delivery-Evidence

- Ziel- oder Integrationsumgebungsnachweise für `WP-005` Konflikt- und Vererbungsfälle
- echte End-to-End-Evidence für `WP-006` Consent-Blocker und Export
- Zielumgebungs-Smoke-Test für `WP-003`

Diese Punkte sind dokumentiert und blockieren den technischen PR nicht, bleiben aber als Delivery-/Abnahmerestpunkte transparent benannt.

## Prüfstand

Folgende Prüfungen wurden für den großen Arbeitsstand bereits erfolgreich ausgeführt:

- `pnpm check:file-placement`
- `pnpm nx affected --target=test:unit --base=origin/main --parallel=1`
- `pnpm nx affected --target=test:types --base=origin/main --parallel=1`
- `pnpm nx run auth-runtime:test:unit`
- `pnpm nx run auth-runtime:test:types`
- `pnpm nx run auth-runtime:check:runtime`
- `pnpm check:server-runtime:affected`

Zusätzlich läuft bzw. lief der bevorzugte PR-Gate:

- `pnpm test:pr`

Wichtig:

- `pnpm test:pr` bewertet in diesem Setup den commiteten Diff gegen `origin/main`.
- Für den bewusst größeren PR bleibt daher der separate Nachweis der Working-Tree-Prüfungen relevant.

## Technischer Sonderbefund

Ein konkreter PR-Blocker im aktuellen Stand wurde bereits behoben:

- in `packages/auth-runtime/src/iam-governance/core.ts` wurde die nicht kompatible Nutzung von `String.prototype.replaceAll` auf eine build-kompatible Regex-Variante umgestellt

## Review-Hinweise

Weil der PR bewusst breit ist, sollten Reviewer nicht auf einzelne Commits vertrauen, sondern den aktuellen Gesamtstand entlang dieser Prüffragen lesen:

- Sind die IAM-Admin-Pfade fachlich konsistent zwischen UI, Runtime und Contracts?
- Sind Consent-/Rechtstext- und Exportpfade Ende-zu-Ende nachvollziehbar?
- Ist die neue Evidence- und Acceptance-Dokumentation konsistent mit dem technischen Stand?
- Bleiben die offenen Delivery-Themen sauber als Restpunkte markiert, statt stillschweigend als erledigt behauptet zu werden?

## Nächster Schritt

Vor dem tatsächlichen PR-Erstellen sollten die gewünschten Inhalte gemeinsam committed bzw. in logisch nachvollziehbare Commit-Gruppen gebracht werden. Der Branch ist jetzt bewusst auf einen großen IAM-Abschluss-PR ausgerichtet; die verbleibende Arbeit ist vor allem Commit-/Push-/PR-Hygiene, nicht mehr die Grundsatzentscheidung über den Scope.
