# Change: Host-seitige Guardrails für Plugin-Erweiterungen härten

## Why

Die Plugin-Architektur des Studios soll build-time-basiert und host-kontrolliert bleiben, ohne Plugins auf reine Datenkonfiguration zu reduzieren. Dafür muss klar spezifiziert werden, dass Packages fachliche UI- und Erweiterungslogik liefern dürfen, während Routing, Berechtigungsprüfung, Audit, Validierung und Request-Grenzen ausschließlich durch den Host erzwungen werden.

Der Change ergänzt die bestehenden P1-Changes zum Build-time-Registry-Vertrag und zur Namespacing-Governance: Dort werden Registry-Snapshot und Identifier-Ownership definiert; dieser Change definiert die technische Grenze, welche sicherheits- und infrastrukturseitigen Entscheidungen Plugins nicht übernehmen dürfen.

## What Changes

- Spezifikation eines hostseitig erzwungenen Guardrail-Modells für Plugin-Beiträge
- Klärung, welche fachlichen Plugin-Beiträge erlaubt bleiben und welche Sicherheits- oder Infrastrukturentscheidungen ausschließlich Host-Verantwortung sind
- Definition technischer Verbote für pluginseitige Sicherheits-, Routing-, Audit- oder Persistenz-Bypässe
- Einführung deterministischer Guardrail-Diagnostics für invalidierte Contributions
- Schärfung des Zusammenspiels von Plugin-SDK, Routing, IAM und Audit-Pfad
- Vorbereitung technischer und review-seitiger Schutzmechanismen gegen Architekturdrift

## Impact

- Affected specs:
  - `iam-access-control`
  - `iam-auditing`
  - `routing`
  - `content-management`
- Affected code:
  - `packages/sdk`
  - `packages/routing`
  - `packages/auth`
  - `apps/sva-studio-react`
- Affected arc42 sections:
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/10-quality-requirements.md`
