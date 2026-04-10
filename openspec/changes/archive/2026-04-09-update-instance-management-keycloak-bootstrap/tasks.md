## 1. Backend
- [x] 1.1 Migration für `realm_mode`, verschlüsselte Tenant-Client-Secrets, Provisioning-Runs und Schrittprotokolle ergänzen
- [x] 1.2 Core- und API-Verträge für Instanzdetail, Update, Preflight, Plan, Status und Provisioning-Run erweitern
- [x] 1.3 Repository- und Service-Layer der Instanzverwaltung um getrennte Registry-, Preflight-, Plan- und Execute-Pfade ergänzen
- [x] 1.4 Keycloak-Control-Plane um realm-modusbewusste Plan-/Status-/Bootstrap-Operationen erweitern
- [x] 1.5 Runtime-Routes und Handler für `PATCH /api/v1/iam/instances/$instanceId`, `GET /api/v1/iam/instances/$instanceId/keycloak/status`, Preflight-/Plan-Reads, Execute und Run-Read ergänzen

## 2. Frontend
- [x] 2.1 Instanzverwaltung um editierbare Realm-/Bootstrap-Felder und expliziten Realm-Modus erweitern
- [x] 2.2 geführten Ablauf mit Vorbedingungen, Vorschau, Ausführung und Protokoll ergänzen
- [x] 2.3 Write-only Secret- und Passwortfelder mit getrennten Speichern-/Provisioning-Aktionen modellieren

## 3. Qualität und Doku
- [x] 3.1 Backend- und Frontend-Tests für Update, Secret-Verhalten, Preflight, Plan, Status und Provisioning ergänzen
- [x] 3.2 Relevante Runbooks, Architekturstellen und die zentrale Betriebsdoku aktualisieren
- [x] 3.3 `openspec validate update-instance-management-keycloak-bootstrap --strict` sowie betroffene Quality Gates ausführen
