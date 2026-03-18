## MODIFIED Requirements
### Requirement: User-Administrationsliste

Das System MUST eine User-Administrationsliste unter `/admin/users` bereitstellen, mit der Administratoren alle Benutzer-Accounts verwalten können.

#### Scenario: User-Liste laden

- **WENN** ein Administrator `/admin/users` aufruft
- **DANN** wird eine semantische Tabelle (`<table>` mit `<caption>` oder `aria-label`) aller Nutzer angezeigt
- **UND** die Spalten sind: Name, E-Mail, Rolle, Status, Letzter Login
- **UND** jede Tabellenkopfzelle hat `<th scope="col">`
- **UND** sortierbare Spalten haben `aria-sort` (ascending|descending|none)
- **UND** die Tabelle paginiert bei mehr als 25 Einträgen
- **UND** ein Loading-State (`aria-busy="true"`) wird angezeigt, bis die Daten geladen sind
- **UND** bei leerem Ergebnis wird ein Empty-State angezeigt (`t('admin.users.emptyState')`)

#### Scenario: Keycloak-Benutzer synchronisieren

- **WENN** ein Administrator in `/admin/users` die Aktion „Aus Keycloak synchronisieren" ausführt
- **DANN** lädt das System Keycloak-Benutzer für den aktuellen `instanceId`-Kontext
- **UND** importiert oder aktualisiert fehlende Benutzer in IAM idempotent
- **UND** zeigt nach Abschluss eine Ergebnisrückmeldung mit Anzahl importierter und aktualisierter Benutzer
- **UND** lädt die User-Liste anschließend neu

