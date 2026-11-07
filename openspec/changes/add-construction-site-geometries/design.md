# Technischer Entwurf

## 1. Ausgangslage und belegte Grenzen

Untersuchungsstand: 07.11.2026, Studio-HEAD `32556e7e150983c4f71e7115cc97451a4f5e336f`, einschließlich der bereits vorhandenen lokalen Tabellenänderungen. Die folgenden Feststellungen beruhen auf lokalen Quellständen, nicht auf einer Prüfung produktiver Systeme.

**Aktuelle Nutzerfestlegung:** Das alte CMS wird nicht mehr für Baustellen verwendet. Die zuvor untersuchte Mainserver-Erweiterung zum Legacy-Erhalt entfällt aus der Lösung. Das Studio verwendet den bestehenden Mainserver unverändert und übernimmt Geometrie-Erhalt sowie Schlüsselentfernung innerhalb seines vollständigen Mutation-Payloads. Abschnitt 10 dokumentiert nur den nicht weiterverfolgten lokalen Versuch.

| Befund                                                                                                                                                        | Zuständiger bestehender Pfad                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formular und serverseitiger Vertrag kennen nur einzelne Standortkoordinaten.                                                                                  | `packages/plugin-construction-sites/src/contract.ts`, `packages/sva-mainserver/src/server/construction-sites-contract.ts`                                             |
| MapLibre 6.9.0 ist vorhanden; das Baustellenmodul nutzt den gemeinsamen, auf Punktmarkierungen begrenzten Karten-Hook.                                        | `packages/plugin-construction-sites/src/construction-sites.map.tsx`, `packages/studio-ui-react/src/studio-location-map.ts`                                            |
| Unbekannte Payload-Felder werden beim Studio-Schreiben bereits aus dem vollständigen Snapshot übernommen.                                                     | `packages/sva-mainserver/src/server/construction-sites-snapshot.ts`                                                                                                   |
| Detail und Liste laden derzeit dieselbe vollständige GraphQL-Projektion einschließlich Payload. Die Liste scannt die Kandidaten vor Filterung und Pagination. | `packages/sva-mainserver/src/generated/construction-sites.ts`, `src/server/service-internals/service-construction-sites.ts`, `src/server/construction-sites-route.ts` |
| Draft, Dirty-Prüfung, Navigationsschutz, Mutationsidentität und Konfliktbehandlung existieren bereits.                                                        | `packages/plugin-construction-sites/src/construction-sites.editor-state.ts`                                                                                           |

Zusätzlich lesend geprüfte Nachbar-Repositories unter `/Users/wilimzig/Documents/Projects/SVA/`:

- Mainserver `smart-village-app-mainserver`, HEAD `37f86dce`: `app/graphql/mutations/create_generic_item.rb` akzeptiert `payload` als JSON; `app/models/data_resources/generic_item.rb` verwendet ein serialisiertes Payload; `db/schema.rb` definiert dafür MySQL `text`. `app/services/resource_service.rb`, insbesondere `update_resource`, ersetzt mit `@old_resource.update(@params)` das übergebene Payload vollständig.
- Altes CMS `smart-village-app-cms`, HEAD `336a5d4`: `app/views/constructions/_form.html.erb` und `app/controllers/constructions_controller.rb` senden die bekannten Felder Richtung, Grund und Einschränkungen. Eine Übernahme unbekannter Payload-Schlüssel ist dort nicht erkennbar.
- Mobile App, lokaler Checkout HEAD `3e4e7711`: `src/queries/constructionSite.js` lädt das Payload bereits, `src/helpers/parser/constructionSiteParser.ts` nutzt für den Standort den ersten Punkt. Neue Formen werden dadurch nicht automatisch sichtbar. Die App ist ausdrücklich außerhalb dieses Vorhabens.

Die Suche im verfügbaren Referenzindex lieferte keinen passenden bestehenden Zeicheneditor; sein Studio-Indexstand lag hinter dem untersuchten HEAD. Daher ist der aktuelle zuständige Projektpfad die Grundlage, keine Übernahme fremder Referenzimplementierungen.

## 2. Gewählte Lösung

**Ein Karteneditor im bestehenden Baustellenformular, ein Formular-Draft, ein Payload im Mainserver.** MapLibre bleibt die Kartenbasis. Terra Draw übernimmt Zeichnen, Auswahl und Bearbeitung von Linien und Polygonen. Der Studio-Adapter übersetzt zwischen dem Bibliothekszustand und dem fachlichen GeoJSON-Vertrag.

Geprüfte Kandidaten zum Untersuchungszeitpunkt: `terra-draw` 1.39.0 und `terra-draw-maplibre-gl-adapter` 1.5.0, beide MIT. Der Adapter deklariert MapLibre ab Version 4 als Peer-Abhängigkeit; die konkrete Kombination mit dem im Plugin gepinnten MapLibre 6.9.0 benötigt vor dem grafischen Abschluss einen Browsernachweis. Exakte Versionen werden bei Umsetzung im bestehenden Package und Lockfile festgehalten.

Kein zusätzlicher Toolbar-Wrapper: Auswahl, Strecken-/Flächenwerkzeug, Rückgängig/Wiederholen und Löschen werden mit vorhandenen Studio-Komponenten umgesetzt. Terra Draw bleibt die einzige neue Bibliotheksfamilie für die nichttriviale Zeichengeometrie. Seine Feature-Eigenschaften wie `mode` gehören ausschließlich zum Editor und werden nicht persistiert.

Alternativen:

- Eigener Zeicheneditor würde Auswahl, Eckpunkte, Historie und Geometrieprüfung neu implementieren; dafür besteht kein Vorteil gegenüber der etablierten Bibliothek.
- Standortrelationen bilden Punkte, aber keine eindeutig typisierten Linien oder geschlossenen Flächen ab. Eine Umdeutung würde bestehende Verbraucher beschädigen.
- Eine Studio-Datenbank als Geometrie-Sidecar erzeugte eine zweite Quelle samt Zuordnung, Berechtigungen und Synchronisation. Der vorhandene GenericItem-Payload erfüllt den Speicherbedarf bereits.
- Ein Legacy-Erhalt im Mainserver wurde lokal erprobt. Nach der anschließenden Nutzerfestlegung ist das alte CMS kein Baustellen-Editor mehr; die Zusatzänderung wird deshalb nicht geliefert. Die bestehende Payload-Ersetzung genügt dem vollständigen Studio-Schreibpfad.

## 3. Datenvertrag

Reservierter Schlüssel: `payload.constructionSiteGeometry`. Inhalt ist eine GeoJSON-FeatureCollection mit dem zusätzlichen Versionsfeld `version`. Koordinaten folgen RFC 7946: WGS84-Dezimalgrade in der Reihenfolge **Längengrad, Breitengrad**.

```json
{
  "version": 1,
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "8b51428e-832b-49ea-a9f7-537608e344e1",
      "properties": {},
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [13.4, 52.5],
          [13.401, 52.501]
        ]
      }
    },
    {
      "type": "Feature",
      "id": "bd220cea-58b3-43ad-a477-8322aa2fa908",
      "properties": {},
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [13.4, 52.5],
            [13.402, 52.5],
            [13.401, 52.502],
            [13.4, 52.5]
          ]
        ]
      }
    }
  ]
}
```

Linien und Flächen dürfen gemeinsam vorkommen. IDs sind innerhalb des Dokuments eindeutige, stabile UUIDv4-IDs (entsprechend der ID-Strategie des Editors). Eigenschaften bleiben in Version 1 leer; weder Zeichenmodi, Farben, Kartenkamera noch Undo-Verlauf werden gespeichert. Alle Formen teilen Zeitraum und Einschränkungen der Baustelle. Ein Standortpunkt bleibt unabhängig; es erfolgt keine automatische Ersetzung durch Schwerpunkt oder ersten Streckenpunkt.

Die bestehenden Studio-Input-Verträge erhalten `geometry?: ConstructionSiteGeometryV1 | null` als fachliches Feld. Der Typ beschreibt die oben gezeigte **FeatureCollection**; GeoJSON-`GeometryCollection` ist nicht Teil des Vertrags.

| Input / Payload-Schlüssel                                         | Schreibwirkung                                                                                  |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Studio-Input `geometry` fehlt                                     | Aktuell gespeicherte Geometrie erhalten; Abwärtskompatibilität zu älteren Studio-Clients.       |
| `geometry` enthält ein gültiges Objekt                            | Geometrie vollständig durch dieses Objekt ersetzen.                                             |
| `geometry: null`                                                  | Nur den reservierten Payload-Schlüssel entfernen.                                               |
| Vollständiges Mutation-Payload enthält den reservierten Schlüssel | Vorhandene Mainserver-Payload-Ersetzung speichert die mitgelieferte Geometrie.                  |
| Vollständiges Mutation-Payload enthält den Schlüssel nicht        | Vorhandene Mainserver-Payload-Ersetzung entfernt den Schlüssel; keine neue Löschsemantik nötig. |

Ein leeres `features`-Array wird im Studio beim ausdrücklichen Löschen der letzten Form in `geometry: null` überführt. Ein fehlendes Feld darf niemals durch einen Default zu einem Löschauftrag werden.

`null` gehört ausschließlich zum Studio-Input. Der Adapter entfernt bei diesem Auftrag den Schlüssel aus dem vollständigen Payload vor der Mutation und sendet keinen reservierten `null`-Wert an den Mainserver.

### Validierung und Größenbudget

Browser und Studio-Server prüfen unabhängig dieselben Regeln. Keine ausschließlich clientseitige Vertrauensentscheidung und kein neues gemeinsames Package nur für diese Schemata. Identische Vertrags-Fixtures sichern die vorhandenen getrennten Verträge ab.

- Ausschließlich zweidimensionale, endliche Zahlen; Längengrad −180 bis 180, Breitengrad −90 bis 90.
- LineString: mindestens zwei unterschiedliche Punkte. Polygon: genau ein geschlossener Außenring mit mindestens drei unterschiedlichen Eckpunkten; keine Löcher und keine Selbstüberschneidung, keine Fläche null. Sich kreuzende Linien sind erlaubt.
- Normalisierung auf sechs Nachkommastellen wie bei vorhandenen Standortkoordinaten, danach erneut validieren; keine stillschweigende Vereinfachung. Polygon-Außenringe werden gegen den Uhrzeigersinn kanonisiert.
- Keine aufeinanderfolgenden identischen Positionen, außer der erforderlichen Ring-Schließung. Stable Feature-IDs und Reihenfolge bleiben bei normaler Bearbeitung erhalten.
- Anfangs maximal zehn Features, 500 Positionen je Feature und 1.000 Positionen insgesamt, einschließlich Ring-Schließung. Dies sind bewusst gesetzte Produktgrenzen, keine Grenzen des GeoJSON-Standards.
- Serialisierte Geometrie maximal 48 KiB UTF-8. Das vollständig zusammengeführte Payload einschließlich bestehender Felder und Operationsmetadaten darf beim Hinzufügen/Ändern der Geometrie 60 KiB nicht überschreiten. Dies hält Abstand zum im lokalen MySQL-Schema erkennbaren TEXT-Limit von 65.535 Byte; tatsächliche Zieldatenbank und Serialisierung sind vor Freischaltung zu prüfen. Bestehende Datensätze ohne Geometrie erhalten durch diese Erweiterung keine neue pauschale Bearbeitungssperre.
- Grenzverletzungen werden vor dem Write mit Feldfehler und de/en-Übersetzung angezeigt. Unbekannte Versionen oder unlesbare gespeicherte Geometrien werden nicht in eine leere Geometrie umgewandelt: der vorhandene `writeBlockedReason` schützt den Datensatz vor einem reduzierenden Write.

