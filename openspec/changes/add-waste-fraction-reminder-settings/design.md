# Design-Verweis: Erinnerungs-Konfiguration pro Abfallfraktion

Die fachliche und technische Ausgestaltung ist im begleitenden Design-Dokument beschrieben:

- `docs/superpowers/specs/2026-06-04-waste-fraction-reminder-settings-design.md`

Kernpunkte:
- Reminder-Felder liegen direkt auf `waste_fractions`
- Kanalfreigaben gelten global pro Fraktion
- die zweite Erinnerung bleibt unabhängig von der ersten, ohne Ordnungsregel
- UI, API und Persistenz normalisieren nicht relevante Felder auf einen kanonischen Zustand
