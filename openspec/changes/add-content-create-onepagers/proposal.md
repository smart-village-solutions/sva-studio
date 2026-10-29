# Change: Redaktionelle Inhalte als Onepager anlegen

## Why

Die Neuanlage verteilt zusammengehörige Eingaben auf mehrere Tabs. Gerade beim ersten Erfassen müssen Redakteure dadurch zwischen Basis, Inhalt und Einstellungen wechseln, um einen vollständigen Inhalt zu erstellen. Eine durchgehende, fachlich sortierte Formularseite macht den Erstellungsablauf überschaubarer; die gezielte Bearbeitung vorhandener Inhalte profitiert weiterhin von Tabs.

Die primäre Zielgruppe sind ungeschulte, gelegentlich arbeitende Redakteure. Sie sollen Pflichtangaben erkennen, Ergänzungen sicher weglassen können und vor dem Absenden die Speicher- und Veröffentlichungswirkung verstehen. Generische Inhalte sind ein technischer Sonderfall und werden praktisch nicht von dieser Zielgruppe verwendet.

## What Changes

- Ersetzt ausschließlich im Create-Modus die Editor-Tabs durch einen Onepager für Nachrichten, Veranstaltungen, Orte/POI, generische Inhalte, FAQ, Cockpit-Karten, Projekte und Umfragen.
- Definiert im [Design](design.md) je Inhaltstyp eine verbindliche Reihenfolge der vorhandenen Eingaben und ihre Darstellung.
- Ordnet Hauptinhalt, ergänzende Angaben und abschließende Publikation in benannten Abschnitten an. Optionale umfangreiche Zusatzbereiche sind aufklappbar; bedingte Felder folgen den bestehenden fachlichen Voraussetzungen.
- Ergänzt für die sieben redaktionell genutzten Typen kurze Einstiegshilfen, verständliche Abschnitts- und Feldbeschreibungen sowie erkennbare Pflicht- und optionale Angaben.
- Erklärt unmittelbar bei den abschließenden Aktionen die aus bestehenden Einstellungen ableitbare Speicher-, Veröffentlichungs- und gegebenenfalls Push-Wirkung.
- Ergänzt nach ausdrücklicher Freigabe eine schmale gemeinsame Verlassenswarnung für die acht Create-Editoren: Plugins melden Änderungen über `@sva/studio-ui-react`, der Host nutzt vorhandenen Router-Blocker und Bestätigungsdialog. Formularwerte bleiben pluginlokal.
- Verwendet dieselben Feldkomponenten, Formularzustände, Validierungen, Medienverträge und hostgeführten Mutationen wie bisher.
- Erhält im Edit-Modus die vorhandenen Tabs einschließlich Historie sowie bei Umfragen Moderation und Ergebnisse.
- Ersetzt widersprechende Create-Vorgaben in `content-management` und `plugin-surveys`, insbesondere die bisherigen Create-Tabs für FAQ und Umfragen.

## Scope und Nicht-Ziele

**Ziel:** Die sieben redaktionell genutzten Inhaltstypen lassen sich auch ohne Schulung über ihre bestehenden Erstellungsrouten verständlich und sicher anlegen. Generische Inhalte erhalten ebenfalls die durchgehende Feldkomposition, bleiben aber ein technischer Editor ohne Anspruch auf einen redaktionellen Einsteigerflow.

**Maximal betroffene Bereiche:** Editor-Komposition und dazugehörige UI-Tests sowie Übersetzungen der acht Plugins; vorhandene Host-Content-Editor-Einbindung nur soweit für den Create-Modus nötig; bestehende Studio-UI-Primitiven nur bei einem belegten Darstellungsdefizit; schmale React-Anbindung in `studio-ui-react` und deren Host-Integration unter `apps/sva-studio-react/src/routing/`; relevante Formular-, Benutzer- und Architekturdokumentation.

