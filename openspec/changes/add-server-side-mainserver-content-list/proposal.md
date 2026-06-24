# Change: Serverseitige Mainserver-Content-Liste für `/admin/content`

## Why
Die aktuelle Inhaltsübersicht für Mainserver-gestützte Inhalte basiert fachlich nicht auf einer einzigen autoritativen serverseitigen Listenquelle. Der bisherige Browser-Pfad für News, Events und POI führt Vollscans über mehrere Mainserver-Fassaden aus und skaliert bei großen Beständen schlecht. Gleichzeitig ist ein requestweises Live-Mergen hinter `GET /api/v1/iam/contents` für große Bestände und Fehlerdiagnose betrieblich zu instabil.

Dadurch kann die Seite `/admin/content` zwar technisch gerendert werden, bildet Mainserver-Inhalte aber entweder langsam, unvollständig oder inkonsistent ab. Für eine belastbare Umstellung auf eine einzige Listenquelle braucht Studio ein persistentes serverseitiges Content-Read-Model mit echter datenbankseitiger Pagination.

## What Changes
- `GET /api/v1/iam/contents` wird zu einer führenden hostgeführten Inhaltslisten-Schnittstelle, die ausschließlich aus einem persistierten Read-Model liest
- Die Listenquelle materialisiert Mainserver-News, -Events und -POI serverseitig in ein gemeinsames Inhaltslistenmodell
- Die Content-Übersicht `/admin/content` verwendet nur noch diese eine serverseitige Listenquelle und führt keine Browser-Vollscans über `news`, `events` und `poi` mehr aus
- Pagination, Sortierung, Suchfilter, Typfilter und sichtbare Typen werden serverseitig und datenbankgestützt auf der Projektion angewendet
- Rechteauswertung und Fehlerabbildung bleiben hostseitig führend; ein Ausfall einer Mainserver-Quelle darf nicht mehr als endloser Ladezustand im Browser erscheinen
- Die bestehende Nicht-Dual-Write-Grenze für Mainserver-News, -Events und -POI bleibt unverändert; die Lösung führt bewusst eine separate Listenprojektion statt einer Materialisierung in `iam.contents` ein

## Impact
- Affected specs:
  - `content-management`
  - `sva-mainserver-integration`
- Affected code:
  - `packages/auth-runtime/src/iam-contents/core.ts`
  - `packages/auth-runtime/src/iam-contents/repository.ts`
  - `packages/sva-mainserver/src/server/**`
  - `apps/sva-studio-react/src/lib/iam-api.ts`
  - `apps/sva-studio-react/src/hooks/use-contents.ts`
  - `apps/sva-studio-react/src/routes/content/-content-list-page.tsx`
  - `apps/sva-studio-react/src/hooks/use-unified-content-list.ts`
  - zugehörige Unit-, Integrations- und E2E-Tests
- Affected arc42 sections:
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
