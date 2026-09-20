## MODIFIED Requirements

### Requirement: Architektur dokumentiert isolierten Waste-Web-Releasepfad

Die Architektur- und Betriebsdokumentation SHALL den Releasepfad der öffentlichen Waste-Web-App als vom normalen Studio getrennten Deployvertrag beschreiben, einschließlich eines Einmal-Builds und environment-getrennter Deploy-Jobs für die explizit konfigurierten Zielstacks.

#### Scenario: Betriebsdoku beschreibt mehrere öffentliche Waste-Web-Ziele

- **WHEN** ein Teammitglied einen Release für Prignitz und Frankfurt (Oder) vorbereitet oder nachvollzieht
- **THEN** erläutern Architektur- und Betriebsdokumentation den identischen Image-Tag, die getrennten GitHub-Environments, die zielbezogenen Stacks und Smokes
- **AND** sie beschreiben den Umgang mit einem teilweisen Fehlschlag ohne automatischen Rollback
- **AND** sie grenzen diesen Vertrag explizit vom normalen `studio`-Releasepfad ab