Nicht enthalten sind Kategorienverwaltung und Abfallwirtschaft. Bereits vorhandene Kategorieauswahlen innerhalb der acht Inhaltsformulare sowie vorhandenes News-Push-Targeting bleiben erhalten; das erfordert keine Änderung dieser ausgeschlossenen Plugins.

Weitere Nicht-Ziele:

- keine Umgestaltung der Bearbeitungsansichten, Listen, Typauswahl oder Routen;
- keine neuen Fachfelder, Pflichtfelder, Feldtypen, Defaultwerte oder Statusmodelle;
- keine Wiederaufnahme ausgeblendeter Legacy-/Kompatibilitätsfelder;
- keine API-, Datenbank-, IAM-, Ownership-, Credential- oder Persistenzänderungen;
- keine neue Formular-Engine, Section-Registry, Konfigurationsschicht, Dependency oder globale Formularmigration;
- kein Autosave, Wizard, neuer Vorschau- oder Entwurfsdienst; keine neue Router-/Guard-Registry oder Plugin-SDK-/Manifest-API, keine allgemeine Fehlerbehandlungs- oder Recovery-Sanierung;
- keine Umsetzung oder Veröffentlichung im Rahmen dieses Proposal-Auftrags.

## Impact

- Affected specs: `content-management`, `plugin-surveys`.
- Affected code: `packages/plugin-{news,events,poi,generic-items,faq,cockpit-cards,projects,surveys}/src/` und vorhandene Editor-Tests; bei Bedarf bestehende Einbindung unter `apps/sva-studio-react/src/routes/content/` und Primitiven unter `packages/studio-ui-react/src/`.
- Affected arc42 sections: `05-building-block-view` (bestehende gemeinsame Feldkomposition), `08-cross-cutting-concepts` (Formularfehler, Verlassenswarnung, i18n, Accessibility), `10-quality-requirements` (Create-/Edit-Akzeptanz).
- Dokumentation bei Umsetzung: bestehende Formularinventur `docs/development/studio-form-migrationsinventur.md` und konkret betroffene arc42-Passagen aktualisieren; unveränderte Baustein-/Systemgrenzen ausdrücklich festhalten.
- Bestehende Changes `refactor-events-detail-content-tab`, `add-studio-data-form-and-test-foundations`, `extend-media-editor-and-metadata` und `add-content-ownership-transfer` liefern bestehende Komponenten/Verträge; dieser Change baut darauf auf und erweitert deren fachlichen Scope nicht.

## Erfolgskriterien

- Alle acht Create-Ansichten zeigen genau ein Formular ohne Editor-Tabs und die im Design festgelegte Feldfolge.
- Sämtliche bisher sichtbaren und zulässigen Create-Eingaben bleiben erreichbar; bisher verborgene Felder bleiben verborgen.
- Edit-Ansichten behalten ihre Tab-Struktur und ihre Speicher-, Medien- und Berechtigungssemantik.
- Fehler in geschlossenen Zusatzabschnitten werden sichtbar und sind fokussierbar; Schließen und Öffnen verliert keine Eingaben.
- Es gibt genau einen bestehenden Formular-/Submit-Owner pro Editor und keine duplizierten Feldimplementierungen oder Mutationspfade.
- Ein ungeschulter Redakteur kann eine Nachricht und eine Veranstaltung ohne mündliche Hilfe anlegen, Pflichtangaben und optionale Ergänzungen unterscheiden und vor dem Absenden korrekt erklären, welche öffentliche Wirkung und gegebenenfalls Push-Wirkung entsteht.
- Hinweise behaupten nur durch bestehende Verträge belegte Wirkungen; insbesondere werden Sichtbarkeit, Aktivierung und Datumsfelder nicht pauschal als Terminierung interpretiert.
- Die acht Create-Editoren warnen beim tatsächlichen Verlassen mit offenen Änderungen. Bestätigte Saves heben den Schutz nur für den nachweislich gespeicherten Änderungsstand auf; spätere Eingaben und ausstehende Medienzuordnungen bleiben geschützt. Fehler-/Retry-Verträge bleiben erhalten.
