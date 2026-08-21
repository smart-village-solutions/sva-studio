## ADDED Requirements

### Requirement: Backup-Agent validiert Requests an getrennten fail-closed Grenzen

Der zentrale Backup-Agent SHALL Backup- und Restore-Aufträge an getrennten, reinen Grenzen für Objektform und erlaubte Felder, Version und Aktion, Umgebung, Datenbank und Tenant, Request-Identität, Wartungsfensterreferenz, Digest beziehungsweise SHA-256, Objektpfad, Sonderverträge und Ablaufzeit validieren. Die nach außen sichtbaren booleschen Entscheidungen, die kanonische Signaturbildung und die umgebungsgebundene Zielableitung SHALL gegenüber den produktiv eingeführten Verträgen unverändert bleiben. Jedes vom Agenten zur Laufzeit importierte lokale Modul SHALL mit expliziter ESM-Laufzeitendung im Container-Image vorhanden sein.

#### Scenario: Manipulierter Restore-Auftrag scheitert an einer reinen Grenze

- **WHEN** ein Restore-Auftrag ein unbekanntes Feld, eine nicht erlaubte Version oder Aktion, eine falsche Umgebung, eine ungültige Datenbank-/Tenant-Kopplung, eine ungültige Ablaufzeit oder SHA-256, ein fremdes Präfix, Pfadtraversal oder einen abweichenden Waste-Importwert enthält
- **THEN** lehnt die zuständige reine Validierungsgrenze den Auftrag ab
- **AND** liefert die öffentliche Fassade weiterhin `false`
- **AND** beginnt keine Datenbankmutation

#### Scenario: Kompatibler Auftrag behält seine Signatur und Zielbindung

- **WHEN** ein bereits unterstützter Backup-v1/v2-, Restore-v1- oder Waste-Import-v1-Auftrag alle bisherigen Regeln erfüllt
- **THEN** bleibt die boolesche Validierungsentscheidung unverändert
- **AND** bleiben kanonischer Request, Signaturprüfung, Bucket, Präfix, Datenbank und Tenant unverändert gebunden

#### Scenario: Container startet mit extrahierten Validatoren

- **WHEN** das Backup-Agent-Image mit den extrahierten lokalen ESM-Modulen gebaut und gestartet wird
- **THEN** löst Node.js jeden relativen `.mjs`-Import deterministisch aus `/app` auf
- **AND** führt kein fehlendes Runtime-Modul zu einer nur im Container sichtbaren Abweichung
