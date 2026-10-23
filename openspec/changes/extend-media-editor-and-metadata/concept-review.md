# Konzeptabgleich Medienverwaltung – 22.10.2026

## Ergebnis und Prüfgrenze

**Fortschreibung:** Die Korrekturen K1–K7 wurden auf Nutzerauftrag in `design.md`, `ui-design.md`, `proposal.md` und den Spec-Delta eingearbeitet. Die folgenden Befunde dokumentieren den Ausgang der Prüfung, nicht weiterhin unveränderte Konzeptmängel. Runtime-, Library- und Nutzernachweise stehen aus.

**Spätere Entscheidung:** Die technische [Library-Vorprüfung](./library-evaluation.md) hat Grundbetrieb und einen repräsentativen Roundtrip belegt sowie konkrete Accessibility-Lücken gefunden. [ADR-069](../../../docs/adr/ADR-069-filerobot-bildeditor-mit-begrenzter-accessibility-abweichung.md) akzeptiert die Einschränkungen der spezialisierten Filerobot-Oberfläche ausdrücklich. Die frühere vollständige Accessibility-Abnahme aus K6 ist für diesen begrenzten Teil durch transparente Erfassung der Abweichung ersetzt; für Studio-eigene Rahmen, Formulare, Status und Abschlussaktionen bleibt sie bestehen. Die Design-System-Ausnahme aus K7 ist ebenfalls in der ADR festgehalten.

Die Architektur- und Designrichtung passt zum Studio. Die ursprüngliche Prüfung fand Lücken bei Verbrauchergrenzen, Datenschutz und Accessibility; deren Anforderungen sind nun präzisiert. Sicherheits-, Datenschutz- oder WCAG-Konformität der späteren Implementierung ist nicht nachgewiesen. Dies dokumentiert einen Konzeptabgleich, keinen Anwendungstest, Penetrationstest oder rechtliches Konformitätsgutachten.

Geprüft wurden die Dateien dieses Changes, bestehende Medien-/Content-Spezifikationen, ADR-034/039, relevante arc42-Konzepte, Entwicklungs-/Accessibility-Regeln, die sechs Content-Anbindungen und das Waste-Branding als weiterer realer Verbraucher. Spezialisierte Reviews für Architektur/Plugins, Accessibility/Design und Dokumentationskonsistenz wurden konsolidiert. Die Anwendungsdateien wurden nicht geändert.

## Bereits konsistent

- Medien bleiben Host-Capability; Plugins verwenden SDK, Medienrollen und gemeinsame UI statt eigener Storage-/Processing-Pfade.
- Kein zusätzlicher DAM-, CDN-, Scanner-, Worker- oder allgemeiner Workflowdienst.
- Metadaten am Asset bleiben von Content-Snapshots und eigenen Verwendungsangaben getrennt.
- Nicht destruktive Kopien und verzögerte Content-Uploads erhalten Originale und vorhandene Referenzen.
- Instanzbindung, Quellzugriff, Sichtbarkeitsvererbung, Scan, harte Quote und Recovery sind ausdrücklich berücksichtigt.
- Studio-Shell, semantische Tokens, bestehende Primitives, verständliche Speicheraktionen und der Verzicht auf Dialogstapel passen zur bisherigen Gestaltung.
- Library-Auswahl bleibt an Roundtrip-, Ressourcen-, Accessibility- und Integrationsnachweise gebunden. Aktuelle Produktdokumentation behauptet keine neue Funktion als bereits implementiert.

## Notwendige Korrekturen vor Implementierungsplanung

### K1 – Bestehende Spezifikation ausdrücklich ändern

**Beleg:** `openspec/specs/media-management/spec.md:150–172` beschreibt Metadatenbearbeitung mit `media.update` und Content-Review nach erfolgreichem Upload. Der neue Change enthält bislang nur zusätzliche Requirements, obwohl sein lokaler Review vor Upload stattfindet.

**Korrektur:** Die betroffene bestehende Requirement über `MODIFIED Requirements` vollständig konsistent fortschreiben. Metadaten einer neu erstellten Kopie und zentrale Updates eines vorhandenen Assets unterscheiden. Die Kopie darf keine Änderungsberechtigung am Quellasset verlangen; Quelle und Verwendung bleiben separat autorisiert. CSRF- und erneute serverseitige Berechtigungsprüfung aller mutierenden Erweiterungen gehören ausdrücklich zum bestehenden Requestvertrag.

### K2 – Verbraucher und Speicherlebenszyklen vervollständigen

