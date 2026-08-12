## Context

Der öffentliche Waste-E-Mail-Erinnerungsdienst besitzt zwei Laufzeitseiten:

- `apps/sva-studio-react` materialisiert Reminder-Outbox-Einträge und erzeugt die Abmelde-URL einschließlich signiertem Token.
- `apps/public-waste-calendar-web` nimmt den öffentlichen Abmeldeaufruf entgegen, liest die Subscription-ID aus dem Token und verifiziert die Signatur gegen den gespeicherten Token-Hash.

Beide Seiten implementieren derzeit Teile desselben kryptografischen Vertrags. Der Studio-Test greift für die Ende-zu-Ende-Prüfung direkt auf die Verifikationsimplementierung der Public-Waste-App zu. Nx interpretiert diesen relativen Import korrekt als Projektabhängigkeit zwischen den Apps. Die technische Ursache des unerwünschten Builds ist daher nicht `^build` selbst, sondern die falsche Ownership des gemeinsam benötigten Serververtrags.

Ein gemeinsames Package muss von Public-Waste-App, Studio, Browser-Plugin und hostseitiger Job-Runtime konsumierbar sein, ohne dabei eine umgekehrte Plugin- oder App-Abhängigkeit zu erzeugen. `@sva/waste-management-contracts` bündelt deshalb die deklarativen Waste-Job- und Importprofildefinitionen sowie den Node-spezifischen Tokenvertrag in getrennten Unterpfaden. Es enthält weder React/UI noch die hostseitige Jobausführung.

## Goals

- genau eine kanonische Implementierung für Erzeugung, Lesen und Verifikation von Waste-Abmeldetoken
- keine Quellcodeabhängigkeit zwischen Studio- und Public-Waste-App
- unveränderte Kompatibilität für bereits erzeugte `v1`-Token
- Node-spezifische Kryptografie ausschließlich über einen serverseitigen Package-Export
- automatisierte Prävention vergleichbarer Cross-App-Imports
- korrekter, kleinerer Nx-Taskgraph für Studio-Typechecks

## Non-Goals

- keine neue Tokenversion und kein neues kryptografisches Verfahren
- keine Änderung der verwendeten Secrets oder ihrer Herkunft
- keine Änderung an Abmelde-Idempotenz, Datenhaltung oder Repository-Verträgen
- keine browserseitige Tokenverarbeitung
- keine allgemeine Neuordnung der Waste-Runtime oder anderer App-Grenzen
- keine Umgehung valider Nx-Abhängigkeiten durch Target-Sonderregeln

## Decisions

### Decision: Der kanonische Vertrag liegt in `@sva/waste-management-contracts/unsubscribe-token`

Das Package erhält ein fokussiertes serverseitiges Modul für:

- `createWasteManagementUnsubscribeToken`
- `readWasteManagementUnsubscribeTokenSubscriptionId`
- `verifyWasteManagementUnsubscribeToken`

Der Export erfolgt als eigener Package-Unterpfad aus `packages/waste-management-contracts/src/unsubscribe-token.server.ts`. Der Root-Barrel re-exportiert bewusst nur die deklarativen Jobdefinitionen, damit Node-Kryptografie ausschließlich über den expliziten `/unsubscribe-token`-Unterpfad erreichbar ist. Relative Runtime-Imports und Re-Exports bleiben Node-ESM-konform.

Die Funktionen bleiben framework- und transportagnostisch. Sie kennen weder HTTP, Datenbanken, Public-Waste-Konfiguration noch Mail-Templates. Damit wird keine neue Service-, Provider- oder Interface-Abstraktion benötigt.

### Decision: Das bestehende `v1`-Format bleibt bytekompatibel

Die Verlagerung übernimmt unverändert:

- Tokenaufbau `v1.<subscriptionId>.<signature>`
- HMAC-SHA-256
- signierten Inhalt `v1:<subscriptionId>:<unsubscribeTokenHash>`
- Base64url-Ausgabe
- längengeprüften Vergleich über `timingSafeEqual`

Ein festes Golden-Test-Vektor-Paar sichert ab, dass ein vor dem Refactoring erzeugtes Token nach dem Refactoring denselben Wert besitzt und weiterhin verifiziert wird. Es gibt keine Daten- oder Tokenmigration.

### Decision: Beide Apps konsumieren ausschließlich den Package-Export

