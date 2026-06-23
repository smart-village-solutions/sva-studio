# Change: Gemeinsame Editor-Primitives aus POI und News in `studio-ui-react` extrahieren

## Why

Der abgeschlossene Change `update-poi-editor-full-redaction-flow` hat den fachlichen Voll-Flow für den POI-Editor geliefert, aber die Wiederverwendbarkeit bewusst konservativ behandelt. Gemeinsame Patterns wie Abschnittskarten, wiederholbare Formularbereiche und adress-/kartennahe Feldgruppen liegen weiterhin teilweise pluginlokal vor und erhöhen damit langfristig Ownership, Review-Aufwand und Änderungsrisiko.

## What Changes

- Gemeinsame Abschnitts- und Formularprimitives für Detaileditoren werden aus `plugin-poi` und den bestehenden News-Referenzen nach `packages/studio-ui-react` extrahiert.
- Wiederholbare Formularmuster für strukturierte Mehrfacheinträge werden als kleine, hosteigene Repeater-Primitives standardisiert, sofern sie für mindestens zwei Editoren tragfähig sind.
- Der bereits produktiv genutzte `StudioDetailTabs`-Pfad wird um die dazugehörigen wiederverwendbaren Detailbereichs-Bausteine ergänzt, damit Content-Editoren weniger lokale Sonderlogik benötigen.
- Plugin-spezifische Fachlogik, Validierung, Datenmappings und Mainserver-spezifische Verträge bleiben weiterhin in den jeweiligen Plugins.
- Der Change bleibt bewusst ein Architektur-/Ownership-Refactoring und führt keinen neuen fachlichen Redaktionsumfang für POI, News oder weitere Content-Typen ein.

## Impact

- Affected specs: `ui-layout-shell`, `content-management`
- Affected code: `packages/studio-ui-react`, `packages/plugin-poi`, `packages/plugin-news`, potenziell `packages/plugin-sdk` nur falls rein client-sichere Formularhilfen fachlich nötig werden
- Affected arc42 sections: `05-building-block-view`, `08-cross-cutting-concepts`, `09-architecture-decisions`, `10-quality-requirements`, `11-risks-and-technical-debt`
- Required documentation updates:
  - `docs/development/studio-form-migrationsinventur.md`
  - relevante UI-/Editor-Dokumentation unter `docs/`
- Required tests:
  - `studio-ui-react`-Unit-Tests für neue Section-/Repeater-Primitives
  - angepasste `plugin-poi`- und `plugin-news`-Tests für die neuen gemeinsamen UI-Bausteine
  - betroffene Typ- und Host-UI-Gates
