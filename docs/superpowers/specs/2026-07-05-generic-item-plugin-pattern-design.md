# Generic-Item-basierte Fachplugins

## Kontext

Für weitere Fachmodule wie Stellenanzeigen, Baustellen, FAQ und ähnliche redaktionelle Inhalte soll nicht für jeden Typ ein eigener Upstream-Datentyp eingeführt werden. Stattdessen sollen neue Studio-Plugins technisch auf dem Mainserver-Datentyp `GenericItem` aufsetzen.

Gleichzeitig sollen diese Module im Studio weiterhin als eigenständige Fachplugins auftreten. Redakteure sollen also nicht mit einem generischen Editor arbeiten, sondern mit fachlich passenden Listen-, Detail- und Validierungsflüssen.

Bereits vorhandene Altdaten spielen dabei eine wichtige Rolle. `payload`-Strukturen können historisch gewachsen und uneinheitlich sein. Die neue Lösung muss diese Datensätze bearbeitbar halten, ohne daraus ein übergenerisches oder schwer wartbares System zu machen.

## Ziele

- Zuerst entsteht ein vollwertiges produktives Plugin für freie `GenericItem`-Inhalte.
- Weitere engere Fachplugins können danach auf Basis von `GenericItem` umgesetzt werden.
- Jedes Plugin bleibt fachlich und technisch klar von anderen Plugins getrennt.
- Jedes Plugin hat einen festen, getypten Vertrag für seine plugin-spezifischen Zusatzdaten.
- Gemeinsame `GenericItem`-Kernfelder werden bevorzugt kanonisch genutzt statt in `payload` dupliziert.
- Historische `payload`-Formate werden pragmatisch und kontrolliert unterstützt.
- Die Lösung bleibt bewusst einfach und vermeidet eine große gemeinsame Meta-Plattform.

## Nicht-Ziele

- Kein konfigurierbarer Low-Code- oder Schema-Driven-Editor für beliebige `GenericItem`-Typen.
- Keine stark gemeinsam genutzte `GenericItem`-Runtime-Basis, die die Fachplugins eng koppelt.
- Keine erzwungene Vereinheitlichung aller Fachformulare über eine einzige generische UI.
- Kein unkontrolliertes Freiform-JSON ohne festen Vertrag.

## Architekturentscheidung

Die neuen Module werden als eigenständige Fachplugins umgesetzt, analog zu `plugin-news`, `plugin-events` und `plugin-poi`.

Die Reihenfolge ist dabei bewusst zweistufig:

1. zuerst ein offenes, vollwertiges Redaktionsplugin für `GenericItem`
2. danach engere Fachplugins wie Stellenanzeigen, Baustellen oder FAQ

Das offene erste Plugin dient gleichzeitig als produktiv nutzbares Modul und als Referenzmuster für spätere engere Plugins.

Jedes Plugin verantwortet vollständig:

- seinen eigenen Studio-`contentType`
- seine eigene Plugin-Definition
- seine eigenen Listen-, Erstellen- und Bearbeiten-Seiten
- seine eigene Formularvalidierung
- seine eigene Abbildung zwischen Fachmodell und `GenericItem`
- seinen eigenen festen `payload`-Vertrag

Es wird bewusst keine große gemeinsame `GenericItem`-Adapterbasis eingeführt. Die Trennung zwischen den Plugins ist wichtiger als die maximale Wiederverwendung in der Fachintegration.

Geteilt bleiben nur die ohnehin vorhandenen Plattformbausteine:

- `@sva/plugin-sdk`
- `@sva/studio-ui-react`
- Host-Routing, Admin-Ressourcen und Actions
- Mainserver-Service-Infrastruktur

### Sonderfall: offenes Generic-Item-Plugin

Das erste Plugin ist bewusst breiter geschnitten als die späteren Fachplugins:

