## 1. Spezifikation

- [x] 1.1 `iam-core` auf host-/realm-basierte tenant-spezifische Session-Hydration umstellen
- [x] 1.2 `iam-core` fuer Keycloak-Import und Session-Kontext von benutzerbezogenem `instanceId`-Claim entkoppeln
- [x] 1.3 `instance-provisioning` auf die neue Rollenverteilung zwischen Host-/Realm-Scope und optionalen Keycloak-Artefakten anpassen

## 2. Implementierung

- [x] 2.1 Callback-, Session- und Middleware-Pfade so anpassen, dass tenant-spezifische Sessions `instanceId` aus dem aufgeloesten Auth-Scope erhalten
- [x] 2.2 Benutzer-Import-, JIT-Provisioning- und Actor-Resolution-Pfade auf das realm-basierte Tenant-Modell angleichen
- [x] 2.3 Runtime- und Admin-Diagnostik auf klare Scope-/Realm-Fehler ohne doppeltes `instanceId`-Gate umstellen

## 3. Verifikation

- [x] 3.1 Betroffene Unit- und Type-Tests fuer Auth-, Session-, Import- und Actor-Resolution-Pfade anpassen oder ergaenzen
- [x] 3.2 Tenant-Login-Repro fuer `hb-meinquartier` und mindestens einen weiteren Tenant gegen die neue Soll-Logik absichern (extern ausgeführt)
- [x] 3.3 Relevante Betriebs- und Architektur-Dokumentation aktualisieren, inklusive betroffener arc42-Abschnitte unter `docs/architecture/`
- [x] 3.4 `openspec validate refactor-tenant-auth-instance-context-source --strict` erfolgreich ausfuehren
