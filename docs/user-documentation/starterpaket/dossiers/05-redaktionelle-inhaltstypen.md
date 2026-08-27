# Dossier 5: Redaktionelle Inhaltstypen

## Gemeinsamer Kontext

Die hier erfassten Editorseiten verwenden Mainserver-gestützte Fachmodelle. Soweit angeboten,
bestimmt „Erstellen als“ beziehungsweise „Handeln als“, ob persönliche oder organisatorische
Credentials verwendet werden. Anlegeseiten besitzen noch keine Historie; Detailseiten können
zusätzlich Löschen, Historie und den ursprünglichen DataProvider zeigen. Medien werden teilweise in
mehreren Schritten gespeichert, sodass Inhalt und Medienreferenzen unterschiedliche Ergebnisse
haben können.

## `cockpit-cards.content.create` – Kachel anlegen

- **Route / Typ / Owner:** `/admin/cockpit-cards/new`, Anlegen, Plugin `cockpit-cards`.
- **Nutzerziel:** Eine neue Cockpit-Kachel mit Text, Bild und Zielverlinkung vorbereiten.
- **Produktfakten:** Bereiche sind Basis, Inhalt und Einstellungen. Felder umfassen Überschrift,
  Sprachcode, Kategorie, Klartext, Bilder, Link und Linktext, Öffnen im neuen Tab, Sortiergewicht,
  Sichtbarkeit und Veröffentlichungszeitpunkt. Bilder können aus der Mediathek, per Upload oder
  über HTTPS-URL kommen.
- **Validierung:** Pflichtfelder, BCP-47-Sprachcode, Klartext ohne HTML, HTTPS für Bilder und Link
  sowie ganzzahliges Sortiergewicht.
- **Leitfragen / Stichwörter:** Welche Kategorie und Reihenfolge gelten? Wann wird die Kachel
  sichtbar? Alternativtext und Bildrechte; Kachel, Cockpit, Sortiergewicht, Linkziel.
- **Evidenz:** `packages/plugin-cockpit-cards/src/cockpit-cards.pages.tsx`,
  `packages/plugin-cockpit-cards/src/plugin.translations.ts`.

## `cockpit-cards.content.detail` – Kachel bearbeiten

- **Route / Typ / Owner:** `/admin/cockpit-cards/$id`, Detail, Plugin `cockpit-cards`.
- **Nutzerziel:** Inhalt, Bilder, Sortierung und Veröffentlichung einer bestehenden Kachel ändern.
- **Produktfakten:** Zusätzlich zum Anlegeumfang stehen Historie und dauerhaftes Löschen mit
  Bestätigung zur Verfügung. Bilder lassen sich umordnen oder entfernen. Bei partiell
  fehlgeschlagenen Medienreferenzen bleibt die Kachel gespeichert und die Referenzen können erneut
  gespeichert werden.
- **Kontextabhängig:** Der ursprüngliche DataProvider kann den wirksamen Schreibkontext bestimmen.
- **Leitfragen / Stichwörter:** Was bleibt bei Medienfehlern gespeichert? Welche Auswirkung hat die
  Reihenfolge der Bilder? Kachel bearbeiten, Medienreferenz, Historie, Löschen.
- **Evidenz:** wie Anlegeseite, zusätzlich `cockpit-cards.history-translations.ts` und
  `cockpit-cards.media-translations.ts`.

## `events.content.create` – Veranstaltung anlegen

- **Route / Typ / Owner:** `/admin/events/new`, Anlegen, Plugin `events`.
- **Nutzerziel:** Eine Veranstaltung mit Termin, Ort, Kontakt und Veröffentlichung erfassen.
- **Produktfakten:** Erfasst werden Titel, Beschreibung, Kategorien, Sichtbarkeit, einzelne oder
  wiederkehrende Termine, Zeit-Hinweise, Veranstalter, Kontakte, Adresse und Karte, POI-Bezug,
  Links, Preise, Barrierefreiheit, Tags und Medien. Wiederholungen unterstützen Tage, Wochen,
  Monate oder Jahre sowie Wochentage. Die Beschreibung lässt sich visuell oder als HTML bearbeiten.
