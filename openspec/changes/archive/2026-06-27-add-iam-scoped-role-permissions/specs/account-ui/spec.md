## ADDED Requirements
### Requirement: Rollen-Detailseite pflegt Assignment-Scopes fuer scope-faehige Rechte
Das System SHALL in der Rollen-Detailseite fuer scope-faehige Datensatzrechte neben der Zuweisung auch den Assignment-Scope pflegbar machen.

#### Scenario: Scope-Selector erscheint nur fuer geeignete Rechte
- **WHEN** ein Administrator den Permissions-Tab einer editierbaren Rolle oeffnet
- **THEN** zeigt die UI fuer scope-faehige Rechte einen Selector fuer `all`, `own` und `organization`
- **AND** nicht scope-faehige Rechte bleiben binaer zuweisbar

#### Scenario: Speichern sendet strukturierte Permission-Assignments
- **WHEN** ein Administrator Rechte- oder Scope-Aenderungen speichert
- **THEN** sendet die UI `permissionAssignments[]` mit `permissionId` und `accessScope`
- **AND** neu zugewiesene scope-faehige Rechte erhalten standardmaessig `all`

### Requirement: Nutzeransicht zeigt effektive Permission-Scopes transparent an
Das System SHALL in der Nutzer-Berechtigungsansicht den effektiven Assignment-Scope rollen- oder gruppenvermittelter Datensatzrechte sichtbar machen.

#### Scenario: Effektiver Scope wird im Permission Trace dargestellt
- **WHEN** ein Administrator den Tab `Berechtigungen` einer Nutzerdetailseite betrachtet
- **THEN** enthalten effektive Permission-Trace-Eintraege den wirksamen Assignment-Scope
- **AND** die Darstellung bleibt read-only
