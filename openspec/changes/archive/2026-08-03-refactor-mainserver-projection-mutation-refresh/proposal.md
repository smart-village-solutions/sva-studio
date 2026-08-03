# Change: Refactor Mainserver Projection Mutation Refresh

## Why
Die aktuelle Studio-Projektion fuer Mainserver-Inhalte ist in zwei Richtungen problematisch:

- Nach erfolgreichen News-, Event- oder POI-Mutationen ersetzt sie den kompletten Projektionsbestand des betroffenen Inhaltstyps, obwohl fachlich nur ein einzelner Datensatz betroffen ist.
- Die persistierte Listenprojektion und ihr Sync-State sind nicht strikt genug pro Account und Credential-Kontext isoliert. In Organisation-Kontexten koennen dadurch Snapshot-Wiederverwendung, Refresh-Zustaende und Deduplizierung zu breit ueber mehrere Accounts derselben Organisation geteilt werden.

Zusammen mit dem heutigen Vollrefresh-Verhalten fuehrt das in der Praxis zu langen Wartezeiten, spaet sichtbaren Daten und einem unklaren Cache-Verhalten. Die Liste soll immer Daten zeigen, notfalls veraltet, waehrend frische Daten im Hintergrund account-spezifisch und paginiert nachgeladen werden.

## What Changes
- Die mutationsgetriebene Mainserver-Projektionsaktualisierung wird von typweiten Vollrefreshes auf gezielte Einzeldatensatz-Aktualisierung umgestellt.
- Create- und Update-Pfade laden nach erfolgreicher Mainserver-Mutation nur den betroffenen Mainserver-Datensatz nach und aktualisieren genau dessen Projektionszeile.
- Delete-Pfade entfernen nur die betroffene Projektionszeile aus der fuehrenden Listenquelle, ohne alle Datensaetze dieses Typs neu aufzubauen.
- Die persistierte Mainserver-Projektion und ihr Sync-State werden strikt ueber `instanceId`, `actorAccountId`, `activeOrganizationId` und `contentType` isoliert; Snapshots und Refresh-Fortschritte duerfen nicht account-uebergreifend geteilt werden. Diese Scope-Definition ist mit dem aktuellen Credential-Modell kompatibel, weil User-Credentials effektiv an `keycloakSubject + instanceId` haengen, `actorAccountId` pro Instanz eindeutig aus diesem Subject aufgeloest wird und Organisation-Credentials bereits ueber `activeOrganizationId` getrennt sind.
- Der Hintergrund-Refresh wird auf einen progressiven, paginierten Ablauf umgestellt: nach Login bzw. Session-Aufbau werden fuer alle sichtbaren Mainserver-Inhaltstypen zunaechst sequentiell die jeweils ersten Seiten mit den neuesten Datensaetzen (`pageSize = 25`, Sortierung nach `updatedAt DESC`) geladen und sofort in die Projektion geschrieben; erst danach folgen sequentiell die jeweils zweiten Seiten und so weiter bis zum Ende des sichtbaren Upstream-Bestands.
- Die Inhaltsliste liest immer aus der persistierten Projektion und darf dabei bewusst auch veraltete Daten anzeigen, solange ein Hintergrund-Refresh laeuft.
- Detailansichten bleiben live gegen den Mainserver.
- Der bisherige periodische Fuenf-Minuten-Vollrefresh wird nicht mehr als primaerer Aktualisierungspfad fuer Listen benoetigt; seltene Reconciliation fuer externe Drift bleibt zulaessig.
- Wenn nach einer erfolgreichen Create- oder Update-Mutation der gezielte Detail-Read noch keinen verarbeitbaren Datensatz liefert, versucht das System fuer kurze Zeit einen begrenzten Retry und faellt erst danach auf spaetere Reconciliation zurueck, ohne die Mutation als fehlgeschlagen umzudeuten.
- Falls die Invariante `actorAccountId` im Mutationspfad wider Erwarten nicht aufgeloest werden kann, bleibt die Mutation fachlich erfolgreich, die Projektions-Nachsynchronisation wird ausgelassen und der Vorfall wird deterministisch protokolliert.

## Impact
- Affected specs: `content-management`, `sva-mainserver-integration`
- Affected code:
  - `apps/sva-studio-react/src/lib/mainserver-projection-refresh.server.ts`
  - `apps/sva-studio-react/src/lib/iam-content-list-projection.server.ts`
  - Login-/Session-nahe Hintergrund-Refresh-Anbindung in `apps/sva-studio-react`
  - Mainserver-Detailadapter und zugehoerige Mapping-Layer in `@sva/sva-mainserver/server`
  - DB-Migrationen und Projektionstabellen in `packages/data`
- Architektur-/Laufzeitwirkung:
  - strikt account-isolierte Snapshot-Speicherung trotz gemeinsamer Organisation
  - deutlich weniger Last nach Einzelmutationen
  - deutlich schnellere Sichtbarkeit der neuesten Datensaetze nach Login
  - die Liste bleibt auch waehrend laufender Synchronisation nutzbar
  - breite periodische Vollrefreshes werden von einem progressiven Refresh-Pfad verdraengt
- Risiken:
  - die Scope-Schluessel fuer Projektion, Sync-State und Deduplizierung muessen identisch definiert sein, sonst entstehen neue Inkonsistenzen
  - auch bei sequentieller Pagination muss die Last auf Studio und Mainserver beobachtbar bleiben, damit lange Refresh-Laeufe nicht unkontrolliert Ressourcen binden
  - Delete-Pfade koennen den Datensatz nicht erneut vom Mainserver lesen und muessen deshalb die Projektionszeile anhand der bekannten Identitaet entfernen
  - Detail-Nachladen nach Mutation muss dieselben Feld- und Scope-Semantiken wie der Vollabgleich einhalten
  - Credential-Cache-Schluessel und persistenter Projektions-Scope muessen fachlich deckungsgleich bleiben, obwohl der Runtime-Credential-Cache heute noch ueber `keycloakSubject` statt `actorAccountId` adressiert wird

## Scope
- Enthalten: gezielte Projektionsaktualisierung fuer News, Events und POI nach erfolgreichen Studio-initiierten Mainserver-Mutationen
- Enthalten: account- und scope-isolierte Snapshot- und Sync-State-Speicherung fuer Mainserver-Projektionen
- Enthalten: progressiver, initial konservativ sequentieller Hintergrund-Refresh nach Login bzw. Session-Aufbau, der seitenweise ueber alle sichtbaren Datentypen rotiert
- Enthalten: stale-but-visible Listenverhalten auf Basis der persistierten Projektion
- Enthalten: definierter Fallback auf spaetere Reconciliation bei Refresh-Fehlern
- Nicht enthalten: neue Benutzeroberflaechen oder neue Mainserver-Fachobjekttypen
- Nicht enthalten: Live-Listen ohne persistierte Projektion
