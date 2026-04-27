# Design: Vollständiges Mainserver-News-Datenmodell

## Context

Die erste News-Mainserver-Integration war bewusst ein produktiver Phase-1-Schnitt: veröffentlichte News, Pflichtdatum, schlanker `payload`, hostgeführte Fassade, keine lokalen IAM-News. Diese Architektur bleibt richtig. Für News als Referenzmuster für Events und POI reicht der schmale Feldumfang aber nicht mehr aus, weil er das tatsächliche Mainserver-Datenmodell nicht vollständig repräsentiert.

Dieser Change erweitert deshalb nur die News-Fachmodellabdeckung. Die Sicherheits- und Boundary-Entscheidungen aus der Mainserver-News-Integration bleiben unverändert:

- Plugins sprechen nur host-owned HTTP-Verträge.
- Auth, CSRF, Idempotency, lokale Content-Primitives, Mainserver-Credentials, Logging und Fehlerklassifikation bleiben serverseitig.
- `@sva/sva-mainserver/server` exportiert typed Adapter, keinen generischen GraphQL-Executor.
- Delete bleibt fachlich der verifizierte harte `destroyRecord(id, recordType: "NewsItem")`-Pfad.
- Update bleibt der verifizierte `createNewsItem(id, forceCreate: false)`-Pfad.

## GraphQL Snapshot Contract

Der eingecheckte Snapshot definiert für `NewsItem`:

| Feld | Typ | Studio-Behandlung |
| --- | --- | --- |
| `id` | `ID` | read-only Identifier |
| `title` | `String` | editierbar |
| `author` | `String` | editierbar |
| `keywords` | `String` | editierbar |
| `externalId` | `String` | editierbar |
| `fullVersion` | `Boolean` | editierbar |
| `charactersToBeShown` | `String` | editierbar, Mutation nutzt `Int` |
| `newsType` | `String` | editierbar |
| `publicationDate` | `String` | editierbar, als Mainserver-Publikationsdatum |
| `publishedAt` | `String` | editierbar, weiterhin für veröffentlichte News verpflichtend |
| `showPublishDate` | `Boolean` | editierbar |
| `payload` | `JSON` | Legacy-Lesefallback, bei Create/Update nicht schreiben |
| `sourceUrl` | `WebUrl` | editierbar |
| `address` | `Address` | editierbar |
| `categories` | `[Category!]` | editierbar über `CategoryInput` und/oder `categoryName` |
| `contentBlocks` | `[ContentBlock!]` | editierbar |
| `visible` | `Boolean` | read-only Statusableitung; keine Draft-Workflows |
| `createdAt` | `String` | read-only |
| `updatedAt` | `String` | read-only |
| `dataProvider` | `DataProvider` | read-only |
| `settings` | `Setting` | read-only |
| `announcements` | `[Shout!]` | read-only, keine Pflege über News |
| `likeCount` | `Int!` | read-only |
| `likedByMe` | `Boolean!` | read-only |
| `pushNotificationsSentAt` | `String` | read-only |

`createNewsItem` akzeptiert:

- `id`, `forceCreate`
- `pushNotification`
- `author`, `keywords`, `title`, `externalId`
- `fullVersion`, `charactersToBeShown`, `newsType`
- `publicationDate`, `publishedAt`, `showPublishDate`
- `categoryName`, `categories`
- `sourceUrl`
- `address`
- `contentBlocks`
- `pointOfInterestId`

## Decisions

### Typed News DTOs

`@sva/sva-mainserver` erhält ein vollständiges News-DTO mit verschachtelten Subtypen:

- `SvaMainserverNewsItem`
- `SvaMainserverNewsInput`
- `SvaMainserverNewsPayload`
- `SvaMainserverWebUrl`
- `SvaMainserverAddress`
- `SvaMainserverGeoLocation`
- `SvaMainserverCategory`
- `SvaMainserverCategoryInput`
- `SvaMainserverContentBlock`
- `SvaMainserverMediaContent`
- `SvaMainserverDataProvider`
- `SvaMainserverSetting`
- `SvaMainserverAnnouncementSummary`

Die Plugin-nahen Typen in `@sva/plugin-news` spiegeln das editierbare Modell und die read-only Detaildaten, ohne Servermodule zu importieren.

### Payload ist Legacy-Lesefallback

Das bestehende `payload` wird nicht mehr als editierbares Plugin-Modell verwendet und bei Create/Update nicht mehr an `createNewsItem` gesendet. Mainserver-Felder mit dedizierten GraphQL-Argumenten werden als eigene Top-Level-Felder modelliert.

Bestehende Phase-1-News können noch `payload` enthalten. Beim Lesen wird `payload` ausschließlich als Legacy-Fallback genutzt:

- Wenn `contentBlocks` fehlen oder leer sind und `payload.body` vorhanden ist, erzeugt der Adapter einen virtuellen ersten ContentBlock.
- `payload.teaser` wird als `intro` dieses virtuellen ContentBlocks übernommen.
- `payload.imageUrl` wird als URL-basierter `mediaContent` übernommen, sofern die URL gültig ist.
- `payload.externalUrl` und `payload.category` werden nur für kompatible Anzeige/Migration gelesen, aber nicht in `payload` zurückgeschrieben.
- Beim Speichern wird nur das vollständige Top-Level-Modell gesendet; `payload` bleibt ungesendet.

### Publication Dates

