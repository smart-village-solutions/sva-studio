# @sva/instance-registry

`@sva/instance-registry` bündelt die fachliche und technische Logik für die Verwaltung von IAM-Instanzen, deren Provisioning sowie die Anbindung an HTTP- und Runtime-Kontexte.

## Architektur-Rolle

Das Package ist eine serverseitige Bibliothek für die Instanzverwaltung im IAM-Umfeld. Es sitzt zwischen persistenter Datenhaltung aus `@sva/data-repositories`, Domänenmodellen aus `@sva/core` und den aufrufenden Laufzeitumgebungen.

Konkret übernimmt es drei Rollen:

- Orchestrierung des Instanz-Lebenszyklus inklusive Anlegen, Aktualisieren, Statuswechseln und Detailabfragen
- Kapselung der Keycloak-bezogenen Provisioning-, Preflight- und Reconcile-Abläufe
- Bereitstellung wiederverwendbarer HTTP-Handler, Guards und Runtime-Helfer für Admin- und Worker-Kontexte

## Öffentliche API

Die öffentliche API wird über [src/index.ts](./src/index.ts) bereitgestellt und gliedert sich in mehrere Flächen:

- Service-Layer: `createInstanceRegistryService`, `InstanceRegistryService`, `createGetInstanceDetail`
- Runtime-Integration: `createInstanceRegistryRuntime`, `resolveRuntimeInstanceFromRequest`, `isInstanceTrafficAllowed`
- HTTP-Integration: `createInstanceRegistryHttpHandlers`, `createInstanceRegistryMutationHttpHandlers`, `createInstanceRegistryKeycloakHttpHandlers`, `createInstanceRegistryHttpGuards`
- Input- und Fehlerbausteine: `build*Input`-Funktionen aus `mutation-input-builders`, `classifyInstanceMutationError`, `createInstanceMutationErrorMapper`
- Provisioning und Keycloak: Leser, Planer, Status- und Worker-Funktionen wie `createGetKeycloakStatusHandler`, `createPlanKeycloakProvisioningHandler`, `processNextQueuedKeycloakProvisioningRun`
- Typen und Verträge: HTTP-Schemas, Mutations-Typen, Keycloak-Typen und Rollenkennzeichnungen wie `instanceRegistryPackageRoles`

Fachlich deckt die API unter anderem folgende Anwendungsfälle ab:

- Instanzen listen und Detailinformationen laden
- Instanzen anlegen und aktualisieren
- Statuswechsel für Instanzen ausführen
- Modulzuweisungen und IAM-Baseline einer Instanz verwalten
- Keycloak-Status, Preflight, Planungs- und Ausführungsdaten für eine Instanz lesen oder fortschreiben

## Nutzung und Integration

Typischerweise wird das Package über die Runtime-Verdrahtung in serverseitige Flows eingebunden:

1. Ein SQL-Pool und ein `InstanceRegistryRepository` werden über `createInstanceRegistryRuntime` verdrahtet.
2. Die aufrufende Laufzeit stellt `InstanceRegistryServiceDeps` bereit, zum Beispiel Host-Invalidierung, Secret-Schutz oder Provisioning-Hooks.
3. HTTP-Schichten verwenden die bereitgestellten Handler und Guards, um Requests zu validieren, Autorisierung durchzusetzen und Mutationen mit Idempotency-Key auszuführen.

Wichtige Integrationspunkte:

- Datenzugriff erfolgt über `@sva/data-repositories`
- Domänenlogik wie Hostnormalisierung und Statusregeln kommt aus `@sva/core`
- Logging läuft über `@sva/server-runtime`
- Geheimnisse können über `protectSecret` und `revealSecret` in `InstanceRegistryServiceDeps` geschützt beziehungsweise entschlüsselt werden

Für Worker- oder Hintergrundprozesse stellt `createInstanceRegistryRuntime` separate Helfer für Provisioning-Kontexte bereit, damit Queues und Run-Verarbeitung ohne doppelte Verdrahtung genutzt werden können.

## Projektstruktur

Die Struktur des Packages folgt einer klaren Trennung nach Verantwortlichkeiten:

- `src/index.ts`: öffentlicher Einstiegspunkt und Re-Exports
- `src/service*.ts`: Kernlogik für Instanzverwaltung, Detailaufbereitung und Provisioning-Orchestrierung
- `src/http-*.ts`: HTTP-Verträge, Guards und Handler für Listen-, Detail-, Mutations- und Keycloak-Endpunkte
- `src/provisioning-*.ts`: Keycloak-spezifische Zustandslese-, Planungs- und Worker-Bausteine
- `src/runtime-*.ts`: Laufzeitauflösung und Repository-/Service-Verdrahtung
- `src/*.test.ts`: Unit-Tests pro Modul
- `dist/`: gebaute ESM-Artefakte und Typdeklarationen

## Nx-Konfiguration

Das Nx-Projekt ist in [project.json](./project.json) als Library `instance-registry` definiert und nutzt `packages/instance-registry/src` als `sourceRoot`.

Verfügbare Targets:

- `build`: kompiliert das Package mit `tsc -p packages/instance-registry/tsconfig.lib.json`
- `check:runtime`: prüft die Server-Runtime-Kompatibilität des gebauten Packages
- `lint`: lintet die Quellmodule unter `src/`
- `test:unit`: führt die Vitest-Unit-Tests des Packages aus
- `test:types`: prüft die TypeScript-Typen ohne Emit
- `test:coverage`: startet die Unit-Tests mit Coverage-Erfassung

Build- und Paketmetadaten liegen in [package.json](./package.json), [tsconfig.lib.json](./tsconfig.lib.json) und [vitest.config.ts](./vitest.config.ts). Das Package wird als ESM-Modul gebaut und exportiert mehrere Subpath-Entrypoints, etwa für HTTP-Verträge, Runtime-Wiring, Services und Provisioning-Helfer.

## Verwandte Dokumentation

- [package.json](./package.json) für veröffentlichte Exporte, Abhängigkeiten und Subpath-Entrypoints
- [project.json](./project.json) für Nx-Targets und Projekt-Tags
- [src/index.ts](./src/index.ts) als maßgebliche Übersicht der öffentlichen API
- [src/service-types.ts](./src/service-types.ts) für den zentralen Service-Vertrag und die benötigten Dependencies