Für die Polygonprüfung wird zuerst der reine Terra-Draw-Validator `ValidateNotSelfIntersecting` auch im Server-Runtime-Kontext geprüft. Besteht er dessen Laufzeit-/Import-Gates nicht, wird die Abweichung vor Umsetzung entschieden; keine improvisierte zweite Geometrie-Engine. Die weiteren begrenzten Struktur- und Zahlenprüfungen gehören in die vorhandenen Zod-Verträge.

## 4. Schreibpfad, Grenzen und Datenintegrität

### Studio

Der vorhandene Weg bleibt maßgeblich: Formular-Draft → authentifizierte Baustellenroute → frischer vollständiger Detail-Snapshot → Fingerprint-Prüfung → Payload-Merge → bestehende GenericItem-Mutation → unabhängiger Readback → bestehende Nachverarbeitung/Historie.

Geometrien werden Bestandteil von Draft, Dirty-Prüfung, Revision, Request-Hash und Readback. Zeichnen speichert nicht unmittelbar auf dem Server. Bei Konflikt, unklarem Write-Ausgang oder fehlendem Recht gelten dieselben Sperr- und Recovery-Regeln wie für andere Baustellenfelder. Keine Koordinaten oder Payloads in Logs.

`construction-sites-snapshot.ts` erhält Mapping und Merge im vorhandenen Pfad. Die Readback-Prüfung muss **exakte Geometriegleichheit beziehungsweise das tatsächliche Fehlen des Schlüssels nach Löschung** nachweisen. Der derzeit verwendete allgemeine Teilmengenvergleich `voucherWriteMatches` allein beweist eine Löschung nicht, weil zusätzliche Schlüssel im gelesenen Objekt akzeptiert werden.

### Unveränderter Mainserver

Der Mainserver behandelt das Payload weiterhin als JSON und ersetzt es im bestehenden GenericItem-Schreibpfad vollständig. Deshalb baut der Studio-Adapter immer den vollständigen Payload-Stand aus dem aktuellen Detail-Snapshot auf. Ausgelassene Studio-Geometrie bleibt darin enthalten; bei explizitem `geometry: null` entfernt der Adapter ausschließlich den reservierten Schlüssel. Sonstige Felder und Standortrelationen bleiben erhalten.

Geometrievalidierung erfolgt unabhängig im Browser und Studio-Server. Eine zusätzliche Geometrievalidierung, reservierte Löschsemantik oder Datenbanksperre im externen Mainserver gehört nicht zu dieser Lieferung. Der lokale Mainserver-Versuch aus Abschnitt 10 bleibt unveröffentlicht und wird nicht vorausgesetzt.

Nachweis vor Freischaltung: Geometrie im Studio anlegen, bearbeiten und vollständig löschen, jeweils über den unveränderten Mainserver schreiben und unabhängig zurücklesen. Das alte CMS ist nach Nutzerfestlegung außerhalb dieses Schreibwegs. Für zusätzliche direkte Schreiber entsteht kein neuer Merge- oder Konfliktvertrag; die bestehenden Studio-Fingerprint-, Lock- und Recovery-Regeln bleiben maßgeblich.

### Listenprojektion

Die Listenabfrage darf weder Geometrie-Payload noch andere ausschließlich für den Editor nötige Vollfelder übertragen. Im bestehenden GraphQL-Dokument wird eine eigene kleine Auswahl für ID, Typ, Titel, Sichtbarkeit, Aktualisierung, Provider, Standorte, Datumsangaben und Kategorien verwendet. Ein passender `ConstructionSiteListItem` und Listenmapper ersetzen im vorhandenen Listenpfad den Detailtyp.

Suche, Kategorien-/Zeitraumfilter, Provider-basierter Zugriff, Sortierung und Pagination bleiben fachlich erhalten. Detail-, Prewrite- und Recovery-Reads bleiben vollständig. Keine Geometrie-Anzeige in Tabellenzellen und kein zusätzlicher Backend-Index nur für diese Erweiterung.

## 5. Karteneditor und Bedienvertrag für Figma

Der bestehende `ConstructionSiteMap` übernimmt lokal den Zugriff auf die echte MapLibre-Instanz für den Adapter. Der punktbezogene gemeinsame Hook bietet diesen Zugriff derzeit nicht. Für diesen einen Verbraucher wird keine allgemeine Kartenplattform eingeführt; die bisherige Nutzung des Punkt-Hooks im Baustelleneditor wird im selben Abschnitt ersetzt. Host-Konfiguration, Style-URL, Kill-Switch und Lazy Loading bleiben maßgeblich, andere Fachmodule unverändert.

