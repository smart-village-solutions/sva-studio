# Change: Host-seitige Guardrails für Plugin-Erweiterungen härten

## Why

Die Plugin-Architektur des Studios soll build-time-basiert und host-kontrolliert bleiben. Dafür muss klar spezifiziert werden, dass Packages nur deklarative Beiträge liefern, während Routing, Berechtigungsprüfung, Audit, Validierung und Request-Grenzen ausschließlich durch den Host erzwungen werden.

## What Changes

- Spezifikation eines hostseitig erzwungenen Guardrail-Modells für Plugin-Beiträge
- Klärung, welche Sicherheits- und Laufzeitentscheidungen Packages deklarieren dürfen und welche ausschließlich Host-Verantwortung bleiben
- Definition technischer Verbote für pluginseitige Sicherheits- oder Routing-Bypässe
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
