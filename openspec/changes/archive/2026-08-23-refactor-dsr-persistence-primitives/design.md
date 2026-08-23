## Context

Die fachliche Ownership für Governance und DSGVO-Betroffenenrechte liegt bereits bei `@sva/iam-governance`. Dennoch besitzen Auth-Runtime, Export-Flows und Wartungslauf dieselben parametrierten SQL-Helfer lokal. Der Change konsolidiert ausschließlich diese Persistenzgrenze.

## Goals / Non-Goals

- Goals: genau ein Owner für Legal-Hold-Prüfung, DSR-Request-Event und DSR-Audit-Event; unveränderte Tenant- und Kontextbindung; direkte Unit-Testbarkeit.
- Non-Goals: keine Schema-, Status-, Retention-, Autorisierungs-, Payload- oder Transaktionsänderung.

## Decisions

- Decision: Ein kleines Modul `dsr-persistence.ts` in `@sva/iam-governance` exportiert drei Funktionen und konsumiert nur den bestehenden strukturellen `QueryClient`-Vertrag.
- Decision: Request- und Trace-ID werden weiterhin bei jedem Audit-Aufruf ausschließlich aus `getWorkspaceContext()` gelesen.
- Decision: Auth-Runtime konsumiert den bestehenden Workspace-Dependency-Pfad als expliziten Package-Subpath.
- Alternatives considered: Eine neue Service-/Factory-Schicht wurde verworfen, weil sie weder Varianten noch Lifecycle besitzt. Eine Ablage in Auth-Runtime wurde verworfen, weil dort nicht die fachliche DSR-Ownership liegt.

## Risks / Trade-offs

- Eine unbemerkte SQL- oder Parameterdrift wird durch exakte Characterization- und Modultests verhindert.
- Eine Package-Zyklusgefahr wird vor Merge über Nx-Graph, Type-Gates und Server-Runtime-Gate geprüft.

## Migration Plan

Die vorhandenen lokalen Funktionen werden nach grünem Test des neuen Moduls durch direkte Imports ersetzt. Ein Rollback besteht aus dem Wiederherstellen der lokalen Helfer; Datenmigrationen sind nicht erforderlich.

## Open Questions

- Keine.