- Eine gemeinsame Karte zeigt vorhandenen Standort sowie alle Linien und Flächen. Die Werkzeuggruppe enthält Standort, Strecke, Fläche und Auswahl. Standortbearbeitung bleibt eindeutig auf den gewählten bestehenden Standort bezogen; zusätzliche Legacy-Standorte werden erhalten.
- Nur ein aktives Werkzeug. Ein Klick zum Zeichnen einer Strecke darf keinen Standort verschieben. Auswahl erlaubt Eckpunkte verschieben/einfügen/löschen sowie eine ganze Form löschen. Löschung wird im lokalen Draft sichtbar und bleibt bis zum Speichern rückgängig machbar.
- Temporäre Zeichenpunkte bleiben im Editor, bis eine gültige Form abgeschlossen ist. Eine unfertige Form blockiert Speichern mit verständlicher Meldung; Abbrechen verwirft nur diese unfertige Form. Fertige Änderungen gelangen in den gemeinsamen Formular-Draft. Terra Draw wird gezielt für Undo/Redo konfiguriert; die Historie ist nicht automatisch aktiv.
- Eine geordnete Koordinatenliste pro Form erlaubt Hinzufügen, Entfernen und Umordnen über Tastatur und beschriftete Buttons. Der doppelte Schließpunkt eines Polygons wird automatisch geführt. Mausbedienung der Karte ist keine Voraussetzung; ein JSON-Textfeld allein ist keine ausreichende Alternative.
- Kartenfehler oder deaktivierte Kartendienste lassen gespeicherte Formen und Koordinaten erhalten. Die Koordinatenbearbeitung bleibt nutzbar. Read-only zeigt Geometrie ohne Mutationshandler. Nach Scope-Wechsel oder Unmount werden Adapter, Karte und Event-Listener abgeräumt.
- Beschriftungen, Fehler, Werkzeugzustände und Statusmeldungen über de/en-`t(...)`; sichtbarer Fokus, programmatische Labels und ausreichend große Ziele. Die überarbeitete Tabellen-Toolbar bleibt ein eigenständiges Layoutmuster.

Die grafische Ausarbeitung benötigt damit konkret: leeren Zustand, vorhandene Linie/Fläche, aktives Zeichnen, Auswahl mit Eckpunkten, Koordinatenalternative, Validierungsfehler, Read-only, Kartenfehler und schmale Ansicht. Sie folgt nach dem technischen Prototyp-Nachweis aus Abschnitt 7; die Produktivimplementierung muss dafür noch nicht vollständig fertig sein.

## 6. Kritische Invarianten und geplanter Nachweis

| Invariante / Fehlerfall                                                           | Nachweis im zuständigen bestehenden Testpfad                                                                                                                      |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bestehende Punkte, Relationen und unbekannte Payload-Felder gehen nicht verloren. | Snapshot-Fixtures mit gemischtem Legacy-Datensatz, Geometrie hinzufügen/ändern/löschen und Vergleich aller unberührten Gruppen.                                   |
| Omission, Objekt und `null` sind eindeutig; Delete wird wirklich verifiziert.     | Contract-/Service-Tests einschließlich Readback mit unerwartet verbliebenem Schlüssel → kein bestätigter Erfolg.                                                  |
| Fehlerhafte Geometrien gelangen nicht über die Studio-API in den Speicher.        | Unabhängige Client-/Studio-Server-Vertragsfälle für NaN/Infinity, ungültige Grenzen, degenerierte Ringe, Selbstschnitt, Duplikate, Fremdversion und Größenlimits. |
| Konflikte und unklarer Write-Ausgang erzeugen keinen automatischen Zweit-Write.   | Erweiterung der bestehenden Service-/Route-Tests für Fingerprint, Hash, Operation-ID und Recovery.                                                                |
| Rechte und Instanzbindung gelten auch für Geometrien.                             | Bestehende Route-Tests: read-only, fehlendes Update-Recht, falsche Instanz; kein Upstream-Write.                                                                  |
| Übersicht lädt keine Geometrien; Filter/Zugriff/Pagination bleiben korrekt.       | Query-Selection-Test ohne Payload und Listen-/Route-Tests mit bisherigem Ergebnissatz.                                                                            |
| Karten- und Koordinatenbearbeitung ändern denselben Draft.                        | Editor-Unit-Tests plus gezielter Playwright-Roundtrip: erstellen, speichern, neu laden, Eckpunkt ändern, löschen.                                                 |
| Werkzeugwechsel, Tastatur, Kartenfehler und Unmount verlieren keine Daten.        | Gezielte Browserfälle mit realem gepinntem MapLibre/Adapter, einschließlich schmaler Ansicht und Tastaturfluss.                                                   |

Tests erweitern die vorhandenen Dateien unter `packages/plugin-construction-sites/tests/`, `packages/sva-mainserver/src/server/construction-sites-*.test.ts`, `service-internals/service-construction-sites.test.ts` und `apps/sva-studio-react/e2e/construction-sites.spec.ts`. Kleinste betroffene Unit-/Type-Gates unmittelbar nach Änderungen; für den serverseitigen Abschnitt früh `pnpm check:server-runtime`. Nx-Targets vor dem Aufruf feststellen; Dateifilter über `--testFiles=...`. Breite Abschlusschecks richten sich nach den Entwicklungsregeln, nicht nach einer neuen CI-Schicht.

## 7. Lieferreihenfolge und Freigabe der grafischen Arbeit

