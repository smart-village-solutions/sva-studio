## Kontext
Root-Studio soll Instanzen und Realms als Control Plane orchestrieren, ohne die globale Keycloak-Superidentität im normalen Web-Request-Pfad zu halten. Bestehende Tabellen für `instance_keycloak_provisioning_runs` und `instance_keycloak_provisioning_steps` sollen weiterverwendet werden.

## Entscheidungen

### 1. Bestehende Run-Tabelle bleibt die Queue
- `instance_keycloak_provisioning_runs` bleibt führend für Worker-Aufträge.
- `overall_status='planned'` repräsentiert den eingereihten Auftrag.
- Der Worker claimt seriell den ältesten `planned`-Run per `FOR UPDATE SKIP LOCKED` und markiert ihn als `running`.

### 2. Root-Studio schreibt nur noch Aufträge
- `executeKeycloakProvisioning` und `reconcileKeycloak` führen keine Keycloak-Mutationen mehr synchron aus.
- Der Web-Pfad speichert stattdessen einen Queue-Eintrag samt Snapshot der Auftragsparameter.
- Temporäre Tenant-Admin-Passwörter werden verschlüsselt in den Run-Schritten abgelegt, damit sie nur der Worker lesen kann.

### 3. Worker nutzt dedizierte Provisioner-Secrets
- Neue Runtime-Variablen:
  - `KEYCLOAK_PROVISIONER_BASE_URL`
  - `KEYCLOAK_PROVISIONER_REALM`
  - `KEYCLOAK_PROVISIONER_CLIENT_ID`
  - `KEYCLOAK_PROVISIONER_CLIENT_SECRET`
- Fallback auf `KEYCLOAK_ADMIN_*` bleibt nur für lokale oder Übergangsprofile erhalten.
- Der Worker schreibt Preflight-, Plan- und Status-Snapshots in Run-Schritte zurück.

### 4. UI liest Worker-Snapshots statt Live-Keycloak
- `getKeycloakStatus`, `getKeycloakPreflight` und `planKeycloakProvisioning` lesen zuerst die neuesten Worker-Snapshots.
- Ohne Snapshot zeigt die UI einen lokalen, nicht-blockierenden Vorbereitungszustand und klare Guidance, dass die technische Prüfung noch durch den Worker aussteht.
- Die Detailseite bleibt damit auch ohne Live-Keycloak-Zugriff des App-Backends stabil.

## Trade-offs
- Der Status wird nicht mehr instantan aus Live-Keycloak gelesen, sondern aus dem letzten Worker-Lauf. Das ist bewusst, weil der Sicherheitsgewinn und die klare Control-Plane-Trennung höher gewichtet werden.
- `planned` wird fachlich als „queued“ interpretiert, um Schema- und API-Brüche zu vermeiden.
