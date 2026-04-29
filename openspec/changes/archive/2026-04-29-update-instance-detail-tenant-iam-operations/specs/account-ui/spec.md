## ADDED Requirements
### Requirement: Tenant-IAM-Betriebsblock auf der Instanz-Detailseite

Das System MUST auf `/admin/instances/:instanceId` einen eigenen Tenant-IAM-Betriebsblock bereitstellen, der Konfiguration, Rechteprobe und Reconcile für die gewählte Instanz getrennt darstellt.

#### Scenario: Instanz-Detailseite zeigt getrennte Tenant-IAM-Abschnitte

- **WENN** ein berechtigter Operator die Detailseite einer Instanz öffnet
- **DANN** zeigt die Seite einen separaten Tenant-IAM-Bereich
- **UND** sind dort mindestens `Konfiguration`, `Rechteprobe`, `Reconcile` und ein zusammengefasster Gesamtzustand sichtbar
- **UND** bleibt dieser Bereich vom bestehenden Keycloak-Setup- und Provisioning-Bereich unterscheidbar

#### Scenario: Tenant-IAM-Befund enthält Diagnose und Korrelation

- **WENN** die Detailseite einen degradierten oder blockierten Tenant-IAM-Zustand zeigt
- **DANN** enthält die UI verständliche Diagnoseinformationen wie Fehlercode, letzten Prüflauf oder `requestId`
- **UND** kann ein Operator den Befund ohne Wechsel in eine andere Admin-Seite einordnen

### Requirement: Tenant-IAM-Aktionen bleiben kontextbezogen und begrenzt

Das System MUST auf der Instanz-Detailseite nur fachlich sinnvolle Tenant-IAM-Aktionen anbieten und diese dem sichtbaren Befund zuordnen.

#### Scenario: Detailseite verknüpft bestehende Reparaturpfade gezielt

- **WENN** ein sichtbarer Tenant-IAM-Befund durch eine bestehende Aktion adressierbar ist
- **DANN** bietet die Detailseite genau diese Aktion kontextbezogen an
- **UND** kann sie dafür bestehende Provisioning-, Secret-, Reset- oder Reconcile-Pfade nutzen
- **UND** werden irrelevante oder nicht wirksame Aktionen nicht vorgeschlagen

#### Scenario: Rechteprobe ist als eigene Operator-Aktion verfügbar

- **WENN** ein Operator die tenantlokale IAM-Betriebsfähigkeit gezielt prüfen möchte
- **DANN** bietet die Detailseite eine explizite Aktion für die Tenant-IAM-Rechteprobe an
- **UND** zeigt nach Abschluss den aktualisierten Access-Zustand im Tenant-IAM-Bereich

#### Scenario: Detailseite bleibt trotz Rechteprobe reaktionsfähig

- **WENN** ein Operator die Instanz-Detailseite öffnet, ohne eine Rechteprobe anzustoßen
- **DANN** rendert die Seite den vorhandenen Tenant-IAM-Befund ohne blockierende Zusatzprüfung
- **UND** zeigt bei Bedarf klar an, dass die Rechteprobe gezielt ausgelöst werden kann

#### Scenario: UI zeigt unbestimmte Access-Lage ehrlich an

- **WENN** für `access` noch keine belastbare Rechteprobe oder äquivalente Access-Evidenz vorliegt
- **DANN** zeigt die Detailseite diesen Teilzustand als `unknown` oder fachlich gleichwertig an
- **UND** suggeriert nicht, dass aus einer grünen Strukturprüfung bereits betriebliche Tenant-IAM-Rechte folgen