- es ist ein vollwertiges Redaktionsplugin
- es deckt möglichst viele vorhandene `GenericItem`-Kernfelder ab
- `genericItemType` wird als Freitext geführt
- `payload` bleibt frei editierbar

Dieses Plugin ist die explizite Ausnahme von der späteren Regel eines festen plugin-spezifischen Payload-Vertrags. Es ist kein internes Technikwerkzeug, sondern ein reguläres redaktionelles Produktmodul.

### UI-Leitlinie für das offene Generic-Item-Plugin

Obwohl das erste Plugin fachlich offen ist, soll seine Oberfläche nicht wie ein technischer Roh-Editor wirken. Stattdessen orientiert sich die GUI bewusst so nah wie sinnvoll an den bestehenden Mustern aus `plugin-poi` und `plugin-events`.

Das bedeutet insbesondere:

- gleiche oder sehr ähnliche Detailseitenstruktur
- bekannte Tab- und Card-Muster
- vorhandene Feldgruppen möglichst entlang bestehender redaktioneller Muster
- kein dominanter JSON-Editor als Hauptinteraktion

Freie Elemente wie `genericItemType` und `payload` werden in dieses Redaktionsmuster eingebettet, nicht als alternative Sonderoberfläche daneben gestellt.

## Datenmodell

### 1. Kanonischer GenericItem-Kern

Felder, die im Mainserver-`GenericItem` stabil und fachlich generisch vorhanden sind, werden direkt kanonisch genutzt. Dazu gehören je nach fachlichem Zuschnitt beispielsweise:

- Titel
- Status- oder Sichtbarkeitsinformationen
- Kategorien
- Veröffentlichungszeitpunkte
- Basis-Medien
- weitere belastbare Kernfelder des Upstream-Schemas

Solche Daten sollen nicht zusätzlich redundant im `payload` gehalten werden.

### 2. Plugin-spezifischer Payload-Vertrag

Für spätere engere Fachplugins definiert jedes Plugin einen festen TypeScript-Vertrag für seine Zusatzdaten im `payload`.

Beispiele:

- Stellenanzeigen: Beschäftigungsart, Bewerbungsfrist, Ansprechpartner, Arbeitgeberinfos
- Baustellen: Sperrungsart, betroffene Bereiche, Verkehrsfolgen, Zeitraum
- FAQ: Frage, Antwort, Gruppierung, Sortierreihenfolge

`payload` ist damit für diese späteren Fachplugins kein freies JSON-Feld, sondern ein fachlicher Vertrag pro Plugin.

### 3. Ausnahme für das offene Generic-Item-Plugin

Das erste offene `Generic Item`-Plugin nutzt ebenfalls die kanonischen `GenericItem`-Kernfelder, erlaubt darüber hinaus aber bewusst:

- freien `payload`
- freien `genericItemType`

Es soll dadurch sowohl freie Inhalte anlegen können als auch als Referenz für spätere strengere Plugins dienen.

## Typdiskriminierung

Die technische Trennung der Fachplugins auf Mainserver-Ebene erfolgt über das vorhandene Feld `genericItemType`.

Festlegungen:

- Jedes Studio-Plugin besitzt einen eigenen Studio-`contentType`.
- Jeder Datensatz wird über `genericItemType` eindeutig einem Fachplugin zugeordnet.
- Jeder Plugin-Mapper liest und schreibt nur Datensätze mit dem erwarteten `genericItemType`.
- `payload` dient nicht der Plugin-Identität, sondern nur den Fachzusatzdaten.

Dadurch bleiben Listen, Reads, Writes und Migrationen sauber trennbar.

Ausnahme für das offene erste Plugin:

- `genericItemType` ist dort bewusst Freitext
- das Plugin darf daher mehrere freie Typausprägungen unter demselben Studio-Modul bearbeiten

## Implementierungsmuster pro Plugin

Jedes neue Plugin folgt dem bestehenden Paketmuster:

