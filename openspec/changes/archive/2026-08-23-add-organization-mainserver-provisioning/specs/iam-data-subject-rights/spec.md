## MODIFIED Requirements

### Requirement: Tenantbezogener Inaktivitäts-Lebenszyklus ergänzt das Recht auf Löschung

Das System SHALL für nicht technische Tenant-Accounts einen regelbasierten Inaktivitäts-Lebenszyklus bereitstellen, der die Stufen `active`, `deactivated`, `pseudonymized` und `deleted` verwendet. Der Lebenszyklus gilt nur im Tenant-Scope, leitet Inaktivität in V1 ausschließlich aus erfolgreichen Login-Events der betroffenen `instanceId` ab und endet im Standardpfad in einem finalen Tombstone-Soft-Delete statt in einer physischen Löschung. Accounts mit der aktuellen Klassifikation `isTechnicalAccount = true` SHALL von automatischen und manuell angestoßenen Läufen dieses konfigurierten Lifecycles ausgenommen werden. Ein separater, privilegierter Admin-Hard-Delete für Tenant-Accounts darf als explizite Ausnahme zusätzlich existieren, ersetzt den Lifecycle-Standardpfad jedoch nicht und wird durch die technische Klassifikation nicht verändert.

#### Scenario: Lebenszyklus bleibt der tombstone-basierte Standardpfad

- **WHEN** das System einen nicht technischen Tenant-Account über den automatischen oder manuellen Inaktivitäts-Lifecycle verarbeitet
- **THEN** beschreibt `deleted` weiterhin den finalen Tombstone-Soft-Delete ohne physische Löschung
- **AND** bleibt dieser Lifecycle unabhängig von einem separaten privilegierten Admin-Hard-Delete

#### Scenario: Technischer Account wird vom Inaktivitäts-Lifecycle übersprungen

- **GIVEN** ein Tenant-Account hat `isTechnicalAccount = true`
- **WHEN** ein automatischer oder manuell angestoßener Lauf die konfigurierten Deaktivierungs-, Pseudonymisierungs- oder Löschschwellen auswertet
- **THEN** führt das System für diesen Account keinen Lifecycle-Übergang aus
- **AND** verändert es weder Accountdaten noch eigene Inhalte aufgrund dieses Laufs

#### Scenario: Nachträgliche Markierung stellt keinen Zustand wieder her

- **GIVEN** ein Account hat bereits den Zustand `deactivated` oder `pseudonymized` erreicht
- **WHEN** ein Administrator ihn als technisch markiert
- **THEN** bleibt der erreichte Zustand unverändert
- **AND** werden nur weitere regelbasierte Lifecycle-Übergänge übersprungen

#### Scenario: Entfernte Markierung aktiviert die normale Regelbewertung erneut

- **GIVEN** ein bisher technischer Account wird mit `isTechnicalAccount = false` gespeichert
- **WHEN** der nächste Lifecycle-Lauf seine unveränderten Referenzzeiten und Tenantregeln auswertet
- **THEN** nimmt der Account wieder an der normalen Lifecycle-Entscheidung teil
- **AND** kann er unmittelbar für den nächsten zulässigen Übergang qualifizieren

#### Scenario: Privilegierter Admin-Hard-Delete ist vom Lifecycle getrennt

- **WHEN** ein berechtigter Tenant-Admin einen Tenant-Account über den expliziten Admin-Delete-Pfad physisch löscht
- **THEN** gilt dieser Vorgang nicht als normaler Lifecycle-Übergang des Inaktivitätsmodells
- **AND** darf er den Account physisch entfernen, sobald referenzierende Daten regelkonform bereinigt wurden
- **AND** bleiben die tenantbezogenen Löschregeln für die Behandlung eigener Inhalte weiterhin maßgeblich
- **AND** erzeugt `isTechnicalAccount = true` keine zusätzliche Hard-Delete-Sperre
- **AND** löst der Hard Delete eine vorhandene Organisations-Provisioning-Accountreferenz, ohne gültige organisationsbezogene Credentials oder DataProvider-Bindungen allein deshalb zu löschen
- **AND** wird der Hard Delete während einer aktiven Provisioning-Lease mit einem sicheren Konflikt abgewiesen
