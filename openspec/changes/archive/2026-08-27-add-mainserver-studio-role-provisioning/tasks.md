## 1. Provisioning-Vertrag

- [x] 1.1 Den gemeinsamen Mainserver-Benutzer-Provisioning-Payload für alle Studio-Aufrufer fest um `role: "studio"` ergänzen.
- [x] 1.2 Sicherstellen, dass persönliche Neuanlage, Einzel- und Bulk-Reprovisionierung sowie organisationsgebundene technische Provisionierung denselben Vertrag verwenden.
- [x] 1.3 Keine optionale Rollenwahl, kein Keycloak-Rollen-Mapping und keine Bestandsmigration einführen.

## 2. Fehler- und Idempotenzvertrag

- [x] 2.1 `403` für Cross-Tenant-Ablehnungen und `422` für ungültige Rollen als sichere, nicht wiederholbare Provisioning-Fehler typisiert abdecken.
- [x] 2.2 Den öffentlichen Einzel-, Bulk- und Organisationsfehlerpfad prüfen und Status beziehungsweise sichere Fehlercodes ohne Secret- oder PII-Leak festschreiben.
- [x] 2.3 Belegen, dass Reprovisionierung bestehende Mainserver-Rollen nicht als lokal veränderbaren Zustand behandelt und keine Migration auslöst.

## 3. Tests

- [x] 3.1 Transporttests für den vollständigen Payload einschließlich `role: "studio"` ergänzen beziehungsweise aktualisieren.
- [x] 3.2 Einen Organisations-Provisioning-Test ergänzen, der die Mainserver-Initialrolle von den weiterhin leeren Studio-/Keycloak-Rollen und Gruppen abgrenzt.
- [x] 3.3 Gezielte Tests für `403`, `422`, Einzel- und Bulk-Reprovisionierung sowie das wiederholte Senden des unveränderten Studio-Caller-Vertrags ergänzen; die Bewahrung bestehender Rollen bleibt vertraglich und testseitig beim Mainserver abgesichert.

## 4. Dokumentation

- [x] 4.1 Den Mainserver-Runbook-Vertrag für persönliche und organisationsgebundene `studio`-Provisionierung, Default `restricted`, Fehlerfälle und fehlende Bestandsmigration aktualisieren.
- [x] 4.2 Die arc42-Laufzeitsicht um Initialrolle, Tenant-Isolation und Idempotenz ergänzen.
- [x] 4.3 ADR-051 so präzisieren, dass „keine Rollen“ Studio-/Keycloak-Rollen meint und `role: "studio"` im Mainserver-Payload nicht ausschließt.

## 5. Verifikation

- [x] 5.1 Relevante `auth-runtime`-Unit-Tests über das Nx-Target ausführen.
- [x] 5.2 `auth-runtime:test:types` und `auth-runtime:check:runtime` ausführen.
- [x] 5.3 `openspec validate add-mainserver-studio-role-provisioning --strict` und `pnpm check:file-placement` ausführen.
- [x] 5.4 Vor PR-Erstellung den betroffenen Scope messen und gemäß `DEVELOPMENT_RULES.md` den kleinsten echten Gate-Pfad ausführen.
