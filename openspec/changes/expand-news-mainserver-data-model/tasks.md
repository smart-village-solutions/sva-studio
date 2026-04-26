## 1. Specification

- [x] 1.1 Konflikte mit aktiven Changes prüfen: `add-events-poi-mainserver-plugins`, `add-media-management`, `refactor-p3-content-ui-specialization-boundaries`, `add-p3-plugin-extension-tier-governance`
- [x] 1.2 Mainserver-Snapshot für `NewsItem`, `createNewsItem`, `WebUrl`, `Address`, `Category`, `ContentBlock`, `MediaContent`, `DataProvider`, `Setting` und `Shout` dokumentiert gegen Staging abgleichen
- [x] 1.3 Fachliche Entscheidungen aus den Open Questions treffen: `newsType` und Kategorie-Konflikte
- [x] 1.4 Events/POI-Change nach diesem News-Referenzmodell aktualisieren oder dort explizit blockieren
- [x] 1.5 `openspec validate expand-news-mainserver-data-model --strict` ausführen

## 2. Mainserver News Contract

- [x] 2.1 `packages/sva-mainserver/src/generated/news.ts` auf vollständige Snapshot-Selektion für `NewsItem` erweitern
- [x] 2.2 Verschachtelte GraphQL-Fragmente/Typen für `WebUrl`, `Address`, `GeoLocation`, `Category`, `ContentBlock`, `MediaContent`, `DataProvider`, `Setting` und `Shout` ergänzen
- [x] 2.3 `createNewsItem`-Variablen auf alle unterstützten Snapshot-Argumente erweitern: `pushNotification` nur bei Create, `author`, `keywords`, `externalId`, `fullVersion`, `charactersToBeShown`, `newsType`, `publicationDate`, `showPublishDate`, `categories`, `sourceUrl`, `address`, `contentBlocks`, `pointOfInterestId`; `payload` nicht senden
- [x] 2.4 `SvaMainserverNewsItem`, `SvaMainserverNewsInput` und Subtypen in `packages/sva-mainserver/src/types.ts` modellieren
- [x] 2.5 Mapper null-tolerant und vollständig für alle Snapshot-Felder erweitern
- [x] 2.6 Schreib-Mapping für Create und Update vollständig auf `createNewsItem`-Variablen abbilden
- [x] 2.6a Legacy-Lesefallback implementieren: fehlende `contentBlocks` aus vorhandenem `payload` ableiten, aber nie `payload` schreiben
- [x] 2.7 Unit-Tests für vollständige Response-Mapping, nullable Felder, verschachtelte Felder, Variablenweitergabe und invalid response handling ergänzen
- [x] 2.8 Nach diesem Block ausführen: `pnpm nx run sva-mainserver:test:unit`, `pnpm nx run sva-mainserver:build`, `pnpm check:server-runtime`

## 3. Host-Owned News Facade

- [x] 3.1 Request-Parsing in `apps/sva-studio-react/src/lib/mainserver-news-api.server.ts` auf vollständiges News-Input-Modell erweitern
- [x] 3.2 Servervalidierung für Datumsfelder, URLs, `charactersToBeShown`, verschachtelte Arrays, Kategorien, Content-Blocks, Medien und Adresse ergänzen
- [x] 3.3 Bestehende Sicherheitsgrenzen beibehalten: Session, `instanceId`, lokale Content-Primitive, CSRF, Idempotency für Create, Mainserver-Credentials
- [x] 3.4 Fehlercodes für neue Validierungsfälle stabil und pluginnah definieren
- [x] 3.5 Read-only Felder unverändert an das Plugin weitergeben, aber Mutationsversuche auf read-only Felder vor GraphQL ablehnen
- [x] 3.6 Unit-Tests für vollständiges Create/Update, minimal kompatibles Create/Update, Validierungsfehler, CSRF, Idempotency Replay/Conflict/Failed und Upstream-Fehler ergänzen
- [x] 3.7 Nach diesem Block ausführen: relevante `sva-studio-react` Unit-Tests für `mainserver-news-api.server`

## 4. Plugin News Model And API

- [x] 4.1 `packages/plugin-news/src/news.types.ts` auf vollständiges editierbares Modell und read-only Detailmodell erweitern
- [x] 4.2 `packages/plugin-news/src/news.api.ts` auf vollständigen HTTP-Fassadenvertrag erweitern, ohne App- oder Servermodule zu importieren
- [x] 4.3 Rückwärtskompatibilität für einfache Phase-1-News-Payloads in API-Tests absichern
- [x] 4.4 Error-Mapping um neue Validierungscodes ergänzen
- [x] 4.5 Boundary-Prüfung sicherstellen: keine Imports aus `apps/**`, `@sva/auth-runtime/server` oder `@sva/sva-mainserver/server`

## 5. Plugin News UI

- [x] 5.1 Editor um vollständige Mainserver-Felder erweitern: Autor, Keywords, External ID, News-Typ, Vollversion, Zeichenbegrenzung, Veröffentlichungsdatum, Publikationsdatum, Publish-Date-Anzeige, Source URL, Adresse, Kategorien, Content-Blocks, Medienreferenzen, POI-ID und Push-Notification-Option
- [x] 5.2 Detail-/Read-only-Kontext für `dataProvider`, `settings`, `announcements`, `likeCount`, `likedByMe` und `pushNotificationsSentAt` ergänzen oder bewusst als technische Detailsektion darstellen
- [x] 5.3 UI für verschachtelte Listen ergonomisch und zugänglich bauen: Kategorien, Content-Blocks, Medien
- [x] 5.4 Keine inhaltlichen Mainserver-Felder mehr im generischen `payload` verstecken, wenn dedizierte GraphQL-Felder existieren
- [x] 5.5 i18n für alle neuen Labels, Hilfetexte, Validierungsfehler und Statusmeldungen ergänzen
- [x] 5.6 Unit-Tests für vollständiges Laden, Bearbeiten, Erstellen, Validieren und Löschen ergänzen
- [x] 5.7 Nach diesem Block ausführen: `pnpm nx run plugin-news:test:unit`

## 6. E2E And Documentation

- [x] 6.1 E2E-News-Smoke um mindestens einen erweiterten Feldsatz ergänzen
- [x] 6.2 `docs/development/runbook-sva-mainserver.md` um vollständige News-Felder, Fehlerdiagnose und Staging-Verifikation erweitern
- [x] 6.3 `docs/guides/plugin-development.md` um das vollständige News-Referenzmodell für Mainserver-Plugins ergänzen
- [x] 6.4 arc42-Abschnitte `05`, `06`, `08` und `11` aktualisieren
- [x] 6.5 `pnpm check:file-placement` ausführen

## 7. Final Verification

- [x] 7.1 `openspec validate expand-news-mainserver-data-model --strict`
- [x] 7.2 `pnpm nx run sva-mainserver:test:unit`
- [x] 7.3 `pnpm nx run sva-mainserver:build`
- [x] 7.4 `pnpm nx run plugin-news:test:unit`
- [x] 7.5 relevante `sva-studio-react` Unit-Tests für News-Fassade und Server-Dispatch
- [x] 7.6 gezielte E2E-Prüfung für `/plugins/news`
- [x] 7.7 `pnpm test:types`
- [x] 7.8 `pnpm test:eslint`
- [x] 7.9 Vor PR nach Möglichkeit `pnpm test:pr`
