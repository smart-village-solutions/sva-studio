## Umsetzung

- [x] Vorhandene Mutationsaufrufe und Publish-Scope lokal korrigieren und gezielt nachweisen.
- [x] MCP-Profilanlage über vorhandene IAM-Verträge mit expliziten Kontexten und Readback implementieren und testen.
- [x] Profilgrenzen und Bedienung dokumentieren; betroffene arc42-/ADR-Stellen aktualisieren.
- [x] Gezielte Unit-/Type-/Server-Runtime- und vorgeschriebene Security-Gates prüfen; technischen Review vor Push abschließen.

## Technischer Abnahmenachweis des vorhandenen Profils

- [x] Tatsächlichen MCP-Rollen-POST in zwei synthetischen Testtenants speichern, unabhängig zurücklesen und wiederholte Ausführung sowie individuelle Rechteerhaltung prüfen.
- [x] Erzeugte Grants an produktive Instanz-/Ownership-Prüfungen und bestehende Benutzer-/Rollen-Readhandler-Factories über lokale Callbacks zum produktiven Permissionguard weitergeben; erlaubte und verweigerte Redaktions-/Adminfälle einschließlich Veröffentlichung und Tenant-/Organisationsgrenzen nachweisen.
- [x] Bestehende Sidebar-Tests mit demselben verbindlich abgeglichenen JSON-Grantvertrag ergänzen und gezielt prüfen.
- [x] Script-Typecheck ausführen und synthetische I/O-Grenzen sowie weiterhin offene Live-Abnahme im bestehenden Entwicklungsdokument benennen.
