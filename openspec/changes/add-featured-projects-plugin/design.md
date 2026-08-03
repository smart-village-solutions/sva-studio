## Kontext

Featured Projects sind fachlich abgegrenzte GenericItems. Im Unterschied zu FAQ und Kacheln soll das Projekte-Plugin einen größeren Teil des vorhandenen GenericItem-Editors als Ausgangspunkt verwenden. Es bleibt dennoch ein eigenständiges Plugin mit eigenem Modell, eigenen Berechtigungen und eigener Weiterentwicklung.

## Ziele und Nicht-Ziele

- Ziele: eigenständiges Fachplugin, feste Typabgrenzung, vollständiger FeaturedProject-Vertrag, host-owned Lifecycle, wiederverwendbare External-Content-Referenz, abwärtskompatible Mainserver-Abbildung, geordnete Bildergalerie, eigene IAM-Actions und Erhaltung verborgener GenericItem-Felder im Studio-Schreibpfad.
- Nicht-Ziele: gemeinsame Form-Engine, Plugin-Vererbung, Übersetzungsbeziehungen, Sprach-Fallbacks, eine gemischte Projekt-Collection oder die Migration bestehender GenericItem-Fachtypen.

## Entscheidungen

### Einmalige Kopiervorlage mit unabhängiger Ownership

`@sva/plugin-projects` wird als eigenes Workspace-Package aus dem vollständigen `@sva/plugin-generic-items` abgeleitet. Nach der Ableitung gibt es keine Runtime-Abhängigkeit und keine automatische Synchronisierung zwischen beiden Fachplugins. Nicht benötigte Felder werden ausschließlich in der Projekte-UI ausgeblendet. Stabile, nachweislich mehrfach benötigte technische Primitives dürfen später separat in vorhandene Workspace-Pakete extrahiert werden.

### Kanonische Abbildung

| FeaturedProject-Feld | GenericItem-Feld | Verhalten |
| --- | --- | --- |
| `Id` | `id` | systemverwaltet, nur lesbar |
| `Language` | `payload.language` | Pflichtfreitext, trimmen, jederzeit editierbar |
| `Title` | `title` | Pflichtfeld |
| `Description` | `teaser` | Pflichtfeld |
| `FullText` | `contentBlocks[0].body` | Pflichtfeld, Rich Text |
| `Images` | `mediaContents` | optionale, geordnete Bildergalerie |
| `Status` | `payload.status` | `draft`, `published` oder `archived` |
| `Published` | aus `payload.status` abgeleitet | `true` nur für `published` |
| `PublishedAt` | `publishedAt` | hostverwaltet; für `published` erforderlich |
| `Author` | `author` plus hostseitige Autorenmetadaten | genau eine Organisation oder Person |
| `Deleted` | `payload.deleted` | systemverwalteter Soft-Delete-Status |
| `CreatedAt` | `createdAt` | systemverwaltet, nur lesbar |
| `UpdatedAt` | `updatedAt` | systemverwaltet, nur lesbar |

Die fachliche API gibt ausschließlich dieses Modell aus. `Published` bleibt ein nur lesbares, abgeleitetes Kompatibilitätsfeld und ist weder Teil des Mutationseingangs noch die führende Statusinformation. `Type`, `Translations`, `ImageUrl`, `ImageCaption` und `ImageCredits` sind nicht Teil des Vertrags. Anhänge und strukturierte externe Links werden nicht angeboten.

### Host-owned Lifecycle und Mainserver-Abbildung

Der hostseitige Content-Core bleibt die führende Quelle für Lifecycle, Validierung, Veröffentlichung, History und Audit. Das Projekte-Plugin definiert keine abweichende Lifecycle-Semantik. Der unveränderte GenericItem-Vertrag besitzt keinen eigenen dreistufigen Status; deshalb spiegelt der Studio-Adapter den hostseitigen Status als Transportabbildung unter `payload.status` und leitet `visible` deterministisch ab:

| `payload.status` | `visible` | Bedeutung |
| --- | ---: | --- |
| `draft` | `false` | Entwurf |
| `published` | `true` | veröffentlicht |
| `archived` | `false` | archiviert |

Die Abbildung wird in diesem Change ausschließlich für Featured Projects umgesetzt. Bestehende Generic Items, FAQ und Kacheln ohne `payload.status` behalten ihr heutiges Verhalten, bei dem der Studio-Status aus `visible` als Entwurf oder veröffentlicht abgeleitet wird. Es findet keine automatische Migration statt. Eine spätere Einführung in weiteren Fachplugins benötigt eine eigene fachliche Freigabe und Migration.

Neue Projekte starten als `draft`. Der Editor bearbeitet den hostseitigen `Status`; `Published` wird daraus abgeleitet und nicht als Eingabe akzeptiert. Beim Übergang zu `published` verwaltet der Host einen konsistenten `PublishedAt`-Wert. Dadurch sind widersprüchliche Kombinationen wie `Published: true` und `Status: archived` ausgeschlossen.

