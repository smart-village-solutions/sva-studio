# Lokale Bearbeitung des Projektstatus

Die App `apps/project-report` bleibt in gebauten Deployments und auf GitHub Pages strikt read-only. Eine direkte Bearbeitung von Arbeitspaketen ist nur im lokalen Lauf über `localhost`, `127.0.0.1` oder `::1` aktiv.

## Verhalten im lokalen Kontext

- In der Ansicht `Arbeitspakete` werden die Spalten `Meilenstein`, `Priorität` und `Status` als Dropdowns gerendert.
- Jede Änderung wird sofort gespeichert, es gibt keinen separaten Bestätigungs- oder Verwerfen-Flow.
- Während eines laufenden Schreibvorgangs sind die lokalen Dropdowns global deaktiviert, um konkurrierende Dateischreibvorgänge zu vermeiden.
- Schlägt ein Speichervorgang fehl, setzt die UI auf den letzten bestätigten Stand zurück und zeigt einen Fehlerhinweis an.

## Lokale Dev-API

Die lokale Schreibfunktion hängt an einer Vite-Middleware und ist nur in `serve` beziehungsweise `preview` aktiv:

- `GET /__local/project-status`
  - liefert den aktuellen Inhalt von `apps/project-report/src/data/project-status.json`
- `PATCH /__local/project-status/work-package`
  - erwartet `workPackageId`, `milestoneId`, `priority` und `status`
  - lädt die JSON-Datei frisch
  - verschiebt das Arbeitspaket bei Bedarf in den Ziel-Meilenstein
  - sortiert den Ziel-Meilenstein nach `WP-ID`
  - validiert den vollständigen Report erneut
  - schreibt die Datei formatiert mit zwei Leerzeichen und abschließendem Newline zurück

## Grenzen

- Die lokale API ist kein öffentliches Interface und nicht für Produktions- oder Preview-Deployments außerhalb des lokalen Rechners gedacht.
- Die Dropdown-Optionen für lokale Bearbeitung werden bewusst nur aus Werten gebildet, die aktuell tatsächlich im JSON der Arbeitspakete vorkommen.
