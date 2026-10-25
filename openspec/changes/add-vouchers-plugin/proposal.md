# Change: Eigenständige Gutscheinverwaltung im Studio

## Why

Redakteure und Firmeninhaber benötigen eine eigenständige Oberfläche zum Erstellen und Bearbeiten von Gutscheinen. Das alte CMS bindet diese Arbeit an den Ort-Editor; der aktuelle Studio-Vertrag bildet Rabatt, Kontingent und verschachtelte Gutscheine noch nicht vollständig ab.

Mainserver-Änderungen sind für diesen Lieferumfang ausgeschlossen. Der Nutzer hat ausdrücklich akzeptiert, dass die Verwendung des bestehenden POI-Schreibpfads Einlösungen zurücksetzt. Diese Akzeptanz gilt nicht für den Verlust anderer Ortsdaten oder Gutschein-Inhalte. Die fachliche Bedienung wird daher eigenständig, die Speicherung bleibt zunächst am einzelnen POI gebunden.

## What Changes

- Ergänzt das optional aktivierbare Feature-Plugin `vouchers` mit Inhaltstyp `vouchers.voucher`, Übersicht, Detailansicht, Erstellung und Inhaltsbearbeitung.
- Verwendet hostgeführte Content-Routen, Berechtigungen, Historie, Medienauswahl und bestehende Studio-UI-Bausteine. Das Plugin erhält ausschließlich Actions im Namespace `vouchers`.
- Erfasst Titel, Teaser, Beschreibung, Kategorie, Bilder, Rabattart, Kontingent, Rhythmus, Gültigkeit und genau einen berechtigten Ort.
- Definiert die Erstellung als Onepager: Grunddaten → Einlöseort → Vorteil → Kontingent → Gültigkeit → Sichtbarkeit und Speichern. Feldhilfen, konkrete Mengenbeispiele, Zusammenfassung und Reset-Dialog sind im Design verbindlich beschrieben.
- Speichert Erstellung und Inhaltsänderungen über `createPointOfInterest(id: …, vouchers: …)` mit dem vollständigen benötigten POI-/Gutscheinbestand. Erweitert dafür den bestehenden typisierten Mainserver-Adapter statt einen zweiten Speicherpfad einzuführen.
- Verlangt vor jedem solchen Update eines Ortes mit Gutscheinen eine konkrete Bestätigung: Alle vorhandenen Gutscheine dieses Ortes können neue Datenbank- und Kontingent-IDs erhalten; bisherige Einlösungen werden zurückgesetzt und erneute Einlösungen möglich.
- Bezieht gewöhnliche Studio-POI-Änderungen in denselben Erhaltungs- und Bestätigungsvertrag ein. Der Ort-Editor bietet keine verschachtelte Gutschein-Erstellung oder -Inhaltsbearbeitung; er verlinkt zu Gutscheinen.
- Nutzt für ausschließliches Anzeigen/Ausblenden die bestehende separate Mutation `changeVisibility`, ohne Einlösungsreset.
- Ergänzt eine konkrete Nutzungsdarstellung in Liste und Detail: registrierte Einlösungen, verbleibendes Kontingent und Auslastung im vom Mainserver gelieferten Rhythmus. Frische Daten, fehlende Werte und Überziehungen werden ehrlich dargestellt; keine erfundene Personenstatistik oder Zeitreihe.
- Grenzt nicht sicher rückschreibbare Bestände konkret ab: Gefilterte Kategorien und Ankündigungen dürfen nicht unbemerkt verlorengehen. Inhalts-Saves werden bei fehlendem Erhaltungsnachweis abgelehnt; Lesen und separate Sichtbarkeit bleiben möglich. Neuanlagen erhalten vor dem Write einen bekannten Erstellungsschlüssel für den Ergebnisabgleich nach Antwortverlust.
- Berücksichtigt zukünftige Mehrfachzuordnungen im fachlichen Modell als Ortsliste mit aktuell genau einem Element; keine Mehrfachauswahl, Schattenzuordnung oder ungenutzte Adapterstrategie.