`publishedAt` bleibt für produktive veröffentlichte News verpflichtend. `publicationDate` wird zusätzlich als Mainserver-Feld abgebildet:

- Wenn `publicationDate` gesetzt ist, wird es separat an `createNewsItem` gesendet.
- Die UI zeigt `publicationDate` als eigenes Feld.
- Wenn nur `publishedAt` gesetzt ist, darf der Adapter `publicationDate` für kompatibles Mainserver-Verhalten aus `publishedAt` ableiten, sofern dies dokumentiert und getestet ist.
- Listen- und Detail-Mapping nutzen deterministische Priorität für Anzeige und Sortierung.

### Categories

Der Snapshot bietet sowohl `categoryName` als Mutation-Argument als auch `categories: [CategoryInput!]`.

Der Change modelliert beide:

- `categoryName` bleibt einfacher Einzelkategorie-Kompatibilitätspfad.
- `categories` wird als strukturierte Kategorie-Liste mit `name`, `payload` und `children` unterstützt.
- Beim Lesen werden `categories` vollständig als read/write-fähiges Modell gemappt, soweit die Felder im Snapshot vorhanden sind.
- Konflikte zwischen `payload.category`, `categoryName` und `categories` werden validiert und deterministisch normalisiert oder abgelehnt.

### Content Blocks And Media

`contentBlocks` werden als strukturierte Inhaltsabschnitte modelliert:

- `title`
- `intro`
- `body`
- `mediaContents`

`mediaContents` werden nur als URL-basierte Mainserver-Medienreferenzen über `sourceUrl` modelliert. Es wird kein Media-Upload in diesen Change aufgenommen. Ein späterer Media-Management-Change kann Upload-/Asset-Auswahl ergänzen.

`contentBlocks` sind der führende News-Inhalt. `ContentBlockInput` enthält keine `id`; Updates senden daher die gesamte Blockliste als neuen Zustand. Die Staging-Verifikation hat bestätigt, dass Create/Update ohne `payload`, mehrere Blöcke, geänderte Blocklisten und leere Blocklisten funktionieren.

### Address And Point Of Interest

`address` wird vollständig nach Snapshot-`AddressInput` unterstützt:

- `id`
- `addition`
- `street`
- `zip`
- `city`
- `kind`
- `geoLocation`

`pointOfInterestId` ist ein schreibbares optionales Feld. Der Editor darf mit einem einfachen ID-Feld starten; eine spätere POI-Auswahl darf darauf aufbauen, ohne eine Plugin-Abhängigkeit von News auf POI einzuführen.

### Push Notifications

`pushNotification` ist eine operationelle Create-only-Option, kein persistiertes `NewsItem`-Feld. Die UI muss eindeutig machen, dass diese Option eine Mainserver-Aktion auslöst und nicht als dauerhaftes Formularfeld geladen wird. Updates senden `pushNotification` nicht. `pushNotificationsSentAt` wird read-only angezeigt, wenn vorhanden.

### Read-only Fields

Folgende Felder werden gelesen, gemappt und im Detailkontext verfügbar gemacht, aber nicht bearbeitet:

- `dataProvider`
- `settings`
- `announcements`
- `likeCount`
- `likedByMe`
- `pushNotificationsSentAt`

Wenn die UI diese Felder nicht prominent anzeigt, müssen sie dennoch in DTOs und Tests abgedeckt sein, damit der Adapter das volle GraphQL-Modell versteht.

## Validation

Die Fassade validiert vor GraphQL:

- Pflichtfelder: `title`, `publishedAt`
- Mindestens ein ContentBlock mit `body`, außer der Benutzer entfernt bewusst alle Blöcke
- Datumsfelder als gültige ISO-kompatible Strings
- URL-Felder in `sourceUrl`, Payload-URLs und Media-URLs als HTTPS oder bewusst erlaubte Mainserver-kompatible URLs
- `charactersToBeShown` als nicht-negative Ganzzahl, obwohl der Rückgabewert als String geliefert werden kann
- verschachtelte Arrays mit sinnvollen Größenlimits
- keine unbekannten Top-Level-Mutationsfelder
- keine PII oder Secrets in Payload, Logs oder Fehlerantworten

## Rollout And Compatibility

Bestehende Phase-1-News bleiben lesbar. Fehlende optionale Felder werden nicht als invalid response behandelt. Nullable Mainserver-Felder werden null-tolerant geparst und auf stabile Pluginwerte normalisiert. Bestehende Payload-Inhalte werden beim ersten Speichern in `contentBlocks` überführt; `payload` wird nicht erneut geschrieben.

Die Erweiterung ist API-erweiternd für das Plugin-Modell, aber sie ändert die Form des HTTP-Fassadenvertrags. Tests müssen sicherstellen, dass bestehende einfache Create-/Update-Payloads weiterhin funktionieren.

## Resolved Questions

- `newsType` bleibt in diesem Change ein getrimmter Freitextwert. Eine fachliche Allow-List wird erst eingeführt, wenn der Mainserver ein stabiles Enum oder eine verbindliche Werteliste bereitstellt.
- `payload.category` ist nur Legacy-Lesefallback und wird nicht geschrieben. `categoryName` bleibt der einfache Kompatibilitätspfad, `categories` die strukturierte Liste. Konflikte zwischen `categoryName` und `categories` werden in Phase 1 nicht abgelehnt; die Fassade validiert Form und Feldgrenzen, sendet beide expliziten Felder aber unverändert an den Mainserver.
