## ADDED Requirements

### Requirement: FAQ ist ein abgegrenzter GenericItem-Fachinhalt

Das System MUST FAQ als namespaceten Content-Type `faq.faq` und als eigenständige redaktionelle Fachfläche bereitstellen. FAQ-Datensätze MUST im Mainserver als GenericItem mit `genericType` gleich `FAQ` gespeichert und in der gemeinsamen Inhaltsübersicht ausschließlich als `faq.faq` dargestellt werden. Das FAQ-Plugin MUST dem etablierten Standard-Content-Plugin-Muster folgen: Es registriert eine FAQ-Admin-Ressource mit spezialisierten `list`-, `detail`- und `editor`-Bindings sowie FAQ-CRUD-Pfaden; der Host blendet deren eigene Navigation zugunsten der gemeinsamen Inhaltsübersicht aus.

#### Scenario: FAQ wird als Fachinhalt angelegt

- **WHEN** ein Benutzer mit `faq.create` eine FAQ anlegt
- **THEN** stellt das System ausschließlich die fachlich erlaubten FAQ-Felder bereit
- **AND** persistiert den Datensatz als GenericItem mit `genericType` gleich `FAQ`
- **AND** zeigt ihn in der Inhaltsübersicht als `faq.faq`

#### Scenario: FAQ wird aus der Inhaltsübersicht im Facheditor geöffnet

- **GIVEN** ein Benutzer darf `faq.read` ausführen
- **WHEN** er eine FAQ in der Inhaltsübersicht auswählt oder dort eine FAQ anlegt
- **THEN** navigiert der Host über den registrierten FAQ-Detail- oder Editor-Pfad zu dessen spezialisiertem Binding
- **AND** bleibt die FAQ in der gemeinsamen Inhaltsübersicht auffindbar
- **AND** bleiben Routing, Guards, Autorisierung, globale Aktionen und History hostgeführt

#### Scenario: FAQ-Navigation wird zugunsten der Inhaltsübersicht ausgeblendet

- **WHEN** der Host die FAQ-Admin-Ressource und ihre Navigation registriert
- **THEN** blendet er die direkte FAQ-Navigation in der Hauptnavigation aus
- **AND** bleibt die FAQ über die gemeinsame Inhaltsübersicht als `faq.faq` erreichbar

#### Scenario: FAQ wird nicht als offenes GenericItem doppelt angezeigt

- **GIVEN** ein GenericItem mit `genericType` gleich `FAQ`
- **WHEN** die Inhaltsprojektion oder die offene GenericItem-Liste aktualisiert wird
- **THEN** klassifiziert das System den Datensatz als `faq.faq`
- **AND** zeigt ihn nicht zusätzlich als `generic-items.generic-item` an

### Requirement: FAQ-Fachmodell ist auf Frage, Antwort, Sprache und Publikationsmetadaten begrenzt

Das System MUST für FAQ ausschließlich Frage, Nur-Text-Antwort, Sprachcode, Sortiergewichtung, Sichtbarkeit und Veröffentlichungszeitpunkt bearbeiten. Frage, Antwort und Sprachcode MUST Pflichtfelder sein. Der Sprachcode MUST ein normalisierter BCP-47-Tag sein. Andere GenericItem-Eingabefelder, insbesondere Medien, Kategorien, Kontakte, Orte und freie Payload-Bearbeitung, MUST in der FAQ-Oberfläche nicht verfügbar sein.

#### Scenario: Gültige FAQ wird gespeichert

- **WHEN** ein Benutzer eine nichtleere Frage, eine nichtleere Nur-Text-Antwort und einen gültigen Sprachcode mit gültigen Publikationsmetadaten speichert
- **THEN** speichert das System die Frage in `title`, die Antwort als alleinigen Eintrag in `contentBlocks: [{ body: answer }]`, den Sprachcode in `payload.languageCode` und die Metadaten in ihren kanonischen GenericItem-Feldern

#### Scenario: HTML in der Antwort wird abgewiesen

- **WHEN** ein Benutzer eine Antwort mit HTML-Markup speichert
- **THEN** weist das System die Speicherung mit einer feldbezogenen Validierungsmeldung ab
- **AND** verändert keinen bestehenden Datensatz

#### Scenario: Sprachfassungen werden als eigene FAQ gespeichert

- **GIVEN** eine gespeicherte FAQ mit Sprachcode `de`
- **WHEN** ein Benutzer dieselbe Frage und Antwort mit Sprachcode `en` anlegt
- **THEN** speichert das System einen weiteren eigenständigen FAQ-Datensatz
- **AND** meldet keinen Duplikatkonflikt allein wegen gleicher Frage

#### Scenario: Unvollständige FAQ wird abgewiesen

- **WHEN** eine Frage oder Antwort leer ist
- **THEN** weist das System die Speicherung mit einer feldbezogenen Validierungsmeldung ab
- **AND** verändert keinen bestehenden Datensatz

### Requirement: FAQ-Sortierung ist deterministisch steuerbar

Das System MUST im FAQ-Payload die kontrollierten Schlüssel `languageCode` und `sortWeight` führen. Fehlende historische Sprachcodes MUST als `und`, fehlende Sortiergewichte MUST als `0` behandelt werden. Beim Update MUST das System unbekannte bestehende Payload-Schlüssel erhalten und ausschließlich die kontrollierten FAQ-Schlüssel überschreiben. Die FAQ-Fachliste MUST nach Sprachcode, aufsteigendem Sortiergewicht, Frage mit der Locale des Sprachcodes und schließlich ID sortieren.

#### Scenario: Standardgewicht wird verwendet

- **GIVEN** eine FAQ ohne gespeichertes Sortiergewicht
- **WHEN** das System die FAQ liest oder in der Liste einsortiert
- **THEN** verwendet es das Sortiergewicht `0`

#### Scenario: Historischer Payload bleibt außerhalb des FAQ-Vertrags erhalten

- **GIVEN** eine FAQ mit dem Payload `{ "legacy": true, "sortWeight": 1 }`
- **WHEN** ein Benutzer die FAQ mit Sprachcode `de` und Sortiergewicht `2` speichert
- **THEN** persistiert das System `{ "legacy": true, "languageCode": "de", "sortWeight": 2 }`

#### Scenario: Negative und positive Gewichte steuern die Reihenfolge

- **GIVEN** FAQ mit den Sortiergewichten `-1`, `0` und `1`
- **WHEN** die Fachliste gerendert wird
- **THEN** steht die FAQ mit `-1` vor der FAQ mit `0`
- **AND** steht die FAQ mit `1` nach der FAQ mit `0`

#### Scenario: Gleichrangige FAQ bleiben stabil sortiert

- **GIVEN** zwei FAQ mit gleichem Sprachcode, gleichem Sortiergewicht und identischer Frage
- **WHEN** die Fachliste gerendert wird
- **THEN** ordnet das System sie aufsteigend nach ihrer ID
