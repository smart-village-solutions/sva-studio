## Kontext

Cockpit Cards sind fachlich abgegrenzte GenericItems. Sie ähneln FAQ in Navigation, Lifecycle und Publikationsmetadaten, erweitern das reduzierte Modell aber um eine bestehende Kategorie, ein oder mehrere Bilder und einen Link.

## Ziele und Nicht-Ziele

- Ziele: eigenständiges Fachplugin, feste Typabgrenzung, kompakter Editor, wiederverwendete Kategorien- und Medienprimitives, getrennte IAM-Actions und deterministische Listen.
- Nicht-Ziele: Abstraktion von FAQ und Cockpit Cards, generische Formkonfiguration oder Erweiterung des Mainserver-Datenmodells.

## Entscheidungen

### Eigenständiges Fachplugin

`@sva/plugin-cockpit-cards` wird als eigenes Workspace-Package aus dem bewährten FAQ-Muster abgeleitet. Fachmodell, UI und Validierung bleiben pluginlokal; Transport, Authentisierung, Autorisierung, Audit und Projektion bleiben hostgeführt. Die direkte Plugin-Navigation wird zugunsten der gemeinsamen Inhaltsübersicht ausgeblendet.

### Kanonische Abbildung

| Fachfeld                   | GenericItem-Feld        |
| -------------------------- | ----------------------- |
| Überschrift                | `title`                 |
| Text                       | `contentBlocks[0].body` |
| Sprachcode                 | `payload.languageCode`  |
| Sortiergewicht             | `payload.sortWeight`    |
| Kategorie                  | `categories[0]`         |
| Bilder                     | `mediaContents`         |
| Link                       | `webUrls[0]`            |
| Sichtbarkeit               | `visible`               |
| Veröffentlichungszeitpunkt | `publicationDate`       |

Überschrift, Text, Sprachcode, genau eine Kategorie und mindestens ein Bild sind Pflicht. Der Text bleibt reiner Text. Medien müssen Bilder sein; die vorhandene Medienverwaltung und deren Upload werden wiederverwendet. Der optionale Link muss eine HTTPS-URL sein. Beim Schreiben werden Kategorie und Link auf ihre erlaubte Kardinalität normalisiert. Unbekannte bestehende Payload-Schlüssel bleiben erhalten; kontrolliert werden ausschließlich `languageCode` und `sortWeight`.

### Typ- und Projektionsabgrenzung

`genericType: "COCKPIT_CARD"` ist die alleinige Mainserver-Diskriminierung. Die Studio-Projektion ordnet diese Datensätze ausschließlich `cockpit-cards.cockpit-card` zu. Detail-, Update- und Delete-Pfade behandeln IDs fremder GenericItem-Typen wie unbekannte IDs und führen keine Mutation aus.

### Editor-Workspace

Die Tab-Reihenfolge lautet `Basis`, `Inhalt`, `Einstellungen`, `Historie`; beim Anlegen fehlt `Historie`. `Basis` enthält Überschrift, Sprachcode und die einzelne Kategorie. `Inhalt` enthält Text und Bilder gemeinsam. `Einstellungen` enthält Link, Sichtbarkeit, Veröffentlichungszeitpunkt und Sortiergewicht. Bilder können aus der Mediathek gewählt oder über den vorhandenen Bild-Upload ergänzt, sortiert und entfernt werden.

### Listen und Pagination

Die Cockpit-Card-Liste übernimmt das abgesicherte FAQ-Muster: Der Host liest alle verfügbaren GenericItem-Upstream-Seiten, filtert nach `COCKPIT_CARD`, sortiert die vollständige Teilmenge deterministisch nach Sprachcode, Sortiergewicht, Überschrift und ID und wendet erst danach die lokale Pagination an.

## Risiken und Abwägungen

- Das vollständige Upstream-Paging ist bei großen GenericItem-Mengen teuer. Seitenzahl, gelesene Datensatzanzahl und Laufzeit werden ohne Inhaltsdaten beobachtbar gemacht.
- Die Ableitung vom FAQ-Plugin erzeugt bewusst ähnliche Dateien. Eine gemeinsame Abstraktion erfolgt erst bei belegtem weiterem Nutzen und nicht innerhalb dieses Changes.
- Kategorie- und Medienladefehler müssen explizit angezeigt werden und dürfen bestehende Formulardaten nicht verwerfen.

## Teststrategie

- Unit-Tests für Mapper, Kardinalitäten, Nur-Text-, BCP-47-, Bild- und HTTPS-Validierung sowie Payload-Erhaltung.
- Komponenten-Tests für Tab-Reihenfolge und Feldzuordnung, insbesondere Text und Bilder gemeinsam im Tab `Inhalt`, Medienauswahl/Upload und Fehlerzustände.
- Host-Tests für IAM, Fremdtyp-Abgrenzung, vollständiges Paging, Projektion ohne Doppelanzeige sowie CRUD.
- Ein E2E-Flow für Anlegen, Bearbeiten und Löschen einschließlich Kategorie, mehreren Bildern und Link.
- Nach jedem Änderungsblock werden die kleinsten relevanten Nx-Unit-, Type- und Server-Runtime-Gates ausgeführt; vor PR-Freigabe nach Möglichkeit `pnpm test:pr`.
