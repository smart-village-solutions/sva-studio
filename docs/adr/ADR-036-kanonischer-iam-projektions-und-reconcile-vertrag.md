# ADR-036: Kanonischer IAM-Projektions- und Reconcile-Vertrag

## Status

Akzeptiert

## Kontext

Die Live-Analyse vom 2026-04-19 zeigte zwei miteinander verknüpfte Laufzeitprobleme:

- User-, Membership-, Profil- und Rollenansichten leiteten ihren Zustand nicht durchgängig aus derselben fachlichen Quelle ab.
- User-Sync und Rollen-Reconcile lieferten zwar zunehmend bessere Diagnostik, blieben aber fachlich inkonsistent, teilweise hängend oder von blockerrelevantem Tenant-Admin-Drift entkoppelt.

Dadurch konnten `/auth/me`, `/account`, `/admin/users` und `/admin/roles` für denselben Benutzer widersprüchliche Rollen-, Status- oder Anzeigenamen zeigen. Gleichzeitig führten fehlender Tenant-Admin-Client, Secret-Drift oder andere Provisioning-Blocker zu scheinbar gestarteten, aber fachlich irreführenden Sync- und Reconcile-Läufen.

## Entscheidung

1. Das System verwendet einen gemeinsamen IAM-Projektionskern von Keycloak-Identität (`sub`, `instanceId`) über IAM-User und Membership bis zur Rollen- und Profilprojektion.
2. `/auth/me`, `/account`, `/admin/users` und `/admin/roles` müssen fachliche User-, Rollen- und Statusinformationen aus diesem gemeinsamen Projektionskern ableiten.
3. User-Sync und Rollen-Reconcile liefern deterministische Abschlusszustände `success`, `partial_failure`, `blocked` oder `failed` sowie die Zähler `checked`, `corrected`, `failed` und `manualReview`.
4. `manual_review` bleibt ein ausschließlich fachlicher Restzustand. Technische Fehler wie `IDP_UNAVAILABLE`, Berechtigungsfehler wie `IDP_FORBIDDEN` und blockerrelevanter Drift bleiben getrennt sichtbar.
5. Tenant-Admin-abhängige Sync- und Reconcile-Pfade reagieren fail-closed, wenn Registry-, Preflight- oder Provisioning-Drift einen tragfähigen Lauf verhindern.

## Konsequenzen

### Positiv

- Profil-, User- und Rollenansichten bleiben fachlich konsistent.
- UI, Browser-API und Server teilen sich denselben Reconcile- und Fehlervertrag.
- Blockerrelevanter Drift führt nicht mehr zu scheinbar erfolgreichen Sync- oder Reconcile-Aktionen.
- Operatoren können technische Fehler, Berechtigungsprobleme und fachliche Restfälle gezielter unterscheiden.

### Negativ

- Der Projektionskern wird zu einer zentralen Integrationsstelle und erhöht die Bedeutung sauberer Tests.
- Bestehende UI-Pfade müssen sich von lokaler Ableitungslogik lösen und können dabei Folgeanpassungen benötigen.
- Nicht deterministisch auflösbare Restfälle bleiben weiterhin manuell zu behandeln.

## Verworfen

### Getrennte Projektionslogik pro UI-Pfad

Verworfen, weil dies die bisherige Inkonsistenz zwischen Self-Service, Admin-Listen und Rollenansicht fortgeschrieben hätte.

### Reconcile als rein technischer Best-Effort-Job

Verworfen, weil fachliche Inkonsistenzen und Drift-Blocker dann weiter in schwer interpretierbaren Teilzuständen sichtbar geblieben wären.

### Automatische Reparatur auch für mehrdeutige Fälle

Verworfen, weil dies fachlich riskante Korrekturen ohne ausreichend sichere Führungsdaten erzeugen könnte.

## Referenzen

- `openspec/changes/refactor-iam-runtime-consistency-remediation/proposal.md`
- `openspec/changes/refactor-iam-runtime-consistency-remediation/tasks.md`
- `docs/reports/iam-diagnostics-analysis-2026-04-19.md`
- `docs/adr/ADR-016-idp-abstraktionsschicht.md`
- `docs/adr/ADR-033-tenant-login-client-vs-tenant-admin-client.md`
