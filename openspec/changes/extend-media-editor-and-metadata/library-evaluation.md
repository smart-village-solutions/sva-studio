# Technische Vorprüfung: Filerobot und Medienpersistenz

## Entscheidungsergebnis

Stand der Prüfung: 22.10.2026. Die ursprüngliche technische Bewertung empfahl Filerobot wegen der Accessibility-Lücken nicht zur Integration. **Fortschreibung nach ausdrücklicher Nutzerentscheidung: [ADR-069](../../../docs/adr/ADR-069-filerobot-bildeditor-mit-begrenzter-accessibility-abweichung.md) akzeptiert diese Abweichung innerhalb der spezialisierten Editoroberfläche und wählt Filerobot als Integrationsweg.** Die nachfolgenden Befunde bleiben unverändert gültig; sie werden durch die Risikoakzeptanz nicht zu bestandenen Prüfungen.

Der vollständige Produktumfang bleibt bestehen. Ein eigener Objekteditor, Accessibility-Fork oder vorgeschalteter Library-Wechsel wird nicht verlangt. Die übrigen Integrations-, Sicherheits- und Datenschutzanforderungen bleiben erhalten. Es wurde keine Dependency in ein Studio-Package übernommen.

## Aufbau und geprüfte Versionen

Die Untersuchung umfasste Paket-/Quellcode, veröffentlichte Typdeklarationen, vorhandene Studio-Medienpfade und zwei isolierte Browseraufbauten mit künstlich erzeugtem PNG. Temporäre Dependencies lagen ausschließlich unter dem ignorierten `node_modules/.cache/media-editor-evaluation` innerhalb des Projekts. Es gab keinen Upload realer Medien, keinen Account und keinen externen Speichervorgang. Die Browser-Bundles wurden im Speicher gebaut und nur auf Loopback bereitgestellt. Die öffentliche Demo wurde ergänzend geprüft; sie ist kein React-19-Nachweis.

| Paket                                  | Im isolierten Lauf verwendet                                            |
| -------------------------------------- | ----------------------------------------------------------------------- |
| React / React DOM                      | 19.3.0, entsprechend der tatsächlich lokal installierten Studio-Version |
| react-filerobot-image-editor           | 5.0.0-beta.159                                                          |
| react-konva                            | 19.3.2                                                                  |
| konva                                  | 9.3.18                                                                  |
| styled-components                      | 6.1.19                                                                  |
| @scaleflex/ui / @scaleflex/icons       | 3.0.0-beta.10                                                           |
| TypeScript für die Deklarationsprüfung | bestehendes Studio-TypeScript 6.0.3                                     |

Die npm-Dist-Tags zeigten `latest = 5.0.0-beta.159`, `beta = 5.0.0-beta.157`. GitHub-`master` meldete weiterhin Paketversion 4.9.1; geprüfter Commit: `a7cce3173cb380c4900b9cb9fb8d91f7f33a7a26`. Die stabile GitHub-Version allein beschreibt somit nicht das aktuell über npm als `latest` gelieferte React-19-Paket. Eine spätere Auswahl muss die konkret geprüften Versionen festlegen, nicht bewegliche Tags verwenden.

Npm-Integrität des geprüften Editorpakets: `sha512-PGmZVUD42fTTnjovHJqaY+X7dlP/uUG4fQOfmQkjYfaDV/8fuVpn6MgVbrsUiLetbtknVJx09mfvxoLfdH9Kmg==`.

## 1. React und TypeScript

**Nachgewiesen:** Der isolierte React-19.3-Aufbau bündelt und rendert den Editor samt drei Canvas-Layern. Initialisierung, Export und die unten beschriebenen Wiederladungen lieferten keine Browser-Laufzeitfehler. Die Beta deklariert React/React DOM ab 19 und react-konva ab 19 als Peers; react-konva 19.3.2 passt zu React 19.3. Ein vollständiger Studio-/TanStack-Start-/SSR-Test wurde nicht durchgeführt. Das Paket greift bei der Initialisierung auf `window` zu; die Client-Ladegrenze bleibt erforderlich.

