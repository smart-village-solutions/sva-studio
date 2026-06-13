# Design-Verweis: Erinnerungs-Konfiguration pro Abfallfraktion

Die fachliche und technische Ausgestaltung ist im begleitenden Design-Dokument beschrieben:

- `docs/superpowers/specs/2026-06-04-waste-fraction-reminder-settings-design.md`

Kernpunkte:
- die Reminder-Konfiguration liegt fachlich führend als JSONB an `waste_fractions`
- Kanalfreigaben gelten global pro Fraktion und verweisen auf kanalbezogene Slot-Listen
- Slot-IDs bleiben persistent stabil und werden bei der Migration deterministisch aus Fraktion, Channel und Slotposition erzeugt
- UI, API und Persistenz normalisieren die Konfiguration auf ein kanonisches JSON-Schema
