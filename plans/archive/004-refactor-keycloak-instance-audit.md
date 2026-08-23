# Plan 004: Keycloak-Instanz-Audit in Erhebung und Bewertung trennen

> **Archivstatus:** DONE

> Executor: Arbeite ausschließlich im eigenen Worktree. Führe jeden Gate aus.
> Bei einer STOP-Bedingung nicht improvisieren, sondern berichten. Den Index
> `plans/README.md` aktualisiert der koordinierende Reviewer.

## Status

- Status: DONE
- Ausgeliefert mit: PR #989, Merge-Commit
  `d9c6c0002ba46943f754ba3541665c29e0b6f5d9`

- Priorität: P1
- Aufwand: M
- Risiko: HIGH
- Abhängigkeit: Plan 003 gemergt
- Kategorie: Operations, Security und Tech Debt
- Geplant bei: `5d57965dfe966a77f66aa0a955ca94a3d7cf0642`, 2026-08-14

## Ziel und Ist-Zustand

`scripts/ops/studio-instance-audit/keycloak.ts` ist produktiv erreichbarer
Audit-Code. Der Callback in `inspectRealmAndClients` umfasst 179 Zeilen bei
zyklomatischer Komplexität 57, kognitiver Komplexität 43 und CRAP 3306. Er
vermischt `kcadm`-Erhebung, Secret-Vergleiche und die Bewertung von 14
Audit-Checks. Die Fail-/Warn-/Skip-Semantik und alle Check-IDs sind operativer
Vertrag und müssen unverändert bleiben.

## Scope

In Scope:

- `scripts/ops/studio-instance-audit/keycloak.ts`
- kleine, zweckgebundene Module unter `scripts/ops/studio-instance-audit/`
- Vitest-Characterization unter `scripts/ops/`
- neuer OpenSpec-Change `refactor-keycloak-instance-audit-evaluation`
- relevante deutsche arc42-/Betriebsdokumentation

Out of Scope:

- Änderungen an Keycloak-Realm, Clients, Rollen, Nutzern oder Secrets
- neue Audit-Checks, neue Check-IDs oder geänderte Statusprioritäten
- Aufweichen fehlender Konfiguration oder fehlender Secrets
- direkte `kcadm`-Mutation, Rollout oder Runtime-Konfigurationsänderung
- generisches Regel-Framework

## Vorgehen

1. OpenSpec-Proposal und Design für getrennte Erhebungs- und pure
   Bewertungsgrenzen erstellen und streng validieren.
2. Vor der Extraktion eine Characterization-Matrix für Realm fehlt,
   Login-Client/URLs/Secret, Tenant-Admin-Client/Flags/Secret/Rollen,
   `system_admin` und optionale Mapper-/Bootstrap-Hinweise ergänzen.
3. Die per `kcadm` gelesenen Fakten in einem kleinen typisierten Snapshot
   sammeln und die unveränderten `AuditCheckResult[]` rein daraus ableiten.
4. Secret-Werte weder in Rückgaben, Fehlern, Logs noch Test-Snapshots
   aufnehmen; nur Gleichheit bzw. Vorhandensein bewerten.
5. Script-Types, fokussierte Unit-Tests, Complexity, Fallow, File-Placement,
   OpenSpec und den kleinsten relevanten PR-Gate-Pfad ausführen.

## Verifikation

```bash
pnpm exec vitest run scripts/ops/studio-instance-audit.test.ts scripts/ops/studio-instance-audit-keycloak.test.ts
pnpm exec tsc -p tsconfig.scripts.json --noEmit
pnpm complexity-gate
pnpm check:file-placement
pnpm exec openspec validate refactor-keycloak-instance-audit-evaluation --strict
```

Vor Push nach Möglichkeit `pnpm test:pr`.

## Fertig, wenn

- der 57/43/179-Hotspot nicht mehr als kritischer Fallow-Befund erscheint,
- alle bestehenden Check-IDs, Titel, Zusammenfassungen, Details und
  Fail-/Warn-/Skip-Status durch Tests fixiert bleiben,
- die `kcadm`-Befehlsfolge und das temporäre Config-Cleanup unverändert sind,
- keine Secret-Inhalte in Evidenz oder Logs gelangen,
- ein eigener PR ohne offene Review-Threads und mit grüner SHA-genauer CI
  gemergt wurde.

## STOP-Bedingungen

- Die Refaktorierung erfordert eine Änderung am Auditvertrag oder an Keycloak.
- Die bestehende Statussemantik ist widersprüchlich und nicht durch aktuellen
  Betriebscode bzw. Dokumentation entscheidbar.
- Tests können nur durch echte externe Keycloak-Mutationen deterministisch
  gemacht werden.
