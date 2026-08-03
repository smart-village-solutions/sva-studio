## ADDED Requirements

### Requirement: Explizite Ingress-Freigabe für betriebene Tenant-Hosts

Das System SHALL bis zu einer separat spezifizierten Wildcard-TLS-Lösung ausschließlich explizit konfigurierte Tenant-Hosts über den Studio-Ingress veröffentlichen und für jeden veröffentlichten Host ein durch den vorhandenen Traefik Certificate Resolver verwaltetes Einzelzertifikat verwenden.

#### Scenario: Dev veröffentlicht genau einen Tenant-Host

- **WHEN** das Dev-Deployment gerendert oder ausgerollt wird
- **THEN** routet der App-Service `studio-dev.smart-village.app`
- **AND** routet er `de-teststadt-dev.studio-dev.smart-village.app`
- **AND** enthält die Dev-Ingress-Konfiguration keinen weiteren Tenant-Host

#### Scenario: Staging veröffentlicht genau den Sandbox-Tenant

- **WHEN** das Staging-Deployment gerendert oder ausgerollt wird
- **THEN** routet der App-Service `studio-staging.smart-village.app`
- **AND** routet er `de-studio-sandbox.studio-staging.smart-village.app`
- **AND** enthält die Staging-Ingress-Konfiguration keinen weiteren Tenant-Host

#### Scenario: Production verwendet eine bestätigte Hostliste

- **WHEN** das Production-Deployment gerendert oder ausgerollt wird
- **THEN** routet der App-Service `studio.smart-village.app`
- **AND** routet er ausschließlich die folgenden Tenant-IDs unter `<instanceId>.studio.smart-village.app`: `bb-ahrensfelde`, `bb-amt-schlieben`, `bb-angermuende`, `bb-bad-belzig`, `bb-bernau`, `bb-birkenwerder`, `bb-briesen`, `bb-dahme-spreewald`, `bb-eberswalde`, `bb-eisenhuettenstadt`, `bb-falkenberg-elster`, `bb-frankfurt-oder`, `bb-gransee`, `bb-gruenheide`, `bb-guben`, `bb-havelland`, `bb-herzberg-elster`, `bb-hohen-neuendorf`, `bb-kloster-lehnin`, `bb-koenigs-wusterhausen`, `bb-kyritz`, `bb-michendorf`, `bb-neuzelle`, `bb-nuthetal`, `bb-oberspreewald-lausitz`, `bb-panketal`, `bb-petershagen-eggersdorf`, `bb-prenzlau`, `bb-prignitz`, `bb-ruedersdorf`, `bb-schoenefeld`, `bb-seelow`, `bb-spremberg`, `bb-storkow`, `bb-uckermark`, `bb-wandlitz`, `bw-kommone`, `by-amorbach`, `by-augsburg`, `de-musterhausen`, `de-studio-sandbox`, `demo`, `eichenzell`, `hb-meinquartier`, `he-kassel`, `mv-crivitz`, `mv-hagenow`, `ni-goslar`, `ni-harsum`, `ni-lehrte`, `ni-osnabrueck`, `ni-papenburg`, `ni-wittingen`, `nrw-detmold`, `nrw-legden`, `rp-linz-am-rhein`, `sh-kiel`, `sh-nordapp`, `sl-sankt-wendel`, `st-arneburg-goldbeck`, `st-magdeburg`, `st-wittenberg`, `st-zeitz`
- **AND** blockiert das Gate fehlende, doppelte oder syntaktisch ungültige Listeneinträge

#### Scenario: Expliziter Host erhält ein Einzelzertifikat

- **WHEN** ein Root- oder Tenant-Host in einer Studio-Routerregel freigegeben wird
- **THEN** ist der vorhandene Traefik Certificate Resolver für diesen Router aktiviert
- **AND** wird der konkrete Host über einen expliziten `Host(...)`-Matcher als ACME-Domain ableitbar
- **AND** muss die externe Verifikation ein für den Host gültiges Zertifikat nachweisen

#### Scenario: Wildcard-TLS bleibt außerhalb des Übergangsprofils

- **WHEN** die Ingress- oder TLS-Konfiguration dieses Betriebsprofils bewertet wird
- **THEN** benötigt der Studio-Stack weder DNS-01 noch AutoDNS-Credentials
- **AND** setzt er kein Wildcard-Zertifikat voraus
- **AND** darf ein generischer `HostRegexp`-Router die explizite Tenant-Hostfreigabe nicht ersetzen

### Requirement: Tenant-Aktivierung berücksichtigt externe Hostbereitschaft

Das System SHALL Registry-Aktivierung und externe Ingress-Bereitschaft als getrennte Gates behandeln und einen Production-Tenant erst dann als extern betriebsbereit einstufen, wenn seine versionierte Hostfreigabe ausgerollt sowie TLS und Tenant-Login erfolgreich verifiziert wurden.

#### Scenario: Registry-Eintrag ohne Ingress-Freigabe

- **WHEN** eine Instanz in der Registry vorhanden oder aktiv ist, ihr Host aber nicht in der Zielumgebung geroutet wird
- **THEN** meldet der Audit die externe Hostbereitschaft als fehlgeschlagen oder nicht bereit
- **AND** gilt der Registry-Status allein nicht als externer Betriebsnachweis

#### Scenario: Neuer Production-Tenant benötigt regulären Rollout

- **WHEN** ein neuer Production-Tenant extern freigegeben werden soll
- **THEN** wird sein vollständiger Hostname über eine versionierte Compose-Änderung ergänzt
- **AND** erfolgt die Änderung ausschließlich über den kanonischen GitHub-Actions-`Promote`-Pfad
- **AND** verändert der Tenant-Erstellungsprozess den gemeinsamen Traefik nicht direkt

#### Scenario: Ingress-Freigabe ersetzt keine Registry-Autorisierung

- **WHEN** Traefik einen explizit konfigurierten Tenant-Host an die Anwendung weiterleitet
- **THEN** prüft die Runtime den normalisierten Host weiterhin gegen einen aktiven, exakt passenden Registry-Eintrag
- **AND** lehnt sie fehlende oder inaktive Registry-Einträge fail-closed ab

### Requirement: Explizite Tenant-Host-Smoke-Matrix

Das System SHALL nach jedem Umgebungsrollout den Root-Host, jeden explizit freigegebenen Tenant-Host und mindestens einen unbekannten Tenant-Host extern prüfen.

#### Scenario: Freigegebener Tenant ist über HTTPS betriebsbereit

- **WHEN** die Post-Deploy-Smokes für eine Zielumgebung laufen
- **THEN** antworten Root-Host und alle explizit freigegebenen Tenant-Hosts über HTTPS
- **AND** ist das jeweils ausgelieferte Zertifikat für den angefragten Host gültig
- **AND** erzeugt `/auth/login` auf einem Tenant-Host einen tenant-spezifischen Redirect mit demselben Rückkehr-Host

#### Scenario: Unbekannter Tenant bleibt fail-closed

- **WHEN** die Smoke-Matrix einen syntaktisch gültigen, aber nicht freigegebenen Tenant-Host anfragt
- **THEN** darf dieser Host nicht als betriebsbereiter Tenant erscheinen
- **AND** liefert die Plattform weder Tenant-Daten noch einen tenant-spezifischen Login-Flow aus