### Autorenschaft

Jedes Projekt besitzt genau einen sichtbaren Autor: eine Organisation oder eine Person. Ownership und Autorenanzeige bleiben getrennt; `ownerUserId` und `ownerOrganizationId` steuern die Autorisierung, nicht die sichtbare Autorenschaft. Der Host wendet die aktive Organisationsrichtlinie an und transportiert den vom Mainserver unterstützten Anzeigewert über `author`; die eindeutige Autorenart und technische Referenz bleiben host-owned.

### Wiederverwendbare externe Content-Identität

Der Change führt als allgemeine Host-Infrastruktur eine External-Content-Referenz ein. Sie ordnet genau einen lokalen Datensatz aus `iam.contents` einer externen Entität über `instanceId`, `sourceSystem`, `sourceEntityType` und `sourceEntityId` zu. Für Projekte lauten Quellsystem und Entitätstyp `mainserver` und `GenericItem`. Eindeutige Constraints verhindern, dass eine externe Entität mehreren lokalen Inhalten oder ein lokaler Inhalt mehreren Referenzen derselben Quelle zugeordnet wird.

Der lokale Content-Core besitzt Lifecycle, Veröffentlichung, Autorenschaft, Ownership und Validierung. Der Mainserver besitzt Fachtext und Medien. Bei Abweichungen gewinnt der lokale Core für host-owned Metadaten; Mainserver-Werte gewinnen für fachliche Inhaltsfelder. Die Referenz führt einen Reconciliation-Status, damit unbekannte oder partielle Ergebnisse sichtbar und wiederaufnehmbar bleiben, ohne stillschweigend eine Quelle zu überschreiben.

Create verwendet den vorhandenen `Idempotency-Key`-Vertrag und schreibt eine stabile Studio-Operations-ID zusätzlich als Mainserver-`externalId`. Nach verloren gegangener Antwort kann der Host den Datensatz darüber wiederfinden und die Referenz finalisieren, statt ein Duplikat anzulegen. Der Change erweitert keine zweite generische Idempotenz- oder Job-Infrastruktur.

Der Ablauf lautet:

1. Idempotenz reservieren und lokalen Content-Core mit noch ungebundener externer Referenz vorbereiten.
2. GenericItem mit stabiler `externalId` im Mainserver anlegen.
3. Mainserver-ID binden, Spiegelwerte prüfen und lokalen Zustand finalisieren.
4. Bei eindeutigem Providerfehler die Idempotenz als fehlgeschlagen abschließen; bei unbekanntem Ergebnis `reconciliation_required` setzen und über `externalId` reparieren.

Update und Soft Delete laden Core und Referenz, autorisieren und validieren zuerst, führen anschließend die Mainserver-Mutation aus und finalisieren danach den lokalen Zustand. Studio-Mutationen je Referenz werden serialisiert. Da der Mainserver keine Revision unterstützt, kann Reconciliation externe Paralleländerungen erkennen und Spiegelwerte reparieren, aber fachliche Konflikte nicht verlustfrei zusammenführen.

### Historie folgt separat

Dieser Change implementiert keine sichtbare Inhaltshistorie und keinen Historien-Tab. `standardize-plugin-content-history` muss die hier eingeführte External-Content-Referenz und Operationskorrelation wiederverwenden, statt eine zweite Identitäts- oder Persistenzstrecke aufzubauen. Es ergänzt später die host-owned History-Capability, `content.readHistory`, Erfolgsfinalisierung und den Herkunftshinweis für ausschließlich im Studio erfasste Mutationen.

### Bildabbildung und Reihenfolge

| FeaturedProject-Bildfeld | GenericItem-Medienfeld |
| --- | --- |
| `Url` | `sourceUrl.url` |
| `AltText` | `sourceUrl.description` |
| `Caption` | `captionText` |
| `Credits` | `copyright` |
| `Position` | nullbasierte Position in `mediaContents` |

`Url`, `AltText` und `Position` sind für jedes vorhandene Bild verpflichtend. Die API erzeugt `Position` deterministisch aus der Array-Reihenfolge und normalisiert eingehende Positionen zu einer lückenlosen Reihenfolge. Das erste Bild ist Titel- und Vorschaubild. Die Oberfläche ermöglicht Auswahl, Upload, Entfernen und barrierefreies Umsortieren.

### Sprache und unabhängige Datensätze

`Language` ist ein nicht leeres, getrimmtes Freitextfeld ohne Werteliste und ohne BCP-47-Validierung. Es darf nach dem Anlegen geändert werden. Jede Sprachfassung ist ein vollständig unabhängiger Datensatz; das System erzeugt weder Verknüpfungen noch Fallbacks oder automatische Übersetzungen.

