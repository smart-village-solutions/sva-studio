## Kontext

Der Mainserver bietet für diese Inhaltsfamilie ausschließlich `GenericItem` an. FAQ ist dennoch ein eigenständiger redaktioneller Fachbereich und darf nicht die offene, umfangreiche Eingabefläche für freie GenericItems übernehmen.

## Ziele und Nicht-Ziele

- Ziele: schlanker Editor, eindeutige Datenklassifikation, feste Validierung, getrennte Berechtigungen, mehrsprachige FAQ-Fassungen und eine deterministische redaktionelle Reihenfolge.
- Nicht-Ziele: eine generische Form-Engine, Payload-Freitext, Rich-Text oder eine Änderung der öffentlichen Ausspielung.

## Entscheidungen

### Eigenständiges Fachplugin

`@sva/plugin-faq` folgt dem Paketmuster der bestehenden Fachplugins. Die UI und Fachvalidierung bleiben pluginlokal; Transport, Authentisierung, Autorisierung, Audit und Projektion bleiben hostgeführt.

Das Plugin folgt dem aktuellen Standard-Content-Plugin-Muster von News und Events: Es registriert eine FAQ-Admin-Ressource mit spezialisierten `list`-, `detail`- und `editor`-Bindings sowie die zugehörigen FAQ-CRUD-Pfade. Der Host blendet deren eigene Navigation zugunsten der gemeinsamen Inhaltsübersicht aus. Die Fachflächen bleiben damit über die normale Inhaltsübersicht erreichbar, während die detaillierte Bearbeitung über die spezialisierte FAQ-Route erfolgt. Eine Vereinheitlichung auf ausschließlich kanonische Content-Routen ist ein späteres, gemeinsames Plattform-Refactoring und nicht Teil dieses Changes.

### Kanonische Abbildung

| Fachfeld | GenericItem-Feld |
| --- | --- |
| Frage | `title` |
| Antwort | `contentBlocks[0].body` |
| Sprachcode | `payload.languageCode` |
| Sortiergewichtung | `payload.sortWeight` |
| Sichtbarkeit | `visible` |
| Veröffentlichungszeitpunkt | `publicationDate` |

Die Frage, die Antwort und der Sprachcode sind Pflichtfelder. Der Sprachcode ist ein normalisierter, nicht leerer BCP-47-Tag (zum Beispiel `de`, `en`, `de-DE` oder `en-GB`). Jede Übersetzung ist ein eigenständiger Datensatz; es gibt keine gruppierende Übersetzungs-ID und keine Eindeutigkeitsregel über Frage und Sprache.

Die Antwort ist reiner Text. Eingaben mit HTML-Markup werden mit einem feldbezogenen Fehler abgewiesen; sie werden weder bereinigt noch als Rich Text interpretiert. Beim Schreiben erzeugt oder ersetzt der Adapter `contentBlocks` vollständig durch genau einen Block `{ body: answer }`. Zusätzliche oder abweichende historische Blöcke werden beim Lesen nicht in die Fachoberfläche übernommen und beim nächsten Speichern entfernt.

`sortWeight` ist eine endliche ganze Zahl; ihr Standardwert ist `0`. Der FAQ-Adapter besitzt ausschließlich die Payload-Schlüssel `languageCode` und `sortWeight`. Beim Update liest er den bestehenden Payload, erhält unbekannte historische Schlüssel unverändert und überschreibt ausschließlich diese beiden FAQ-Schlüssel. Es gibt keine freie Payload-Bearbeitung.

### Typ- und Projektionsabgrenzung

Auf Mainserver-Ebene ist `genericType: "FAQ"` die alleinige Diskriminierung. Die Studio-Inhaltsprojektion ordnet solche Datensätze dem Fach-`contentType` `faq.faq` zu und ordnet andere GenericItems weiter `generic-items.generic-item` zu. Dadurch gibt es keine doppelten Einträge in der gemeinsamen Inhaltsübersicht und keine Bearbeitung eines FAQ über das offene Plugin.

### Listen, Sortierung und Pagination

Die Fachliste zeigt den Sprachcode und kann danach filtern. Ihre vollständige Sortierung lautet: `languageCode` in aufsteigender Codepoint-Reihenfolge, `sortWeight` aufsteigend, Frage mit `Intl.Collator(languageCode, { usage: 'sort', sensitivity: 'base', numeric: true })` und schließlich `id` in aufsteigender Codepoint-Reihenfolge. Damit ist auch bei identischen Fragen eine stabile Reihenfolge festgelegt. Das Gewicht unterstützt negative und positive Ausnahmen, ohne dass für den Normalfall Eingaben nötig sind.