**Typgrenze:** TypeScript meldete beim gezielten Prüfen der veröffentlichten Editor-Deklaration mit `strict: true`, `skipLibCheck: false` 13 Diagnosen. Beispiele in `lib/index.d.ts`: fehlender `ThemeOverride`-Export (Zeile 1), ungültige Ambient-Konstanten (4/14), optionaler Indexparameter (204), unparametrisiertes `Promise` (243), untypisierte Callbackparameter und unparametrisierte `RefObject`-Typen (382/387). Die Datei ist syntaktisch parsebar; die Fehler sind semantisch.

Studio verwendet bereits `skipLibCheck: true`; deshalb wird daraus kein behaupteter roter Studio-Build abgeleitet. Die gelieferte Typoberfläche ist jedoch kein belastbarer typsicherer Zustandsvertrag. Eine kleine validierte Anwendungsgrenze wäre ohnehin erforderlich; globale Strict-Abschwächung oder ein pauschales `any` sind keine Lösung. Kein vollständiger Typecheck der späteren Integration wurde behauptet.

## 2. Wiederherstellung und Bildausgabe

Verwendet wurden die tatsächlichen APIs `getCurrentImgDataFnRef` für Export und `loadableDesignState` für Wiederherstellung. Der Zustand wurde per JSON serialisiert und in eine neu gemountete Editorinstanz gegeben. Er enthält neben Einstellungen insbesondere `imgSrc`, `annotationIds`, `annotations` und geometrische Angaben; Referenzen auf Bildressourcen sind vor Persistenz zu kontrollieren.

Der Testzustand enthielt ein getrenntes Textobjekt, ein Rechteck, horizontale Spiegelung und 90-Grad-Rotation. Anschließend wurden der Text in „CORRECTED“ geändert, seine Position angepasst, ein quadratischer 400×400-Zuschnitt, Sepia und schließlich Helligkeit (`Brighten`, 0,12) ergänzt. Die Änderungen wurden über den State-Eingang gesetzt; dies beweist den API-Roundtrip, nicht die zugängliche UI-Bearbeitung.

| Prüfung                                                                          | Ergebnis                                                                                                   |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Text-/Rechteckobjekt nach JSON-Speichern und erneutem Mounten getrennt vorhanden | Bestanden                                                                                                  |
| Identische PNG-Ausgabe nach Wiederladen von Text/Rechteck/Spiegelung/Rotation    | Bestanden; SHA-256 über Export-Data-URL `83563f9cd74d1778747dd8fd5ea1e0a573f521f1b9ed1e0e9abb59a2ac45312d` |
| Text einzeln korrigieren, Rechteck erhalten, Zuschnitt/Filter hinzufügen         | Bestanden; Ausgabe änderte sich                                                                            |
| Korrigierten Text, Rechteck, 400×400-Zuschnitt und Sepia wiederladen             | Bestanden; identische Ausgabe, SHA-256 `db94ee6814e909134f97d62d3db5d58a0cad90ddde32ec84f43854b38e95b720`  |
| Helligkeit exportieren und wiederladen                                           | Bestanden; `Brighten` und Wert erhalten, identische Ausgabe                                                |

Ein zunächst experimentell gesetzter ungültiger Filtername `Brightness` verursachte beim Export einen Fehler; der gültige Konva-Name ist `Brighten`. Das war kein aus einem gültigen Export erzeugter Roundtrip-Fehler. Es bestätigt die Notwendigkeit einer begrenzten serverseitigen Zustandsvalidierung.

Nicht nachgewiesen: alle Filterkombinationen, Bild-/Wasserzeichenressourcen, Schriften über verschiedene Betriebssysteme, alte Zustände nach Editorupdates und pixelgleiche Ergebnisse zwischen unterschiedlichen Browsern. Die Prüfung belegt die Grundfähigkeit, keine vollständige Langzeitkompatibilität.