Das Studio ersetzt seine lokale Create-Implementierung durch den Import aus `@sva/waste-management-contracts/unsubscribe-token`. Die Public-Waste-App importiert Create, Read und Verify ebenfalls von dort. Beide `package.json`-Dateien deklarieren das Contracts-Package als Runtime-Dependency mit `workspace:*`, weil ihre gebauten Node-Server den Export zur Laufzeit laden. `@sva/waste-management-runtime/server` bleibt ausschließlich der hostseitigen Job-Runtime vorbehalten.

Damit der Public-Waste-Produktions-Deploy nur den leichten Vertrag installiert, besitzt `@sva/waste-management-contracts` keine Abhängigkeit auf `@sva/waste-management-runtime` oder `@sva/plugin-waste-management`. Die gemeinsamen Job- und Importprofildefinitionen liegen im Unterpfad `/job-definitions`; Browser-Plugin und Job-Runtime konsumieren ihn, das Plugin re-exportiert ihn über seinen bisherigen Unterpfad kompatibel. Die gerichteten Abhängigkeiten lauten `plugin-waste-management -> waste-management-contracts -> plugin-sdk` und `waste-management-runtime -> waste-management-contracts`.

Die beiden app-lokalen Tokenmodule werden vollständig entfernt. Kompatibilitätswrapper bleiben nicht bestehen, weil es keine externen Consumer dieser app-internen Pfade gibt und Wrapper die unklare Ownership konservieren würden.

### Decision: Ein fokussierter `check:app-boundaries`-Check schützt App-Grenzen

Der bestehende Nx-ESLint-Lauf und `check:boundaries:fallow` lassen den aktuellen relativen Cross-App-Import passieren. Der Change ergänzt deshalb einen kleinen, fokussierten Repository-Check `scripts/ci/check-app-boundaries.ts`. Ein Quellmodul unter `apps/<source-app>/**` darf damit kein Modul unter `apps/<target-app>/**` importieren, wenn sich die App-Namen unterscheiden.

Der Check berücksichtigt statische Imports, Type-Imports, dynamische Imports, CommonJS-`require`, TypeScript-`import = require(...)` und Re-Exports. Ein Regressionstest enthält sowohl verbotene Cross-App-Varianten als auch erlaubte app-interne relative Imports und Package-Imports.

Die Regel verbietet nicht, dass mehrere Apps dasselbe Workspace-Package konsumieren. Genau diese gerichtete Wiederverwendung ist der Zielzustand.

Das Root-Skript `check:app-boundaries` wird in die bestehenden ESLint-/CI-Gates aufgenommen. Vorhandene Import-Parsing-Logik darf nur dann wiederverwendet werden, wenn sie ohne Plugin-spezifische Semantik extrahiert werden kann; der neue Check erhält keine Allowlist für die heute fehlerhafte App-Kante.

### Decision: Nx-Taskregeln und Public-Waste-Validierung bleiben unverändert

`dependsOn: ["^build"]` bildet reale Projektabhängigkeiten ab und bleibt bestehen. Auch `public_waste_config_invalid` bleibt fail-closed. Nach Entfernung der falschen Projektkante wird die Public-Waste-App bei einem Studio-Typecheck nicht mehr gebaut; bei einem echten Public-Waste-Build validiert sie ihre Konfiguration weiterhin strikt.

## Alternatives Considered

### Alternative A: `^build` für den Studio-Typecheck entfernen oder filtern

Verworfen. Dies würde das sichtbare Symptom unterdrücken, aber echte Package-Abhängigkeiten nicht mehr zuverlässig vor dem Typecheck bauen und die Cross-App-Ownership bestehen lassen.

### Alternative B: Nur den Studio-Test umschreiben

Verworfen. Damit könnte die Nx-Kante verschwinden, die getrennten Create- und Verify-Implementierungen würden aber weiterhin denselben Sicherheitsvertrag unabhängig pflegen und könnten driften.

### Alternative C: Tokenlogik in `@sva/core` oder `@sva/server-runtime` verschieben

Verworfen. `@sva/core` soll keine Node-Kryptografie aufnehmen. `@sva/server-runtime` enthält generische Server-Infrastruktur, während der konkrete signierte Inhalt und das Tokenformat fachlich zum Waste-Erinnerungsdienst gehören. `@sva/waste-management-contracts/unsubscribe-token` besitzt die engste passende Ownership und hält die Jobausführung sowie Browser-UI aus dem Public-Waste-Deploy heraus.

### Alternative D: Lokalen Wrapper in jeder App behalten

Verworfen. Wrapper ohne Kompatibilitätsbedarf erhöhen Ownership und können erneut als falsche Importziele verwendet werden. Direkte Package-Imports machen die kanonische Grenze sichtbar.

## Data and Security Flow

