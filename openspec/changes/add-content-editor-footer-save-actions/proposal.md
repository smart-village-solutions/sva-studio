# Change: Primäraktion bei langen Bearbeitungsflächen oben und unten anbieten

## Why

Lange, tab-basierte oder listenorientierte Bearbeitungsflächen zeigen ihre Speichern-Aktion derzeit häufig nur an einem Ende der Arbeitsfläche. Redakteurinnen, Redakteure und Administratoren müssen deshalb nach der Bearbeitung unnötig scrollen, obwohl die Primäraktion für die gesamte jeweilige Formular- oder Teilflächengrenze gilt.

## What Changes

- News, Events, FAQs, POIs, Umfragen und generische Inhalte zeigen die formularweite Speichern- beziehungsweise Anlegen-Aktion sowohl im Seitenkopf als auch direkt unterhalb der Tabs.
- Beide Aktionen lösen denselben Submit-Pfad aus und teilen Beschriftung, Lade-, Disabled- und Berechtigungszustände.
- Die untere Aktion bleibt in jedem Tab sichtbar, einschließlich des schreibgeschützten Historien-Tabs.
- Die Benutzerbearbeitung zeigt ihre formularweite Speichern-Aktion oberhalb der Benutzer-Tabs und am Formularende.
- Die Rollenberechtigungen zeigen ihre eigene Speichern-Aktion oberhalb und unterhalb der Berechtigungsmatrix, ohne andere Rollen-Teilflächen einzubeziehen.
- Rechtstexterstellung und Rechtstextbearbeitung zeigen ihre Primäraktion oberhalb der Eingabefläche und unterhalb des Rich-Text-Editors.
- `StudioDetailPageTemplate` erhält einen semantischen `primaryAction`-Vertrag für seitengroße Bearbeitungsflächen; eingebettete Teilflächen verwenden eine gemeinsame `StudioFormActionBar`.
- Der bestehende generische Kern-Inhaltseditor wird auf denselben gemeinsamen Layoutpfad vereinheitlicht.
- Der Plugin-Entwicklungsleitfaden dokumentiert das Pattern „lange Bearbeitungsfläche“ mit Einsatzkriterien, Referenzkomposition und Review-Checkliste für neue Plugins.

## Impact

- Affected specs: `content-management`, `account-ui`, `iam-access-control`, `ui-layout-shell`, `architecture-documentation`
- Affected code: `packages/studio-ui-react`, `packages/plugin-news`, `packages/plugin-events`, `packages/plugin-faq`, `packages/plugin-poi`, `packages/plugin-surveys`, `packages/plugin-generic-items`, `apps/sva-studio-react`
- Affected arc42 sections: keine; bestehende Paket- und Verantwortungsgrenzen bleiben unverändert
- Required documentation updates: `docs/guides/plugin-development.md` und `docs/development/studio-uebersichts-und-detailseiten-standard.md`
- Required tests: gemeinsame Template-/Action-Bar-Tests sowie betroffene Editor-, Benutzer-, Rollen- und Rechtstext-Unit-Tests für zwei gleichwertige Primäraktionen
