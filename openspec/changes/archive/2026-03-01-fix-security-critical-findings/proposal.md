# Change: Kritische Security- und Stabilitäts-Findings beheben

## Why

Ein umfassendes Code-Quality-Review hat mehrere P0-Findings identifiziert, die Security-Risiken, Stabilitäts-Lücken und Dependency-Gefahren darstellen. Diese Findings sollten sofort adressiert werden, bevor weitere Feature-Entwicklung stattfindet.

**Konkrete Risiken:**
- **R-2 (Kritisch):** Der Auth-Route-Handler in `packages/routing` enthält einen offenen `else`-Fallback, der unbekannte Pfade stillschweigend als Logout behandelt. Wenn neue Auth-Routen hinzugefügt werden, ohne `resolveAuthHandlers` zu aktualisieren, werden Benutzer unbeabsichtigt ausgeloggt.
- **C-6 (Hoch):** Interne Verschlüsselungs-Key-IDs werden in Exception-Messages exponiert. Diese können in Error-Responses oder Logs landen und Angreifern Informationen über die Key-Infrastruktur liefern.
- **APP-1 (Hoch):** Die Root-Route hat kein `errorComponent` – unbehandelte Runtime-Fehler crashen die App ohne Fallback-UI.
- **NX-1 (Hoch):** `@tanstack/react-router` Version-Divergenz zwischen `packages/routing` (`^1.59.0`) und `apps/sva-studio-react` (`^1.160.0`) – potentielle Runtime-Inkompatibilitäten.
- **NX-2 (Hoch):** `nitro-nightly@latest` als Dependency in der Produktions-App – instabile Nightly-Version mit unvorhersehbaren Breaking Changes.

## What Changes

### 1. Exhaustive Auth-Route-Handler (R-2)
- `resolveAuthHandlers` in `packages/routing/src/auth.routes.server.ts` wird von einer offenen `if-else`-Kette auf ein exhaustives `Record<AuthRoutePath, () => Promise<Handler>>`-Mapping umgestellt
- Neue Auth-Routen ohne Handler-Mapping führen zu einem Compile-Time-Fehler statt stillschweigendem Logout

### 2. Key-ID aus Exceptions entfernen (C-6)
- `packages/core/src/security/field-encryption.ts`: Exception-Messages werden generisch formuliert
- Key-IDs werden nur noch im strukturierten Debug-Log (SDK-Logger) ausgegeben, nicht in der Exception selbst

### 3. Root-Route Error Boundary (APP-1)
- `apps/sva-studio-react/src/routes/__root.tsx`: `errorComponent` hinzufügen, das eine benutzerfreundliche Fehlerseite rendert
- Fehlerseite mit Retry-Button und Navigation zur Startseite

### 4. Dependency-Stabilisierung (NX-1, NX-2)
- `@tanstack/react-router` Version zwischen `packages/routing` und `apps/sva-studio-react` synchronisieren (gemeinsame Version)
- `nitro-nightly@latest` durch eine stabile Nitro-Release-Version ersetzen

## Impact
- Affected specs: `routing`, `iam-access-control`
- Affected code:
  - `packages/routing/src/auth.routes.server.ts` (R-2)
  - `packages/core/src/security/field-encryption.ts` (C-6)
  - `apps/sva-studio-react/src/routes/__root.tsx` (APP-1)
  - `packages/routing/package.json`, `apps/sva-studio-react/package.json` (NX-1, NX-2)
- Affected arc42 sections: `08-cross-cutting-concepts` (Fehlerbehandlung, Security), `05-building-block-view` (Routing-Modul)
