# Change: Rechtstext-Erzwingung und Nachweis-UI für IAM abschließen

## Why

Der aktuelle Stand deckt Versionierung, Akzeptanzereignisse und Backend-Compliance-Exports für Rechtstexte bereits teilweise ab. Für die vollständige Erfüllung von Paket 5 fehlen jedoch der blockierende Akzeptanz-Flow beim Login sowie eine explizite Admin-Oberfläche für revisionssichere Nachweise und Exporte.

## What Changes

- Rechtstext-Akzeptanz als verbindliche Login-Vorbedingung spezifizieren
- Blockierenden UI-Flow für ausstehende Akzeptanzen spezifizieren
- Admin-Oberfläche für Nachweis, Filterung und Export von Rechtstext-Akzeptanzen spezifizieren
- Exportvertrag für Einzel- und Sammelnachweise von Rechtstext-Akzeptanzen präzisieren

## Impact

- Affected specs:
  - `iam-core`
  - `account-ui`
  - `iam-auditing`
- Affected code:
  - `packages/auth`
  - `packages/data`
  - `apps/sva-studio-react`
  - `docs/guides`
  - `docs/reports`
- Affected arc42 sections:
  - `05-building-block-view`
  - `06-runtime-view`
  - `08-cross-cutting-concepts`
  - `10-quality-requirements`
  - `11-risks-and-technical-debt`

## Dependencies

- Baut auf bestehender Governance-/Legal-Text-Logik und `add-iam-transparency-ui` auf
- Bleibt unabhängig von Paket 6

## Risiken und Gegenmaßnahmen

- Zu aggressive Sperrung kann Nutzer aussperren: Fail-Closed-Regeln werden nur für unklare Pflichtfälle angewendet und klar kommuniziert
- Login- und UI-Flows können sich gegenseitig blockieren: dedizierter Akzeptanz-Interstitital mit eng begrenztem Funktionsumfang wird verwendet
- Nachweis-Exporte könnten unvollständig sein: verpflichtende Exportfelder und Konsistenztests werden Teil der Spezifikation

## Approval Gate

Vor Start der Implementierung müssen folgende Punkte bestätigt sein:

1. Ausstehende Pflicht-Rechtstexte blockieren den fachlichen Systemzugang bis zur Akzeptanz.
2. Der Akzeptanzflow darf nicht durch reguläre Navigation oder Deep-Links umgangen werden.
3. Administratoren benötigen einen expliziten Nachweis- und Exportpfad für Rechtstext-Akzeptanzen.
4. Nachweise müssen revisionssicher und exportierbar bleiben.
