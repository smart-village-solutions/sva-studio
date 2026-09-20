## MODIFIED Requirements

### Requirement: Öffentliche Waste-Web-App hat einen eigenen Swarm-Stack

Das System SHALL für jede konfigurierte öffentliche Waste-Web-Instanz einen eigenen Portainer-/Swarm-Stack bereitstellen, der nicht Teil des normalen `studio`-Stacks ist. Der tag-basierte Release darf mehrere explizit konfigurierte Stacks mit demselben Image-Tag aktualisieren, muss jeden Stack aber über ein getrenntes GitHub-Environment und einen getrennten Deploy-Job behandeln.

#### Scenario: Multi-target Release aktualisiert nur die expliziten Waste-Web-Stacks

- **WHEN** ein öffentlicher Waste-Web-Release für Prignitz und Frankfurt (Oder) ausgeführt wird
- **THEN** aktualisiert jeder Environment-gebundene Deploy-Job nur `PUBLIC_WASTE_IMAGE_TAG` seines konfigurierten Stacks
- **AND** der bestehende `studio`-Stack bleibt unverändert
- **AND** keine Runtime-Variable eines Zielstacks als Fallback für den anderen Zielstack verwendet wird

#### Scenario: Öffentliche Waste-Web-App wird getrennt von Studio ausgerollt

- **WHEN** ein Operator oder Workflow die öffentliche Waste-Web-App ausrollt
- **THEN** erfolgt der Rollout gegen den dedizierten Stack `web-waste-calendar`
- **AND** der bestehende `studio`-Stack bleibt unverändert
- **AND** die Compose-Definition des Waste-Web-Stacks erweitert nicht die Studio-Compose
