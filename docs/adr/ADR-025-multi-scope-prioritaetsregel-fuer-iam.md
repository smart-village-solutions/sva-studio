# ADR-025: Prioritätsregel für Multi-Scope-IAM-Entscheidungen

**Status:** Accepted
**Entscheidungsdatum:** 2026-03-31
**Entschieden durch:** SVA Studio Team

## Kontext

Mit Gruppen, Organisationsvererbung und Geo-Vererbung treffen mehrere Scope-Dimensionen gleichzeitig auf dieselbe fachliche Anfrage. Ohne feste Prioritätsregel würden identische Eingaben zu unterschiedlichen Ergebnissen oder schwer erklärbaren Denials führen.

## Entscheidung

Für Multi-Scope-IAM-Entscheidungen gilt die konservative Prioritätsregel: `deny` oder Restriktion vor `allow`, lokale Regel vor vererbter Parent-Regel, konkretere Ressource vor generischer Ressource und expliziter Scope vor allgemeinem Scope.

## Begründung

- Das Modell bleibt sicherheitsorientiert und fail-safe.
- Es passt zu den bestehenden RBAC-/ABAC-Leitplanken.
- Deterministische Reasoning-Daten und Testmatrizen werden dadurch möglich.

## Konsequenzen

### Positive Konsequenzen

- Vorhersehbare Konfliktauflösung über Rollen, Gruppen, Org und Geo
- Konsistentes Reasoning in `authorize` und `me/permissions`
- Eindeutige Testbarkeit von Parent-Allow/Child-Deny-Szenarien

### Negative Konsequenzen

- Fachlich gewünschte Ausnahmen müssen explizit modelliert werden
- Konservative Entscheidungen können zusätzliche UI-Erklärungen erfordern

### Mitigationen

- Transparenzdaten zeigen Herkunft und Denial-Grund
- Konflikt- und Abnahmematrix bleibt normiert

## Verwandte ADRs

- `ADR-012-permission-kompositionsmodell-rbac-v1.md`
- `ADR-013-rbac-abac-hybridmodell.md`
- `ADR-024-iam-groups-als-eigenstaendige-entitaet.md`
