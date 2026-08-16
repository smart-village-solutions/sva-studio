# Change: Scope-gebundenen UI-Zugriff zentralisieren

## Why

Studio-Navigation, Route-Guards, Host-Seiten und Plugin-Editoren leiten ihre Verfügbarkeit derzeit aus unterschiedlichen Permission-Quellen und lokalen Zuständen ab. Dadurch können geschützte UI-Elemente während des Ladens, nach einem Organisationswechsel oder trotz fehlender Mutationsberechtigung sichtbar und scheinbar ausführbar bleiben.

Der kanonische Permission-Katalog beschreibt zwar die bekannten Rechte, erzwingt aber nicht, dass UI-Aktionen dieselben scope-gebundenen Entscheidungen wie Routing und Server-Autorisierung verwenden. Die geprüften Server-Mutationspfade bleiben die maßgebliche Sicherheitsgrenze; der UI-Vertrag muss diese Grenze korrekt abbilden und darf keine Berechtigung suggerieren.

Die serverseitige Permission-Auflösung verwendet zusätzlich prozesslokale L1- und geteilte Redis-Snapshots. `NOTIFY` und TTL beschleunigen beziehungsweise begrenzen derzeit die Invalidierung, können aber bei verlorenen Events oder parallelen Recomputes nicht allein beweisen, dass ein Snapshot noch zur aktuellen IAM-Datenrevision gehört. Da die akuten Rollendaten inzwischen korrekt aufgelöst werden, wird dies als geordnete Architekturhärtung und nicht als Hotfix umgesetzt.

## What Changes

- Führt einen einzigen, vom Host verantworteten Effective-Access-State je explizitem Plattform- oder Tenant-Scope ein; Tenant-Snapshots sind an Instanz, aktive Organisation und Modulzuweisungen gebunden.
- Verwendet die strukturierte, kontextbezogene Permission-Sicht aus `GET /iam/me/permissions` als kanonische UI-Autorisierungsquelle; `/auth/me` bleibt der Authentifizierungs- und Identitätskontext.
- Behandelt `unresolved`, `loading` und `error` für geschützte Navigation und Aktionen fail-closed und verwirft beim Scope-Wechsel alte Entscheidungen atomar; `503` oder andere nicht belastbare Permission-Reads liefern keinen partiell erlaubenden Degraded-Snapshot.
- Trennt Seitenzugriff (`read`) verbindlich von Aktionsrechten wie `create`, `update`, `delete`, `publish`, `archive`, Import- oder Administrationsaktionen.
- Führt in `@sva/iam-core` einen gemeinsamen, framework-agnostischen UI-Access-Requirement-/Decision-Vertrag und eine schlanke React-Bindung im Host ein; der Vertrag projiziert serverautoritatives IAM für die Darstellung und ist keine zweite `authorize()`-Engine.
- Übergibt Plugins hostaufgelöste, scope-gebundene Entscheidungen beziehungsweise Capabilities; Plugins dürfen UI-Berechtigungen nicht aus Rollen, Dev-Auth-Verfügbarkeit oder unscoped Action-Listen ableiten.
- **BREAKING**: Autorisierbare Plugin-Aktionen, Navigationseinträge, Routen und Admin-Resource-Aktionen müssen ihren Access-Bezug explizit deklarieren. Fehlende oder unbekannte Referenzen werden nach der Migration fail-fast abgewiesen.
- Validiert Plugin-Permissions, Module-IAM-Permissions, Action-Referenzen und Admin-Resource-Permissions gegen denselben kanonischen Katalog.
- Migriert Host- und Plugin-Oberflächen in getrennten Delivery-Slices und ergänzt eine negative Persona- und Scope-Wechsel-Testmatrix.
- Prüft alle betroffenen Server-Mutationsendpunkte separat; UI-Gates ersetzen keine serverseitige Autorisierung.
- Konsumiert für scope-beschränkte Ressourcen ausschließlich bereits serverautoritativ gelieferte Capabilities beziehungsweise bestehende Authorize-Verträge. Dieser Change erfindet keinen generischen zweiten Capability-Endpunkt und verändert nicht den im Change `use-mainserver-data-provider-as-content-author` festgelegten DataProvider-, Principal- oder Same-Credential-Vertrag.
- Führt eine in PostgreSQL autoritativ gespeicherte, monotone Permission-Cache-Revision für Instanz- und Benutzerscopes ein. L1- und Redis-Snapshots sind logisch nur gültig, wenn ihr Revisionsvektor exakt der aktuellen Revision entspricht.
- Erhöht die relevante Revision in derselben Datenbanktransaktion wie die erfolgreich gespeicherte Rollen-, Gruppen-, Membership-, Permission-, Hierarchie- oder Moduländerung. Benutzerbezogene Änderungen bumpen gezielt die Benutzerrevision; rollen-, katalog-, hierarchie- oder instanzweite Änderungen bumpen vollständig die Instanzrevision.
- Verwendet PostgreSQL `NOTIFY` weiterhin für schnelle lokale Eviction und best-effort Redis-Bereinigung, aber nicht als Korrektheitsvoraussetzung. Browser-Refetch bleibt davon getrennt; verlorene oder verspätete Events können keinen revisionsveralteten Snapshot freigeben.
- Verhindert die logische Wiederveröffentlichung veralteter Recompute-Ergebnisse durch revisionsgebundene Keys und einen Revision-Recheck vor dem Publish; physisch alte Redis-Keys dürfen bis TTL oder asynchroner Bereinigung verbleiben, sind aber nicht mehr adressierbar.
- Trennt revisionsbasierte Invalidierung, Browser-Refetch und Session-Widerruf in eigenständige Verträge. Ein manueller Permission-Cache-Reset ist nicht Bestandteil dieses Changes.