## 3. Barrierefreiheit: konkreter Ablehnungsgrund

Im isolierten Beta-Lauf waren die sechs Werkzeugbereiche Adjust, Finetune, Filters, Watermark, Annotate und Resize als klickbare `div`-Elemente gerendert, ohne passende Rolle, ohne Tab-Fokus und ohne Tastaturhandler. `lib/components/Tabs/TabItem.js` verwendet `StyledTabItem` mit `onClick`; `Tabs.styled.js` definiert diesen Baustein als `styled.div`. Der Accessibility-Tree führte die Werkzeugnamen als Text, nicht als bedienbare Tabs/Buttons. Die öffentliche Demo zeigte denselben grundlegenden Navigationsmangel.

Die Bildarbeitsfläche hat `tabIndex=-1`; `lib/components/MainCanvas/CanvasNode.js` fokussiert sie über Zeigerereignisse. Die dortigen Tastaturhandler behandeln Pan-/Modifier-Tasten, nicht die vollständige Auswahl und Änderung einzelner Annotationen. Die getrennten Testobjekte waren nicht als benannte bedienbare Objekte im Accessibility-Tree vorhanden. Damit ist bereits der normale Werkzeugwechsel über Tab nicht ausreichend nutzbar; vollständige Objektbedienung und Screenreaderzugang sind erst recht nicht nachgewiesen.

Einzelne vorhandene Positionsfelder ersetzen weder den fehlenden Zugang zu Werkzeugen noch eine zugängliche Objektauswahl. DOM-Nachbesserungen über fragile Selektoren oder ein eigener paralleler Objektinspektor sind nicht als kleine Konfiguration anzusehen. Eine vollständige manuelle WCAG-/Screenreader-Abnahme, Theme-Kontrastprüfung und 320-Pixel-Reflow-Prüfung wurde bei diesem bereits konkreten Blocker nicht vorgetäuscht.

**Folge:** Die vollständige Barrierefreiheit ist nicht erfüllt. Dieser konkrete Mangel ist gemäß ADR-069 für die spezialisierte Werkzeug-/Canvas-Oberfläche akzeptiert und blockiert die Integration nicht mehr. Der Befund betrifft die Bedienoberfläche; Studio-eigene Rahmen-, Formular- und Abschlussaktionen bleiben außerhalb der Ausnahme.

## 4. Netzwerk, i18n, Größe und Lizenz

Mit Standardkonfiguration wurde ein externer XHR-Abruf zu `https://i18n-fastly.ultrafast.io/api/export?grid=undefined` beobachtet. `context/defaultConfig.js` setzt `useBackendTranslations=true`; `utils/translator.js` führt den Abruf aus. Es wurde keine Übertragung von Bildbytes durch diesen Übersetzungsabruf beobachtet.

Mit der unterstützten Option `useBackendTranslations=false`, lokaler Schriftwahl und expliziten Übersetzungseinträgen lud der zweite isolierte Aufbau ausschließlich lokale JS-/CSS-/Favicon-Ressourcen. Ein Testlabel erschien als „Speichern“. Vollständige deutsche/englische Übersetzung muss über Studio-Ressourcen erfolgen; `language="de"` allein übersetzt nicht alle Werkzeuge. Für die geprüfte Sitzung ist der externe Abruf somit ohne Fork vermeidbar, nicht aber pauschal jedes mögliche externe Nachladen aller Werkzeuge bereits geprüft.

Der minimierte isolierte Browser-Build inklusive React/React DOM, Editor und dessen Abhängigkeiten maß 1.209.425 Byte JS beziehungsweise 355.240 Byte gzip. Das ist kein gemessener zusätzlicher Studio-Chunk, da der echte Build gemeinsame Dependencies teilen kann. Lazy Loading bleibt sinnvoll; ein Performanceproblem im Studio wird daraus nicht behauptet.

