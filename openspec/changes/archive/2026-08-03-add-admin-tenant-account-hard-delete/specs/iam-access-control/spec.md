## ADDED Requirements

### Requirement: Tenant-Account-Hard-Delete ist eine explizit permission-gesteuerte Mutation

Das System SHALL die physische Löschung von Tenant-Accounts ausschließlich über die explizite Permission `iam.accounts.delete` autorisieren. `system_admin` darf nur über seine effektive Permission-Menge zugreifen und ist kein genereller Rollen-Bypass für diesen Runtime-Pfad.

#### Scenario: Delete-Pfad verlangt die explizite Permission

- **WENN** ein Tenant-Benutzer ohne wirksame Permission `iam.accounts.delete` den Admin-Delete-Pfad für einen Tenant-Account aufruft
- **DANN** weist das System die Mutation mit einem Autorisierungsfehler ab
- **UND** erklärt die Entscheidung als fehlende Permission statt als fehlende Rolle

#### Scenario: system_admin bleibt permission-basiert, nicht rollenbasiert

- **WENN** ein Actor die Rolle `system_admin` besitzt
- **DANN** darf der Delete-Pfad nur deshalb erfolgreich sein, weil `system_admin` die Permission `iam.accounts.delete` in seiner effektiven Permission-Menge enthält
- **UND** bleibt der Pfad Teil der normalen tenantseitigen Runtime-Autorisierung

### Requirement: system_admin-Zielaccounts bleiben vor Löschung geschützt

Das System SHALL Tenant-Accounts mit der Rolle `system_admin` vor physischer Löschung schützen, bis diese Rolle zuvor entzogen wurde.

#### Scenario: Geschützter Zielaccount wird nicht gelöscht

- **WENN** ein berechtigter Actor einen Zielaccount löschen will, der aktuell die Rolle `system_admin` besitzt
- **DANN** lehnt das System die Löschung ab
- **UND** beschreibt die Ablehnung als Schutzregel für `system_admin`
- **UND** verlangt der fachliche Ablauf zuerst den Entzug der Rolle
