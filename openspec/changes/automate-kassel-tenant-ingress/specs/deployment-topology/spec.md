## ADDED Requirements

### Requirement: Kasseler Standalone-Provisioner automatisiert explizite Tenant-Ingress-Router

Die Kasseler Standalone-Installation SHALL für jeden freigegebenen Tenant einen
eigenen, expliziten Traefik-`Host(...)`-Router über einen beobachteten
File-Provider-Ordner bereitstellen. Ausschließlich der vorhandene eigenständige
Kasseler Provisioner SHALL in diesen Ordner schreiben dürfen; Traefik SHALL ihn
nur lesbar mounten, und kein beteiligter Studio-Prozess SHALL dafür einen
Docker-Socket oder DNS-/ACME-Zugangsdaten erhalten.

#### Scenario: Ein gültiger Kasseler Tenant erhält einen Router

- **WHEN** der Elternlauf einen validierten Host mit genau einem DNS-Label unter `dialog.kassel.de` an den Kasseler Provisioner übergibt
- **THEN** veröffentlicht der Provisioner atomar eine deterministische Konfiguration mit genau einer expliziten `Host(...)`-Regel für diesen Tenant
- **AND** verweist der Router über eine gegen die Live-Topologie geprüfte providerqualifizierte Referenz auf den vorhandenen Studio-Service
- **AND** fordert Traefik über den bestehenden TLS-ALPN-Resolver ein tenantbezogenes Zertifikat an

#### Scenario: Eine Routerdatei kann nicht vollständig validiert werden

- **WHEN** Rendering, Validierung oder Dateischreiben vor der atomaren Veröffentlichung scheitert
- **THEN** ersetzt der Provisioner die letzte gültige Routerdatei nicht
- **AND** meldet er einen stabilen, zum Elternlauf korrelierbaren Fehler ohne sensible Konfigurationswerte

#### Scenario: Ein Host liegt außerhalb des Kasseler Tenant-Vertrags

- **WHEN** ein Host reserviert ist, zusätzliche Labels, Punycode oder unzulässige Zeichen enthält oder nicht unter `dialog.kassel.de` liegt
- **THEN** lehnt der Provisioner den Ingress-Schritt vor jeder Dateisystemmutation fail-closed ab

#### Scenario: Ein unbekannter oder fehlgeschlagener Tenant erreicht Traefik

- **WHEN** eine Anfrage einen unbekannten Host oder einen Tenant im Status `failed` verwendet
- **THEN** darf keine generische `HostRegexp`-Regel den Host als aktiven Tenant freischalten
- **AND** lehnen Runtime und modulbezogene Directory-Pfade den Tenant unabhängig von erhaltenen Diagnoseartefakten fail-closed ab

#### Scenario: Traefik liest dynamische Konfiguration

- **WHEN** die Kasseler Traefik-Instanz den File Provider aktiviert
- **THEN** mountet sie den beobachteten Ordner nur lesbar
- **AND** bleibt der bestehende Docker Provider für Bestandsrouter funktionsfähig
- **AND** kann Traefik keine Routerdateien in den Writer-Ordner zurückschreiben

### Requirement: Kasseler Ingress-Automatisierung bleibt umgebungsspezifisch

Das System SHALL den dynamischen File-Provider-Writer nur bei expliziter
Aktivierung des Kasseler Ingress-Modus verwenden. Alle regulären
Studio-Umgebungen SHALL ohne diese Aktivierung den bestehenden expliziten
Ingress- und geschützten Promote-Vertrag unverändert beibehalten.

#### Scenario: Eine reguläre Studio-Umgebung startet ohne Kassel-Modus

- **WHEN** Dev, Staging, Production oder eine andere Installation keinen Kassel-Modus konfiguriert
- **THEN** erhält kein Studio-Prozess ein Writer-Mount für Traefik-Konfiguration
- **AND** mutiert die Instanzanlage keine Traefik-Dateien
- **AND** bleiben versionierte Hostregeln und der kanonische Promote-Prozess maßgeblich

#### Scenario: Die Kasseler Umgebung besitzt keinen DNS-01-Zugang

- **WHEN** ein neuer Kasseler Tenant provisioniert wird
- **THEN** verwendet das System den bestehenden TLS-ALPN-ACME-Vertrag mit explizitem Host
- **AND** setzt es weder ein Wildcard-Zertifikat noch DNS-Zugangsdaten voraus

### Requirement: Statische Kasseler Bestandsrouten werden unterbrechungsfrei übernommen

Die Kasseler Standalone-Installation SHALL jeden vorhandenen Tenant-Host erst
nach erfolgreichem Nachweis seines höher priorisierten dynamischen Routers aus
der statischen Docker-Label-Regel entfernen.

#### Scenario: Ein Bestands-Tenant wird auf den File Provider migriert

- **WHEN** ein bestehender Host aus der statischen Regel übernommen werden soll
- **THEN** veröffentlicht das System zunächst nur für diesen Host einen expliziten dynamischen Router mit definierter höherer Priorität
- **AND** verifiziert es Routerauswahl, Zertifikat, Studio-Login und erforderliche Modul-Readiness extern
- **AND** entfernt es den Host erst danach aus der statischen Regel
- **AND** prüft es anschließend sowohl den migrierten Host als auch alle verbliebenen Bestands-Hosts erneut

#### Scenario: Ein Bestands-Tenant erfüllt die Abnahme nicht

- **WHEN** der dynamische Router funktioniert, aber Login oder modulabhängige Readiness scheitern
- **THEN** gilt der Tenant nicht als erfolgreich migriert
- **AND** bleibt sein letzter nachweislich funktionierender expliziter Routingpfad für Diagnose oder Rückweg erhalten
- **AND** werden Registry-, Keycloak-, Secret- und Lifecycle-Daten nicht gelöscht

### Requirement: Kasseler Ingress-Abnahme ist Teil des terminalen Create-Ergebnisses

Das Kasseler Provisioning SHALL Routerübernahme, öffentlich vertrauenswürdiges
TLS und den externen Studio-Login als zwingende Postconditions des fachlichen
Elternlaufs behandeln. Modulabhängige öffentliche Postconditions SHALL aus den
jeweils führenden Modulverträgen stammen.

#### Scenario: TLS und Studio-Login sind extern betriebsbereit

- **WHEN** ein Kasseler Tenant erfolgreich angelegt werden soll
- **THEN** verifiziert das System öffentliches TLS für den exakten SNI-/Hostnamen
- **AND** verifiziert es den Studio-Login-Redirect zum erwarteten Tenant-Realm
- **AND** verifiziert es eine Redirect- beziehungsweise Callback-Konfiguration auf demselben Tenant-Host
- **AND** gilt die Anlage erst nach allen allgemeinen und modulabhängigen Nachweisen als erfolgreich

#### Scenario: Der Studio-Login liefert trotz gültigem Zertifikat einen Fehler

- **WHEN** TLS erfolgreich ist, der externe Studio-Login aber einen Fehler, falschen Realm oder falschen Callback-Host liefert
- **THEN** darf der Elternlauf nicht erfolgreich enden
- **AND** wird die Instanz innerhalb der definierten Fehlerpolitik auf `failed` gesetzt
- **AND** bleiben Router und übrige Teilartefakte für Diagnose und idempotenten Retry erhalten