Die sechs wesentlichen Editor-/UI-/Canvas-Pakete deklarieren MIT. Ein Manifest-Screening aller 87 Pakete des temporären Prüfaufbaus einschließlich Testbundler ergab MIT, ISC, BSD-3-Clause, 0BSD, Apache-2.0 und CC-BY-4.0, keine fehlende Lizenzangabe. Dies ersetzt weder die vollständige transitive Lizenzprüfung des endgültigen Runtime-Baums noch dessen SBOM/Sicherheitsprüfung. Es wurde kein zusätzlicher kommerzieller Cloudimage-/DAM-Dienst benötigt.

## 5. Kleinste sinnvolle Persistenzerweiterung

Geprüfte bestehende Quellen: `docs/development/studio-db-schema-final.sql:1602` und `:1672`, `docs/development/studio-db-schema.md` Abschnitt 7, `packages/data-repositories/src/media/asset-statements.ts`, der bestehende Storage-Port sowie Upload-/Content-Save-/Löschpfade.

Eine neue Plattform, allgemeine Historie, neue Queue oder ein allgemeines Ressourcenregister sind nicht erforderlich. Die bestehenden Assets besitzen bereits Metadaten-/Technical-JSONB und provisorische Operationsbindung. Eine ausschließlich darin versteckte Quell-ID genügt jedoch nicht für eine belastbare referenzielle Löschsperre.

**Bevorzugte Entwurfsrichtung, noch keine Migration:**

- Bestehendes `media_assets` um eine explizite instanzgebundene Quellasset-Beziehung und einen privaten Editorzustand mit Format-/Versionskennung erweitern. Zustandsfelder werden nur über berechtigte Editor-Projektionen ausgegeben.
- Für erstmals lokale Ausgangsbilder die unveränderten Bytes als private zusätzliche Datei des neuen Assets speichern; ein optionaler privater Quell-Dateiverweis am Asset hält diese Grundlage. Spätere Kopien verweisen direkt auf das Asset, das die tatsächliche unveränderte Grundlage besitzt, statt Ketten über jede Zwischenkopie zu bilden.
- Dies lässt sich voraussichtlich durch drei optionale Felder am bestehenden Asset ausdrücken: Quellasset-ID, privater Quell-Dateiverweis und Editorzustand. Eine instanzgebundene Fremdschlüsselbeziehung samt gezieltem Index schützt die Datenbankreferenz. Zusätzliche Quellbytes und begrenzte Zustandsbytes werden im bestehenden Quotenpfad berücksichtigt; kein allgemeines Deduplizierungssystem.
- Vorhandene private Storage-Grenzen wiederverwenden. Fehlende private Speicherkonfiguration darf nicht durch öffentliche Grundlagen kompensiert werden. Neue Zusatzdateien verwenden vorhandene Inhalts-/Scan-/Claim-/Cleanup-Grenzen; Asset und Zustand werden erst zusammen nutzbar. Die konkrete Mehrdatei-Finalisierung ist im vorhandenen Uploadpfad zu planen.

**Wichtiger notwendiger Folgeeingriff:** `asset-mutation-handlers.ts` löscht gegenwärtig zuerst Storage-Objekte und erst danach den Asset-Datensatz. Eine neue Datenbank-FK allein käme somit zu spät: Das Original könnte bereits fehlen, obwohl die DB-Löschung scheitert. Link-Erzeugung und Löschentscheidung müssen im bestehenden Repository kurz atomar gegeneinander abgesichert werden, bevor Storage entfernt wird. Storage-I/O bleibt außerhalb langer Datenbanktransaktionen. Die genaue Reihenfolge und Wiederherstellung sind vor Implementierung festzulegen und mit einem Konkurrenztest zu belegen.

Es wurde keine Tabelle, Spalte oder Migration angelegt und keine Datenbank angesprochen. Die Richtung ist eine begrenzte Erweiterung vorhandener Pfade, keine fertige Schema-/Nebenläufigkeitsabnahme. Die Library ist inzwischen durch ADR-069 gewählt; eine Implementierungsfreigabe für die Persistenz folgt daraus nicht.

