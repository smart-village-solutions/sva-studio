## MODIFIED Requirements
### Requirement: User-Bearbeitungsseite

Das System MUST eine User-Bearbeitungsseite unter `/admin/users/:userId` bereitstellen, die eine detaillierte Bearbeitung eines Benutzer-Accounts in einer Tab-Ansicht ermöglicht und direkte, gruppenbasierte sowie vererbte Berechtigungsursachen nachvollziehbar darstellt.

#### Scenario: Verwaltung zeigt nachvollziehbare Berechtigungsherkunft

- **WENN** ein Administrator den Benutzer-Detailbereich mit Rollen- und Rechteinformationen öffnet
- **DANN** zeigt die UI direkte Rollen, Gruppenherkünfte und effektive Berechtigungen in lesbarer Form an
- **UND** markiert sie sichtbar, ob ein Eintrag instanzweit, datensatzbezogen oder organisationskontextbezogen ausgewertet wird
- **UND** bleibt erkennbar, ob ein Eintrag direkt zugewiesen, über eine Gruppe wirksam oder über Organisations- bzw. Geo-Hierarchien vererbt ist
- **UND** bleiben blockierte oder fachlich unwirksame Einträge als solche erkennbar statt still ausgeblendet zu werden

#### Scenario: Benutzerbearbeitung löscht fachlich unveränderte Assignment-Metadaten nicht

- **WENN** ein Administrator einen Benutzer speichert, ohne eine bestehende Rollen- oder Gruppenzuordnung fachlich zu ändern
- **DANN** bleiben vorhandene Metadaten wie Herkunft und Gültigkeitsfenster erhalten
- **UND** erstellt die UI keinen Bedienfluss, der diese Metadaten implizit zurücksetzt, nur weil derselbe Benutzer erneut gespeichert wurde

### Requirement: Sichtbare Gruppenherkunft in IAM-Transparenzdaten

Das System MUST gruppenbasierte Herkunft von Berechtigungen in den relevanten IAM-Ansichten sichtbar machen und zusätzlich Vererbungs- und Restriktionsgründe strukturiert anzeigen.

#### Scenario: Geo-Vererbung mit untergeordneter Restriktion bleibt nachvollziehbar

- **WENN** eine Parent-Freigabe über eine Geo-Hierarchie grundsätzlich wirksam wäre, aber auf einer untergeordneten Einheit eine Restriktion greift
- **DANN** zeigt die UI sowohl die geerbte Herkunft als auch den blockierenden Restriktionsgrund
- **UND** bleibt erkennbar, aus welcher Gruppe oder Rolle die ursprüngliche Freigabe stammt
- **UND** modelliert die UI diese Restriktion nicht als fachliche `deny`-Permission

#### Scenario: Inaktive Gruppen- oder Membership-Zustände bleiben sichtbar

- **WENN** eine Berechtigung wegen deaktivierter Gruppe, abgelaufener Membership oder noch nicht begonnenem Gültigkeitsfenster fachlich nicht wirksam ist
- **DANN** zeigt die UI den Eintrag weiterhin mit einem lesbaren Inaktivitätsgrund
- **UND** muss ein Administrator nicht zwischen mehreren Ansichten springen, um die Ursache zu verstehen
