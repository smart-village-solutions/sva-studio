# Tasks – Refactor Auth-Routing & Logging

## Phase 1: Dead-Code-Entfernung

- [ ] `packages/auth/src/routes/registry.ts` löschen
- [ ] Alle Referenzen auf `registry.ts` entfernen (Exports in `index.ts`, Re-Exports, Barrel-Files)
- [ ] Sicherstellen, dass keine Tests die gelöschte Registry importieren
- [ ] Typ-Tests und Unit-Tests ausführen: `pnpm nx run auth:test:unit && pnpm nx run auth:test:types`

## Phase 2: SDK-Logger in Routing-Error-Boundary

- [ ] `@sva/sdk` als Dependency zu `packages/routing/package.json` hinzufügen
- [ ] In `wrapHandlersWithJsonErrorBoundary` (`auth.routes.server.ts`): `console.error` durch SDK-Logger ersetzen
- [ ] Log-Felder: `requestId`, `traceId`, `route`, `method`, `error.message`, `error.stack`
- [ ] Unit-Test: Prüfen, dass Logger mit korrektem Kontext aufgerufen wird
- [ ] `pnpm nx run routing:test:unit`

## Phase 3: Auth-Middleware-Logging ergänzen

- [ ] `withAuthenticatedIamHandler` catch-Block: `buildLogContext()` ergänzen (inkl. `requestId`, `traceId`)
- [ ] Middleware-Server: `buildLogContext({ includeTraceId: true })` an bestehende Log-Aufrufe ergänzen
- [ ] Unit-Tests für Log-Kontext in Fehlerpfaden ergänzen
- [ ] `pnpm nx run auth:test:unit`

## Phase 4: Keycloak-Sync-Logging

- [ ] `user-import-sync-handler.ts`: Für jeden übersprungenen User `debug`-Log mit `userId`, `email`, `instanceId`-Attribut
- [ ] Zusammenfassendes `info`-Log: `{ skippedCount, sampleInstanceIds: [...neue Set der ersten 5] }`
- [ ] Unit-Test: Prüfen, dass Debug-Logger bei übersprungenen Usern aufgerufen wird
- [ ] `pnpm nx run auth:test:unit`

## Phase 5: Dokumentation & Validierung

- [ ] `docs/architecture/` – Abschnitt 8 (Querschnittliche Konzepte) um Error-Boundary-Logging aktualisieren
- [ ] `openspec validate refactor-auth-routing-and-logging --strict` ausführen
- [ ] Komplette CI-Suite: `pnpm test:ci`