## Verbindliche Schlussfolgerung

React-19-Grundbetrieb und ein repräsentativer State-/Bild-Roundtrip sind praktisch belegt. Der externe Übersetzungsabruf ist konfigurierbar vermeidbar. Die Persistenz ist im vorhandenen Modell grundsätzlich darstellbar, benötigt aber eine echte Änderung am Lösch-/Finalisierungspfad. Die vollständige Accessibility-Anforderung ist mit dem geprüften Filerobot-Paket nicht erfüllt und wird für dessen Spezialoberfläche durch ADR-069 ausdrücklich als Abweichung akzeptiert. Damit kann die Umsetzung mit Filerobot geplant werden; es gibt weiterhin weder einen Implementierungsnachweis noch eine Rollout-Freigabe.

Quellen: [Editor-Registry und Versionen](https://registry.npmjs.org/react-filerobot-image-editor), [GitHub-Projekt](https://github.com/scaleflex/filerobot-image-editor), [öffentliche Demo](https://scaleflex.github.io/filerobot-image-editor/), [React-Konva-Registry](https://registry.npmjs.org/react-konva). Bewegliche Registry-/Branchstände wurden für diesen Bericht auf die oben genannten Versionen begrenzt.


## Implementierungsnachweis im Studio (23.10.2026)

Der bestehende Playwright-Pfad `apps/sva-studio-react/e2e/media-management.spec.ts` prüft zusätzlich die echte Filerobot-Integration mit synthetischen lokalen Bilddaten und gemockten Medienendpunkten. Der Lauf enthält drei grüne Fälle: bisherigen Upload, Fehler beim direkten PUT sowie Kopie exportieren, speichern und erneut bearbeiten. Text, Rechteck und ein eingebettetes Bild bleiben im gespeicherten Dokument erhalten; die beiden PNG-Exporte sind bytegleich, die ursprünglichen Assetdaten unverändert. Die gesamte Editorsitzung erzeugt keine zusätzlichen externen HTTP-Abrufe. Default/Forest jeweils Light/Dark und die Hostansicht bei 320 CSS-Pixeln werden erfasst; native Fokusregler sind per Tastatur bedienbar. Dies ist lokale Browser-Evidenz, keine Produktionsabnahme oder umfassende Screenreader-Zertifizierung.

Zusätzliche Unit- und PostgreSQL-Nachweise decken private Projektionen, Quellenrechte, Scan/Quote, wiederholbaren Upload-Abschluss, Löschsperren, terminale Fehler und abgelaufene Pending-Uploads ab. Der Dependency-Audit meldet bereits bestehende projektweite Befunde; über die neue Editor-Kette werden vorhandene Build-Abhängigkeiten `browserslist`/`baseline-browser-mapping` zusätzlich erreicht. Diese sind keine im Browser ausgeführte Verarbeitung redaktioneller Eingaben. Es wurden keine fremden Update- oder Infrastrukturmaßnahmen in den Editorumfang aufgenommen.


Die abschließenden lokalen Gates bestehen: Server-Runtime (20 Projekte), PostgreSQL-Medienverträge (15 Fälle), drei Browserfälle einschließlich Axe für den Studio-Rahmen, 200-Prozent-Textvergrößerung und 320-Pixel-Reflow, Typ-/Lintprüfungen der betroffenen Projekte sowie die internen Coverage- und Komplexitätsgates. Patch-Coverage beträgt 92,04 Prozent, die kombinierte neue Zeilen-/Branch-Coverage 88,37 Prozent bei jeweils 85 Prozent Ziel. Der reine Medienkern erreicht den unveränderten Funktions-Floor von 100 Prozent. Die vorher gemessenen 36 affected Unit-Projekte wurden lokal über gezielte Prüfungen und vollständige Coverage-Läufe der zentralen betroffenen Projekte abgedeckt; die transitive Gesamtauswertung bleibt bei den GitHub-Gates.
