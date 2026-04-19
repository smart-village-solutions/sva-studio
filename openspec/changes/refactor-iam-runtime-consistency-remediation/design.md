## Context

Die Analyse- und Retest-Befunde auf `studio` zeigen drei unterschiedliche Referenzmuster:

- `de-musterhausen` kombiniert technische Auth-Erreichbarkeit mit leerer Rollenprojektion, verbesserter aber noch unvollständiger User-Projektion und einem instabilen User-Sync-Pfad.
- `bb-guben` zeigt eine formal funktionierende Admin-Oberfläche mit breit fehlgeschlagenem Rollen-Reconcile (`IDP_FORBIDDEN`, `IDP_UNAVAILABLE`) trotz grünem allgemeinen Health-Status.
- `hb-meinquartier` zeigt keinen harten Seitenausfall mehr, aber weiter fachlich fehlgeschlagenen Rollenabgleich mit klaren IDP-Fehlercodes.

Diese Muster belegen, dass das Problem nicht nur in der Fehlerdarstellung liegt. Es betrifft die fachliche Konsistenz zwischen Registry/Provisioning, Keycloak, IAM-Datenmodell und UI-Projektion.

## Goals / Non-Goals

- Goals:
  - echte Remediation für User-/Rollen-Reconcile und Membership-/Profilprojektion
  - deterministische Behandlung von `IDP_FORBIDDEN`, `IDP_UNAVAILABLE`, Drift und `manual_review`
  - konsistente fachliche Projektion in Self-Service- und Admin-Flows
  - Reparatur aktiver Tenant-Admin-Client- und Provisioning-Drift, soweit sie den IAM-Abgleich blockiert
- Non-Goals:
  - kein weiterer reiner Diagnosechange
  - keine Neudefinition des gesamten IAM-Domänenmodells
  - keine breit angelegte UI-Neugestaltung außerhalb der betroffenen IAM-Flows

## Decisions

- Decision: Reconcile und Sync werden als fachliche Schreib- und Abgleichsprozesse behandelt, nicht nur als Diagnose-Events.
  - Alternatives considered: Nur bessere Fehlermeldungen ergänzen.
  - Rationale: Der neue Online-Stand zeigt bereits bessere Fehlermeldungen, ohne die eigentlichen Inkonsistenzen zu beheben.

- Decision: User-, Membership-, Profil- und Rollenprojektion müssen aus einem konsistenten fachlichen Auflösungspfad abgeleitet werden.
  - Alternatives considered: Separate Spezialpfade pro UI-Seite beibehalten.
  - Rationale: Die heutigen Abweichungen zwischen `/auth/me`, `/account`, `/admin/users` und `/admin/roles` zeigen, dass getrennte Projektionen zu dauerhafter Inkonsistenz führen.

- Decision: `registry_or_provisioning_drift` wird als blockerrelevanter Vorzustand für Tenant-Admin- und Reconcile-Pfade behandelt.
  - Alternatives considered: Drift nur sichtbar machen und Sync trotzdem laufen lassen.
  - Rationale: `de-musterhausen` zeigt, dass grüne Basis-Health-Signale und fachlich kaputte Tenant-Admin-/Reconcile-Voraussetzungen gleichzeitig auftreten können.

- Decision: Der Change arbeitet mit klar getrennten Fehlerpfaden für technische Nichtverfügbarkeit, Berechtigungsfehler und fachliche manuelle Prüfung.
  - Alternatives considered: Ein einziger generischer Reconcile-Fehlerpfad.
  - Rationale: `IDP_UNAVAILABLE`, `IDP_FORBIDDEN` und `manual_review` erfordern unterschiedliche Behebungsschritte und dürfen nicht vermischt werden.

## Risks / Trade-offs

- Risiko: Die Vereinheitlichung der Projektion kann bestehende Spezialfälle in Self-Service- oder Admin-Flows sichtbar brechen.
  - Mitigation: Repro-Tests pro Referenztenant und getrennte Regressionstests für `/account`, `/admin/users` und `/admin/roles`.

- Risiko: Die Reparatur von Drift- und Tenant-Admin-Voraussetzungen kann operative Seiteneffekte auf bestehende Provisioning-Läufe haben.
  - Mitigation: idempotente Reparaturpfade, explizite Guardrails und Tests gegen wiederholte Läufe.

- Risiko: Technische IDP-Probleme und fachliche Mapping-Probleme werden weiterhin verwechselt.
  - Mitigation: strikt getrennte Server- und UI-Pfade für `unavailable`, `forbidden`, `drift`, `manual_review`.

## Migration Plan

1. Reconcile-/Sync-Pfade serverseitig stabilisieren und Drift-Blocker explizit behandeln.
2. Projektion von User-, Membership-, Profil- und Rollenbild vereinheitlichen.
3. Admin-UI und Self-Service auf den stabilisierten fachlichen Pfad umstellen.
4. Referenzfälle `de-musterhausen`, `bb-guben` und `hb-meinquartier` erneut gegenprüfen.

## Open Questions

- Welche heute sichtbaren `manual_review`-Fälle können automatisiert behoben werden, und welche bleiben bewusst operatorpflichtig?
- Soll der Change bereits operative Reparaturaktionen für einzelne Rolleneinträge enthalten oder nur den Sammel-Reconcile stabilisieren?
