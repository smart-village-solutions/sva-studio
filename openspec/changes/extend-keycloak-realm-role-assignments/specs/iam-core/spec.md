## MODIFIED Requirements

### Requirement: Keycloak Admin API Integration

Das System MUST über dedizierte Service-Accounts mit der Keycloak Admin REST API kommunizieren, um Benutzer, Identitätsattribute, technische Realm-Artefakte sowie direkte Realm-Rollenzuweisungen im jeweiligen Platform- oder Tenant-Scope vollständig listen, bearbeiten und synchronisieren zu können. Keycloak bleibt System of Record für Identitäten, Login, technische Realm-Zugänge und die direkten Zuweisungen externer Realm-Rollen; tenantlokale Fachrollen und deren Studio-Permissions werden normativ im Studio-IAM-Modell verwaltet.

#### Scenario: Keycloak-first user mutation

- **WHEN** ein berechtigter Admin einen User im Studio erstellt, deaktiviert oder Identitäts-/Profilfelder ändert
- **THEN** führt das System die identitätsbezogene Mutation zuerst gegen Keycloak aus
- **AND** synchronisiert anschließend das Studio-Read-Model
- **AND** direkte fachliche Tenant-Rollen werden dabei nicht als allgemeiner Keycloak-Rollenkatalog vorausgesetzt
- **AND** bei nachgelagertem Sync-Fehler bleibt der Keycloak-Zustand sichtbar und wird als Drift gemeldet

#### Scenario: Tenant-Rollenmutation bleibt fachlich im IAM-Modell

- **WHEN** ein berechtigter Tenant-Admin eine lokale fachliche Rolle oder deren Studio-Permissions ändert
- **THEN** führt das System die fachliche Mutation im IAM-Rollenmodell aus
- **AND** materialisiert oder verändert es dadurch keine gleichnamige externe Keycloak-Realm-Rolle

#### Scenario: Externe Realm-Rollenzuweisung bleibt Keycloak-owned

- **WHEN** ein berechtigter Tenant-Admin eine reguläre externe Realm-Rolle direkt einem Benutzer zuweist oder entzieht
- **THEN** führt das System ausschließlich das angeforderte Delta gegen den gebundenen Tenant-Realm aus
- **AND** importiert es die externe Rolle oder Zuweisung nicht in lokale IAM-Rollenbeziehungen
- **AND** bestätigt es Erfolg erst nach einem kausalen Read des direkten Keycloak-Zuweisungszustands

#### Scenario: Bulk-Reprovision aktualisiert Mainserver-Attribute pro Zielnutzer

- **WENN** ein berechtigter Tenant-Admin `POST /api/v1/iam/users/bulk-reprovision-mainserver` mit explizit markierten Nutzer-IDs ausführt
- **DANN** verarbeitet das System höchstens 50 eindeutige Zielnutzer
- **UND** aktualisiert pro erfolgreich verarbeitetem Zielnutzer die Mainserver-Credentials in den Keycloak-Attributen
- **UND** liefert pro nicht erfolgreich verarbeitetem Zielnutzer einen stabilen Fehlercode zurück, ohne erfolgreiche Zielnutzer zurückzurollen

### Requirement: Keycloak-Rollenabgleich ist auf technische Sonderrollen begrenzt

Das System SHALL den automatischen normativen Keycloak-Rollenabgleich weiterhin auf Plattform-Scope, Tenant-Bootstrap und technische Realm-Verträge begrenzen. Tenantlokale Fachrollen werden nicht allgemein als Keycloak-Realm-Rollen materialisiert oder gepflegt. Explizite direkte Benutzerzuweisungen bereits vorhandener externer Realm-Rollen sind davon als administrativer Interop-Pfad getrennt.

#### Scenario: Tenant-Custom-Rolle bleibt IAM-lokal

- **WHEN** ein `system_admin` im Tenant-Realm eine editierbare Custom-Rolle erstellt, ändert oder löscht
- **THEN** persistiert das System diese Mutation im tenantlokalen IAM-Rollenmodell
- **AND** führt dafür keine allgemeine Keycloak-Realm-Rollenmutation aus
- **AND** behandelt eine fehlende korrespondierende Keycloak-Rolle nicht als Drift des Sollmodells

#### Scenario: Technische Sonderrolle bleibt synchronisierbar

- **WHEN** der Bootstrap-, Repair- oder Schutzpfad die tenantlokale Sonderrolle `system_admin` oder die Plattformrolle `instance_registry_admin` prüft
- **THEN** darf das System diese technische Sonderrolle weiterhin gezielt in Keycloak abgleichen
- **AND** bleibt dieser Abgleich auf den jeweils zuständigen Realm-Scope beschränkt

#### Scenario: Explizite externe Zuweisung erweitert den Reconcile-Scope nicht

- **WHEN** ein Admin einem Benutzer eine reguläre externe Realm-Rolle direkt zuweist
- **THEN** gilt diese Zuweisung als Keycloak-owned Interop-Zustand
- **AND** nimmt der Rollen-Reconcile weder die externe Rollendefinition noch ihre Zuweisung in das lokale IAM-Sollmodell auf
- **AND** entfernt ein späterer Reconcile diese Zuweisung nicht als Drift