**Beleg:** `proposal.md` nennt sechs Content-Plugins. `packages/plugin-waste-management/src/waste-management.output-branding-media.logic.ts:129–155` verwendet ebenfalls den gemeinsamen Picker, lädt unmittelbar öffentlich hoch und speichert eine persistente öffentliche URL; die fachliche Freigabe erfolgt über `waste-management.settings.manage`.

**Korrektur:** Waste-Branding als weiteren Verbraucher mit eigenem bestehenden Settings-Lebenszyklus und Regressionstest aufführen. Keine automatische Umstellung dieses Verbrauchers auf Mainserver-Content-Save, keine neu behauptete Referenzverwaltung. Die sechs Content-Plugins behalten ihre tatsächlichen Rollen und unterstützten Felder, einschließlich eingeschränkter Cockpit-Card-Metadaten.

### K3 – Öffentliche, geschützte und manuelle Quellen unterscheiden

**Beleg:** `openspec/specs/content-management/spec.md:2275–2308` erlaubt manuelle URLs ohne Medienrechte und verbietet ungeeignete kurzlebige Delivery-URLs. `packages/plugin-news/src/news.detail-page-media.ts:88–89` und `packages/plugin-events/src/events.detail-media-actions.ts:27–29` begrenzen die Auswahl auf öffentliche persistierbare Assets; `packages/plugin-sdk/src/content-media-persistence.ts:128–146` verwendet öffentliche Content-Uploads.

**Korrektur:** Geschützte Medien können berechtigt in der Mediathek bearbeitet werden, werden dadurch aber nicht in öffentlichen Inhaltseditoren auswählbar. Keine automatische Veröffentlichung und keine persistierten signierten URLs. Manuelle URL-Eingabe bleibt erhalten; der neue Editor importiert oder lädt fremde URLs nicht stillschweigend. Neue Remote-Importfunktionen sind außerhalb dieses Umfangs.

### K4 – Vertrauliche Bearbeitungsdaten und öffentliche Ausgabe abgrenzen

**Beleg:** `design.md`, Abschnitte 3 und 5, schützt Grundlagen und Zustand grundsätzlich; konkrete Ausgabemetadaten- und Netzwerkabnahmen fehlen. `docs/architecture/08-cross-cutting-concepts.md` fordert Datenminimierung und Schutz personenbezogener Daten; bestehendes `getMedia` serialisiert den Asset-Datensatz (`packages/auth-runtime/src/iam-media/asset-read-handlers.ts:79`). Ein bloßes Hinzufügen vertraulicher Zustandsfelder zur vorhandenen Asset-Antwort wäre deshalb keine ausreichende Zugriffstrennung.

**Korrektur:** Separate zulässige Datenprojektionen für Auswahl/Metadaten, ausgelieferte Bildausgabe und berechtigten Editorzugriff festlegen. Öffentliche Ausgaben und Varianten dürfen weder private Grundlagen/Zustände noch ungewollte EXIF-/IPTC-/XMP- oder Standortdaten enthalten. Editor, Schriften und Ressourcen kontrolliert bereitstellen; keine Bild-, Zustands- oder Annotationstexte an externe Dienste und keine unkontrollierten externen Abrufe. Nachweis durch Dateiprüfung und Netzwerkbeobachtung einer vollständigen Editorsitzung, bei unveränderten bestehenden CSP-/CORS-Grenzen.

### K5 – Nicht destruktive Bearbeitung ist keine Anonymisierung

**Beleg:** `design.md`, Abschnitt 3, erhält ausdrücklich die unveränderte Grundlage und wiederherstellbare Annotationen. Das ist für redaktionelle Bearbeitung erforderlich, macht Überdecken oder Weichzeichnen aber nicht zu sicherer Entfernung personenbezogener Information.

**Korrektur:** Der Editor darf keine sichere Schwärzung oder Anonymisierung versprechen. Ausgangsbild und Zustand haben gegebenenfalls höheren Schutzbedarf als die sichtbare Ausgabe. Vorhandene öffentliche Quellen werden durch Bearbeitung nicht nachträglich vertraulich. Für einen tatsächlichen Lösch-/Datenschutzfall müssen Original, Kopien, Zustände und abhängige Ressourcen nachvollziehbar behandelt werden; eine Bearbeitungsabhängigkeit darf nicht als unbegrenzte datenschutzrechtliche Aufbewahrungserlaubnis dargestellt werden. Der bestehende Löschschutz bleibt bis zu einer kontrollierten Auflösung der Abhängigkeiten bestehen; keine automatische Kaskadenlöschung oder neue Retention-Plattform. Der konkrete Anschluss an bestehende Lösch-/Auskunftsprozesse ist vor Implementierung festzulegen.

