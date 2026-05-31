## Context
Die bestehende IAM-Struktur kennt bereits instanz- und organisationsbezogene Effective Permissions, aber keine fachlich sichtbaren Zugriffsstufen pro Rollen-Recht-Zuweisung. Gleichzeitig darf `iam.permissions.scope` nicht ueberladen werden, weil dort bereits generische ABAC-/Policy-Daten liegen.

## Decision
- Rollen-Rechte-Scope wird auf der Join-Tabelle `iam.role_permissions` modelliert.
- Die wire-kompatible Rollenmutation akzeptiert zukunftig `permissionAssignments[]`; `permissionIds[]` bleibt voruebergehend als Legacy-Shortcut fuer `all` bestehen.
- Der zentrale Authorize-Pfad wertet `accessScope` nur fuer explizit scope-faehige Datensatzrechte aus.
- V1 aktiviert die Funktion nur fuer Datensatzrechte mit stabiler Ownership-Semantik im Content-/Standard-Content-Pfad.

## Consequences
- Role Read Models muessen Assignment-Metadaten mitliefern.
- Effective Permissions und Permission Trace koennen denselben Scope transparent anzeigen.
- Content-Authorize-Requests muessen `createdByAccountId` und den aktiven Organisationskontext strukturiert mitliefern.
