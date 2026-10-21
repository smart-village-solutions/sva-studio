## 1. Bestehenden Verarbeitungspfad umstellen

- [x] 1.1 Einen hosteigenen Medienjob über vorhandene Studio-Jobs registrieren und den Upload-Abschluss dauerhaft sowie idempotent anbinden; vorhandene Runtime-Registrierungen einschließlich SSF berücksichtigen
- [x] 1.2 Vorhandene Inhaltsvalidierung, Metadatenextraktion und Standard-Variantengenerierung im Job ausführen; synchronen Request-Aufruf entfernen und Claim-, Quoten- und Bereinigungsschutz erhalten
- [x] 1.3 Bestehende Upload-/Detailanzeige und SDK um begrenztes Warten auf `ready` ergänzen; Content erst danach speichern und Medien vorher weder neu referenzieren noch fachlich ausliefern. Bei Timeout Bibliotheksjobs weiterlaufen lassen; Content-Speicherversuche mit Fehlermeldung und erhaltenen Formulareingaben beenden und deren provisorische Uploads über den vorhandenen Abbruch-/Recovery-Pfad bereinigen. Vorhandene Job-Diagnostik verwenden.

## 2. Gezielte Absicherung und Dokumentation

- [x] 2.1 Gezielt testen: Annahme und `ready`, fehlgeschlagene Einplanung, wiederholter Abschluss/Job, temporärer und endgültiger Fehler, Mandantentrennung und Quotenüberschreitung ohne Doppelbuchung
- [x] 2.2 Timeout beim Bibliotheksupload mit weiterlaufendem Job ohne Duplikat testen. Content-Flow testen: Warten vor Content-Persistenz, Timeout mit Fehlermeldung und erhaltenen Formulareingaben, Bereinigung provisorischer Uploads bei unveränderten Bibliotheksmedien, stabile Delivery-URL nach `ready` sowie Abbruch während Verarbeitung ohne spätere Veröffentlichung oder verwaiste Varianten.
- [x] 2.3 `docs/reference/media-management.md` sowie `docs/architecture/05-building-block-view.md` und `docs/architecture/06-runtime-view.md` für den geänderten Ablauf sowie den bestehenden Risikoeintrag und die Beschreibung des Claim-Vertrags in `docs/development/studio-db-schema.md` aktualisieren
- [x] 2.4 Kleinste betroffene Unit-/Type-Gates, relevante PostgreSQL-/Job-Integrationstests und `pnpm check:server-runtime` ausführen; bei Schemaänderungen zuvor die kanonischen Schemadokumente prüfen und gemeinsam fortschreiben
- [x] 2.5 `openspec validate add-media-async-processing --strict` und `pnpm check:file-placement` ausführen

## Lokale Nachweise

- Gezielte Unit-Tests für Medien-Runtime, Media-SDK, Medien-Repository, Upload-/Detail-Hooks, Bibliotheks-/Detailseiten, Host-Registrierung einschließlich SSF und Cockpit-Editor erfolgreich.
- `pnpm nx run auth-runtime:test:integration` erfolgreich: bestehende Graphile-/Lifecycle-Verträge und Medien-PostgreSQL-Tests. Nach Ergänzung der alten Claim-Übernahme wurden die zugehörigen Job- und PostgreSQL-Tests erneut gezielt geprüft (13 Tests erfolgreich).
- `pnpm check:server-runtime` abschließend sequenziell mit Node 24.15.0 für alle 20 Projekte erfolgreich.
- App- und betroffene Package-Typprüfungen erfolgreich; keine Datenbankschemaänderung erforderlich.
- OpenSpec-, Dokumentations-, Dateiplatzierungs- und Diff-Prüfung erfolgreich.
- Lint der neuen Dateien erfolgreich. Vier Architekturfehler in den bestehenden Studio-/SSF-Runtime-Dateien wurden am unveränderten HEAD reproduziert und nicht in diesen Change aufgenommen.

Diese Nachweise gelten lokal im Implementierungs-Worktree; sie belegen keinen Rollout.
