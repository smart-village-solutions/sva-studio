# Design-Verweis: Benutzerdefinierte Abstandspresets für Waste-Touren

Die freigegebene Detailausarbeitung liegt unter:

- `docs/superpowers/specs/2026-05-31-waste-custom-recurrence-presets-design.md`

Dieser OpenSpec-Change übernimmt daraus insbesondere:

- instanzbezogene Verwaltung benutzerdefinierter Abstandspresets in den Waste-Einstellungen
- exklusive Tour-Semantik `recurrence` oder `customRecurrenceId`
- automatische Übernahme geänderter Preset-Abstände durch referenzierende Touren
- serverseitig atomare Fallback-Umschaltung beim Löschen referenzierter Presets
