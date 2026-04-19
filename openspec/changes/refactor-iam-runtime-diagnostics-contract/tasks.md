## 1. Diagnosevertrag serverseitig vereinheitlichen

- [x] 1.1 Bestehende Auth-, IAM-, Schema- und Provisioning-Fehlerpfade auf den gemeinsamen Klassifikationskern abbilden
- [x] 1.2 Additive öffentliche Diagnosefelder für `classification`, `status`, `recommendedAction`, `requestId` und `safeDetails` konsistent serialisieren
- [x] 1.3 Kompatibilität zu bestehenden Fehlercodes und fail-closed-Verhalten absichern

## 2. Browser- und UI-Pfade aufwerten

- [x] 2.1 `apps/sva-studio-react/src/lib/iam-api.ts` so erweitern, dass Diagnoseinformationen im Fehlerobjekt erhalten bleiben
- [x] 2.2 Self-Service-Ansichten wie `/account` auf classification-basierte Fehler- und Statusbilder umstellen
- [x] 2.3 Admin-nahe Ansichten wie `/admin/instances` auf classification-basierte Drift- und Diagnoseanzeigen umstellen
- [x] 2.4 Recovery-nahe Zustände (`recovery_laeuft`, `degradiert`) sichtbar machen, ohne unsichere Interna auszugeben

## 3. Runtime und Provisioning verzahnen

- [x] 3.1 Runtime-IAM- und Instanz-/Provisioning-Driftbegriffe auf kompatible Klassifikationen abbilden
- [x] 3.2 Verweise zwischen Runtime-Fehlern und Preflight-/Plan-/Run-Evidenz ergänzen
- [x] 3.3 Historische Workarounds markieren, die sichtbar gemacht, eingegrenzt oder später abgebaut werden sollen
- [x] 3.4 Die verbleibende Nutzung von `SVA_ALLOWED_INSTANCE_IDS` in SDK-, Fallback- und Ops-Pfaden inventarisieren und auf registrygeführtes oder klar lokalen Fallback-Verhalten umstellen
- [x] 3.5 User- und Rollen-Reconcile gegen Keycloak als eigenen Diagnosepfad modellieren, inklusive `IDP_FORBIDDEN`, `IDP_UNAVAILABLE`, `DB_WRITE_FAILED` und partieller Erfolgszustände
- [x] 3.6 Admin-Ansichten `/admin/users` und `/admin/roles` auf korrelierbare Sync-/Reconcile-Befunde mit `requestId`, Klassifikation und handlungsleitendem Status ausrichten

## 4. Tests und Doku

- [x] 4.1 Unit-Tests für Serverklassifikation und additive Diagnosefelder ergänzen
- [x] 4.2 Browser-/UI-Tests für classification-basierte Fehlerbehandlung ergänzen
- [x] 4.3 Betroffene arc42-Abschnitte und ggf. ADR-Bedarf aktualisieren
- [x] 4.4 Reconcile-/Sync-Szenarien für Rollen- und Benutzerabgleich mit Keycloak als Regressionstests oder reproduzierbare Diagnosefälle abbilden