### Verborgene Felder und verlustfreie Aktualisierung

Das Projektformular bearbeitet nur das FeaturedProject-Modell. Beim Aktualisieren führt der Server die kontrollierten Projektfelder mit dem unmittelbar zuvor gelesenen GenericItem zusammen. Verborgene GenericItem-Felder und unbekannte Payload-Schlüssel bleiben im Studio-Schreibpfad erhalten; lediglich `payload.language`, die hostseitige Statusspiegelung `payload.status` und der systemverwaltete Wert `payload.deleted` werden vom Projekte-Vertrag kontrolliert. Ausblenden darf niemals implizit löschen oder zurücksetzen. Da der unveränderte GenericItem-Vertrag keine Revision und kein `If-Match` anbietet, kann der Adapter konkurrierende externe Änderungen zwischen Lesen und Schreiben nicht konfliktfrei garantieren.

### Typ-, API- und Projektionsabgrenzung

`genericType: "PROJECT"` ist die technische Mainserver-Diskriminierung und kein Feld der fachlichen API. Die Studio-Projektion ordnet solche Datensätze ausschließlich `projects.project` zu. Listen-, Detail-, Update- und Delete-Pfade behandeln IDs fremder GenericItem-Typen wie unbekannte IDs und führen keine Mutation aus. Die Projekte-Collection enthält ausschließlich nicht gelöschte Featured Projects; ein Studio-Löschvorgang setzt `payload.deleted` und entfernt den Eintrag aus aktiven Studio-Listen und -Projektionen. Dies ist eine Studio-Konvention und keine globale Löschgarantie für externe Mainserver-Clients.

### Editor-Workspace

Die Tab-Reihenfolge lautet `Basis`, `Inhalt`, `Einstellungen`. `Basis` enthält Sprache, Titel und Kurzbeschreibung. `Inhalt` enthält Rich Text und Bildergalerie. `Einstellungen` enthält den redaktionellen Status und nur lesbare Metadaten. `Published` wird aus dem Status abgeleitet; `Deleted` und `genericType` sind keine editierbaren Formularfelder. `Historie` wird erst durch `standardize-plugin-content-history` ergänzt.

## Risiken und Abwägungen

- Die vollständige Kopie erhöht zunächst die pluginlokale Codefläche. Sie reduziert dafür die Laufzeitkopplung und erlaubt projektspezifische Änderungen ohne Seiteneffekte auf Generic Items.
- `AltText` wird im bestehenden Mainserver-Medienmodell über `sourceUrl.description` transportiert. Der projektspezifische Adapter muss diese Semantik an allen Lese- und Schreibgrenzen konsistent erzwingen.
- Soft Delete weicht von einem physischen GenericItem-Delete ab und kann außerhalb des Studio-Vertrags umgangen werden. Studio-Listen, Detailzugriffe, Projektion und Wiederholungsaufrufe müssen den Marker konsistent behandeln.
- Bei bestehenden Datensätzen können verborgene Felder gefüllt sein. Merge-basierte Updates und Regressionstests schützen diese Daten vor unbeabsichtigtem Verlust.
- Ohne Mainserver-Revisionsvertrag bleibt ein Race zwischen Studio-Lesen und externem Schreiben erkennbar, aber nicht konfliktfrei lösbar.
- Lokaler Core und Mainserver können nicht atomar in einer Datenbanktransaktion geändert werden. Bestehende Idempotenz, stabile `externalId`, persistierter Reconciliation-Status und ein expliziter Repair-Pfad begrenzen Teilerfolge.

## Teststrategie

- Unit-Tests für alle Mapper, Pflichtfelder, freien Sprachwert, Rich Text, Status-zu-Sichtbarkeit-Abbildung, Bildmetadaten, Positionen, Payload-Erhaltung und Soft Delete.
- Komponenten-Tests für Tab-Reihenfolge, Pflichtfeldfehler, Rich-Text-Bearbeitung, Bildauswahl/Upload, barrierefreies Umsortieren, Titelbildregel und schreibgeschützte Metadaten.
- Host-Tests für IAM, Autorenrichtlinie, External-Content-Eindeutigkeit, Idempotenz-Replay, verlorene Providerantwort, Reconciliation, Fremdtyp-Abgrenzung, vollständiges Upstream-Paging bis zum nachgewiesenen Ende, Projektion ohne Doppelanzeige, Soft Delete und CRUD.
- API-Vertragstests stellen sicher, dass `Type`, `Translations` und die abgelösten Einzelbildfelder nicht ausgegeben werden.
- Ein E2E-Flow deckt Anlegen, Bearbeiten, Veröffentlichen, Bildreihenfolge und Löschen ab.
- Nach jedem Änderungsblock laufen die kleinsten relevanten Nx-Unit-, Type- und Server-Runtime-Gates; vor PR-Freigabe nach Möglichkeit `pnpm test:pr`.