- **Validierung:** Titel erforderlich; gültige Datumswerte, HTTPS-URLs, valide Preise und Geo-
  Koordinaten. Kategorienamen sind auf 128 Zeichen begrenzt.
- **Leitfragen / Stichwörter:** Einzeltermin oder Wiederholung? Adresse oder POI? Nur Zeit-Hinweis?
  Veranstaltung, Terminserie, Veranstaltungsort, Preis, Barrierefreiheit.
- **Evidenz:** `packages/plugin-events/src/events.detail-*.tsx`,
  `packages/plugin-events/src/plugin.translations.ts`.

## `events.content.detail` – Veranstaltung bearbeiten

- **Route / Typ / Owner:** `/admin/events/$id`, Detail, Plugin `events`.
- **Nutzerziel:** Eine bestehende Veranstaltung und ihre strukturierten Angaben aktualisieren.
- **Produktfakten:** Der Anlegeumfang wird um Historie und Löschen ergänzt. Adresse kann geocodiert
  und ein Kartenpunkt rückwärts in eine Adresse übersetzt werden. Medienreferenzen können nach
  partiellem Fehler erneut gespeichert werden. Die Beschreibung bietet eine visuelle und eine
  HTML-Ansicht.
- **Kontextabhängig:** Kartenfunktionen benötigen eine aktive Karten-/Geocoding-Schnittstelle;
  Credentials und DataProvider beeinflussen Schreibaktionen.
- **Leitfragen / Stichwörter:** Wie korrigiert man eine Serie ohne falsche Termine? Welche Quelle hat
  Vorrang bei Karte und Adresse? Veranstaltung bearbeiten, Geocoding, Historie, Medienreferenz.
- **Evidenz:** `packages/plugin-events/src/events.detail-page.tsx`,
  `packages/plugin-events/src/events.location-map.*`.

## `faq.content.create` – FAQ anlegen

- **Route / Typ / Owner:** `/admin/faq/new`, Anlegen, Plugin `faq`.
- **Nutzerziel:** Eine häufige Frage mit Antwort und Veröffentlichungsmerkmalen erfassen.
- **Produktfakten:** Bereiche sind Basis, Inhalt und Einstellungen. Felder sind Frage, Antwort als
  Klartext, BCP-47-Sprachcode, ganzzahliges Sortiergewicht, Sichtbarkeit und
  Veröffentlichungszeitpunkt.
- **Validierung:** Frage und gültige Textantwort sind erforderlich; Sprachcode und Sortiergewicht
  werden geprüft.
- **Leitfragen / Stichwörter:** Wie kurz sollte die Frage sein? Welche Sprache und Sortierung gelten?
  FAQ, Frage, Antwort, Sprachcode, Sichtbarkeit.
- **Evidenz:** `packages/plugin-faq/src/faq-editor-view.tsx`,
  `packages/plugin-faq/src/plugin.translations.ts`.

## `faq.content.detail` – FAQ bearbeiten

- **Route / Typ / Owner:** `/admin/faq/$id`, Detail, Plugin `faq`.
- **Nutzerziel:** Inhalt, Reihenfolge und Veröffentlichung einer FAQ ändern.
- **Produktfakten:** Zusätzlich stehen Historie und dauerhaftes, nicht rückgängig zu machendes
  Löschen bereit. Die Historie zeigt nur Studio-Änderungen.
- **Leitfragen / Stichwörter:** Welche Änderung beeinflusst die Reihenfolge? Ist Löschen statt
  Unsichtbarschalten nötig? FAQ bearbeiten, Historie, Sortiergewicht, dauerhaft löschen.
- **Evidenz:** `packages/plugin-faq/src/faq.editor-page.logic.ts`,
  `packages/plugin-faq/src/faq.detail-history-tab.tsx`.

## `generic-items.content.create` – Generischen Inhalt anlegen

