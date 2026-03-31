# Abnahmeartefakte IAM-Angebotsbausteine 3 bis 5

## Zweck

Dieses Dokument bündelt die normativen Liefernachweise für `complete-iam-offer-packages-3-to-5`, sodass Angebotsabnahme und technische Abnahme dieselben Artefakte referenzieren.

## Paket 3: Gruppen, Geo-Vererbung und Transparenz

- Referenz-Specs:
  - `openspec/changes/archive/2026-03-31-complete-iam-offer-packages-3-to-5/specs/iam-access-control/spec.md`
  - `openspec/changes/archive/2026-03-31-complete-iam-offer-packages-3-to-5/specs/iam-organizations/spec.md`
  - `openspec/changes/archive/2026-03-31-complete-iam-offer-packages-3-to-5/specs/account-ui/spec.md`
- Pflichtnachweis:
  - Ergebnis der normierten Testmatrix für Gruppen- und Geo-Konfliktfälle
- Mindestinhalt des Nachweises:
  - Mehrfachherkunft direkt + Gruppe
  - deaktivierte oder soft-gelöschte Gruppen
  - Gültigkeitsfenster von Mitgliedschaften
  - Geo-Parent-Allow mit Child-Deny
  - instanzfremde Gruppen- oder Geo-Daten

## Paket 4: Permission Engine und Redis-Snapshots

- Referenz-Specs:
  - `openspec/changes/archive/2026-03-31-complete-iam-offer-packages-3-to-5/specs/iam-access-control/spec.md`
  - `openspec/changes/archive/2026-03-31-complete-iam-offer-packages-3-to-5/specs/iam-core/spec.md`
- Pflichtnachweise:
  - Performance-Bericht für Cache-Hit, Cache-Miss und Recompute
  - Invalidation-Testprotokoll für user-scoped und hierarchische Events
- Mindestinhalt des Performance-Berichts:
  - Testprofil
  - Messumgebung
  - Stichprobenzahl
  - p50, p95, p99
  - Abnahmegrenzen
  - verwendete Endpunkte
- Mindestinhalt des Invalidation-Protokolls:
  - auslösendes Event
  - invalidierter Scope
  - erwarteter Folgezustand
  - Nachweis für Idempotenz oder Event-Duplikate
  - Nachweis für Race-Condition-Schutz

## Paket 5: Rechtstexte, Enforcement und Nachweise

- Referenz-Specs:
  - `openspec/changes/archive/2026-03-31-complete-iam-offer-packages-3-to-5/specs/iam-core/spec.md`
  - `openspec/changes/archive/2026-03-31-complete-iam-offer-packages-3-to-5/specs/account-ui/spec.md`
  - `openspec/changes/archive/2026-03-31-complete-iam-offer-packages-3-to-5/specs/iam-auditing/spec.md`
- Pflichtnachweise:
  - Screenshot oder Screenrecord des blockierenden Akzeptanzflows
  - Testprotokoll für server-seitiges `403 legal_acceptance_required`
  - Deep-Link-Test für blockierte geschützte Route
  - Export-Testprotokoll für JSON und CSV
  - Negativtest ohne `legal-consents:export`
  - Konsistenzabgleich zwischen UI, Export und Auditspur

## Gemeinsame Abnahme-Regel

- Angebotsabnahme und technische Abnahme referenzieren dieselben Artefakte.
- Fehlende oder widersprüchliche Nachweise machen den Change nicht archivierungsfähig.
