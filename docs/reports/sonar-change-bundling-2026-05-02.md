# SonarCloud-Bündelung für anstehende Changes am 2026-05-02

## Ausgangslage

- Maßgeblicher SonarCloud-Stand: Analyse vom 2026-05-02 17:43 UTC
- Projekt: `smart-village-app_sva-studio`
- Quality Gate: `ERROR`
- Aktueller Gate-Befund: `new_coverage` liegt bei `74.8` und damit unter dem Schwellwert `80`
- In der öffentlichen Hotspot-Abfrage waren keine offenen Security Hotspots sichtbar

## Ziel

Diese Arbeitsliste ordnet offene SonarCloud-Issues nur dann einem aktiven Change zu, wenn die betroffenen Stellen durch den jeweiligen Change ohnehin fachlich umgebaut werden. Alles andere bleibt bewusst außerhalb des Scopes, damit kein generischer Cleanup in fachliche Änderungen hineinwuchert.

## add-mainserver-plugin-list-pagination

### Take now

- `packages/sva-mainserver/src/server/service.ts`
  - Regeln: `typescript:S3776`, `typescript:S7735`
  - Grund: Der Change führt serverseitige Pagination, `hasNextPage`-Ermittlung und Query-Normalisierung ein. Die betroffenen Funktionen enthalten genau den Listen- und Sichtbarkeitsfluss, der im Pagination-Umbau ohnehin zerlegt werden muss.
- `apps/sva-studio-react/src/lib/mainserver-news-api.server.ts`
  - Regeln: `typescript:S3776`, `typescript:S7735`
  - Grund: Die News-Adapter validieren Query- und Request-Flows für Listen und Mutationen. Für typisierte Search-Params und paginierte Host-Routen ist eine Entzerrung des Kontrollflusses fachlich deckungsgleich.
- `apps/sva-studio-react/src/lib/mainserver-events-poi-api.server.ts`
  - Regeln: `typescript:S3776`, `typescript:S7735`
  - Grund: Gleicher Grund wie bei News; die Event-/POI-Adapter werden für denselben Pagination-Vertrag umgebaut.
- `packages/plugin-news/src/news.pages.tsx`
  - Regeln: `typescript:S3776`, `typescript:S2004`, `typescript:S3358`, `typescript:S3735`, `typescript:S6478`, `typescript:S6479`
  - Grund: Die News-Liste ist explizit im Scope des Changes. Der Wechsel auf `StudioDataTable`, URL-getriebene Paging-States und eine neue Paging-Bedienung rechtfertigt die Mitnahme der Listen- und Render-Smells an genau diesen Stellen.

### Optional if touched

- `packages/plugin-events/src/events.pages.tsx`
  - Regeln: aktuell keine sichtbaren offenen Befunde in der öffentlichen Trefferliste
  - Grund: Wenn die Migration auf `StudioDataTable` neue gemeinsame Hilfsbausteine erzwingt, können kleine Strukturverbesserungen direkt mitgenommen werden. Ohne konkrete Sonar-Befunde kein eigener Cleanup-Auftrag.
- `packages/plugin-poi/src/poi.pages.tsx`
  - Regeln: aktuell keine sichtbaren offenen Befunde in der öffentlichen Trefferliste
  - Grund: Gleiche Einordnung wie bei Events.

### Defer

- `packages/studio-ui-react/src/*`
  - Regeln: z. B. `typescript:S6819`, `typescript:S1874`, `typescript:S6759`
  - Grund: Das sind generische UI-Bibliotheksbefunde und keine paginationsspezifischen Änderungen. Nur anfassen, wenn der Change tatsächlich neue `StudioDataTable`-APIs benötigt und die Sonar-Stelle direkt berührt.
- `packages/sva-mainserver/src/server/service.ts` an Stellen außerhalb der Listenpfade
  - Regeln: einzelne `S3776`-/`S7735`-Befunde außerhalb des Pagination-Pfads
  - Grund: Nicht jeder Mainserver-Smell gehört automatisch zu diesem Change. Nur die Listen- und Sichtbarkeitslogik ist Pflichtteil.

### Coverage- und Testhinweise

