## 1. Specification

- [ ] 1.1 Konflikte mit aktiven Changes prüfen: `add-events-poi-mainserver-plugins`, `add-media-management`, `refactor-p3-content-ui-specialization-boundaries`, `add-p3-plugin-extension-tier-governance`
- [ ] 1.2 Mainserver-Snapshot für `NewsItem`, `createNewsItem`, `WebUrl`, `Address`, `Category`, `ContentBlock`, `MediaContent`, `DataProvider`, `Setting` und `Shout` dokumentiert gegen Staging abgleichen
- [ ] 1.3 Fachliche Entscheidungen aus den Open Questions treffen: `newsType` und Kategorie-Konflikte
- [ ] 1.4 Events/POI-Change nach diesem News-Referenzmodell aktualisieren oder dort explizit blockieren
- [ ] 1.5 `openspec validate expand-news-mainserver-data-model --strict` ausführen

## 2. Mainserver News Contract

- [ ] 2.1 `packages/sva-mainserver/src/generated/news.ts` auf vollständige Snapshot-Selektion für `NewsItem` erweitern
- [ ] 2.2 Verschachtelte GraphQL-Fragmente/Typen für `WebUrl`, `Address`, `GeoLocation`, `Category`, `ContentBlock`, `MediaContent`, `DataProvider`, `Setting` und `Shout` ergänzen
- [ ] 2.3 `createNewsItem`-Variablen auf alle unterstützten Snapshot-Argumente erweitern: `pushNotification` nur bei Create, `author`, `keywords`, `externalId`, `fullVersion`, `charactersToBeShown`, `newsType`, `publicationDate`, `showPublishDate`, `categories`, `sourceUrl`, `address`, `contentBlocks`, `pointOfInterestId`; `payload` nicht senden
- [ ] 2.4 `SvaMainserverNewsItem`, `SvaMainserverNewsInput` und Subtypen in `packages/sva-mainserver/src/types.ts` modellieren
- [ ] 2.5 Mapper null-tolerant und vollständig für alle Snapshot-Felder erweitern
- [ ] 2.6 Schreib-Mapping für Create und Update vollständig auf `createNewsItem`-Variablen abbilden
- [ ] 2.6a Legacy-Lesefallback implementieren: fehlende `contentBlocks` aus vorhandenem `payload` ableiten, aber nie `payload` schreiben
- [ ] 2.7 Unit-Tests für vollständige Response-Mapping, nullable Felder, verschachtelte Felder, Variablenweitergabe und invalid response handling ergänzen
- [ ] 2.8 Nach diesem Block ausführen: `pnpm nx run sva-mainserver:test:unit`, `pnpm nx run sva-mainserver:build`, `pnpm check:server-runtime`

## 3. Host-Owned News Facade

- [ ] 3.1 Request-Parsing in `apps/sva-studio-react/src/lib/mainserver-news-api.server.ts` auf vollständiges News-Input-Modell erweitern
- [ ] 3.2 Servervalidierung für Datumsfelder, URLs, `charactersToBeShown`, verschachtelte Arrays, Kategorien, Content-Blocks, Medien und Adresse ergänzen
- [ ] 3.3 Bestehende Sicherheitsgrenzen beibehalten: Session, `instanceId`, lokale Content-Primitive, CSRF, Idempotency für Create, Mainserver-Credentials
- [ ] 3.4 Fehlercodes für neue Validierungsfälle stabil und pluginnah definieren
- [ ] 3.5 Read-only Felder unverändert an das Plugin weitergeben, aber Mutationsversuche auf read-only Felder vor GraphQL ablehnen
- [ ] 3.6 Unit-Tests für vollständiges Create/Update, minimal kompatibles Create/Update, Validierungsfehler, CSRF, Idempotency Replay/Conflict/Failed und Upstream-Fehler ergänzen
- [ ] 3.7 Nach diesem Block ausführen: relevante `sva-studio-react` Unit-Tests für `mainserver-news-api.server`

## 4. Plugin News Model And API

- [ ] 4.1 `packages/plugin-news/src/news.types.ts` auf vollständiges editierbares Modell und read-only Detailmodell erweitern
- [ ] 4.2 `packages/plugin-news/src/news.api.ts` auf vollständigen HTTP-Fassadenvertrag erweitern, ohne App- oder Servermodule zu importieren
- [ ] 4.3 Rückwärtskompatibilität für einfache Phase-1-News-Payloads in API-Tests absichern
- [ ] 4.4 Error-Mapping um neue Validierungscodes ergänzen
- [ ] 4.5 Boundary-Prüfung sicherstellen: keine Imports aus `apps/**`, `@sva/auth-runtime/server` oder `@sva/sva-mainserver/server`

## 5. Plugin News UI

- [ ] 5.1 Editor um vollständige Mainserver-Felder erweitern: Autor, Keywords, External ID, News-Typ, Vollversion, Zeichenbegrenzung, Veröffentlichungsdatum, Publikationsdatum, Publish-Date-Anzeige, Source URL, Adresse, Kategorien, Content-Blocks, Medienreferenzen, POI-ID und Push-Notification-Option
- [ ] 5.2 Detail-/Read-only-Kontext für `dataProvider`, `settings`, `announcements`, `likeCount`, `likedByMe` und `pushNotificationsSentAt` ergänzen oder bewusst als technische Detailsektion darstellen
- [ ] 5.3 UI für verschachtelte Listen ergonomisch und zugänglich bauen: Kategorien, Content-Blocks, Medien
- [ ] 5.4 Keine inhaltlichen Mainserver-Felder mehr im generischen `payload` verstecken, wenn dedizierte GraphQL-Felder existieren
- [ ] 5.5 i18n für alle neuen Labels, Hilfetexte, Validierungsfehler und Statusmeldungen ergänzen
- [ ] 5.6 Unit-Tests für vollständiges Laden, Bearbeiten, Erstellen, Validieren und Löschen ergänzen
- [ ] 5.7 Nach diesem Block ausführen: `pnpm nx run plugin-news:test:unit`

## 6. E2E And Documentation

- [ ] 6.1 E2E-News-Smoke um mindestens einen erweiterten Feldsatz ergänzen
- [ ] 6.2 `docs/development/runbook-sva-mainserver.md` um vollständige News-Felder, Fehlerdiagnose und Staging-Verifikation erweitern
- [ ] 6.3 `docs/guides/plugin-development.md` um das vollständige News-Referenzmodell für Mainserver-Plugins ergänzen
- [ ] 6.4 arc42-Abschnitte `05`, `06`, `08` und `11` aktualisieren
- [ ] 6.5 `pnpm check:file-placement` ausführen

## 7. Final Verification

- [ ] 7.1 `openspec validate expand-news-mainserver-data-model --strict`
- [ ] 7.2 `pnpm nx run sva-mainserver:test:unit`
- [ ] 7.3 `pnpm nx run sva-mainserver:build`
- [ ] 7.4 `pnpm nx run plugin-news:test:unit`
- [ ] 7.5 relevante `sva-studio-react` Unit-Tests für News-Fassade und Server-Dispatch
- [ ] 7.6 gezielte E2E-Prüfung für `/plugins/news`
- [ ] 7.7 `pnpm test:types`
- [ ] 7.8 `pnpm test:eslint`
- [ ] 7.9 Vor PR nach Möglichkeit `pnpm test:pr`
