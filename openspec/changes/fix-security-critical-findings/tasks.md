## 1. Exhaustive Auth-Route-Handler (R-2)

- [x] 1.1 In `packages/routing/src/auth.routes.server.ts`: Alle Auth-Route-Pfade als Union-Type extrahieren (falls nicht vorhanden)
- [x] 1.2 `resolveAuthHandlers`-Funktion von `if-else`-Kette auf typsicheres `Record<AuthRoutePath, () => Promise<Handler>>`-Mapping umstellen
- [x] 1.3 `satisfies Record<AuthRoutePath, ...>` nutzen, damit fehlende Pfade zu Compile-Time-Fehlern führen
- [x] 1.4 Fallback-`else`-Zweig entfernen; bei unbekanntem Pfad expliziten `throw` oder 404-Response einführen
- [ ] 1.5 Den `as any`-Cast auf der Route-Config (Finding R-1) dokumentieren und, soweit möglich, durch korrekte TanStack-Router-Typen ersetzen
- [ ] 1.6 Unit-Test: Sicherstellen, dass alle bekannten Pfade korrekt aufgelöst werden
- [ ] 1.7 Unit-Test: Sicherstellen, dass ein unbekannter Pfad zu einem expliziten Fehler führt (kein stillschweigender Logout)

**Akzeptanzkriterien:**
- Compile-Time-Fehler wenn neue Auth-Route ohne Handler-Mapping ergänzt wird
- Kein offener `else`-Fallback mehr
- Alle bestehenden Auth-Flows funktionieren weiterhin

---

## 2. Key-ID aus Exceptions entfernen (C-6)

- [x] 2.1 In `packages/core/src/security/field-encryption.ts`: Exception bei `Encryption key '${keyId}' is not configured` (Zeile ~26) generisch formulieren: `Encryption key is not configured`
- [x] 2.2 Exception bei `IAM_PII_ACTIVE_KEY_ID '${activeKeyId}' not found in keyring` (Zeile ~105) generisch formulieren: `Active encryption key not found in keyring`
- [ ] 2.3 An beiden Stellen: Key-ID als strukturiertes Debug-Log über SDK-Logger ausgeben (falls Logger verfügbar) oder als separaten Error-Kontext mitgeben, der nicht in der Message selbst erscheint
- [ ] 2.4 Unit-Test: Prüfen, dass Exception-Messages keine Key-IDs enthalten
- [x] 2.5 Prüfen, ob weitere Stellen im Projekt interne Key-IDs in Exceptions leaken (grep nach `keyId` in `throw`)

**Akzeptanzkriterien:**
- Keine Key-IDs in Exception-Messages
- Debug-Logging mit Key-ID weiterhin verfügbar für Troubleshooting
- Bestehende Tests weiterhin grün

---

## 3. Root-Route Error Boundary (APP-1)

- [x] 3.1 Error-Fallback-Komponente erstellen (z. B. `apps/sva-studio-react/src/components/ErrorFallback.tsx`)
- [x] 3.2 Komponente zeigt benutzerfreundliche Fehlermeldung, Retry-Button und Link zur Startseite
- [x] 3.3 Alle sichtbaren Texte über i18n-Keys referenzieren (sofern i18n-System vorhanden, sonst als TODO markieren)
- [x] 3.4 WCAG-Basics: `role="alert"`, `aria-live="assertive"`, semantisches HTML
- [x] 3.5 In `apps/sva-studio-react/src/routes/__root.tsx`: `errorComponent: ErrorFallback` setzen
- [ ] 3.6 Manueller Smoke-Test: Künstlichen Fehler in einer Route provozieren → Fallback wird angezeigt

**Akzeptanzkriterien:**
- Unbehandelte Runtime-Fehler zeigen Error-Fallback statt leerer/gebrochener Seite
- Error Boundary fängt sowohl synchrone als auch asynchrone Fehler in Routen ab
- Zugänglich (Keyboard, Screen Reader)

---

## 4. Dependency-Stabilisierung (NX-1, NX-2)

- [x] 4.1 `@tanstack/react-router`-Version zwischen `packages/routing/package.json` und `apps/sva-studio-react/package.json` auf eine gemeinsame Version synchronisieren
- [ ] 4.2 Bei Bedarf: pnpm override in Root `package.json` setzen, um eine einheitliche Version workspace-weit zu erzwingen
- [x] 4.3 `nitro-nightly@latest` in `apps/sva-studio-react/package.json` durch die neueste stabile Nitro-Version ersetzen
- [x] 4.4 `pnpm install` und `pnpm nx run-many -t build` ausführen – sicherstellen, dass Build grün ist
- [x] 4.5 `pnpm nx run sva-studio-react:test:unit` und `pnpm nx run sva-studio-react:test:e2e` ausführen
- [ ] 4.6 App manuell starten (`pnpm nx run sva-studio-react:serve`) und kritische Flows prüfen

**Akzeptanzkriterien:**
- Eine einzige `@tanstack/react-router`-Version im Lockfile
- Keine `nightly`/`latest`-Tags in Produktions-Dependencies
- Build, Unit-Tests und E2E-Tests grün

---

## 5. Dokumentation & Validierung

- [ ] 5.1 Betroffene arc42-Abschnitte prüfen und bei Bedarf aktualisieren:
  - `docs/architecture/08-cross-cutting-concepts.md` (Fehlerbehandlung, Security-Patterns)
  - `docs/architecture/05-building-block-view.md` (Routing-Modul-Beschreibung)
- [x] 5.2 `pnpm nx affected --target=lint` ausführen
- [x] 5.3 `pnpm nx affected --target=test:unit` ausführen
- [x] 5.4 `pnpm nx affected --target=build` ausführen
- [ ] 5.5 `pnpm test:e2e` ausführen
