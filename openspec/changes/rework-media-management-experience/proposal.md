# Change: Medienverwaltung und Bildkopie-Ablauf überarbeiten

## Why

Die bestehende Medienverwaltung verteilt Vorschau, Angaben und Bearbeitungsabschluss über technische Detailansichten und einen schwer erkennbaren Ablauf. Das abgestimmte Figma-Konzept sowie die aktualisierten Issues #2227 und #971 verlangen eine verständliche Detailansicht, Fokus als übergebbares Metadatum und einen ausdrücklich gespeicherten Kopie-Entwurf; die sichere automatische Aufnahme vorhandener Dateien benötigt zusätzlich einen abgesicherten Importvertrag.

## What Changes

- Figma als Wireframe für Informationshierarchie und Interaktion verwenden. Gestaltung mit bestehenden Studio-Komponenten, Fira Sans, Theme-Tokens und DE/EN-Texten; keine pixelgenaue Nachbildung und kein Filerobot-Fork.
- Bild vollständig auf einer großen Bühne zeigen; Angaben, Beispielvorschauen und verständliche Verwendungen darunter. Technische Details und Löschung nachordnen, handlungsrelevante Fehler sichtbar halten.
- Texte und Fokus bestehender Bilder direkt gemeinsam speichern. Fokus per Punkt auf der tatsächlichen Bildfläche mit Pointer und Tastatur bedienen.
- **Vertragsänderung:** Fokus ist ausschließlich Metadatum. Studio übergibt `focusPoint` an Zielanwendungen, erzwingt keine Auswertung und erzeugt allein deshalb weder Bildkopien noch neue Pixelvarianten. Bestehende Fokusauswertung in der Variantenverarbeitung entsprechend abgrenzen.
- Kopie-Entwurf mit drei Schritten: Bild gestalten → Fokuspunkt setzen → Ergebnis prüfen. Erst der ausdrückliche Abschluss erzeugt in der Mediathek ein neues Medium; Inhaltsentwürfe behalten ihren verzögerten Speichervertrag.
- Geeignete Speicherdateien beim bewussten autorisierten Öffnen automatisch über den bestehenden Registrierungs-/Verarbeitungspfad aufnehmen. GET und Prefetch bleiben ohne Mutation. Scanner, Sichtbarkeit, Quellidentität, Quoten und Wiederholung sind Teil des Vertrags.
- Gemeldete Fehler bei Zuschneiden, Entfernen und Verwendungsanzeige gegen den aktuellen Stand reproduzieren und belegte Fehler im zuständigen bestehenden Pfad korrigieren. Verwerfen und Speicherwiederholung gezielt absichern.

## Ziel und Scope-Grenze

Ziel eines späteren PRs: Die vorhandene Medienverwaltung entlang des Figma-Wireframes überarbeiten und die zugehörigen Fokus-, Kopie- und Aufnahmeverträge nachweislich erfüllen.

Maximal betroffen sind Medienrouten, Hooks und API-Anbindung in `apps/sva-studio-react`, die gemeinsame Medienoberfläche in `packages/studio-ui-react`, Medienverträge in `packages/media` und `packages/plugin-sdk`, Medienruntime in `packages/auth-runtime` sowie deren vorhandene Repository-/Persistenzpfade. Bestehende Fachplugin-/Mainserver-Anbindungen werden nur für belegte Übergabe-, Entfernungs- oder Referenzfehler angepasst. Schemaänderungen sind kein vorweggenommener Bestandteil; eine belegte Notwendigkeit muss gegen die beiden kanonischen Schemadokumente geprüft werden.

Nicht-Ziele: neuer Editor, neue Upload-/Worker-Plattform, neue Medientypen, Ordnerverwaltung, pauschales Runtime-Refactoring, automatische Bestandsmigration, beliebige externe URL-Importe, automatische Ersetzung vorhandener Inhaltsbilder, neue Zielanwendungs-Renderer und Rollout. Neue Instanz-Einstellungen zur Mindestgröße aus #970 sind ein eigener fachlicher Umfang; vorhandene Größenhinweise bleiben erhalten und nicht blockierend.

## Grundlage und Priorität

1. Nutzerauftrag vom 18.11.2026: Figma als Wireframe/Konzeption, vorhandenes Designsystem und kompatibles Issue-Feedback berücksichtigen.
2. Aktuelle Produktgrenzen aus [#2227](https://github.com/smart-village-solutions/sva-studio/issues/2227) und [#971](https://github.com/smart-village-solutions/sva-studio/issues/971), beide zuletzt am 18.11.2026 um 13:09 UTC aktualisiert.
3. [Figma-Konzept](https://www.figma.com/design/vZt8nEniBsFGQAgxvcEOxM?node-id=2-276), Kopie-Einstieg `2:331`. Beispielvorschauen sind entsprechend #2227 unverbindlich zu beschriften, auch wenn ältere Konzepttexte eine feste Ausgabewirkung nahelegen.
4. Weitere Rückmeldungen werden nach [Design und Issue-Abgleich](./design.md) übernommen. Offene Issues und Checkboxen beweisen keine fehlende Implementierung.

## Lieferabschnitte und Freigabe

1. Detailansicht, direkte Fokusbedienung und nachgewiesene Metadatenübergabe.
2. Kopie-Entwurf und sicherer Abschluss im bestehenden gemeinsamen Medienpfad.
3. Sichere automatische Aufnahme einschließlich serverseitigem Aufnahmevertrag und Fehler-/Lesemodus.

Die Abschnitte sind Arbeits- und Nachweisgrenzen; sie erzwingen keinen PR-Stack. Vor Abschnitt 3 werden die in `design.md` benannten Aufnahmefragen im bestehenden Pfad verbindlich geschlossen. Bis dahin bleibt die bestehende Scan-Sperre wirksam. Der Nutzer hat den technischen Zuschnitt und die Umsetzung am 18.11.2026 im Dialog freigegeben. Die Aufnahmefestlegung ist inzwischen geschlossen: aktive eigene S3-Schnittstelle, öffentlich auslieferbare verwaltete Ausgabe, andere Quellen ausgeschlossen. Umsetzung und lokale Nachweise sind in `tasks.md` dokumentiert; ein Rollout wurde nicht beauftragt.

## Impact

- Affected specs: `media-management`.
- Die frühere Editor-Integration `extend-media-editor-and-metadata` und `add-media-async-processing` sind im Aufgabenstand vollständig. Dieser neue Change beschreibt die neue Fokuszuständigkeit und den Aufnahmeablauf; er öffnet die abgeschlossene Integration nicht rückwirkend wieder.
- `extend-media-management-governance` bleibt für Scan-/Governance-Grenzen maßgeblich. Keine parallelen Änderungen derselben Persistenz- oder Uploadzustände; Überschneidungen vor Umsetzung abgleichen.
- Aktuelle Dokumentation bei Umsetzung: `docs/reference/media-management.md`, betroffene Anwenderdokumentation und arc42 `05-building-block-view.md`, `06-runtime-view.md`, `08-cross-cutting-concepts.md`; bei Schemaänderungen beide kanonischen Schemadokumente.

Der neue Change ist erforderlich, weil der abgeschlossene Editor-Change die neue Fokuszuständigkeit und sichere automatische Aufnahme nicht beschreibt. Unmittelbare Verbraucher sind die Mediendetailansicht und der gemeinsame Medienpicker; der bestehende Codepfad wird erweitert, kein paralleles Subsystem angelegt.
