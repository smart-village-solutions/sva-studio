# ADR-033: Tenant-Login-Client vs. Tenant-Admin-Client

## Status

Akzeptiert

## Kontext

Der bisherige Instanzvertrag nutzte `authClientId` sowohl fuer interaktive OIDC-Logins als auch fuer tenant-lokale Keycloak-Admin-Mutationen. Dadurch entstanden drei betriebliche Risiken:

- Login- und Admin-Pfad teilten sich denselben Client-Lifecycle, obwohl sie unterschiedliche Berechtigungen und Failure-Modes haben.
- Reconcile, Doctor und Runtime konnten Drift des technischen Admin-Clients nicht getrennt vom Login-Client erkennen.
- Tenant-Mutationen wurden in Altpfaden implizit ueber globale oder login-orientierte Credentials kaschiert, statt bei fehlendem tenantlokalem Admin-Pfad fail-closed zu reagieren.

Mit der Registry-basierten Instanzverwaltung ist `iam.instances` der kanonische Vertrag fuer tenantgebundene Realm-Basisdaten. Dieser Vertrag muss daher Login- und Admin-Verantwortung explizit trennen.

## Entscheidung

1. Jede betriebsfaehige Tenant-Instanz fuehrt zwei getrennte Client-Vertraege:
   - `authClientId` fuer interaktive Login-, Session- und Callback-Flows
   - `tenantAdminClient.clientId` fuer tenant-lokale Keycloak-Admin-Mutationen und Reconcile
2. Das Secret fuer `tenantAdminClient` wird separat tenantgebunden verschluesselt gespeichert und ausschliesslich ueber `iam.instances.tenant_admin_client_secret:{instanceId}` aufgeloest.
3. Normale Tenant-Mutationen fuer Nutzer, Rollen, Gruppen und Reconcile laufen ausschliesslich ueber `tenantAdminClient`.
4. Fehlt `tenantAdminClient` oder sein Secret, reagieren Tenant-Mutationen fail-closed; Login ueber `authClientId` bleibt davon getrennt.
5. Plattformpfade, Root-Host-Control-Plane und explizite Break-Glass-Operationen bleiben separat markiert und duerfen tenant-lokale Admin-Mutationen nicht implizit uebernehmen.

## Konsequenzen

### Positiv

- Login- und Admin-Drift werden betrieblich getrennt sichtbar.
- Tenant-Mutationen werden fail-closed, statt ueber globale Fallbacks stillschweigend weiterzulaufen.
- Provisioning, Backfill und Reconcile koennen gezielt nur den Tenant-Admin-Client nachziehen.
- Readiness-, Doctor- und Health-Pfade koennen Login-, Tenant-Admin-, Plattform- und Break-Glass-Vertrag separat ausweisen.

### Negativ

- Bestehende Instanzen benoetigen einen Backfill fuer den neuen Tenant-Admin-Client.
- Datenmodell, Migrationen, Provisioning und lokale Seeds werden komplexer, weil zwei getrennte Client-Vertraege gepflegt werden muessen.
- Betriebsdokumentation und Rollout-Reihenfolge muessen den Cutover explizit absichern.

## Verworfen

### Ein gemeinsamer Client fuer Login und Tenant-Administration

Verworfen, weil interaktive OIDC-Flows und technische Admin-Mutationen unterschiedliche Rechte, Secret-Lifecycles und Diagnoseanforderungen haben. Ein gemeinsamer Client verschleiert Drift und erschwert fail-closed-Verhalten.

### Globaler Admin-Fallback fuer normale Tenant-Mutationen

Verworfen, weil dadurch tenantlokale Fehlkonfigurationen nicht mehr sichtbar waeren und Root-/Break-Glass-Credentials unnoetig in den Alltagsbetrieb hineinragen.

## Referenzen

- `openspec/changes/refactor-tenant-admin-client-contract/proposal.md`
- `openspec/changes/refactor-tenant-admin-client-contract/design.md`
- `docs/adr/ADR-030-registry-basierte-instance-freigabe-und-provisioning.md`
- `docs/adr/ADR-032-plattform-scope-vs-tenant-instanz.md`
