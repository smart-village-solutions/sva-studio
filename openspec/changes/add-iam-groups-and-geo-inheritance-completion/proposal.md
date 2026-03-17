# Change: Gruppenmodell und hierarchische Geo-Vererbung im IAM abschließen

## Why

Der aktuelle Stand erfüllt für Paket 3 Rollen, Organisationshierarchie und strukturierte Permissions nur teilweise. Es fehlen das im Angebot explizit zugesagte Gruppenmodell sowie eine echte hierarchische Geo-Vererbung über mehrstufige geografische Kontexte.

## What Changes

- Gruppenmodell als zusätzliche fachliche Berechtigungsquelle spezifizieren
- Account-zu-Gruppen-Zuordnung und Gruppen-Verwaltungsoberfläche spezifizieren
- Hierarchische Geo-Vererbung als deterministische Erweiterung der bestehenden Org-/ABAC-Auswertung spezifizieren
- Konflikt- und Prioritätsregeln zwischen Rollen, Gruppen, Org-Hierarchie und Geo-Hierarchie präzisieren

## Impact

- Affected specs:
  - `iam-access-control`
  - `account-ui`
- Affected code:
  - `packages/data`
  - `packages/core`
  - `packages/auth`
  - `apps/sva-studio-react`
- Affected arc42 sections:
  - `05-building-block-view`
  - `06-runtime-view`
  - `08-cross-cutting-concepts`
  - `10-quality-requirements`
  - `11-risks-and-technical-debt`

## Dependencies

- Baut auf `add-iam-permission-inheritance-engine` auf
- Muss mit `iam-organizations` und bestehender Rollenverwaltung kompatibel bleiben

## Risiken und Gegenmaßnahmen

- Zusätzliche Berechtigungsquelle erhöht Komplexität: eindeutige Prioritätsregeln und Testmatrix werden verpflichtend
- Geo-Hierarchien können fachlich uneinheitlich modelliert sein: kanonisches Read-Modell und explizite Datenquelle werden im Design festgelegt
- Gruppen-UI kann Rollen-UI duplizieren: klare Abgrenzung zwischen Rollen, Gruppen und effektiven Berechtigungen wird im UI-Konzept verankert

## Approval Gate

Vor Start der Implementierung müssen folgende Punkte bestätigt sein:

1. Gruppen werden als eigenständige fachliche Bündelung von Rechten und/oder Rollen eingeführt.
2. Geo-Vererbung wird als echte Hierarchieauflösung umgesetzt, nicht nur als String-Match.
3. Die resultierende effektive Berechtigung bleibt deterministisch und instanzisoliert.
4. Die Admin-Oberfläche erhält eine explizite Gruppenverwaltung.
