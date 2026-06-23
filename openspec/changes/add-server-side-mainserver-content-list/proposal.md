# Change: Serverseitige Mainserver-Content-Liste fuer `/admin/content`

## Why
Die aktuelle Inhaltsuebersicht fuer Mainserver-gestuetzte Inhalte basiert fachlich nicht auf einer einzigen autoritativen serverseitigen Listenquelle. Der bisherige Browser-Pfad fuer News, Events und POI fuehrt Vollscans ueber mehrere Mainserver-Fassaden aus und skaliert bei grossen Bestaenden schlecht. Gleichzeitig liest `GET /api/v1/iam/contents` heute nur aus `iam.contents`, obwohl Mainserver-News, -Events und -POI produktiv nicht per Dual-Write in diese Tabelle geschrieben werden.

Dadurch kann die Seite `/admin/content` zwar technisch gerendert werden, bildet aber Mainserver-Inhalte entweder langsam, unvollstaendig oder inkonsistent ab. Fuer eine belastbare Umstellung auf eine einzige Listenquelle braucht Studio eine hostgefuhrte serverseitige Aggregation und Pagination fuer Mainserver-gestuetzte Inhalte.

## What Changes
- `GET /api/v1/iam/contents` wird von einem reinen IAM-Repository-Listing zu einer fuehrenden hostgefuhrten Inhaltslisten-Schnittstelle fuer die Content-Uebersicht erweitert
- Die Listenquelle aggregiert Mainserver-News, -Events und -POI serverseitig in ein gemeinsames Inhaltslistenmodell
- Die Content-Uebersicht `/admin/content` verwendet nur noch diese eine serverseitige Listenquelle und fuehrt keine Browser-Vollscans ueber `news`, `events` und `poi` mehr aus
- Pagination, Sortierung, Suchfilter, Typfilter und sichtbare Typen werden serverseitig auf den aggregierten Bestand angewendet
- Rechteauswertung und Fehlerabbildung bleiben hostseitig fuehrend; ein Ausfall einer Mainserver-Quelle darf nicht mehr als endloser Ladezustand im Browser erscheinen
- Die bestehende Nicht-Dual-Write-Grenze fuer Mainserver-News, -Events und -POI bleibt unveraendert; die Loesung fuehrt bewusst keine Materialisierung in `iam.contents` ein

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
  - zugehoerige Unit-, Integrations- und E2E-Tests
- Affected arc42 sections:
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
