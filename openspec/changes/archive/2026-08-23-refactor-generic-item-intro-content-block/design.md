## Kontext

Der eingecheckte Mainserver-Introspection-Snapshot und die Rails-GraphQL-Definition stimmen darin überein, dass `createGenericItem` kein Top-Level-Argument `teaser` besitzt. `ContentBlockInput` stellt dagegen `title`, `intro`, `body` und `mediaContents` bereit. Der bisherige Studio-Vertrag vermischt ein historisch lesbares GenericItem-Feld mit dem tatsächlich schreibbaren Mutationsvertrag.

## Ziele / Nicht-Ziele

- Ziele:
  - GenericItem-Mutationen vollständig an das hinterlegte GraphQL-Schema binden.
  - Einleitungen kanonisch über `ContentBlockInput.intro` modellieren.
  - News-Text ausschließlich über Content-Blocks modellieren.
  - Fachplugin-Abbildungen eindeutig halten und weitere Content-Blocks bei Updates erhalten.
  - Die falsche Top-Level-Abstraktion typseitig entfernen, damit sie nicht erneut verwendet wird.
- Nicht-Ziele:
  - Historische Top-Level-Teaser migrieren oder lesen.
  - Das externe GraphQL-Schema erweitern.

## Entscheidungen

### GenericItem-Vertrag kennt keinen Teaser

`SvaMainserverGenericItem`, `SvaMainserverGenericItemInput`, die generierten GenericItem-Fragmente und die Plugin-API-Typen enthalten kein Feld `teaser`. Der Query-Client selektiert das historisch im Snapshot vorhandene Feld nicht. Es existiert kein Alias und kein Fallback.

### Einleitungen gehören zum jeweiligen Content-Block

Der offene GenericItem-Editor bietet kein separates globales Einleitungsfeld mehr an. Jeder Block bearbeitet sein eigenes `intro`. Damit entsprechen Formularmodell, Query-Antwort und Mutation demselben Datenmodell.

### Featured Projects kontrollieren den ersten Block

Featured Projects verwenden den ersten Content-Block als fachlichen Textblock:

- `Description` entspricht `contentBlocks[0].intro`.
- `FullText` entspricht `contentBlocks[0].body`.

Beim Update werden `title`, `intro` und `body` des ersten Blocks fachlich gesetzt, vorhandene weitere schreibbare Eigenschaften des ersten Blocks erhalten und alle weiteren Blocks als gültige `ContentBlockInput`-Werte übernommen. Nur lesbare IDs und Zeitstempel werden nicht zurückgesendet. Sind Beschreibung und Volltext leer und existiert kein erhaltenswerter erster Block, wird kein leerer Platzhalterblock erzeugt.

### News-Text besitzt keinen Payload-Fallback

News-Einleitung und -Inhalt werden aus `contentBlocks[].intro/body` gelesen und dorthin geschrieben. `payload` bleibt auf eigenständige Metadaten wie Kategorie oder externe URL begrenzt. Historische `payload.teaser`, `payload.body` und `payload.imageUrl` werden nicht zur Erzeugung eines Content-Blocks verwendet. Im Editor heißt das Feld entsprechend „Einleitung“ beziehungsweise `contentIntro`.

### Schlanke Fachplugins behalten ihren Body-Vertrag

FAQ und Cockpit Cards besitzen keine separate Einleitung. Ihre vorhandenen Body-Abbildungen bleiben unverändert. Sie dürfen weder Top-Level-Teaser lesen noch `intro` automatisch aus `body` ableiten.

## Alternativen

- Interner `teaser`-Alias auf `contentBlocks[0].intro`: verworfen, weil er die falsche Top-Level-Abstraktion konserviert und Blocksemantik verdeckt.
- Erweiterung des Mainservers um ein Top-Level-Mutationsargument: verworfen, weil die bestehende `ContentBlockInput.intro`-Funktion die Anforderung bereits erfüllt und keine externe Schemaänderung benötigt.
- Legacy-Fallback beim Lesen: ausdrücklich verworfen; Altwerte werden nicht übernommen.

## Risiken / Abwägungen

- Historische Werte ausschließlich in `GenericItem.teaser` oder in News-`payload.teaser/body` erscheinen nach der Umstellung nicht mehr im Studio. Das ist die ausdrücklich gewählte No-Fallback-Semantik.
- Featured-Project-Updates dürfen zusätzliche Blocks nicht verlieren. Mappertests sichern den Read-Merge-Write-Vertrag ab.
- Das eingecheckte Schema enthält historisch noch lesbare beziehungsweise verschachtelte Teaser-Felder. Statische Vertragstests müssen verhindern, dass sie wieder in den Root-GenericItem-Pfad gelangen.

## Migrationsplan

1. Vertragstests für die Abwesenheit von Root-`teaser` und die Intro-Abbildungen rot ergänzen.
2. Gemeinsame Typen, GraphQL-Dokumente, Mapper und Eingabeparser umstellen.
3. GenericItem-Editor und Featured-Projects-Adapter migrieren.
4. News-Editor, Mapper und IAM-Payload-Vertrag auf Content-Blocks ohne Fallback umstellen.
5. FAQ- und Kachelverträge auf unveränderte Body-Semantik regressionsprüfen.
6. Unit-, Type-, Server-Runtime-, Coverage- und PR-Gates ausführen.

## Offene Fragen

Keine. Der Verzicht auf Legacy-Fallback wurde ausdrücklich festgelegt.
