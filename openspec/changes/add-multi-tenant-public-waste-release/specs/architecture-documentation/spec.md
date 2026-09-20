## MODIFIED Requirements

### Requirement: Architektur dokumentiert isolierten Waste-Web-Releasepfad

Die Architektur- und Betriebsdokumentation SHALL den Releasepfad der öffentlichen Waste-Web-App als vom normalen Studio getrennten Deployvertrag beschreiben, einschließlich eines Einmal-Builds und environment-getrennter Deploy-Jobs für die explizit konfigurierten Zielstacks.

#### Scenario: Betriebsdoku beschreibt mehrere öffentliche Waste-Web-Ziele

- **WHEN** ein Teammitglied einen Release für Prignitz und Frankfurt (Oder) vorbereitet oder nachvollzieht
- **THEN** erläutern Architektur- und Betriebsdokumentation den identischen Image-Tag, die getrennten GitHub-Environments, die zielbezogenen Stacks und Smokes
- **AND** sie beschreiben den Umgang mit einem teilweisen Fehlschlag ohne automatischen Rollback
- **AND** sie grenzen diesen Vertrag explizit vom normalen `studio`-Releasepfad ab

#### Scenario: Dokumentation beschreibt harte Stack- und Workflow-Trennung

- **WHEN** ein Teammitglied den öffentlichen Waste-Web-Releasepfad nachschlägt
- **THEN** dokumentieren `05-building-block-view`, `07-deployment-view` und `08-cross-cutting-concepts` die Trennung von eigenem Image, eigenem Stack, eigenem Variablenraum und eigenem Workflow
- **AND** die Doku grenzt diesen Vertrag explizit vom normalen `studio`-Releasepfad ab

#### Scenario: Betriebsdoku erklärt tag-basierten Release und Smoke-Checks

- **WHEN** ein Operator einen neuen öffentlichen Waste-Web-Release vorbereitet oder nachvollzieht
- **THEN** beschreibt das Runbook Git-Tags `waste-web-vX.Y.Z`, den Portainer-Variablenvertrag, den Stack-Rollout und die nachgelagerten Smoke-Checks
- **AND** die Doku benennt Rollback über einen früheren `PUBLIC_WASTE_IMAGE_TAG` als Standardpfad