- **Route / Typ / Owner:** `/admin/generic-items/new`, Anlegen, Plugin `generic-items`.
- **Nutzerziel:** Einen frei modellierbaren Inhalt anlegen, wenn kein enger Fachtyp passt.
- **Produktfakten:** Neben Überschrift, freiem Inhaltstyp, Sichtbarkeit und Veröffentlichung stehen
  Content-Blocks, Kategorien, Kontakte, Weblinks, Adressen, Orte, Termine, Öffnungszeiten,
  Barrierefreiheit, Preise, Medien und freies JSON zur Verfügung. Content-Blocks lassen sich
  visuell oder als HTML bearbeiten.
- **Validierung:** Überschrift erforderlich; Kategorien, Links, Koordinaten und JSON werden
  validiert. Der freie Typ ist ein redaktioneller Marker und keine neue Plugin-Definition.
- **Leitfragen / Stichwörter:** Warum ist kein Fachtyp geeigneter? Welche Felder braucht die
  Ausspielung tatsächlich? Generischer Inhalt, Content-Block, Zusatzdaten, strukturierte Listen.
- **Evidenz:** `packages/plugin-generic-items/src/generic-items.detail-*.tsx`,
  `packages/plugin-generic-items/src/plugin.translations.de.ts`.

## `generic-items.content.detail` – Generischen Inhalt bearbeiten

- **Route / Typ / Owner:** `/admin/generic-items/$id`, Detail, Plugin `generic-items`.
- **Nutzerziel:** Freie und strukturierte Daten eines bestehenden generischen Inhalts pflegen.
- **Produktfakten:** Der große Anlegeumfang wird um Studio-Historie, Löschen und
  Medienreferenzstatus ergänzt. Medien lassen sich sortieren und ihre Metadaten aus der Mediathek
  gezielt übernehmen. Für Content-Blocks stehen die visuelle und die HTML-Ansicht bereit.
- **Kontextabhängig:** Freies JSON und manuelle Medien-URLs erfordern besondere redaktionelle
  Sorgfalt; nicht auflösbare Referenzen werden sichtbar markiert.
- **Leitfragen / Stichwörter:** Welche Zusatzdaten sind fachlich dokumentiert? Woher stammen
  Medienmetadaten? Generischer Inhalt bearbeiten, JSON, Medienabgleich, Historie.
- **Evidenz:** `packages/plugin-generic-items/src/generic-items.detail-page.tsx`,
  `packages/plugin-generic-items/src/generic-items.detail-media.helpers.ts`.

## `news.content.create` – Nachricht anlegen

- **Route / Typ / Owner:** `/admin/news/new`, Anlegen, Plugin `news`.
- **Nutzerziel:** Eine Nachricht als Entwurf, sofort oder zeitgesteuert veröffentlichen.
- **Produktfakten:** Tabs sind Basis, Inhalte und Einstellungen. Felder umfassen Überschrift,
  Kategorien, Schlagwörter, Einleitung, Richtext, Medien, Quelle, Veröffentlichungsmodus und
  optional Push. Der Richtext lässt sich visuell oder als HTML bearbeiten; Links, Überschriften
  und Listen stehen in der visuellen Ansicht bereit. Push kann global oder auf ausgewählte
  Abholorte begrenzt werden; die Nachricht selbst bleibt dabei öffentlich sichtbar.
- **Lebenszyklus:** Entwurf, sofort veröffentlichen oder zeitgesteuert; geplanter Zeitpunkt darf in
  Vergangenheit oder Zukunft liegen. Push wird beim Speichern einer veröffentlichten Nachricht
  ausgelöst und kann pro Nachricht nur einmal gesendet werden.
- **Leitfragen / Stichwörter:** Wann ist die Nachricht sichtbar? Wer erhält Push? Was bedeutet
  globale Zielgruppe? Nachricht, Push, Abholorte, Entwurf, Zeitsteuerung.
- **Evidenz:** `packages/plugin-news/src/news.detail-*.tsx`,
  `packages/plugin-news/src/plugin.translations.ts`.

## `news.content.detail` – Nachricht bearbeiten

- **Route / Typ / Owner:** `/admin/news/$id`, Detail, Plugin `news`.
- **Nutzerziel:** Redaktionellen Inhalt, Veröffentlichung, Push-Zielgruppe und Medien aktualisieren.
- **Produktfakten:** Historie und Löschen ergänzen den Anlegeumfang. Nach versendetem Push ist die
  dokumentierte Empfängerauswahl nur lesbar. Bei partiellen Medienfehlern bleibt der Inhalt
  gespeichert; Referenzen können erneut synchronisiert werden.
