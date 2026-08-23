# Change: FAQ- und Kachel-Editoren auf den Studio-UI-Standard vereinheitlichen

## Why

FAQ, Kacheln und offene GenericItems bearbeiten dieselbe Mainserver-Inhaltsfamilie, verwenden im Studio aber noch unterschiedliche lokale Varianten für Tabs, Panelhierarchie, Formularfehler, Historie, Listensteuerung und destruktive Aktionen. Die sichtbaren Unterschiede erhöhen die Bedien- und Wartungskosten; einzelne Abweichungen wie fehlende Kachel-Pagination oder ein nur auf der geladenen FAQ-Seite angewendeter Sprachfilter sind darüber hinaus funktional unvollständig.

## What Changes

- FAQ und Kacheln verwenden für ihre Detailansichten `StudioDetailPageTemplate`, `StudioDetailTabs`, gemeinsame Detailkarten sowie die standardisierten Formularzusammenfassungen und Zustandsanzeigen.
- Fachlisten und Editoren erhalten verständliche Seitenbeschreibungen sowie modusabhängige Primäraktionen mit gesperrtem Pending-Zustand.
- Bewährte Einzelmuster aus News, Events und POIs dienen als kuratierte Referenz: News für Formular-/Tabzustand und History, POI für Section-Cards und Events für kanonische URL-Pagination.
- Lokale Nachbildungen aus den Referenzplugins, insbesondere eigene Tab-Gerüste, pluginlokale Pagination und `window.confirm`, werden nicht als neue Standardimplementierung kopiert.
- Die fachlich reduzierten Editoren behalten ihre bisherigen Felder, Mapper, Validierungen, API-Verträge und verborgenen Payload-Daten unverändert bei.
- Der Kachel-Inhaltsbereich gliedert Text, Bilder und Link in klar getrennte Studio-Karten; die bereits eingeführte gemeinsame Medienauswahl und Bildvorschau bleiben erhalten.
- FAQ- und Kachel-Historien folgen demselben zugänglichen Tabellen-, Lade-, Fehler- und Leerzustandsmuster.
- Die Kachel-Fachliste erhält URL-gesteuerte Vor-/Zurück-Navigation für die bereits serverseitig berechnete Pagination.
- Der FAQ-Sprachfilter wird über URL-Search-Params gesteuert und vor der Seiteneinteilung auf die vollständige FAQ-Teilmenge angewendet.
- FAQ, Kacheln und offene GenericItems verwenden vor dem Löschen einen gemeinsamen Bestätigungsdialog mit gesperrtem Pending-Zustand und sichtbarer Fehlerbehandlung.
- Die Umstellung wird mit Komponenten- und Interaktionstests für Tabwechsel, Formularerhalt, Fehlernavigation, Pagination, Filterung und Löschen abgesichert.

## Non-Goals

- Keine Änderung der Mainserver-Entitäten, GenericItem-Discriminators oder fachlichen CRUD-Berechtigungen.
- Keine Erweiterung der erlaubten FAQ- oder Kachel-Felder.
- Keine gemeinsame fachliche Form-Engine und keine direkte Kopplung zwischen `plugin-faq`, `plugin-cockpit-cards` und `plugin-generic-items`.
- Kein globales Umbenennen bestehender Studio-Farbvariablen und kein Redesign weiterer Content-Plugins.
- Keine vollständige Migration von News, Events oder POIs innerhalb dieses Changes; deren spätere Umstellung auf stabilisierte gemeinsame Primitives bleibt ein getrennt reviewbarer Folgeschritt.
- Keine Änderung der mobilen oder öffentlichen Ausspielung von FAQ oder Kacheln.

## Impact

- Affected specs: `content-management`, `ui-layout-shell`
- Affected code: `packages/plugin-faq`, `packages/plugin-cockpit-cards`, `packages/plugin-generic-items`, `packages/studio-ui-react`; gegebenenfalls die hostgeführten FAQ-Listenparameter in `packages/sva-mainserver`
- Related active changes:
  - `add-faq-generic-item-plugin`
  - `add-cockpit-cards-plugin`
  - `refactor-shared-editor-primitives`
- Dependency boundary: Dieser Change konsumiert die in `refactor-shared-editor-primitives` vereinbarten allgemeinen Editor-Primitives oder ergänzt nur nachgewiesene Lücken in `studio-ui-react`; er führt keine konkurrierenden Primitives ein.
- Reference implementations: `plugin-news`, `plugin-events` und `plugin-poi` werden zur Auswahl und Verifikation bewährter Interaktionsmuster herangezogen, ohne ihre lokalen Doppelimplementierungen zum Zielvertrag zu erklären.
- Affected arc42 sections: `05-building-block-view`, `08-cross-cutting-concepts`, `10-quality-requirements`, `11-risks-and-technical-debt`
- Required tests: gemeinsame UI-Primitive-Tests sowie gezielte Unit-/Komponententests der drei Plugins; E2E für die kritischen FAQ- und Kachel-Flows
