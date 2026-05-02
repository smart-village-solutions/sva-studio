## ADDED Requirements
### Requirement: Tenant-IAM-Betriebsstatus pro Instanz

Das System MUST für die Instanz-Detailansicht einen aggregierten Tenant-IAM-Betriebsstatus bereitstellen, der Konfiguration, tenantlokale Admin-Rechte und Reconcile-Zustand getrennt beschreibt.

#### Scenario: Instanzdetail liefert getrennte Tenant-IAM-Achsen

- **WHEN** ein berechtigter Operator die Detaildaten einer Instanz lädt
- **THEN** enthält die Antwort einen `tenantIamStatus`
- **AND** weist dieser mindestens die Teilachsen `configuration`, `access`, `reconcile` und `overall` aus
- **AND** bleiben strukturelle Provisioning-Befunde von operativen Rechte- oder Reconcile-Befunden getrennt
- **AND** enthält jede Achse mindestens `status`, `summary`, `source` sowie optional `checkedAt`, `errorCode` und `requestId`
- **AND** ist `overall` aus den drei Fachachsen abgeleitet und keine eigenständige vierte Diagnosequelle

#### Scenario: Tenant-IAM-Status bleibt korrelierbar

- **WHEN** `tenantIamStatus` einen degradierten oder blockierten Zustand meldet
- **THEN** enthält der Status sichere Detailfelder wie stabile Fehlercodes, Zeitstempel und, falls vorhanden, `requestId`
- **AND** können UI und Betrieb daraus auf Diagnosepfade oder Bestandsaktionen verweisen

### Requirement: Tenant-lokale Admin-Rechteprobe

Das System MUST eine explizite, nicht-destruktive Rechteprobe für den tenantlokalen Admin-Client bereitstellen, damit die Betriebsfähigkeit von Tenant-IAM unabhängig von bloßen Strukturartefakten geprüft werden kann.

#### Scenario: Rechteprobe hat einen stabilen API-Vertrag

- **WHEN** eine berechtigte Person die Rechteprobe für eine Instanz auslöst
- **THEN** erfolgt dies über einen instanzbezogenen Schreibpfad wie `POST /api/v1/iam/instances/:instanceId/tenant-iam/access-probe`
- **AND** enthält die erfolgreiche Antwort mindestens den aktualisierten `access`-Befund und den daraus abgeleiteten `overall`-Befund
- **AND** führt der Endpoint keine destruktive Keycloak-Mutation aus

#### Scenario: Rechteprobe bestätigt tenantlokale Betriebsfähigkeit

- **WHEN** eine berechtigte Person die Rechteprobe für eine Instanz ausführt
- **THEN** verwendet das System den tenantlokalen Admin-Client dieser Instanz
- **AND** prüft mindestens, ob die für Tenant-IAM erforderlichen administrativen Keycloak-Operationen lesbar und ausführbar auflösbar sind
- **AND** aktualisiert die `access`-Achse des `tenantIamStatus`

#### Scenario: Rechteprobe meldet fehlende Tenant-IAM-Rechte

- **WHEN** der tenantlokale Admin-Client zwar konfiguriert ist, aber Keycloak die nötigen Operationen mit `403` oder gleichwertig verweigert
- **THEN** meldet die Rechteprobe einen stabilen Tenant-IAM-Befund
- **AND** ordnet diesen nicht als bloßen Registry-/Provisioning-Check ein
- **AND** bleibt die Ursache für die Instanz-Detailseite und den Betrieb verständlich auswertbar

#### Scenario: Detailansicht führt die Rechteprobe nicht implizit aus

- **WHEN** eine berechtigte Person die Instanz-Detailseite ohne explizite Probe-Aktion lädt
- **THEN** verwendet die Antwort nur vorhandene Tenant-IAM-Evidenz oder den letzten bekannten Probe-Befund
- **AND** startet keine neue tenantlokale Rechteprobe allein durch das Rendern der Seite

#### Scenario: Access-Befund bleibt ohne Evidenz explizit unbestimmt

- **WHEN** für eine Instanz noch keine belastbare tenantlokale Access-Evidenz vorliegt
- **THEN** bleibt die `access`-Achse im Zustand `unknown`
- **AND** wird dieser Zustand nicht künstlich als `ready` oder `blocked` aus Registry-Feldern abgeleitet
