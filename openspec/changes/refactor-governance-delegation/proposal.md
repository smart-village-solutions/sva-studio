# Change: Governance-Delegation entflechten

## Warum

Die Delegationserstellung bündelt Eingabenormalisierung, Policy-Entscheidungen, Account-Auflösung, Persistenz und Audit in einer komplexen Funktion. Der sicherheitskritische Vertrag soll ohne Verhaltensänderung in eine reine Entscheidung und explizites I/O-Wiring getrennt werden.

## Was ändert sich

- Charakterisiert Pflichtfelder, Ticketzustände, Zeitgrenzen, Account-Auflösung, Self-Approval sowie SQL- und Audit-Reihenfolge vollständig.
- Extrahiert frameworkfreie Normalisierung und Delegationsentscheidung innerhalb von `@sva/iam-governance`.
- Belässt Account-Auflösung, SQL-Persistenz, Audit und Logging als explizites Wiring im Workflow-Executor.
- Erhält Reason Codes, Instanzfilter, SQL-Parameter, Auditfelder und Fehlerweitergabe unverändert.

## Auswirkungen

- Betroffene Spezifikation: `iam-program-governance`
- Betroffener Code: `packages/iam-governance/src/governance-workflow-executor.ts` und kleine paketinterne Helper
- Betroffene Tests: `packages/iam-governance/src/governance-workflow-executor.test.ts`
- Betroffene arc42-Abschnitte: `05-building-block-view`, `08-cross-cutting-concepts`
- Keine Datenbank-, API-, Rollen-, Impersonation- oder Transaktionsänderung
