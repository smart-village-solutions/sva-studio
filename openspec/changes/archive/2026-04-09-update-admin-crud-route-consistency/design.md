## Context
Die Admin-Ressourcen `users`, `organizations`, `groups` und `legal-texts` verwenden bislang lokale Dialogzustände für Create- und teilweise auch Edit-Flows. Bereits bestehende Referenzmuster im Projekt sind `content`, `admin/instances` und `admin/roles`, die auf listen-, create- und detailbasierte Routen setzen.

## Decisions
### Neue kanonische Routen
- Liste: `/admin/<resource>`
- Neu: `/admin/<resource>/new`
- Detail/Bearbeitung: `/admin/<resource>/$id`

### Keine Parallelpfade
Bestehende Modal-Flows werden entfernt. Buttons für "Anlegen", "Bearbeiten" und vergleichbare Aktionen navigieren direkt auf die neue Route.

### Detaildaten pro Ressource
- `users`: bestehende Detailseite bleibt der Bearbeitungsort.
- `organizations`: Detailseite lädt die Organisation explizit über den vorhandenen Detail-Endpoint und bündelt Stammdaten und Mitgliedschaften.
- `groups`: Detailseite lädt die Gruppe explizit und bündelt Stammdaten, Rollen und Mitgliedschaften.
- `legal-texts`: mangels separatem Detail-Endpoint wird die Detailseite aus der bereits geladenen Liste gespeist; die Version-ID bleibt der kanonische Pfadparameter.

## Consequences
- Deep Links und Berechtigungsprüfungen werden konsistent auf echte Zielseiten angewendet.
- Listenseiten werden schlanker, da dialogbezogener UI-State entfällt.
- `legal-texts` bleibt für harte Reloads von der Listendatenbasis abhängig, bis ein eigener Detail-Endpoint eingeführt wird.