## Impact

- Affected specs: `account-ui`, `iam-access-control`, `local-dev-auth`, `plugin-actions`, `routing`
- Affected code:
  - `apps/sva-studio-react` (`AuthProvider`, Organisationskontext, Routing-Bindings, Sidebar, IAM-, Media-, Interfaces- und Monitoring-Seiten)
  - `packages/iam-core` für den framework-agnostischen UI-Access-Requirement-/Decision-Vertrag
  - `packages/plugin-sdk` für Plugin-Action-, Admin-Resource- und Session-Access-Verträge
  - `packages/routing` für scope-gebundene Route-Guards
  - `packages/studio-module-iam` für die vollständige Mutationsklassifizierung des Permission-Katalogs
  - priorisierte Fachplugins, insbesondere Standard-Content-Plugins sowie Surveys und Waste Management
  - `packages/auth-runtime` für Revision-Read, L1-/Redis-Snapshot-Pfad, Recompute-Fencing, `NOTIFY` und strukturierte Cache-Diagnostik
  - `packages/data-repositories` und IAM-Migrationen für die autoritative Revisionspersistenz
- Affected arc42 sections:
  - `04-solution-strategy`
  - `05-building-block-view`
  - `06-runtime-view`
  - `08-cross-cutting-concepts`
  - `09-architecture-decisions`
  - `10-quality-requirements`
  - `11-risks-and-technical-debt`
- Related active change: `refactor-cross-cutting-runtime-guardrails`; dessen Plugin-Cross-Validation soll wiederverwendet und nicht parallel dupliziert werden.
- Related active change: `use-mainserver-data-provider-as-content-author`; dessen serverautoritiver Mainserver-Ownership-, Principal- und Ressourcen-Scope-Vertrag bleibt führend und wird nur konsumiert.
- Related ADRs: ADR-014 (`Postgres NOTIFY`) wird von korrektheitsführend zu beschleunigend fortgeschrieben; ADR-026 (`Redis als primärer Shared Permission Cache`) bleibt gültig, wird aber um den PostgreSQL-autoritativ geprüften Revisionsvektor ergänzt.
- Datenbank-Schema-Change: monotone Instanz- und Benutzerrevisionen für Permission-Snapshot-Gültigkeit; Schema-Snapshot und Schema-Dokumentation werden verbindlich mitgeführt.
- Nicht enthalten: Korrektur bestehender Rollendaten, kurzfristiger Hotfix, Änderung des fachlichen Rollen-/Permission-Modells oder impliziter Session-Widerruf.
