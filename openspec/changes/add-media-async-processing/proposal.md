# Change: Standard-Bildvarianten über vorhandene Studio-Jobs verarbeiten

## Warum

Das Medienmanagement erzeugt Standard-Bildvarianten derzeit im Upload-Request. Dieser Change verschiebt die vorhandene Verarbeitung in einen Studio-Job. Redakteure warten weiterhin auf das fertige Medium, bevor sie es verwenden oder den zugehörigen Inhalt speichern.

Ein konkreter Performanceengpass ist bisher nicht durch Messungen belegt. Der Change bleibt ein geplanter Ausbau und erhält erst bei einem belegten Betriebsbedarf oder einer konkret anstehenden Hintergrundverarbeitung Priorität.

## Was ändert sich

- Ein hosteigener Medienjob nutzt die vorhandene Studio-Job-Fähigkeit mit Graphile Worker gemäß ADR-040.
- Inhaltsvalidierung, Metadatenextraktion und Standard-Variantengenerierung laufen im Job über die bestehende Verarbeitungslogik.
- Bestehende UI und SDK zeigen beziehungsweise verfolgen die Verarbeitung und schließen den Upload erst bei `ready` erfolgreich ab.
- Mandantentrennung, Claims, Quoten und Bereinigung bleiben erhalten.

## Nicht-Ziele

- Nutzung, Referenzierung oder fachliche Auslieferung unfertiger Medien; Original-/Placeholder-Fallbacks
- neue Queue-Technologie, separater Worker-Dienst, eigene Retry-/Dead-Letter-Infrastruktur oder zusätzliche Monitoring-Oberfläche
- paralleler synchroner Variantenpfad für kleine Dateien
- Malware-Scan, Replace, Versionierung, Retention, zusätzliche Presets oder Batch-Migrationen; fachliche Governance-Funktionen bleiben im separaten Change `extend-media-management-governance`

## Auswirkungen

- Affected specs: `media-management`
- Betroffene bestehende Pfade: Medien-Upload und Studio-Jobs in `packages/auth-runtime`, bei Bedarf deren Persistenz in `packages/data` und `packages/data-repositories`, Upload-/Detailanzeige in `apps/sva-studio-react` sowie Upload und Content-Speichern in `packages/plugin-sdk`
- Vorhandene Job-Persistenz, Status, Wiederholungsversuche und Betriebsdiagnostik werden wiederverwendet. Es entsteht keine neue Job-Plattform.
- Betroffene Dokumentation bei Umsetzung: `docs/reference/media-management.md` sowie die arc42-Abschnitte `docs/architecture/05-building-block-view.md` und `docs/architecture/06-runtime-view.md`
