# Change: Metadatenpflege und vollständige Bildbearbeitung verbinden

## Why

Die Mediendetailansicht zeigt die zentralen Textmetadaten überwiegend nur an. Interaktive Bildbearbeitung und das Speichern weiterbearbeitbarer Kopien fehlen. Die vorhandenen Medien-, Upload- und Content-Save-Pfade sollen diese redaktionelle Fähigkeit gemeinsam erhalten.

## What Changes

- Durchgängige Pflege von Titel, Alternativtext, Beschreibung, Copyright, Lizenz und Tags in Mediathek und gemeinsamem Medienpicker.
- Explizite Trennung zentral gespeicherter Asset-Metadaten von Angaben, die nur mit dem aktuellen Inhalt gespeichert werden.
- Vollständiger Bildeditor mit Zuschnitt, Seitenverhältnissen, Drehen, Spiegeln, Bildanpassungen, Filtern, Text, Annotationen sowie Undo/Redo und Zurücksetzen; zusätzlich Fokuspunkt und Vorschau der bestehenden Ausgabevarianten.
- Bildänderungen erzeugen neue Medienkopien; Ausgangsbild und letzter Editorzustand bleiben zur erneuten Bearbeitung erhalten.
- Im Inhaltseditor bleiben neue Bilder und bearbeitete Ergebnisse bis zum Content-Speichern lokal. In der Mediathek startet das Speichern unmittelbar den bestehenden Bibliotheksupload.
- Filerobot Image Editor ist gemäß ADR-069 als Integrationsweg mit ausdrücklich akzeptierter Accessibility-Abweichung der spezialisierten Editoroberfläche gewählt; die konkrete Produktintegration ist noch nicht implementiert.
- Redaktionelle Bedienabläufe erhalten eindeutige Aktionsnamen, sichtbare Speicherzustände, selektive Übernahme zentraler Angaben und verständliche Löschhinweise für benötigte Bearbeitungsgrundlagen. Lokales Übernehmen setzt keinen vorzeitigen Serverupload voraus.

## Nicht-Ziele

Cloudimage/CDN-Anbindung, Scaleflex-DAM oder Media Asset Widget, Mehrfachupload, Ordner, neue Medientypen, vollständige Versionshistorie, Austausch bestehender Originale und automatische Änderungen fremder Inhaltsverwendungen.

## Umfang und Status

Unterlagen: [fachlicher Entwurf](./design.md), [Designkonzept](./ui-design.md) und [Anforderungen](./specs/media-management/spec.md).

Der [Konzeptabgleich mit Architektur, Plugins, Datenschutz und Accessibility](./concept-review.md) dokumentiert die Prüfung und den Erledigungsstand. Die konzeptionellen Korrekturen sind umgesetzt. Lokale Komponenten-, Typ-, Coverage-, PostgreSQL- und Browsernachweise sind im Aufgabenstand und in der Library-Bewertung dokumentiert; die endgültigen GitHub-Gates werden am PR-HEAD ausgewertet.

Die [technische Library-Vorprüfung](./library-evaluation.md) belegt React-19-Grundbetrieb und einen repräsentativen Bearbeitungs-Roundtrip und dokumentiert konkrete Accessibility-Lücken. Der Nutzer akzeptiert diese für die spezialisierte Editoroberfläche ausdrücklich in [ADR-069](../../../docs/adr/ADR-069-filerobot-bildeditor-mit-begrenzter-accessibility-abweichung.md). Damit entfällt dieser Integrationsblocker, ohne die Befunde oder die übrigen Qualitätsanforderungen aufzuheben. Der vollständige Funktionsumfang bleibt bestehen; ein eigener Accessibility-Fork oder Ersatzeditor ist nicht erforderlich.

Leitlinie der Überarbeitung: Werkzeuge und redaktionelle Entscheidungen bleiben frei. Hinweise zu Bildrechten, Alternativtext, Bildqualität und Text im Bild sind Hilfestellungen, keine neuen Pflichtbestätigungen oder Veröffentlichungssperren. Technische Sperren schützen ausschließlich bestehende Rechte, zulässige Ausgabeziele, Verarbeitung und Datenintegrität. Es entstehen kein Moderationsablauf, keine OCR-Prüfung, keine neue Rollenverwaltung und keine zusätzliche Governance-Plattform.

Der Nutzer hat am 22.10.2026 den gemeinsamen fachlichen Entwurf und seine schriftliche Ausarbeitung freigegeben. Dieser Change dokumentiert das Ziel, nicht eine Implementierungsfreigabe. Ein zusammenhängender Lieferumfang umfasst Metadaten und vollständigen Editor; eine künstliche Aufteilung in Funktions-PRs ist nicht vorgesehen. Der schriftliche Entwurf ist vor der Implementierungsplanung vom Nutzer zu prüfen.

## Impact

- Affected specs: `media-management`; bestehende Content-Save- und Content-Berechtigungsverträge bleiben Grundlage. Die Metadaten-Requirement wird ausdrücklich geändert, statt einen parallelen Upload-/Review-Vertrag hinzuzufügen.
- Maximal betroffene Bereiche bei Umsetzung: Medienrouten und Hooks in `apps/sva-studio-react`, gemeinsame Medienoberfläche in `packages/studio-ui-react`, Medienverträge in `packages/media` und `packages/plugin-sdk`, bestehender Medienruntime- und Persistenzpfad in `packages/auth-runtime`, `packages/data-repositories` und bei nachgewiesenem Bedarf `packages/data`.
- Die sechs bestehenden Content-Anbindungen News, Events, POI, Generic Items, Projects und Cockpit Cards werden auf Konsistenz geprüft und nur soweit für denselben Medienvertrag erforderlich angepasst.
- Als weiterer Verbraucher wird Waste-Branding berücksichtigt. Sein bestehender unmittelbarer Bibliotheksupload und Settings-Vertrag bleiben erhalten; er wird nicht an den Mainserver-Content-Save gekoppelt.
- Dokumentation bei Umsetzung: `docs/reference/media-management.md`, betroffene Anwenderdokumentation und tatsächliche Übersetzungsressourcen sowie arc42 `05-building-block-view.md`, `06-runtime-view.md` und `08-cross-cutting-concepts.md` unter `docs/architecture/`.
- Ein möglicher Persistenzausbau wird erst nach Prüfung von `docs/development/studio-db-schema-final.sql` und `docs/development/studio-db-schema.md` konkretisiert; dieser Dokumentationschange ändert kein Schema.

## Einordnung bestehender Changes

`add-media-async-processing` liefert den bereits vorhandenen Job-/Verarbeitungspfad. `extend-media-management-governance` bleibt für Tags, ClamAV und Bestandsscan zuständig; dessen Sicherheitsgrenzen werden weder ersetzt noch erweitert. Der archivierte Change `delay-content-media-persistence` und die aktuelle Spezifikation bestimmen weiterhin provisorische Content-Assets, Wiederholung und Recovery. Es entsteht kein zweiter Upload-, Worker- oder Storage-Pfad.

Der zusätzliche Change ist erforderlich, weil keiner dieser bestehenden Umfänge vollständige Bildbearbeitung und wiederherstellbare Editorzustände abdeckt. Unmittelbare Verbraucher sind die bestehende Mediendetailansicht und der gemeinsame Medienpicker.