1. Das Studio liest das bestehende serverseitige Secret aus dem unveränderten Konfigurationspfad.
2. Der Studio-Dispatcher übergibt Subscription-ID, gespeicherten Unsubscribe-Token-Hash und Secret an den Package-Helper.
3. Der Helper erzeugt das kompatible `v1`-Token; das Secret wird weder persistiert noch geloggt.
4. Die Public-Waste-App liest die Subscription-ID strukturell aus dem Token und lädt den zugehörigen gespeicherten Hash.
5. Der Package-Helper berechnet die erwartete Signatur mit demselben Vertrag und vergleicht sie längengeprüft und timing-safe.
6. Nur bei erfolgreicher Verifikation wird der bestehende idempotente Abmeldepfad ausgeführt.

## Testing Strategy

- Package-Unit-Tests prüfen Golden-Vektor, Roundtrip, Parsergrenzen und Manipulationsfälle.
- Studio-Tests beweisen, dass die erzeugte Abmelde-URL ein vom Package verifizierbares Token enthält.
- Public-Waste-Tests beweisen weiterhin erfolgreiche, ungültige und idempotente Abmeldepfade.
- Package-Build, Package-Typecheck und `check:runtime` sichern den Node-ESM-Export.
- `pnpm check:server-runtime` prüft die serverseitige Workspace-Laufzeit.
- Der Boundary-Test beweist Negativ- und Positivfälle.
- Der Nx-Graph wird maschinenlesbar geprüft: keine Studio-zu-Public-App-Kante, aber beide Apps zum Contracts-Package.
- `sva-studio-react:test:types --skip-nx-cache` muss starten und erfolgreich laufen, ohne `public-waste-calendar-web:build` in den Taskgraphen aufzunehmen.
- Public-Waste-Typecheck und -Build bleiben separat grün und behalten ihre Konfigurationsvalidierung.

## Documentation

- `04-solution-strategy`: gemeinsame serverseitige Fachverträge liegen im owning Workspace-Package statt in Apps.
- `05-building-block-view`: beide Apps zeigen für den Tokenvertrag auf `@sva/waste-management-contracts/unsubscribe-token`; keine App-zu-App-Kante.
- `10-quality-requirements`: Boundary- und Tokenkompatibilitätsnachweise ergänzen.
- Paketübersichten: Public-Waste-App als Consumer des Contracts-Pakets und dieses als Owner der gemeinsamen Waste-Verträge dokumentieren.

## Risks / Trade-offs

- Ein unbeabsichtigter Formatunterschied könnte vorhandene Abmeldelinks ungültig machen.
  - Mitigation: fester Golden-Vektor und bestehende Integrationstests vor Entfernung der lokalen Module.
- Ein serverseitiger Export könnte versehentlich in einen Browserpfad gelangen.
  - Mitigation: ausschließlicher Import über `/unsubscribe-token`, Runtime-Gate und Buildprüfung beider Apps.
- Eine zu breite Boundary-Regel könnte legitime Test- oder Toolingpfade blockieren.
  - Mitigation: Regel auf Imports zwischen unterschiedlichen Verzeichnissen direkt unter `apps/` begrenzen und Positivfälle testen.
- Das Public-Waste-Artefakt benötigt ein weiteres Workspace-Package.
  - Mitigation: deklarierte `workspace:*`-Runtime-Dependency sowie bestehende Inject-/Build-Prüfung des konsumierten Artefakts.

## Migration Plan

1. Golden-Test gegen den bestehenden Tokenalgorithmus im Contracts-Package zunächst rot hinzufügen.
2. Tokenimplementierung und Server-Export im Contracts-Package ergänzen.
3. Studio auf den Package-Create-Helper umstellen und lokale Create-Datei entfernen.
4. Public-Waste-App auf Package-Create/Read/Verify umstellen, Dependency ergänzen und lokale Tokendatei entfernen.
5. `check:app-boundaries` mit Regressionstest ergänzen und in die bestehenden ESLint-/CI-Gates aufnehmen.
6. fokussierte Unit-, Type-, Runtime-, Build- und Graph-Gates ausführen.
7. arc42- und Paketdokumentation aktualisieren.
8. abschließende relevante PR-Gates ausführen und Ergebnisse transparent dokumentieren.

## Rollback

Die Umstellung kann als zusammenhängender Commit zurückgenommen werden, weil weder Persistenz noch Tokenformat verändert werden. Bei einer Regression bleiben die vorherigen app-lokalen Module durch Git wiederherstellbar. Ein Rollback darf weder `^build` abschwächen noch die Public-Waste-Konfigurationsvalidierung deaktivieren.

## Open Questions

Keine.
