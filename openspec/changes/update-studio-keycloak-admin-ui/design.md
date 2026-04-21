## Context

PR #303 macht den Root-Host platform-scope-fähig. Die neue Zielsetzung geht darüber hinaus: Studio soll für IAM-Alltagsaufgaben als alternative UI zu Keycloak nutzbar sein. Damit reicht eine reine Projektion oder ein partieller Sync nicht mehr aus.

## Goals / Non-Goals

- Goal: Alle administrativ relevanten Keycloak-User und -Rollen im passenden Studio-Scope sichtbar machen.
- Goal: User- und Rollenänderungen über Studio ausführen, auditieren und mit Keycloak synchron halten.
- Goal: `partial_failure` und `IDP_FORBIDDEN` so darstellen, dass Admins die betroffenen Objekte und Ursachen sehen.
- Goal: Keycloak-Listen skalierbar über serverseitige Filter, Pagination und Count-/Cursor-Mechanismen laden.
- Non-Goal: Keycloak vollständig ersetzen oder Realm-/Client-Administration außerhalb von Usern, Rollen und Rollenzuordnungen übernehmen.
- Non-Goal: Globale Admin-Rechte als Fallback für Tenant-Operationen verwenden.

## Decisions

- Decision: Keycloak bleibt System of Record für Identitäten und Realm-Rollen; Studio ist Admin-UI und synchronisierte Fachansicht.
- Decision: Mutationen laufen Keycloak-first und aktualisieren danach Studio-Read-Models oder markieren Sync-Drift.
- Decision: Root verwendet `platform_admin`; Tenant-Hosts verwenden `tenant_admin`. Cross-Scope-Fallbacks bleiben verboten.
- Decision: Listen-Endpunkte müssen serverseitige Keycloak-Filter und Count-/Cursor-Daten verwenden. Vollständige Realm-Scans sind nur für explizite Sync-/Reconcile-Jobs zulässig.
- Decision: Built-in- und Systemrollen bleiben sichtbar, aber mit Bearbeitbarkeitsstatus (`read_only`, `studio_managed`, `external_managed`) gekennzeichnet.

## Risks / Trade-offs

- Risk: Keycloak-Admin-API-Rechte sind tenantweise inkonsistent. Mitigation: Diagnosecodes, Provisioning-Checks und Runbook-Aktionen für fehlende Realm-/Client-Rollen.
- Risk: Große Realms erzeugen hohe Latenzen. Mitigation: serverseitige Pagination, Count-Endpunkte, gedrosselte Rollenprojektion und Hintergrund-Sync für schwere Abgleiche.
- Risk: Studio-Read-Models können von Keycloak abweichen. Mitigation: sichtbarer Drift-Status, Reconcile-Aktionen und Audit-Events.
- Risk: Bearbeitung von extern gemanagten Rollen kann fachliche Integrationen stören. Mitigation: explizite Bearbeitbarkeitsmatrix und blockierte Mutationen mit Diagnose.

## Migration Plan

1. Keycloak-Admin-Port um Count-, Paging-, User-/Role-Mutation- und Assignment-Operationen erweitern.
2. Root- und Tenant-Listen auf serverseitige Keycloak-Filter/Pagination umstellen.
3. Bearbeitbarkeitsmatrix für User, Rollen und Rollenzuordnungen implementieren.
4. UI-Detailseiten für Keycloak-first User-/Rollenbearbeitung freischalten.
5. Sync-/Reconcile-Reports um objektbezogene Diagnosen erweitern.
6. E2E-Smokes für Root und Tenant mit echten Keycloak-Objekten ergänzen.

## Open Questions

- Welche Keycloak-Built-in-Rollen sollen nur sichtbar sein und welche dürfen über Studio zugewiesen werden?
- Sollen Tenant-Hosts ausschließlich User mit Tenant-Zuordnung zeigen oder alle User des Tenant-Realms, inklusive noch nicht gemappter User?
- Welche Felder gelten als Studio-bearbeitbar, wenn Keycloak über Föderation/LDAP angebunden ist?
