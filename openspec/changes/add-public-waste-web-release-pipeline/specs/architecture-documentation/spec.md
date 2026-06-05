## ADDED Requirements

### Requirement: Architektur dokumentiert isolierten Waste-Web-Releasepfad

Die Architektur- und Betriebsdokumentation SHALL den Releasepfad der
öffentlichen Waste-Web-App als vom normalen Studio getrennten Deployvertrag
beschreiben.

#### Scenario: Dokumentation beschreibt harte Stack- und Workflow-Trennung

- **WHEN** ein Teammitglied den öffentlichen Waste-Web-Releasepfad nachschlägt
- **THEN** dokumentieren `05-building-block-view`, `07-deployment-view` und `08-cross-cutting-concepts`
  die Trennung von eigenem Image, eigenem Stack, eigenem Variablenraum und eigenem Workflow
- **AND** die Doku grenzt diesen Vertrag explizit vom normalen `studio`-Releasepfad ab

#### Scenario: Betriebsdoku erklärt tag-basierten Release und Smoke-Checks

- **WHEN** ein Operator einen neuen öffentlichen Waste-Web-Release vorbereitet oder nachvollzieht
- **THEN** beschreibt das Runbook Git-Tags `waste-web-vX.Y.Z`, den Portainer-Variablenvertrag,
  den Stack-Rollout und die nachgelagerten Smoke-Checks
- **AND** die Doku benennt Rollback über einen früheren `PUBLIC_WASTE_IMAGE_TAG` als Standardpfad
