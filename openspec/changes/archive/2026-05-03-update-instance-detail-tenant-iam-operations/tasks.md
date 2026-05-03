## 1. Spezifikation und Vertrag

- [x] 1.1 `tenantIamStatus` als Instanz-Detailvertrag in `packages/core` spezifizieren
- [x] 1.2 Zustandsachsen `configuration`, `access`, `reconcile`, `overall` mit sicheren Details und Korrelation festlegen
- [x] 1.3 zulässige Bestandsaktionen und die neue Access-Probe als UI-/API-Vertrag dokumentieren

## 2. Backend und Runtime

- [x] 2.1 Tenant-Rollen-Reconcile auf den tenantlokalen Admin-Client umstellen und gegen globale Fallbacks absichern
- [x] 2.2 Aggregation für `tenantIamStatus` im Instanz-Detailservice zunächst aus vorhandener Registry-, Provisioning- und Reconcile-Evidenz implementieren
- [x] 2.3 neuen Probe-Pfad für tenantlokale Admin-Rechte ergänzen
- [x] 2.4 Reconcile- und Probe-Ergebnisse mit stabilen Fehlercodes, Zeitstempeln und `requestId` korrelierbar ausweisen
- [x] 2.5 nur bei nachgewiesenem Bedarf zusätzliche Persistenz für Probe-Snapshots ergänzen; andernfalls letzte bekannte Evidenz weiterverwenden

## 3. Detailseite und UX

- [x] 3.1 Instanz-Detailseite um Tenant-IAM-Bereich mit Status, Diagnose und Guidance erweitern
- [x] 3.2 nur fachlich sinnvolle Bestandsaktionen im Detailkontext einbinden
- [x] 3.3 neue Access-Probe-Aktion einbinden, aber nicht automatisch beim initialen Laden ausführen
- [x] 3.4 irreführende Vermischung von `keycloakStatus` und `tenantIamStatus` in der UI vermeiden

## 4. Tests und Dokumentation

- [x] 4.1 Unit- und Integrationstests für Vertrag, Probe, Reconcile-Scope und UI ergänzen
- [x] 4.2 relevante Dokumentation und Runbooks für Tenant-IAM-Diagnose auf der Instanz-Detailseite aktualisieren
- [x] 4.3 betroffene arc42-Abschnitte `04`, `05`, `06` und `08` fortschreiben
