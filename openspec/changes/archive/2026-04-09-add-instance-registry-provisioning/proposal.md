# Change: Zentrale Instanz-Registry und Provisioning fuer Multi-Tenant-Studio

## Why

Das bestehende Multi-Host-Modell von SVA Studio ist aktuell fuer wenige, vorab bekannte Instanzen ausgelegt. Gültige Instanz-Hosts werden heute ueber `SVA_ALLOWED_INSTANCE_IDS` env-basiert freigeschaltet und Runtime-Profile wie `acceptance-hb` sind noch eng an eine einzelne Instanz gekoppelt. Dieses Modell skaliert operativ nicht, sobald `studio.smart-village.app` als gemeinsame Plattform fuer viele Instanzen mit Subdomains wie `hb-meinquartier.studio.smart-village.app` oder `bb-guben.studio.smart-village.app` betrieben werden soll.

Fuer die grosse Variante wird eine zentrale, laufzeitfaehige Instanz-Registry benoetigt, die Host-Aufloesung, Tenant-Konfiguration und den kontrollierten Lebenszyklus neuer Instanzen von Deployment-Konfiguration entkoppelt. Gleichzeitig muss die Erstellung neuer Instanzen ueber einen reproduzierbaren, auditierbaren Provisioning-Prozess steuerbar werden.

## What Changes

- Fuehrt eine neue Capability `instance-provisioning` fuer Instanz-Registry, Lebenszyklus und Provisioning ein.
- Ersetzt die env-basierte Allowlist als autoritative Quelle gueltiger Instanzen durch eine Registry im IAM-/Studio-Datenbestand.
- Verankert das Betriebsmodell "ein Deployment, viele Tenant-Hosts" fuer `studio.smart-village.app` und `*.studio.smart-village.app`.
- Definiert einen Registry-basierten Laufzeitpfad fuer Host-Aufloesung, Tenant-Konfiguration und fail-closed-Ablehnungen unbekannter oder deaktivierter Instanzen.
- Definiert einen steuerbaren Provisioning-Workflow fuer neue Instanzen inklusive Validierung, Statusmodell, Idempotenz, Auditierbarkeit und technischer Teilaufgaben.
- Definiert einen administrativen Steuerungspfad fuer neue Instanzen mit verpflichtendem nicht-interaktivem CLI-/Ops-Pfad; Studio-Control-Plane wird als gleichwertiger Einstieg auf denselben Provisioning-Vertrag spezifiziert.
- Definiert einen lokalen Entwicklungs- und Testvertrag mit einfachem Dev-Modus, registry-nahem Multi-Tenant-Modus, Seed-Instanzen, Hostname-Strategie und Testabdeckung ueber Unit-, Integrations- und E2E-Pfade.
- Aktualisiert die Architektur- und Betriebsdokumentation fuer Deployment-Topologie, Runtime-View, Cross-Cutting Concepts, ADR-Fortschreibung und Risikoaenderungen.

## Impact

- Affected specs:
  - `deployment-topology`
  - `architecture-documentation`
  - `instance-provisioning`
- Affected code:
  - `packages/sdk/src/instance/*`
  - `packages/auth/src/*`
  - `packages/data/src/*`
  - `packages/data/migrations/*`
  - `apps/sva-studio-react/src/routes/*`
  - `scripts/ops/*`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/07-deployment-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/09-architecture-decisions.md`
  - `docs/architecture/10-quality-requirements.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
