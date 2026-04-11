## MODIFIED Requirements

### Requirement: Env-gesteuerte Allowlist fuer gueltige Instanz-Hosts

Das System SHALL dokumentieren, dass die env-basierte Allowlist fuer gueltige `instanceId`s nur fuer lokale, isolierte oder uebergangsweise Betriebsprofile zulaessig ist und im produktiven Multi-Tenant-Betrieb nicht die fuehrende Freigabequelle bildet.

#### Scenario: Produktiver Multi-Tenant-Betrieb mit zentraler Registry

- **WHEN** die Dokumentation das Zielbild fuer `studio.smart-village.app` mit vielen Instanz-Subdomains beschreibt
- **THEN** benennt sie eine zentrale Instanz-Registry als autoritative Quelle gueltiger Instanzen
- **AND** beschreibt `SVA_ALLOWED_INSTANCE_IDS` hoechstens als Fallback-, Entwicklungs- oder Migrationsmechanismus

#### Scenario: Lokaler oder uebergangsweiser Betrieb mit Env-Konfiguration

- **WHEN** ein lokales oder migrierendes Profil ohne aktive Registry betrieben wird
- **THEN** darf die Dokumentation die env-basierte Allowlist weiterhin als zulaessigen Uebergangspfad beschreiben
- **AND** grenzt diesen Pfad explizit gegen den produktiven Zielbetrieb ab

### Requirement: Registry-basiertes Single-Deployment fuer Multi-Tenant-Studio

Das System SHALL den produktiven Betrieb als einzelnes Deployment mit zentraler Instanz-Registry fuer Root-Host und Tenant-Hosts dokumentieren.

#### Scenario: Gemeinsamer Plattformbetrieb unter Root- und Tenant-Hosts

- **WHEN** ein Team die Zieltopologie fuer `studio.smart-village.app` betrachtet
- **THEN** beschreibt die Dokumentation genau ein App-Deployment fuer die Plattform
- **AND** ordnet sowohl `studio.smart-village.app` als auch `*.studio.smart-village.app` diesem Deployment zu
- **AND** koppelt die Tenant-Freigabe nicht an getrennte Images, getrennte Stacks oder getrennte Runtime-Profile

#### Scenario: DNS- und TLS-Vertrag fuer Tenant-Hosts

- **WHEN** die Verteilungssicht die externe Erreichbarkeit beschreibt
- **THEN** dokumentiert sie DNS fuer Root-Domain und Wildcard-Subdomains
- **AND** dokumentiert sie TLS fuer Root-Domain und Wildcard-Subdomains
- **AND** beschreibt den Ingress als gemeinsamen Eintrittspunkt

### Requirement: Dokumentierter lokaler Multi-Tenant-Testvertrag

Das System SHALL fuer lokale Entwicklung und lokale Multi-Tenant-Tests einen dokumentierten Betriebsvertrag bereitstellen, der Root-Host, Tenant-Hosts und Seed-Instanzen reproduzierbar macht.

#### Scenario: Schneller lokaler Dev-Modus

- **WHEN** ein Teammitglied den taeglichen lokalen Entwicklungsmodus startet
- **THEN** beschreibt die Dokumentation einen schnellen Standardpfad mit vorbereiteten Seed-Instanzen
- **AND** macht deutlich, welche Teile des grossen Multi-Tenant-Modells dabei echt und welche vereinfacht sind

#### Scenario: Realistischer lokaler Multi-Tenant-Modus

- **WHEN** ein Teammitglied das Zielbild fuer Host-Aufloesung und Registry-Verhalten lokal pruefen will
- **THEN** beschreibt die Dokumentation einen realistischen lokalen oder acceptance-nahen Testpfad
- **AND** enthaelt dieser Root-Host, Tenant-Hosts und Registry-basierte Tenant-Freigabe

#### Scenario: Lokale Hostname-Strategie ist verbindlich beschrieben

- **WHEN** die Dokumentation lokale Root- und Tenant-Hosts beschreibt
- **THEN** benennt sie eine verbindliche lokale Parent-Domain oder aequivalente Host-Strategie
- **AND** beschreibt mindestens einen offiziell unterstuetzten Mechanismus fuer die Aufloesung lokaler Tenant-Hosts

### Requirement: Registry-basierte Laufzeitfreigabe fuer Instanz-Hosts

Das System SHALL dokumentieren, dass eingehende Instanz-Hosts gegen eine zentrale Registry mit Status- und Hostname-Pruefung validiert werden.

#### Scenario: Aktive Instanz wird ueber Registry freigegeben

- **WHEN** ein Request fuer `<instanceId>.<base-domain>` eingeht
- **AND** die Registry enthaelt einen aktiven Eintrag mit passendem Hostnamen
- **THEN** wird der Tenant-Kontext fuer diese Instanz aufgeloest
- **AND** die Dokumentation beschreibt die Registry als fuehrende Quelle fuer den Freigabeentscheid

#### Scenario: Unbekannte oder inaktive Instanz wird fail-closed abgelehnt

- **WHEN** ein Request fuer einen ungueltigen, unbekannten, suspendierten oder archivierten Tenant-Host eingeht
- **THEN** beschreibt die Dokumentation fuer diese Faelle ein identisches fail-closed-Verhalten nach aussen
- **AND** vermeidet erklaerende Unterschiede, die Tenant-Enumeration erleichtern koennten
