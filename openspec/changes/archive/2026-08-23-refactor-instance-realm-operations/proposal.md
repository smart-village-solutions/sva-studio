# Change: Realm-Operationsmodell intern und semantikgleich vereinfachen

## Why

Die Realm-Schrittprojektion und die Auswahl der primären Admin-Aktion liegen in
wenigen stark verzweigten Buildern. Dadurch sind sicherheitsrelevante Status-,
Fallback- und Prioritätsregeln schwer isoliert prüfbar, obwohl sie produktiv den
nächsten IAM-Operationsschritt bestimmen.

## What Changes

- Charakterisiert die vollständige New-/Existing-Realm-Schrittmatrix vor jeder
  produktiven Änderung.
- Charakterisiert die Primäraktionspriorität getrennt von der Schritterzeugung.
- Strukturiert ausschließlich interne Builder und typisierte Auswahlhelfer im
  bestehenden Route-Owner neu.
- Bewahrt Reihenfolge, Status, Summary, Evidence Source, Timestamp, Request-ID,
  Action-ID, Label, Reason und Follow-up-Verhalten unverändert.
- Führt keine neue Workflow-Engine, öffentliche API, Mutation, Berechtigung oder
  Übersetzung ein.

## Impact

- Affected specs: `instance-provisioning`
- Affected code:
  - `apps/sva-studio-react/src/routes/admin/instances/-instances-shared.tsx`
  - optional ein internes, nicht öffentliches Helper-Modul im selben Route-Owner
  - `apps/sva-studio-react/src/routes/admin/instances/-instances-shared.test.tsx`
  - `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-models.test.ts`
- Affected arc42 sections: keine normative Architekturwirkung; Owner,
  Paketgrenze, öffentliche Verträge und Runtime-Flows bleiben unverändert
- Active-change boundary: `update-instance-detail-module-tab` besitzt
  Modul-Workspace, Tab-Integration und Page-/UI-Flows. Dieser Change besitzt
  ausschließlich Realm-Operationsprojektion, Primäraktionsauswahl und die zwei
  benannten Modelltests. Bei Source-, Fixture- oder Vertragsüberschneidung wird
  die Umsetzung gestoppt.