Der Mainserver bietet aktuell keinen vertraglich garantierten `genericType`-Listenfilter. Der FAQ-Adapter ruft deshalb jede verfügbare Upstream-Seite ab, filtert ausschließlich `genericType === 'FAQ'`, sortiert die gesamte gefilterte Menge und wendet danach die vom Client angefragte Pagination an. `totalCount` und leere Seiten beziehen sich auf diese gefilterte Menge, nicht auf die GenericItem-Gesamtmenge. Ein künftiger serverseitiger Filter darf diese Strategie nur ersetzen, wenn er dieselben Filter-, Sortier- und Zählsemantiken garantiert.

### Editor-Workspace

Der Editor verwendet `StudioDetailPageTemplate` sowie die vorhandenen Tabs-Primitives und Detail-Panel-Konventionen der Standard-Content-Plugins. Die feste Tab-Reihenfolge lautet `Basis`, `Inhalt`, `Einstellungen`, `Historie`. Für neue FAQ fehlt der Tab `Historie`, da noch keine Inhalts-ID vorliegt. Frage und Sprachcode gehören nach `Basis`, die fachliche Nur-Text-Antwort ausschließlich nach `Inhalt` und Sichtbarkeit, Veröffentlichungszeitpunkt sowie Sortiergewicht nach `Einstellungen`.

Die Historie nutzt `fetchIamContentHistory` und die bestehenden SDK-/UI-Muster aus den anderen Content-Plugins. Sie lädt erst bei Tab-Besuch und behandelt Lade-, Fehler- und Leerzustände explizit. Speichern, Zurück-Navigation und Löschen werden als Kopfaktionen des Detail-Templates umgesetzt; die bestehende Formularvalidierung und API bleiben unverändert. Medien, Kategorien, Orte, Kontakte und weitere nicht zum FAQ-Fachmodell gehörende Bereiche werden nicht ergänzt.

## Risiken und Abwägungen

- Das vollständige Einlesen ohne Upstream-Typfilter kann bei großen GenericItem-Mengen teuer werden. Der Adapter muss dafür beobachtbare Seitenzahl, gelesene Datensatzanzahl und Laufzeit ohne Inhaltsdaten protokollieren; die korrekte fachliche Pagination hat Vorrang vor einer unvollständigen Seite.
- Bestehende `GenericItem`-Projektionen kennen derzeit nur `generic-items.generic-item`. Die Änderung erfordert atomische Anpassungen von Registry, IAM, Projektion und Delete-/Detail-Routing, damit FAQ nicht falsch klassifiziert oder doppelt angezeigt werden.
- Detail, Update und Delete müssen nach erfolgreicher Autorisierung zunächst das GenericItem laden und `genericType === 'FAQ'` verifizieren. Für eine Fremdtyp-ID liefern sie dieselbe Nichtgefunden-Klassifikation wie für eine unbekannte ID und rufen keine mutierende Mainserver-Operation auf.
- Der zusätzliche Workspace-Tab erhöht die Navigation bei einem kleinen Fachmodell. Der Gewinn an konsistenter Orientierung und der unmittelbare Zugang zur Historie überwiegt dies.

## Teststrategie

- Unit-Tests für Einlesen, Schreiben, Defaults und Validierung von `languageCode`/`sortWeight`, die Pflichtfelder Frage/Antwort sowie die HTML-Ablehnung.
- Komponenten-Tests für die Tab-Reihenfolge, Feldzuordnung, mobile Tab-Auswahl, Kopfaktionen, die Ausblendung der Historie beim Anlegen sowie Feldfehler.
- Tests für den Historie-Tab prüfen Laden, Fehler, leeren Verlauf und gerenderte Einträge.
- Host-Tests für Berechtigungen, vollständiges Paging mit fremden GenericItems zwischen FAQ, `genericType`-Filter, Projektionsklassifikation, Fremdtyp-Detail-/Delete-Pfade und die Vermeidung doppelter Inhaltseinträge.
- Tests für die Erhaltung unbekannter Payload-Schlüssel, das Ersetzen mehrerer historischer Content-Blöcke sowie die vollständige Sortierung einschließlich gleicher Fragen.
- Ein Integrations- oder E2E-Test für Anlegen, Bearbeiten und Löschen einer FAQ in mindestens zwei unterschiedlichen Sprachen.
- Die vollständige Upstream-Pagination, Filterung, Sortierung und lokale Seiteneinteilung wird in kleine, isoliert testbare Funktionen aufgeteilt; Netzwerk-, Autorisierungs- und Fachlogik werden nicht in einer Route oder Fassade vermischt.
- Die neuen produktiven Dateien müssen die geltenden Coverage-Floors und das `pnpm complexity-gate` erfüllen. Eine neu verursachte Komplexitätsüberschreitung ist vor Merge entweder durch Refactoring zu beseitigen oder mit einem dokumentierten Refactoring-Ticket gemäß `tooling/quality/complexity-policy.json` zu referenzieren.
- Der PR-Nachweis umfasst `pnpm test:pr` sowie die Bewertung der externen Sonar- und Codecov-Checks. Rote externe Checks oder genehmigte Ausnahmen werden mit Ursache, Risiko und Folgemaßnahme im PR dokumentiert.
