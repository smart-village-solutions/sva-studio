## MODIFIED Requirements

### Requirement: Tenant-Aktivierung berücksichtigt externe Hostbereitschaft

Das System SHALL Registry-Aktivierung und externe Ingress-Bereitschaft als
getrennte, aber vor der Freigabe gemeinsam nachzuweisende Gates behandeln.
Ein Production-Tenant SHALL erst nach einer ausdrücklich bestätigten
manuellen Aktivierung als extern betriebsbereit gelten. Die Aktivierung SHALL
voraussetzen, dass seine versionierte Hostfreigabe ausgerollt sowie TLS,
OIDC-Konfiguration und die weiteren blockierenden technischen Voraussetzungen
aktuell über vorhandene serverseitige Readbacks und Probes geprüft wurden.
Ein interaktiver Login-/Callback-/Gateway-Nachweis SHALL weder Voraussetzung
noch nachgelagerter Pflichtschritt der Tenant-Erstellung sein.

#### Scenario: Registry-Eintrag ohne Ingress-Freigabe

- **WHEN** eine Instanz in der Registry vorhanden oder aktiv ist, ihr Host
  aber nicht in der Zielumgebung geroutet wird
- **THEN** meldet der Audit die externe Hostbereitschaft als fehlgeschlagen
  oder nicht bereit
- **AND** gilt der Registry-Status allein nicht als externer
  Betriebsnachweis

#### Scenario: Neuer Production-Tenant benötigt regulären Rollout

- **WHEN** ein neuer Production-Tenant extern freigegeben werden soll
- **THEN** wird sein vollständiger Hostname über den für das Betriebsprofil
  versionierten Infrastrukturvertrag ergänzt
- **AND** erfolgt eine erforderliche Studio-Änderung ausschließlich über den
  kanonischen GitHub-Actions-`Promote`-Pfad
- **AND** definiert der Tenant-Erstellungsprozess keinen konkurrierenden
  Deployment- oder Rolloutpfad

#### Scenario: Ingress-Freigabe ersetzt keine Registry-Autorisierung

- **WHEN** der Ingress einen explizit konfigurierten Tenant-Host an die
  Anwendung weiterleitet
- **THEN** prüft die Runtime den normalisierten Host weiterhin gegen einen
  aktiven, exakt passenden Registry-Eintrag
- **AND** lehnt sie fehlende oder inaktive Registry-Einträge fail-closed ab

#### Scenario: Technische Hostbereitschaft aktiviert nicht automatisch

- **WHEN** Ingress, TLS, OIDC-Konfiguration und modulabhängige Readiness technisch
  erfolgreich nachgewiesen sind
- **THEN** persistiert das System diese Evidenz für die manuelle Aktivierung
- **AND** setzt kein Ingress-, Provisioning- oder Recovery-Prozess die
  Instanz automatisch auf `active`
- **AND** bleibt die kritische Aktivierungsaktion als menschliche Freigabe
  erforderlich

#### Scenario: Kasseler Ingress bleibt Capability des gemeinsamen Flows

- **WHEN** das Kasseler Betriebsprofil dynamischen Ingress, TLS und zusätzliche
  Readiness-Probes bereitstellt
- **THEN** führt der Kasseler Provisioner diese Arbeiten als technische
  Schritte des gemeinsamen Tenant-Provisioning-Auftrags aus
- **AND** entstehen weder ein zweiter fachlicher Create-Pfad noch eigene
  Status-, Retry- oder Aktivierungsregeln
- **AND** fließt die Kasseler Evidenz in dieselbe manuelle
  Aktivierungsentscheidung ein

#### Scenario: Aktivierung prüft externe Evidenz erneut

- **WHEN** ein berechtigter Benutzer die kritische Aktivierungsaktion
  bestätigt
- **THEN** prüft der Server die aktuelle Revision der Host-, TLS-, OIDC-Konfigurations-
  und Modulnachweise
- **AND** lehnt er fehlende, veraltete oder widersprüchliche Evidenz ohne
  Statuswechsel ab
- **AND** bindet er die erfolgreiche Aktivierung und ihre Evidenzrevision an
  das Audit

#### Scenario: Aktivierung benötigt keinen Zugriff auf inaktive Tenant-Routen

- **WHEN** die technischen Voraussetzungen eines noch inaktiven Tenants
  erfolgreich geprüft wurden und ein berechtigter Operator die Aktivierung bestätigt
- **THEN** darf die Instanz ohne interaktive Browserabnahme aktiviert werden
- **AND** bleibt normaler Tenant-Zugriff bis zum Statuswechsel gesperrt
- **AND** entsteht weder ein Abnahme-Sonderzugang noch ein zusätzlicher
  Pflichtschritt nach der Aktivierung