- Dieser Change kann das Quality Gate nur dann nachhaltig verbessern, wenn neben Refactors auch die neuen Listenpfade getestet werden.
- Mindest-Gates:
  - `pnpm nx run plugin-news:test:unit`
  - `pnpm nx run plugin-events:test:unit`
  - `pnpm nx run plugin-poi:test:unit`
  - `pnpm nx run sva-studio-react:test:unit`
  - `pnpm nx run sva-mainserver:test:unit`
  - `pnpm nx affected --target=test:types --base=origin/main`

## refactor-runtime-module-iam-contract-source

### Take now

- `packages/plugin-sdk/src/plugins.ts`
  - Regeln: `typescript:S3776`, `typescript:S6564`, `typescript:S7765`, `typescript:S7758`, `typescript:S4325`
  - Grund: Der Change führt eine gemeinsame Runtime-Quelle für Modul-IAM-Verträge ein. Registry-Merge-, Contract-Normalisierungs- und Guardrail-Logik in `plugins.ts` ist direkt auf dieser Contract-Kante und sollte im selben Umbau gestrafft werden.
- `packages/auth-runtime/src/iam-instance-registry/provisioning-auth.ts`
  - Regeln: `typescript:S7763`
  - Grund: Die Datei ist ein reiner Re-Export-/Wiring-Pfad für den gemeinsamen Contract-Edge. Die Sonar-Empfehlung passt unmittelbar zum Refactor-Ziel.
- `packages/auth-runtime/src/iam-instance-registry/core-runtime.ts`
  - Regeln: `typescript:S7763`
  - Grund: Gleiche Einordnung wie oben; Runtime-Wiring wird für die neue Contract-Quelle ohnehin angefasst.
- `packages/auth-runtime/src/iam-instance-registry/service-keycloak.ts`
  - Regeln: `typescript:S7763`
  - Grund: Re-Export- und Adapter-Wiring liegt direkt auf dem Pfad, der vom gemeinsamen Contract-Edge profitieren soll.

### Optional if touched

- `packages/instance-registry/src/service-keycloak.ts`
  - Regeln: `typescript:S3358`, `typescript:S7763`
  - Grund: Falls der gemeinsame Contract-Edge die Handler-Zusammensetzung in dieser Datei verändert, können die Re-Export- und kleine Struktur-Smells mitgenommen werden.
- `packages/instance-registry/src/http-contracts.ts`
  - Regeln: `typescript:S1874`, `typescript:S7753`
  - Grund: Nur mitnehmen, wenn der Refactor die Runtime-Vertragsform oder HTTP-Contract-Typen direkt berührt.

### Defer

- `packages/instance-registry/src/provisioning-auth-plan.ts`
  - Regeln: `typescript:S3358`, `typescript:S7735`
  - Grund: Die Datei modelliert Provisioning-Planung und UI-nahe Driftbeschreibungen. Diese Ternary- und Lesbarkeits-Smells sind kein direkter Effekt der gemeinsamen Contract-Quelle und wuerden den Scope unnötig verbreitern.
- `packages/instance-registry/src/provisioning-auth-evaluation.ts`
  - Regeln: `typescript:S3358`
  - Grund: Gleiche Einordnung wie `provisioning-auth-plan.ts`; nur mitnehmen, wenn der Contract-Edge die Evaluationsregeln fachlich ändert.
- `packages/instance-registry/src/mutation-input-builders.ts`
  - Regeln: `typescript:S4144`
  - Grund: Kein klarer Bezug zum Modul-IAM-Contract-Refactor.
- `packages/instance-registry/src/service-helpers.ts`
  - Regeln: `typescript:S107`
  - Grund: Hilfsfunktionszuschnitt ist eher generische Aufräumarbeit als notwendiger Contract-Umbau.
- `packages/instance-registry/src/service-keycloak-execution.ts`
  - Regeln: `typescript:S3358`
  - Grund: Nur tangentiale Ausführungslogik; kein Pflichtteil für die Vertragsquelle.

### Coverage- und Testhinweise

- Dieser Change ist primär Refactor- und Drift-Schutz-Arbeit; der Gate-Hebel liegt eher in Paritäts- und Regressionstests als in Coverage-Masse.
- Mindest-Gates:
  - betroffene Unit-Tests in `plugin-sdk`, `auth-runtime` und `instance-registry`
  - `pnpm check:server-runtime`
  - `pnpm nx affected --target=test:types --base=origin/main`
  - zusätzlich die Runtime-/Provisioning-Checks, die in den Change-Tasks für den neuen Contract-Edge vorgesehen sind

