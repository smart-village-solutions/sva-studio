# Change: Serverseitige Mainserver-Content-Liste für `/admin/content`

## Why
Die aktuelle Inhaltsübersicht für Mainserver-gestützte Inhalte basiert fachlich nicht auf einer einzigen autoritativen serverseitigen Listenquelle. Der bisherige Browser-Pfad für News, Events und POI führt Vollscans über mehrere Mainserver-Fassaden aus und skaliert bei großen Beständen schlecht. Gleichzeitig liest `GET /api/v1/iam/contents` heute nur aus `iam.contents`, obwohl Mainserver-News, -Events und -POI produktiv nicht per Dual-Write in diese Tabelle geschrieben werden.

Dadurch kann die Seite `/admin/content` zwar technisch gerendert werden, bildet aber Mainserver-Inhalte entweder langsam, unvollständig oder inkonsistent ab. Für eine belastbare Umstellung auf eine einzige Listenquelle braucht Studio eine hostgeführte serverseitige Aggregation und Pagination für Mainserver-gestützte Inhalte.

## What Changes
- `GET /api/v1/iam/contents` wird von einem reinen IAM-Repository-Listing zu einer führenden hostgeführten Inhaltslisten-Schnittstelle für die Content-Übersicht erweitert
- Die Listenquelle aggregiert Mainserver-News, -Events und -POI serverseitig in ein gemeinsames Inhaltslistenmodell
- Die Content-Übersicht `/admin/content` verwendet nur noch diese eine serverseitige Listenquelle und führt keine Browser-Vollscans über `news`, `events` und `poi` mehr aus
- Pagination, Sortierung, Suchfilter, Typfilter und sichtbare Typen werden serverseitig auf den aggregierten Bestand angewendet
- Rechteauswertung und Fehlerabbildung bleiben hostseitig führend; ein Ausfall einer Mainserver-Quelle darf nicht mehr als endloser Ladezustand im Browser erscheinen
- Die bestehende Nicht-Dual-Write-Grenze für Mainserver-News, -Events und -POI bleibt unverändert; die Lösung führt bewusst keine Materialisierung in `iam.contents` ein

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