### K6 – Accessibility von Bedienung und erzeugtem Inhalt prüfen

**Beleg:** `ui-design.md`, Abschnitt 9, nennt 200 Prozent Zoom und allgemeine Tastaturbedienung. `docs/development/accessibility.md:25–50`, `docs/governance/content-guidelines.md:50–56` und `docs/architecture/08-cross-cutting-concepts.md:22–27` verlangen darüber hinaus konkrete Bedien- und Gestaltungsnachweise.

**Korrektur:** Objektwahl, Identifikation, Position, Größe, Rotation, Textänderung, Entfernen und gegebenenfalls Reihenfolge müssen im aktivierten Editor ohne Maus bedienbar sein. 200 Prozent Textvergrößerung, Textabstände und Reflow bei 320 CSS-Pixeln beziehungsweise entsprechendem 400-Prozent-Desktopzoom prüfen. Die notwendige zweidimensionale Bildfläche ist von Formularen und Aktionen zu unterscheiden. Die vorhandene Theme-Matrix umfasst Default und Forest jeweils Light/Dark; Textkontrast 4,5:1, relevante UI-Kontraste 3:1 und bestehende Vorgaben zu Aktionsflächen sind zu übernehmen.

Rasterisierte Texte und Informationsmarkierungen brauchen im Veröffentlichungskontext zugängliche Textentsprechungen. Alt-Text-Hilfe muss den Informationswert im Kontext erläutern; bei komplexen Informationen reicht ein kurzer Alt-Text nicht immer aus. Es entsteht keine pauschale neue Pflicht für jedes Bibliotheksasset. Die Textfunktion kann erhalten bleiben, ohne zu behaupten, ihr gerastertes Ergebnis sei automatisch barrierefrei.

**Referenzen:** [W3C Reflow](https://www.w3.org/WAI/WCAG21/Understanding/reflow.html), [W3C Images of Text](https://www.w3.org/WAI/WCAG21/Understanding/images-of-text.html). Konkrete WCAG-Verstöße einer noch nicht implementierten Oberfläche werden nicht behauptet. Die in `docs/development/accessibility.md` verlinkte Browser-/AT-Matrix ist im angegebenen Pfad nicht vorhanden; für die Abnahme ist deren gültige Quelle zu klären.

### K7 – Design-System-Grenze für Filerobot entscheiden

**Beleg:** `DEVELOPMENT_RULES.md:554–564` verlangt shadcn-/Studio-Primitives und eine dokumentierte Entscheidung für parallele Basis-Komponenten. `ui-design.md` erlaubt Tokenanpassung der spezialisierten Editoroberfläche nur soweit unterstützt. Filerobot bringt eigene UI-/Canvas-Abhängigkeiten mit.

**Korrektur:** Studio verantwortet Dialograhmen, Metadaten, Status, Vorschauprüfung und Speicheraktionen. Die spezialisierte Editoroberfläche wird nur innerhalb einer ausdrücklich dokumentierten, begrenzten Ausnahme integriert; keine zweite allgemeine Komponentenbibliothek im Studio. Kann die Library verbindliche Accessibility-/i18n-/Theme-Anforderungen nicht erfüllen, wird die Eignung neu entschieden. „Soweit unterstützt“ allein ist keine Ausnahmegenehmigung.

## Nachweis und nächste Entscheidung

Die sieben Befunde sind konzeptionell eingearbeitet: K1 über eine ausdrücklich geänderte bestehende Metadaten-Requirement, K2/K3 über die Verbraucher-/Quellenverträge, K4/K5 über private Projektionen, Ausgabe-/Netzwerkprüfung und kontrollierte Prozessanbindung, K6 über konkrete Accessibility-Abnahme und K7 über die eng begrenzte dokumentierte Editor-Ausnahme. Es entstehen keine neue Plattform, zusätzliche Redaktionsfreigabe, OCR-Prüfung oder automatische Löschkaskade. Die neuen redaktionellen Hinweise bleiben nicht blockierend; bestehende fachliche Validierungen gelten weiter.

Offen für die Implementierungsplanung bleiben die kleinste geeignete Persistenzentscheidung einschließlich der konkreten bestehenden Lösch-/Auskunftsanbindung und die Library-Eignungsnachweise. Der ungültige Browser-/AT-Matrix-Verweis wird vor Abnahme geklärt. Für diesen reinen Dokumentationschange sind keine Code-Testläufe sinnvoll. OpenSpec-/Dateiplatzierungsvalidierung belegt lediglich die formale Dokumentationsqualität, nicht die technische Sicherheit oder Barrierefreiheit.