## add-p2-admin-resource-host-standards

### Take now

- `packages/plugin-sdk/src/admin-resources.ts`
  - Regeln: `typescript:S4144`
  - Grund: Der Change erweitert den Admin-Ressourcenvertrag um deklarative Host-Capabilities. Die doppelten Normalisierungsfunktionen liegen direkt in diesem Vertragsmodul und können beim Capability-Zuschnitt sauber zusammengelegt werden.
- `packages/routing/src/admin-resource-routes.ts`
  - Regeln: `typescript:S2004`, `typescript:S6653`
  - Grund: Der Change führt hostseitige Routing- und Search-Param-Standards ein. Die verschachtelte Legacy-Alias-/Redirect-Logik gehört genau in diesen Umbau und sollte dabei vereinfacht werden.

### Optional if touched

- `apps/sva-studio-react/src/routes/admin/-iam-page.tsx`
  - Regeln: `typescript:S3735`, `typescript:S2004`, `typescript:S3776`, `typescript:S3358`
  - Grund: Nur dann mitnehmen, wenn diese Seite für die Pilotressource oder hostgeführte Capability-UI direkt angepasst wird. Ohne konkrete Host-Capability-Migration wäre das ein separater IAM-Page-Refactor.
- `apps/sva-studio-react/src/routes/admin/users/-user-list-page.tsx`
  - Regeln: `typescript:S6478`, `typescript:S3776`, `typescript:S3358`
  - Grund: Nur relevant, wenn `adminUsers` als frühe Pilotressource auf den neuen Host-Standard gehoben wird.
- `apps/sva-studio-react/src/routes/admin/roles/-roles-page.tsx`
  - Regeln: `typescript:S3776`, `typescript:S6478`
  - Grund: Gleiche Einordnung wie bei `users`.

### Defer

- `apps/sva-studio-react/src/routes/admin/instances/-instances-shared.tsx`
  - Regeln: zahlreiche `typescript:S3776`, `typescript:S3358`, `typescript:S7735`, `typescript:S7776`
  - Grund: Das ist ein großer Admin-/Instance-Flow-Refactor mit eigener Komplexität. Er passt nicht automatisch zu den Host-Standards für Search, Filter, Pagination und Bulk-Actions, solange `instances` nicht explizit Pilotressource des Changes ist.
- `apps/sva-studio-react/src/routes/admin/media/-media-page.tsx`
  - Regeln: `typescript:S6478`, `typescript:S1874`
  - Grund: Der aktuelle Change zielt auf den Admin-Resource-Vertrag, nicht auf einen generischen Media-Page-Cleanup.
- sonstige `routes/admin/**`-Seitenbefunde
  - Grund: Nur aufnehmen, wenn die konkrete Seite durch die Capability-Migration zwingend berührt wird. Kein breitflächiger Admin-Refactor im Schatten dieses Changes.

### Coverage- und Testhinweise

- Hier ist die Refactor-Arbeit klein, aber Search-Param-, Deep-Link- und Capability-Validierung braucht gezielte Tests.
- Mindest-Gates:
  - betroffene Routing-/UI-Unit-Tests für deklarierte Capabilities
  - `pnpm nx affected --target=test:types --base=origin/main`
  - die Search-Param- und Route-Validierungschecks, die bereits in den Change-Tasks für `packages/routing` und die Host-UI genannt sind

## Übergreifende Empfehlungen

- `add-mainserver-plugin-list-pagination` ist der stärkste Kandidat für echte Sonar-Mitnahme, weil der Change viele stark belastete Listenpfade ohnehin neu strukturiert.
- `refactor-runtime-module-iam-contract-source` sollte Sonar nur auf der Contract-Kante mitnehmen, nicht tief in Provisioning-Planungslogik.
- `add-p2-admin-resource-host-standards` bleibt bewusst schmal: Vertrags- und Routing-Code ja, große Admin-Seiten nur bei direkter Pilotmigration.
- Das aktuelle Quality-Gate-Problem ist primär Coverage-getrieben. Refactors allein werden das Gate nicht schließen, wenn die neuen Pfade nicht zusätzlich mit Tests abgesichert werden.
