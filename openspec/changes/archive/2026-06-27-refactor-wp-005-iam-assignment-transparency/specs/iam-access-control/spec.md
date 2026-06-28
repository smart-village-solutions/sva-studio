## MODIFIED Requirements
### Requirement: Permissions-Übersicht pro aktivem Kontext

Das System SHALL eine kontextbezogene Permissions-Übersicht für den aktuell angemeldeten Benutzer bereitstellen, optional einen impersonierten Zielkontext auswerten und dabei alle für Transparenz- und Diagnose-UI erforderlichen strukturierten Felder einschließlich `runtimeScope`, Vererbungs-, Restriktions- und Inaktivitätsgründen liefern.

#### Scenario: Strukturierte Permission-Felder enthalten Vererbungs- und Restriktionsgründe

- **WHEN** die Permissions-Übersicht oder ein äquivalentes Benutzer-Detail-Read-Modell für Transparenzzwecke zurückgegeben wird
- **THEN** enthält jeder Permission-Eintrag neben Quelle und Scope auch strukturierte Felder für `runtimeScope`, organisations- oder geo-bezogene Vererbung sowie blockierende Restriktionen
- **AND** kann die Admin-UI direkte, vererbte und unwirksame Pfade ohne zusätzliche Serverheuristik unterscheiden

### Requirement: Hierarchische Vererbung mit Restriktionen

Das System SHALL Berechtigungen entlang definierter Org-/Geo-Hierarchien vererben, untergeordnete Restriktionen berücksichtigen und die daraus resultierende Wirkung reproduzierbar begründen.

#### Scenario: Vererbte Berechtigung mit Einschränkung bleibt erklärbar

- **WHEN** eine Berechtigung auf übergeordneter Ebene vergeben ist
- **AND** auf untergeordneter Ebene eine Einschränkung existiert
- **THEN** wird die effektive Berechtigung unter Berücksichtigung der Einschränkung berechnet
- **AND** das Read-Modell enthält genug Informationen, um sowohl den Vererbungsursprung als auch die blockierende Restriktion nachvollziehbar anzuzeigen

### Requirement: Gruppen als zusätzliche Quelle effektiver Berechtigungen

Das System SHALL Gruppen als instanzgebundene IAM-Entität auswerten, deren Zuweisungen in die effektive Berechtigungsberechnung einbeziehen und inaktive oder historisierte Zustände transparent von wirksamen Zuständen trennen.

#### Scenario: Mehrfachherkunft direkt plus Gruppe bleibt fachlich verdichtet

- **WHEN** dieselbe effektive Berechtigung gleichzeitig aus einer direkten Rolle und einer oder mehreren Gruppen stammt
- **THEN** wird das fachliche Ergebnis deterministisch nur einmal bewertet
- **AND** das Transparenzmodell listet die vollständige Herkunft getrennt nach direkter und gruppenbasierter Quelle

#### Scenario: Inaktive oder soft-gelöschte Gruppen bleiben transparent, aber wirkungslos

- **WHEN** eine Gruppe deaktiviert oder soft-gelöscht ist oder eine Membership zeitlich nicht wirksam ist
- **THEN** fließen ihre Rechte nicht in die effektive Berechtigungsentscheidung ein
- **AND** das Transparenzmodell kann den inaktiven Zustand für Diagnose- und Abnahmezwecke weiterhin ausweisen

## ADDED Requirements
### Requirement: Tenantweite Rechte bleiben bei aktivem Organisationskontext instanzweit wirksam

Das System SHALL tenantweite Host- und Plugin-Rechte nicht allein deshalb organisationsgebunden behandeln, weil ein aktiver `organizationId`-Kontext vorhanden ist.

#### Scenario: Instanzrecht bleibt trotz aktivem Organisationskontext organisationsagnostisch

- **WHEN** eine instanzweite Permission wie `media.read` oder `waste-management.read` für einen Benutzer aufgelöst wird
- **AND** der Request oder die Session gleichzeitig einen aktiven `organizationId`-Kontext trägt
- **THEN** bleibt die effektive Permission instanzweit wirksam
- **AND** wird im effektiven Permission-Modell kein organisationsbezogener Scope allein aus diesem Kontext abgeleitet