- **Kontextabhängig:** Die Historie enthält nur Studio-Änderungen. Globale Push-Zustellung fordert
  je nach Zustand eine Bestätigung.
- **Leitfragen / Stichwörter:** Welche Felder können nach dem Push noch geändert werden? Wie erkennt
  man eine nur teilweise gespeicherte Medienverknüpfung? Nachricht bearbeiten, Push gesendet,
  Historie, Medienreferenz.
- **Evidenz:** `packages/plugin-news/src/news.detail-page.tsx`,
  `packages/plugin-news/src/news.detail-targeting-*.tsx`.

## `poi.content.create` – Ort anlegen

- **Route / Typ / Owner:** `/admin/poi/new`, Anlegen, Plugin `poi`.
- **Nutzerziel:** Einen Ort mit Beschreibung, Lage, Kontakt und Öffnungszeiten erfassen.
- **Produktfakten:** Der Editor umfasst Basis, Inhalt und Einstellungen mit Name, Aktivstatus,
  Kategorien, Beschreibungen, Kontakt, Adresse und Karte, Betreiber, Öffnungszeiten, Links, Preise,
  Barrierefreiheit, Medien sowie technische Zusatzdaten. Die Beschreibung lässt sich visuell oder
  als HTML bearbeiten.
- **Validierung:** Name erforderlich; HTTPS-URLs, gültige Koordinaten, Kategorien und JSON werden
  geprüft.
- **Leitfragen / Stichwörter:** Was gehört zum Ort und was zum Betreiber? Welche Adresse und
  Öffnungszeiten sind öffentlich relevant? POI, Ort, Betreiber, Öffnungszeit, Karte.
- **Evidenz:** `packages/plugin-poi/src/poi.detail-*.tsx`,
  `packages/plugin-poi/src/plugin.translations.de.ts`.

## `poi.content.detail` – Ort bearbeiten

- **Route / Typ / Owner:** `/admin/poi/$id`, Detail, Plugin `poi`.
- **Nutzerziel:** Einen bestehenden Ort einschließlich Karte, Medien und Fachdaten aktualisieren.
- **Produktfakten:** Ergänzt werden Historie, Löschen sowie Geocoding und Reverse-Geocoding.
  Öffnungszeiten, Links, Preise und Medien können als mehrere Einträge gepflegt werden. Für die
  Beschreibung stehen die visuelle und die HTML-Ansicht bereit.
- **Kontextabhängig:** Kartenaktionen hängen von der konfigurierten Schnittstelle ab. Historie
  umfasst ausschließlich Studio-Änderungen.
- **Leitfragen / Stichwörter:** Wie vermeidet man widersprüchliche Adresse und Koordinaten? Welche
  Medienrolle wird in der App verwendet? Ort bearbeiten, Geocoding, Öffnungszeiten, Historie.
- **Evidenz:** `packages/plugin-poi/src/poi.detail-page.tsx`,
  `packages/plugin-poi/src/poi.location-map.*`.

## `projects.content.create` – Projekt anlegen

- **Route / Typ / Owner:** `/admin/projects/new`, Anlegen, Plugin `projects`.
- **Nutzerziel:** Ein Featured Project mit Text, Bildern und Veröffentlichungsstatus erstellen.
- **Produktfakten:** Felder umfassen Sprache, Titel, Kurzbeschreibung, Richtext, geordnete Bilder
  mit Alternativtext, Bildunterschrift und Nachweis sowie Status und Veröffentlichungszeitpunkt.
  Bilder kommen aus Mediathek, Upload oder dauerhafter URL. Der Richtext lässt sich visuell oder als
  HTML bearbeiten.
- **Lebenszyklus:** Entwurf, veröffentlicht oder archiviert.
- **Leitfragen / Stichwörter:** Was macht ein Projekt „featured“? Welche Bildreihenfolge und
  Nachweise werden benötigt? Projekt, Featured Project, Richtext, Bildnachweis, Archiv.
