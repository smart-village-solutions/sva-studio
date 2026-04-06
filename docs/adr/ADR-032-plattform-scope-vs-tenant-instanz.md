# ADR-032: Plattform-Scope vs. Tenant-Instanz

## Status

Akzeptiert

## Kontext

Der Root-Host der Studio-Plattform steuert tenantübergreifende Funktionen wie Instanzverwaltung, Root-Host-Login und globale Readiness-/Diagnosepfade. Gleichzeitig ist das IAM-Datenmodell tenantzentriert; `iam.instances` repräsentiert nur echte Tenant-Instanzen. Die bisherige technische Vermischung über `global`, `default` und `platform` führte zu inkonsistenten Laufzeitkontexten, uneinheitlichem Logging und Audit-Schreibfehlern gegen `iam.activity_logs`.

## Entscheidung

1. Die Runtime kennt genau zwei kanonische Scope-Arten:
   - `instance`
   - `platform`
2. `instanceId` bleibt exklusiv tenantgebunden.
3. Der Root-Host läuft fachlich immer im `platform`-Scope.
4. Tenant-Audit bleibt in `iam.activity_logs`.
5. Plattform-Audit wird separat in `iam.platform_activity_logs` persistiert.
6. Operative Logs und Fehlerpfade verwenden `scope_kind`, `workspace_id`, `reason_code`, `error_type` und redigierte Diagnosefelder statt roher Fehlertexte.

## Konsequenzen

### Positiv

- Root-Host-Aktionen sind fachlich explizit modelliert.
- Tenant-Audit bleibt sauber FK-gebunden an `iam.instances`.
- Plattform-Audit scheitert nicht mehr an tenantgebundenen Fremdschlüsseln.
- Logs und Fehlerantworten werden stabiler und betrieblich besser auswertbar.

### Negativ

- Bestehende Tests und Log-Erwartungen müssen auf `platform`/`instance` migriert werden.
- Übergangsweise bleiben einzelne Altpfade mit `default` als technischer Kompatibilitätswert bestehen.

## Verworfen

### Pseudo-Instanz in `iam.instances`

Verworfen, weil sie Plattform- und Tenant-Modell künstlich vermischt und FK-gebundene Tenant-Tabellen fachlich unsauber erweitert hätte.