- `plugin.tsx` für Plugin-Definition, Actions, Permissions und Übersetzungen
- `*.api.ts` für CRUD-Pfade gegen `GenericItem`
- `*.types.ts` für Fachmodell und Payload-Typen
- `*.validation.ts` für die fachliche Eingabevalidierung
- `*.pages.tsx` sowie bei Bedarf Detail-Tab-Dateien für die UI

Zwischen UI und GraphQL-Mutation steht immer ein expliziter Plugin-Adapter:

- `GenericItem -> PluginReadModel`
- `PluginFormInput -> GenericItemWriteInput`
- `payload <-> PluginPayload`

Die Plugins bleiben so unabhängig änderbar, auch wenn sie denselben Upstream-Datentyp verwenden.

Für das erste offene `Generic Item`-Plugin bedeutet das konkret:

- eigene Listenansicht
- eigene Create-/Edit-Seiten
- redaktionell vertraute Oberfläche nahe an `POI` und `Events`
- freie Bearbeitung von `genericItemType` und `payload`

### UI-Struktur des ersten Plugins

Die Oberfläche des offenen `Generic Item`-Plugins soll sich soweit möglich an den vorhandenen Redaktionsmustern orientieren und dabei bewusst nur wenige Haupttabs verwenden:

- `Basis` für Identität, Titel, Typ, Sichtbarkeit und Kernmetadaten
- `Inhalt` als gemeinsamer großer redaktioneller Arbeitsbereich
- `Einstellungen` für sekundäre technische oder publikationsnahe Felder
- `Historie` nur optional, sofern der bestehende Host-Pfad sinnvoll wiederverwendet werden kann

Der Tab `Inhalt` bündelt dabei bewusst mehr als nur Textfelder. Vorhandene `GenericItem`-Felder wie Kontakte, Adressen, Web-Links, Medien, Termine, Öffnungszeiten oder ähnliche Gruppen sollen innerhalb dieses großen Arbeitsbereichs über bekannte Cards und Sections erscheinen, die Redakteure aus den bestehenden Plugins bereits kennen.

`payload` bleibt zwar frei, soll aber UI-seitig nur ein ergänzender Bereich sein, nicht die primäre Hauptstruktur der Seite.

### Konkrete Erstzuordnung der Felder

Für die erste Iteration gilt folgende grobe Zuordnung:

- `Basis`
  - `title`
  - `genericType`
  - `visible`
  - `publicationDate`
  - `publishedAt`
  - `author`
  - `externalId`
- `Inhalt`
  - `teaser`
  - `description`
  - `contentBlocks`
  - `categories`
  - `keywords`
  - `contacts`
  - `companies`
  - `addresses`
  - `locations`
  - `pointOfInterest`
  - `dates`
  - `openingHours`
  - `webUrls`
  - `accessibilityInformations`
  - `mediaContents`
- `Einstellungen`
  - `payload`
  - `settings`
  - `pushNotifications`
  - `quota`
  - seltene oder technische Restfelder

Die Umsetzung soll innerhalb dieser Tabs mit Cards und klaren Feldgruppen arbeiten, nicht mit einer weiteren inneren Tab-Hierarchie.

### Pflichtfelder im Tab `Basis`

Damit das offene erste Plugin redaktionell nutzbar bleibt, aber nicht unnötig eng wird, sollen in Iteration 1 nur sehr wenige Pflichtfelder gelten.

#### Pflicht in Iteration 1

- `title`
- `genericType`

#### Optional oder mit Default-Verhalten

- `visible`
- `publicationDate`
- `publishedAt`
- `author`
- `externalId`

Wenn für Felder wie `visible` ein belastbarer technischer Default möglich ist, soll dieser gegenüber einer zusätzlichen Pflichtinteraktion bevorzugt werden.

### Muss-/Kann-Matrix für Iteration 1 im Tab `Inhalt`

Damit das erste Plugin nicht an zu breiter Feldabdeckung scheitert, wird der große Tab `Inhalt` in Pflicht- und optionale Gruppen unterteilt.