1. **Technische Absicherung nach Planfreigabe:** Browser-Prototyp innerhalb des bestehenden Kartenpfads mit gepinnten Dependencies; Linie/Polygon zeichnen, editieren, laden und serialisieren; pure Studio-Server-Validierung und Source-to-Draft-Mapping prüfen. Den vollständigen Studio-Write einschließlich Schlüsselentfernung gegen die unveränderte Mainserver-Ersetzungssemantik nachweisen. Keine neue Prototyp-App; nutzbaren Code anschließend in denselben Pfad übernehmen, temporäre Teile entfernen.
2. **Figma vervollständigen:** Sobald Format, Editierfähigkeiten, Fehler-/Fallback-Zustände und der Studio-Roundtrip aus Schritt 1 nachgewiesen sind, die Zustände aus Abschnitt 5 grafisch ausarbeiten. Dann ist klar, welche Bedienelemente technisch belastbar sind.
3. **Persistenz liefern:** Studio-Verträge, Snapshot-Merge, exakter Readback und kleine Listenprojektion ergänzen. Der Mainserver bleibt unverändert; ein gesonderter Mainserver-Release entfällt.
4. **Editor vervollständigen:** Karte, Koordinatenalternative, Undo/Redo, Formularintegration, Übersetzungen und Fehlerzustände gemäß abgestimmtem Figma ausarbeiten; keine parallele Speichermöglichkeit.
5. **Abnahme und Rollout:** Gezielte technische Tests, anschließende Dev-/Staging-Prüfung des vollständigen Studio-Roundtrips gegen den bestehenden Mainserver. Studio folgt ausschließlich `docs/guides/studio-rollout-process.md` (Build → Dev → Staging → Production, gleicher Digest). Dieses Dokument autorisiert keinen Rollout.

Rollback des Editors lässt die gespeicherten Daten stehen. Ältere Studio-Versionen können unbekannte Payload-Felder bewahren, zeigen und bearbeiten die Formen jedoch nicht. Eine Aktivierung allein aufgrund grüner Studio-Tests ist unzureichend; der vollständige Roundtrip muss gegen die bestehende Zielumgebung geprüft sein. Dafür ist keine neue Feature-Flag-Infrastruktur vorgesehen.

## 8. Noch ausstehende Nachweise, keine stillen Annahmen

- Browserverhalten der konkreten MapLibre-/Terra-Draw-Versionen, Undo/Redo und Server-Runtime-Verträglichkeit sind lokal nachgewiesen; siehe Abschnitt 9. Dokumentation und deklarierte Peer-Abhängigkeiten allein ersetzen diesen Test nicht.
- Der vollständige Studio-/GraphQL-Roundtrip und die Datenbanklimits müssen zusätzlich gegen den konkreten Zielstand geprüft werden. Der lokale Service-Nachweis verwendet die unveränderte Payload-Ersetzung. Abschnitt 10 ist ein historischer, nicht weiterverfolgter Versuch und keine Freischaltvoraussetzung.
- Die vorgeschlagenen Mengen- und Bytegrenzen werden mit repräsentativen kommunalen Strecken/Flächen geprüft. Eine notwendige Änderung wird im Vertrag und den Grenztests vorgenommen, nicht durch stilles Abschneiden.
- Nach Nutzerfestlegung wird das alte CMS nicht mehr für Baustellen verwendet; deshalb entfällt die Mainserver-Anpassung. Der bereits angelegte lokale Versuch bleibt ausschließlich in seinem eigenen Worktree. Keine Übernahme, kein Push, keine Veröffentlichung und kein Mainserver-Rollout.

## Quellen zu Bibliothek und Datenformat