## Scope und Nicht-Ziele

**Ziel:** Berechtigte Anwender können Gutscheine eigenständig finden, erstellen, inhaltlich bearbeiten und ein-/ausblenden, ohne Mainserver-Änderung und mit ausdrücklich bestätigtem Reset aller betroffenen Einlösungen am Ort.

**Maximal betroffene Bereiche:** `packages/plugin-vouchers`, bestehende Plugin-Registrierung und Content-Host-Einbindung, `packages/sva-mainserver`, `packages/plugin-poi`, erforderliche Plugin-Action-/Content-Projektionsbeiträge, zugehörige Übersetzungen, Tests und aktuelle Dokumentation. Bestehende SDK-/UI-Verträge werden genutzt; Erweiterungen daran nur bei einem nachgewiesenen konkreten Defizit, nicht vorsorglich.

Nicht enthalten:

- Mainserver-, App- oder Altes-CMS-Änderungen; Reparatur des Einlöseverfahrens;
- echte Mehrfachzuordnungen, Ortswechsel bestehender Gutscheine, harte Gutscheinlöschung und eigenständige Archivierung;
- neue Gutschein-Datenbank, Workflow-Engine, Queue, Lock-Service oder allgemeine Formular-/Konfliktplattform;
- eingebettete Neuerstellung von Orten im Gutscheinformular: Neue Orte entstehen über den vorhandenen POI-Editor und werden anschließend ausgewählt;
- Garantie unveränderlicher Mainserver-IDs oder erhaltener Einlösungen beim verschachtelten Speichern;
- Implementierung, PR-Erstellung oder Rollout durch diesen Proposal-Auftrag.

## Impact

- Affected specs: `content-management`, `sva-mainserver-integration` (jeweils additive Anforderungen).
- Affected arc42 sections bei Umsetzung: 03 (Mainserver-Grenze), 05 (Plugin/Adapter), 06 (Aggregat-Speicherung), 08 (Autorisierung, Historie, Bestätigung und Fehler), 10 (Akzeptanznachweise), 11 (Reset und externe Konkurrenz).
- Aktuelle Anwender- und Entwicklerdokumentation wird in den bestehenden Bereichsindizes eingeordnet; keine neue Governance-Schicht.
- Berührung mit `add-content-create-onepagers`, `extend-media-editor-and-metadata`, `add-content-ownership-transfer` und `add-plugin-tenant-lifecycle`: bestehende UI-, Medien-, Principal- und Aktivierungsverträge übernehmen; keine fachliche Erweiterung dieser Changes.
- Backend-Follow-up: [GitHub #445](https://github.com/smart-village-solutions/smart-village-app-mainserver/issues/445), [Jira SVA-1778](https://tpwd.atlassian.net/browse/SVA-1778). Kein Startblocker; ein späterer Wegfall des Resets benötigt neue Vertragsnachweise und einen Folgechange.

## Erfolgskriterien

- Zwei Gutscheine am selben Ort lassen sich anlegen und bearbeiten; die Inhalte beider sowie unberührte POI-Daten bleiben erhalten.
- Kein destruktiver Schreibrequest ohne gültige, serverseitig geprüfte Bestätigung für den aktuellen Orts-/Gutscheinbestand.
- Ein-/Ausblenden verwendet ausschließlich den separaten Sichtbarkeitspfad.
- Kein Zugriff außerhalb des zulässigen Mandanten-, Organisations- und Datenanbieterbereichs; Aggregatwirkung wird autorisiert.
- Keine automatische Wiederholung eines unbestätigten destruktiven Schreibrequests.
- Gezielte Tests und isolierte Mainserver-Akzeptanz belegen Daten-Roundtrip, erwarteten Reset, neue IDs und Ergebniszuordnung. Ein Schema-Snapshot oder gemockter Test allein belegt keine Laufzeitsemantik.