#### Pflicht in Iteration 1

Diese Gruppen sollen in der ersten Umsetzung als echte editorische UI-Komposition vorhanden sein:

- Textinhalte
  - `teaser`
  - `description`
  - `contentBlocks`
- Einordnung
  - `categories`
  - `keywords`
- Adressen und Orte
  - `addresses`
  - `locations`
  - `pointOfInterest`, sofern die bestehende Verknüpfungslogik ohne Sonderpfad anschließbar ist
- Links und Medien
  - `webUrls`
  - `mediaContents`
- Zeitbezug
  - `dates`

#### Optional in Iteration 1

Diese Gruppen sollen nur dann als eigene UI-Gruppen in die erste Umsetzung gehen, wenn sie mit vertretbarem Aufwand direkt an bestehende Muster aus `POI` oder `Events` angeschlossen werden können:

- `contacts`
- `companies`
- `openingHours`
- `accessibilityInformations`

#### Nicht priorisiert für Iteration 1

Diese Felder sollen nicht den ersten UI-Schnitt treiben und können zunächst in `Einstellungen`, read-only oder ganz außerhalb des ersten Ausbaus bleiben, sofern kein klarer redaktioneller Bedarf besteht:

- `settings`
- `pushNotifications`
- `quota`
- `genericItemMessages`
- `discountType`
- `priceInformations`
- `dataProvider`
- `ancestry`
- `genericItems`
- `memberId`
- `likeCount`
- `likedByMe`

Die Leitregel lautet: Iteration 1 optimiert auf einen glaubwürdigen, redaktionell nutzbaren Kern, nicht auf die vollständige Sichtbarkeit jedes Upstream-Feldes als eigene hochwertige UI-Komponente.

### Editierbarkeit im Tab `Einstellungen`

Auch der Tab `Einstellungen` braucht für Iteration 1 eine klare Grenze, damit er kein unstrukturierter Restcontainer wird.

#### Editierbar in Iteration 1

Diese Bereiche sollen im ersten Schnitt bewusst editierbar sein:

- `payload`
  - als freier Zusatzbereich
  - mit klarer Trennung vom redaktionellen Kern
  - mit Legacy-Hinweisen, falls das bestehende Format nicht vollständig interpretierbar ist
- `settings`, aber nur dann, wenn sich die zugrunde liegende Struktur ohne übermäßige Speziallogik als freier JSON-ähnlicher Zusatzbereich anschließen lässt

#### Read-only in Iteration 1

Diese Felder können sichtbar sein, sollen aber den ersten Ausbau nicht mit eigener Vollbearbeitung belasten:

- `pushNotifications`
- `quota`
- `dataProvider`
- `genericItemMessages`

#### Nicht sichtbar oder explizit außerhalb des ersten Ausbaus

Diese Felder sollen nicht automatisch im ersten `Einstellungen`-Tab erscheinen, wenn dafür keine klare redaktionelle Bedeutung oder kein belastbares Bearbeitungsmuster besteht:

- `discountType`
- `priceInformations`
- `ancestry`
- `genericItems`
- `memberId`
- `likeCount`
- `likedByMe`

Die Leitregel lautet: `Einstellungen` dient in Iteration 1 primär dem freien Zusatzdatenbereich und wenigen kontrollierten technischen Informationen, nicht der vollständigen UI-Abbildung jeder seltenen Upstream-Eigenschaft.

## Legacy-Strategie für payload

Altdaten müssen gezielt unterstützt werden, aber ohne die Lösung unnötig zu verkomplizieren.

Deshalb gilt:

- tolerant beim Lesen
- strikt beim Schreiben

Pro Plugin wird perspektivisch nur ein kleiner, klarer Legacy-Pfad vorgesehen:

- `parseCurrentPayload`: validiert das aktuelle Zielformat
- `parseLegacyPayload`: erkennt bekannte Altformate und normalisiert sie
- `serializePayload`: schreibt ausschließlich das aktuelle kanonische Format

Für das erste offene `Generic Item`-Plugin ist die Legacy-Behandlung jedoch ausdrücklich **nicht** Teil des ersten Umsetzungsschnitts. Der erste Ausbau optimiert auf neue und kontrolliert bearbeitete Datensätze. Altformat-Behandlung wird als späterer eigener Ausbau nachgezogen.

### Vereinfachungsregel

Es werden nur bekannte und fachlich nachvollziehbare Legacy-Varianten unterstützt. Es wird keine offene, beliebig heuristische Altformat-Interpretation gebaut.

Das Ziel ist:

- vorhandene Datensätze sinnvoll weiterbearbeitbar halten
- beim Speichern nur noch das neue Format erzeugen
- die Anzahl unterstützter Altpfade klein und explizit halten

### Umgang mit unbekannten Altformaten

Wenn ein Altformat später nicht sicher interpretierbar ist:

- der Datensatz wird nicht stillschweigend umgedeutet
- die UI zeigt einen klaren Hinweis auf ein nicht vollständig unterstütztes Altformat
- wo sinnvoll bleibt ein lesender oder eingeschränkter Bearbeitungspfad möglich
- Support- und Diagnosepfade sollen solche Fälle sichtbar machen

## Qualitäts- und Testanforderungen

Pro Plugin müssen mindestens folgende Bereiche abgesichert werden:

- Read-Mapping von `GenericItem` in das lokale Fachmodell
- Write-Mapping vom Plugin-Formmodell in `GenericItem`
- Typdiskriminierung über `genericItemType`
- Validierung des aktuellen `payload`-Formats
- Normalisierung bekannter Legacy-`payload`-Formate
- Fehlerfälle bei unvollständigen oder nicht interpretierbaren Altformaten
- Listen-, Create- und Edit-Flows im Plugin
- Plugin-Vertrag analog zu den bestehenden Fachplugins

Für das offene erste Plugin zusätzlich:

- Roundtrip-Tests für freien `payload`
- Roundtrip-Tests für freien `genericItemType`
- Mapping-Tests für eine breite Auswahl realer `GenericItem`-Kernfelder
- UI-Tests für die Orientierung an den bekannten Detailseitenmustern aus `POI` und `Events`

## Konsequenzen

### Vorteile

- sehr klare Ownership pro Fachplugin
- keine enge fachliche Kopplung zwischen Stellenanzeigen, Baustellen, FAQ und weiteren Modulen
- Redakteure sehen eigenständige Fachmodule statt eines generischen Editors
- Legacy-Kompatibilität bleibt pragmatisch, ohne ein vollgenerisches Migrationsframework aufzubauen

### Nachteile

- Mapping- und API-Logik wird teilweise mehrfach pro Plugin aufgebaut
- Änderungen an `GenericItem` können mehrere Plugins parallel betreffen
- Disziplin bei Feldnutzung und Payload-Verträgen ist wichtiger, da keine starke Shared-Basis schützt

## Empfehlung für die Umsetzung

Die erste Umsetzung sollte mit dem offenen produktiven `Generic Item`-Plugin beginnen und dabei das Muster bewusst knapp halten:

1. eigenständiges Plugin-Paket
2. breite kanonische Nutzung der vorhandenen `GenericItem`-Kernfelder
3. freier `payload`
4. freier `genericItemType`
5. kleiner, expliziter Legacy-Read-Pfad
6. vollständige Paket- und Mapping-Tests

Erst danach sollten engere Fachplugins mit festem `genericItemType` und festem `payload`-Vertrag folgen.

Erst nach dem ersten produktiven Plugin sollte geprüft werden, ob sich sehr kleine stabile Hilfen herauskristallisieren. Vorher sollte keine zusätzliche Shared-Abstraktion eingeführt werden.