- [Terra Draw und MIT-Lizenz](https://github.com/JamesLMilner/terra-draw), [Einstieg und Adapter](https://github.com/JamesLMilner/terra-draw/blob/main/guides/1.GETTING_STARTED.md), [Feature-Speicher](https://github.com/JamesLMilner/terra-draw/blob/main/guides/2.STORE.md), [Modi und Validierung](https://github.com/JamesLMilner/terra-draw/blob/main/guides/4.MODES.md).
- Geprüfte Paketmetadaten: [terra-draw 1.39.0](https://registry.npmjs.org/terra-draw/1.39.0), [MapLibre-Adapter 1.5.0](https://registry.npmjs.org/terra-draw-maplibre-gl-adapter/1.5.0).
- [RFC 7946: GeoJSON](https://datatracker.ietf.org/doc/html/rfc7946), insbesondere Koordinaten, LineString, Polygon und zusätzliche Mitglieder.
- [MySQL: String Type Syntax und TEXT-Grenzen](https://dev.mysql.com/doc/refman/8.4/en/string-type-syntax.html).

## 9. Technischer Nachweis im isolierten Worktree

Umsetzungsbeginn nach Nutzerfreigabe am 07.11.2026. Worktree `.worktrees/construction-site-geometries`, Branch `feature/construction-site-geometries`, Basis `origin/main` bei `b8521c2b4`. Die vorherigen Tabellenänderungen gehören nicht zu diesem Branch.

Nachgewiesen sind die unabhängigen Geometrieverträge einschließlich serverseitig ausgeführtem Terra-Draw-Polygonvalidator, Bestandserhalt im Snapshot-Merge, exakter Readback und die Unterscheidung zwischen Auslassen und Löschen. Der Service-Roundtrip verwendet eine kontrollierte GraphQL-Upstream-Fixture mit unveränderter Payload-Ersetzung; er ist kein Schreibtest gegen eine echte Mainserver-Datenbank. Nach der Nutzerfestlegung wurde der Studio-Adapter vereinfacht: `geometry: null` entfernt den Schlüssel direkt aus dem vollständigen Mutation-Payload. Ein verbliebener Schlüssel, auch mit dem Wert `null`, wird im Readback weiterhin nicht als erfolgreiche Löschung bestätigt. 28 gezielte Snapshot-/Service-Tests bestehen; die beiden geänderten Löschfälle scheiterten vor der Anpassung gezielt. Der bereits vorhandene Teilmengenvergleich wurde nur um den zuständigen Geometrievergleich ergänzt.

Der Browsernachweis verwendet echtes MapLibre 6.9.0 und den echten Terra-Draw-Adapter mit einem lokalen Kartenstil ohne externe Tiles. Er zeichnet Linie und Polygon, verschiebt einen Eckpunkt per Maus, prüft Undo/Redo, ändert Koordinaten, speichert über die bestehende Formular-API, öffnet den Datensatz erneut und entfernt eine Form. Die Studio-API wird dabei im Test kontrolliert beantwortet. Die Linien-/Flächendarstellung wurde am Canvas-Screenshot visuell geprüft. Ein fehlender MapLibre-Worker im Vite-Optimizer wurde durch einen expliziten `?worker&url`-Import und `setWorkerUrl` behoben; siehe [Vite-Worker](https://vite.dev/guide/assets.html#importing-script-as-a-worker) und [MapLibre setWorkerUrl](https://maplibre.org/maplibre-gl-js/docs/API/functions/setWorkerUrl/).

Vor der Mainserver-Freigabe wurde dessen tatsächliches `ResourceService#update_resource` unverändert lesend geladen und mit einer In-Memory-Modellfixture ausgeführt: Ein Update mit Legacy-Payload ohne reservierten Schlüssel entfernt die Geometrie. Nach dem gesonderten Auftrag folgten die lokale Korrektur und der Datenbanknachweis aus Abschnitt 10.

Der damalige Prototypstand wurde anschließend gemäß Abschnitt 12 finalisiert. Offen bleiben die Zielversionsprüfung, der vollständige API-Roundtrip in der Zielumgebung und die fachliche Abnahme. Der lokale Prototyp darf diese Voraussetzungen nicht als erfüllt ausgeben und wird noch nicht veröffentlicht oder ausgerollt.

### Lokale Prüfergebnisse des Prototyps

- 44 gezielte Plugin-Unit-Tests und 47 Baustellen-Adapter-/Route-/Service-Tests bestanden.
- Echter Chromium-/MapLibre-Lauf bestanden (ein fachlicher Roundtrip plus Auth-Fixture). Er umfasst auch Koordinaten-Undo/Redo nach erneutem Öffnen. Die beim bibliotheksinternen Entfernen/Wiedereinfügen veränderte Snapshot-Reihenfolge wird im Adapter auf die stabile Reihenfolge des Formulars zurückgeführt; unveränderte Formen erzeugen keine zusätzlichen Undo-Schritte.
- Typechecks beider betroffener Packages bestanden; Lint ohne Fehler, mit vorhandenen beziehungsweise neuen Hinweisen zu Nicht-Null-Zusicherungen in Tests und begrenzten Geometrieindizes. Keine Diagnostic-Console im ausgelieferten Prototypcode.
- `pnpm check:server-runtime` vollständig bestanden: 20 Projekte und deren Build-Voraussetzungen. Der erste parallele Versuch kollidierte beim Synchronisieren injizierter Build-Dateien; der anschließende sequenzielle Lauf war erfolgreich.
- `pnpm install --frozen-lockfile --offline`, strikte OpenSpec-Validierung, Dateiplatzierung und `git diff --check` bestanden. Lockfile-Diff auf 27 unmittelbar benötigte Ergänzungen begrenzt.
- Kein Push und kein Rollout. Die gesondert freigegebene lokale Mainserver-Korrektur und die anschließende Figma-Ausarbeitung sind in Abschnitten 10–11 dokumentiert.

## 10. Nicht weiterverfolgter lokaler Mainserver-Versuch

**Historischer Nachweis, keine aktuelle Voraussetzung:** Die folgenden Arbeiten entstanden vor der anschließenden Nutzerfestlegung, dass das alte CMS nicht mehr für Baustellen verwendet wird. Die Mainserver-Änderung wird nicht in die Lieferung übernommen. Der lokale Worktree bleibt unberührt liegen; der aktuelle Studio-Adapter setzt die dortige Sonderbehandlung nicht voraus.

Ausdrücklich freigegebener Umfang: ausschließlich lokal implementieren und testen. Worktree im Repository `smart-village-app-mainserver`: `.worktrees/construction-site-geometries`, Branch `feature/construction-site-geometry-preservation`, Basis `origin/master` bei `37f86dce`. Der ursprüngliche, bereits veränderte Checkout bleibt unberührt. Keine Credentials oder Umgebungsdateien werden übernommen. Geändert werden ausschließlich der bestehende `app/services/resource_service.rb` und dessen neue gezielte Tests in `spec/services/resource_service_geometry_spec.rb`.

Die lokale Schreibweginventur unter `app/` und `lib/` führt ConstructionSite-Schreibvorgänge über `app/graphql/mutations/create_generic_item.rb` zum ResourceService. Der gesonderte `GenericItem::Message`-Pfad betrifft keine Baustellen. Der im Import vorhandene weitere Payload-Write betrifft POI. Diese Quellinventur ist keine Garantie für unbekannte oder abweichend ausgelieferte Betreiberpfade.

Der ResourceService führt GenericItem-Updates unter `with_lock` aus. Die ActiveRecord-Zeilensperre lädt den Datensatz frisch; die Entscheidung anhand des gespeicherten Typs und das Übernehmen des vorhandenen Geometrieschlüssels erfolgen innerhalb derselben Transaktion wie die Relations- und Payload-Änderungen. Eine vom Aufrufer abweichend übergebene Typangabe kann den Bestandserhalt nicht umgehen. Nach Erwerb der Sperre werden Leseberechtigung und bei Extended-Usern die aktuelle Eigentümerschaft erneut geprüft. Andere Payload-Felder behalten ihre bisherige Ersetzungssemantik; es entsteht kein allgemeiner Merge-Vertrag.

Neue Geometrieobjekte werden auch an dieser Eingangsgrenze strukturell, geometrisch und nach den vereinbarten Grenzen validiert. Sechs-Dezimalstellen-Normalisierung entspricht einschließlich negativer Halbwerte dem JavaScript-Verhalten. Polygone erhalten die kanonische Orientierung; Selbstschnitt und kollabierte Punkte werden abgewiesen. Validierung und UTF-8-Budgetprüfung erfolgen vor dem Löschen abhängiger Relationen. Ein explizites `null` entfernt den Schlüssel auch bei einer Neuanlage. Ein ausgelassener Schlüssel erhält dagegen den gespeicherten Wert einschließlich einer unbekannten zukünftigen Version.

### Testumgebung und Ergebnis

Die Host-Ruby-Installationen können ihre alten OpenSSL-Bibliotheken nicht laden. Deshalb wurde innerhalb des freigegebenen lokalen Umfangs ein isolierter Docker-Test verwendet: Ruby **2.6.8** gemäß Projektvorgabe, ActiveRecord **5.2.4.3**, RSpec **3.8**, GraphQL **1.9.21**, Testtreiber mysql2 **0.5.6** und MySQL **8.0.46 / InnoDB**. Die produktiven Gemfile-/Lock-Dateien bleiben unverändert. Die Test-Gems liegen ausschließlich im ignorierten Worktree-Unterordner `tmp/geometry-gems`. Die Datenbank verwendet ein internes Docker-Netz ohne veröffentlichten Port und ein flüchtiges Datenverzeichnis; keine Bestandsdatenbank und kein fremdes Konto werden angesprochen.

Der Regressionstest führte vor der Korrektur zu **11 Fehlern bei 14 Beispielen**. Der abschließende Stand besteht **19 Beispiele ohne Fehler**. Er prüft den tatsächlichen ResourceService und das tatsächliche ActiveRecord-Locking gegen MySQL mit begrenzten Fixture-Modellen und Rollen-Doubles. Ein kontrollierter konkurrierender Writer hält die Zeilensperre, während das Legacy-Update wartet; erst danach werden Payload und Standortrelationen geändert. Der zuletzt geschriebene Geometriestand bleibt erhalten. Ein gesonderter Fall prüft den zwischen Lesen und Sperrerwerb geänderten Eigentümer.

Weitere Fälle prüfen Auslassen des gesamten Payloads, Legacy-`null`-Payload, explizites Löschen/Ersetzen, frischen statt veralteten Speicherstand, neue Datensätze, Fremdversionen, Mengen-/UTF-8-Grenzen, ungültige Geometrien vor Relationsänderungen, readonly/Extended-User-Ablehnung und unveränderte Aufruferobjekte. Ruby-Syntax beider Dateien und `git diff --check` bestehen.

Die Tests sind per `GEOMETRY_TEST_MYSQL_HOST` ausdrücklich opt-in und auf die isolierte Datenbank `sva_geometry_fixture` begrenzt. Bei verfügbarer Projekt-Bundle-Umgebung lautet der gezielte Aufruf `GEOMETRY_TEST_MYSQL_HOST=<isolierter Testhost> bundle exec rspec spec/services/resource_service_geometry_spec.rb`. Im hier verwendeten Ruby-Container wurde derselbe Test mit `GEM_HOME=/work/tmp/geometry-gems` und `GEM_PATH=/work/tmp/geometry-gems` gestartet. Die Fixture verwendet `TEXT` wie das vorhandene GenericItem-Schema; die 60-KiB-Grenze wird vor dem tatsächlichen Write geprüft.

**Grenze des historischen Nachweises:** Keine vollständige Rails-Suite, kein echter CMS-HTTP-/GraphQL-Roundtrip und keine produktive Versions- oder Datenbankprüfung. Die isolierte InnoDB-Sperre ist tatsächlich ausgeführt, die vollständigen App-Modelle und deren übrige Callbacks sind damit nicht abgenommen. Dieser lokale Versuch wird nicht ausgeliefert. Mainserver-Änderungen bleiben ausschließlich lokal; Push und Rollout sind nicht freigegeben.

## 11. Figma nach dem technischen Nachweis

Im vorhandenen [Designsystem SVA Studio, Ansicht 44](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio?node-id=252-17112) sind Anlage und Bearbeitung mit Standort, Strecke, Fläche, Eckpunkten und numerischer Alternative ausgearbeitet. Die bisherige Tabellen-/Toolbar-Ansicht 43 bleibt erhalten. Die neue Ansicht umfasst Desktop Light/Dark, eine 390-px-Ansicht, Leerzustand, laufende Zeichnung mit Abbruch, ungültige Fläche, Kartenausfall, Nur-Lesen-Koordinaten, Mengenlimit, nicht unterstützten Bestand und unklaren Speicherausgang.

Vorhandene Button-, Field-, FieldText-, Card-, Disclosure- und Alert-Komponenten werden als Instanzen verwendet. Ausschließlich die fehlende Geometriekarte ergänzt die vorhandene Bibliothek als `SVA Studio/ConstructionGeometryMap` mit zwei Viewports und vier Zuständen. Farben, Abstände und Radien sind an bestehende Variablen gebunden; Schriftstile verwenden Fira Sans. Die Kartengrundlage ist eine editierbare schematische Darstellung, kein Bildschirmfoto und kein neuer Kartenanbieter.

Strukturprüfung nach Abgleich der Standortfelder: 661 editierbare Nachfahren, darunter 194 Instanzen, keine Bildfüllung, ausschließlich Fira Sans und keine horizontalen Überläufe in den geprüften Auto-Layout-/Slot-Containern. Gesamtansicht visuell geprüft; Koordinatenbreiten, Hilfetextstil und Kartenanpassung korrigiert. Die Standortfelder entsprechen dem vorhandenen Vertrag aus Bezeichnung, Breitengrad und Längengrad; die numerischen Punktaktionen sind mit der Control-Unterkante ausgerichtet. Die Codeumsetzung ist gemäß Abschnitt 12 abgeschlossen. Kommunale Originalfälle und fachliche Freigabe stehen weiterhin aus.

## 12. Lokale Studio-Finalisierung

Auf den anschließenden Nutzerauftrag hin ist die Studio-Umsetzung im bestehenden Worktree finalisiert. Die einzige zusätzliche technische Datenquelle bleibt das vorhandene GenericItem-Payload im unveränderten Mainserver. Der Mainserver-Versuch aus Abschnitt 10 bleibt lokal und wird nicht übernommen.

- Die Übersicht verwendet eine eigene schema-validierte GraphQL-Auswahl und `ConstructionSiteListItem` statt vollständiger Editor-Records. Payload, Geometrien, Medien und Editor-Metadaten fehlen im Kandidatenscan und in der Listenantwort. Filter, Provider-Autorisierung, Sortierung und Pagination bleiben im bisherigen Pfad.
- Der Editor gruppiert Werkzeuge und Historie mit einheitlichen Controls. Karte, Formenliste und aufklappbare Koordinatenabschnitte teilen dieselbe Auswahl. Auf schmalen Ansichten stehen die Gruppen untereinander; numerische Aktionen richten sich auf breiten Ansichten an der Control-Unterkante aus. Standortpunkt und Formen bleiben unabhängig.
- Der Kartenadapter gleicht ausschließlich fachliche Linien und Polygone ab. Terra-Draw-Hilfspunkte für Auswahl und Zwischenpunkte werden nicht als zu löschende Formen behandelt. Unvollständige Koordinaten sind weiterhin der maßgebliche Draft; bis zur Korrektur bleibt die Karte im Render-Modus und überschreibt diese Eingaben nicht. Fehler öffnen die Koordinatenabschnitte. Ein laufender Zeichenvorgang sperrt den Save-Button zusätzlich zur vorhandenen Save-Vorprüfung.
- Semantische Farben werden für den Canvas aufgelöst und bei Moduswechsel aktualisiert. Der initiale Ausschnitt enthält vorhandene Formen und Standort. Karte, Adapter, Beobachter und Marker werden beim Unmount entfernt. Read-only bietet keine Zeichen-/Löschaktionen; bei Kartenfehlern bleibt die Koordinatenalternative nutzbar.

### Abschließende lokale Evidenz und PR-Nachprüfung

Der vollständige Plugin-Coverage-Lauf besteht mit 101 Tests: 96,64 % Lines, 96,04 % Statements, 93,81 % Functions und 90,17 % Branches. Die zustandsbehafteten Adaptertests sichern Initialisierung mit verzögerter Konfiguration und verzögertem Kartenladen, sechs Dezimalstellen, Teil-Drafts, Auswahl, Zeichnungsabbruch, Undo/Redo, stabile Reihenfolge, Hilfspunkte und Cleanup ab. Eine `fast-check`-Property prüft für 100 generierte Linien und Ringe Normalisierungs-Idempotenz und unveränderten Input. Die unabhängigen Server-Grenzfixtures bleiben bestehen.

Die Nachprüfung für [PR #2081](https://github.com/smart-village-solutions/sva-studio/pull/2081) hat konkrete Kartenfehler geschlossen: An Terra Draw gehen ausschließlich normalisierte, gültige Features; unvollständige Koordinaten erreichen weder Mittelpunkt noch Bounds. Die asynchrone Initialisierung ist an ihre Mount-Generation gebunden. Die vorhandene Karte ist lokal nach Laufzeit, Draft-Abgleich und Controls aufgeteilt; es bleibt ein einziger Kartenpfad. Die numerischen Punktfelder und Geometrie-Texte sind im selben Plugin abgegrenzt. Qualitätsgrenzen, Baselines und Ausschlüsse bleiben unverändert.

Konturen behalten den semantischen Farbton, begrenzen aber dessen Helligkeit unabhängig vom UI-Modus, weil die konfigurierte Kartengrundlage auch im Dark Mode hell bleiben kann. Der Kartenbereich meldet seine Ladebereitschaft über `aria-busy`. Das 60-KiB-Payloadbudget wird bei hinzugefügter oder geänderter Geometrie geprüft; unveränderte Geometrie sperrt andere Bestandsänderungen nicht. Snapshot- und Service-Regressionen prüfen weiterhin Erhalt, Löschung und unabhängigen Readback.

Der echte Chromium-Roundtrip prüft Standortpunkt, Linie/Polygon, Eckpunkt-/Zwischenpunktbearbeitung, Undo/Redo, wieder geöffneten Bestand, unvollständige Koordinaten, 390 px ohne horizontalen Überlauf, Save bei Kartenausfall, Nur-Lesen, Light/Dark und Entfernung der letzten Form mit anschließendem Reload. API und Kartenstil sind kontrollierte Fixtures ohne externe Tiles; ein echter Ziel-Mainserver wird dabei nicht beschrieben. Desktop-, Mobil- und Dark-Screenshots werden gegen die Figma-Komposition geprüft. Bestehende Shell-/Seitenstrukturen außerhalb des Geometrieabschnitts bleiben unverändert.

Maßgeblich für den PR sind terminale GitHub-Gates und geschlossene Review-Threads am abschließenden HEAD. Merge, Zielumgebungs-Schreibtest und Rollout sind nicht Teil dieses Auftrags. Die technische Fertigstellung im Studio ist keine Produktions- oder fachliche Abnahme. Die verbleibenden Aufgaben stehen ausschließlich in Abschnitt 5 von tasks.md.