- **Evidenz:** `packages/plugin-projects/src/projects.pages.tsx`,
  `packages/plugin-projects/src/plugin.translations.ts`.

## `projects.content.detail` – Projekt bearbeiten

- **Route / Typ / Owner:** `/admin/projects/$id`, Detail, Plugin `projects`.
- **Nutzerziel:** Inhalte, Bilder und Status eines vorhandenen Projekts ändern.
- **Produktfakten:** Historie und Löschen ergänzen den Anlegeumfang. Löschen markiert das Projekt im
  Studio als gelöscht. Medienmetadaten können selektiv mit der Mediathek abgeglichen werden;
  partielle Referenzfehler lassen sich wiederholen. Der Richtext bietet eine visuelle und eine
  HTML-Ansicht.
- **Leitfragen / Stichwörter:** Ist Archivieren geeigneter als Löschen? Welche Bildwerte stammen aus
  der Mediathek, welche aus dem Projekt? Projekt bearbeiten, Medienabgleich, Historie, gelöscht.
- **Evidenz:** `packages/plugin-projects/src/projects.pages.tsx`,
  `packages/plugin-projects/src/projects.model.ts`.

## `surveys.content.create` – Umfrage anlegen

- **Route / Typ / Owner:** `/admin/surveys/new`, Anlegen, Plugin `surveys`.
- **Nutzerziel:** Rahmen, Teilnahmebedingungen und Fragen einer Umfrage definieren.
- **Produktfakten:** Basis und Inhalt umfassen Titel, Status, Laufzeit, Zielgebiete, Kurz- und
  Langbeschreibung, anonyme Teilnahme, Ergebnisfreigabe, Datenschutz- und Transparenzhinweis sowie
  geordnete Fragen. Fragetypen sind Einfach-, Mehrfach- und Freitextvarianten; Fragen können
  verpflichtend sein.
- **Lebenszyklus:** Entwurf, aktiv oder archiviert. Ohne Enddatum bleibt die Umfrage unbefristet.
- **Leitfragen / Stichwörter:** Welche Ergebnisfreigabe ist datenschutzgerecht? Welche Frageart
  passt? Umfrage, Zielgebiet, anonyme Teilnahme, Pflichtfrage, Ergebnisfreigabe.
- **Evidenz:** `packages/plugin-surveys/src/surveys.editor.tsx`,
  `packages/plugin-surveys/src/plugin.translations.*.ts`.

## `surveys.content.detail` – Umfrage bearbeiten

- **Route / Typ / Owner:** `/admin/surveys/$id`, Detail, Plugin `surveys`.
- **Nutzerziel:** Umfrage bearbeiten sowie Moderation, Ergebnisse und Historie prüfen.
- **Produktfakten:** Zusätzlich bestehen Tabs für Moderation, Ergebnisse und Historie. Ergebnisse
  zeigen Teilnahme-, Abgabe- und Antwortzahlen sowie aggregierte Fragen. Das UI-Modell sieht
  Exporte als CSV, JSON, Excel oder XML mit oder ohne Freitexte vor. Der aktuelle Editor übergibt
  jedoch keinen Export-Handler; deshalb sind Exportaktionen derzeit nicht sichtbar oder nutzbar.
  Die aktuelle Moderationssicht zeigt Freitextantworten nur lesend; Sichtbarkeits- und
  Löschaktionen sind noch nicht host-seitig angebunden.
- **Kontextabhängig:** Bearbeiten kann von der Mainserver-Umgebung noch nicht unterstützt sein.
  Moderation benötigt eigene Rechte. Das Recht `surveys.export` ist bereits definiert, schaltet
  ohne die fehlende Editor-Anbindung aber noch keine Exportfunktion frei.
- **Leitfragen / Stichwörter:** Welche Funktionen sind aktuell nur lesbar? Welche Exportfunktion
  ist derzeit noch nicht angebunden? Umfrage bearbeiten, Moderation, Ergebnisse, Freitext, Export.
- **Evidenz:** `packages/plugin-surveys/src/surveys.editor.tsx`,
  `packages/plugin-surveys/src/surveys.editor-tabs.tsx`,
  `packages/plugin-surveys/src/surveys.detail-results-tab.tsx`.
