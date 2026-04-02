# deployment-topology Specification

## Purpose
TBD - created by archiving change add-swarm-portainer-deployment. Update Purpose after archive.
## Requirements
### Requirement: Swarm-kompatibler Portainer-Stack

Das System SHALL einen Portainer-Stack bereitstellen, der für Docker Swarm mit externem Ingress-Netzwerk und Traefik-Routing geeignet ist.

#### Scenario: Deployment in bestehender Swarm-Umgebung

- **WHEN** ein Operator den bereitgestellten Stack in einer bestehenden Swarm-/Portainer-Umgebung ausrollt
- **THEN** verwendet der Stack ein externes Netzwerk für den Ingress
- **AND** der öffentlich erreichbare Service wird über Traefik-Labels statt über direkt veröffentlichte Host-Ports exponiert
- **AND** der Stack enthält Swarm-kompatible `deploy`-Metadaten

### Requirement: Registry-basiertes App-Deployment

Das System SHALL die Anwendung im Swarm-Stack als vorgebautes Container-Image referenzieren.

#### Scenario: Redeploy einer bestehenden Version

- **WHEN** ein Operator einen bestehenden Stack auf eine neue oder frühere Version umstellt
- **THEN** erfolgt der Wechsel über einen Image-Tag oder Digest
- **AND** der Stack benötigt keinen Build-Schritt auf dem Zielserver
- **AND** die Image-Referenz im Stack ist parametrisierbar (über Env-Variablen für Registry und Tag)

### Requirement: Dokumentiertes Subdomain-Modell für Instanz-URLs

Das System SHALL dokumentieren, dass Instanzen unter Hostnamen der Form `instanceId.<base-domain>` adressiert werden und die linke Subdomain direkt die `instanceId` repräsentiert.

#### Scenario: Ableitung der Instanz aus dem Hostnamen

- **WHEN** ein Team das Zielbild für Instanz-Subdomains betrachtet
- **THEN** beschreibt die Dokumentation ein festes Hostschema wie `instanceid.studio.smart-village.app`
- **AND** hält fest, dass `instanceid` direkt als `instanceId` verwendet wird
- **AND** grenzt die zulässige Parent-Domain explizit ein

#### Scenario: Host-Validierung für Instanz-Subdomains

- **WHEN** ein eingehender Host gegen das dokumentierte Subdomain-Modell geprüft wird
- **THEN** wird genau ein zusätzliches DNS-Label links der Parent-Domain akzeptiert
- **AND** die Host-Prüfung verwendet eine kanonische Kleinschreibungsform ohne abschließenden Punkt
- **AND** Root-Domain-Anfragen, mehrstufige Subdomains, IDN-/Punycode-Labels (`xn--`-Präfix) und nicht unterstützte Label-Formate werden als ungültig behandelt
- **AND** die HTTP-Antwort für alle Ablehnungsgründe (ungültiges Format, nicht in Allowlist, Root-Domain) ist identisch: gleicher Status-Code (`403`), gleicher Body, kein erläuternder Ablehnungsgrund nach außen

### Requirement: Env-gesteuerte Allowlist für gültige Instanz-Hosts

Das System SHALL dokumentieren, dass gültige `instanceId`s über Runtime-Konfiguration autoritativ freigegeben werden.

#### Scenario: Anfrage für nicht freigegebene Instanz-Subdomain

- **WHEN** eine Anfrage für `unknown.<base-domain>` eingeht
- **AND** `unknown` ist nicht in der konfigurierten Allowlist enthalten
- **THEN** wird diese Instanz vor OIDC und vor jeder instanzbezogenen Verarbeitung nicht als gültig behandelt
- **AND** die Dokumentation beschreibt die dafür vorgesehene Env-Variable

#### Scenario: Format der konfigurierten Allowlist

- **WHEN** ein Operator die Env-Variable für gültige `instanceId`s setzt
- **THEN** verwendet die Dokumentation ein kommagetrenntes Format ohne Leerzeichen
- **AND** alle Einträge sind in Kleinschreibung angegeben
- **AND** die Dokumentation beschreibt dieses Format als verbindlich

#### Scenario: Allowlist als autoritative Freigabequelle

- **WHEN** die Dokumentation das Betriebsmodell für gültige Instanzen beschreibt
- **THEN** benennt sie die Allowlist als aktuell autoritative Quelle gültiger `instanceId`s
- **AND** beschreibt, dass nur Einträge aus dieser Allowlist als freigegebene Instanzen gelten

#### Scenario: Startup-Validierung der Allowlist

- **WHEN** die Applikation gestartet wird und die Allowlist-Konfiguration geladen wird
- **THEN** SHALL jeder Eintrag gegen das `instanceId`-Regex validiert werden
- **AND** bei ungültigen Einträgen bricht die Applikation fail-fast mit einer klaren Fehlermeldung ab

### Requirement: Kanonischer Auth-Host für Multi-Host-Betrieb

Das System SHALL dokumentieren, dass mehrere App-Hosts unterhalb der festen Parent-Domain zulässig sind, interaktive OIDC- und Logout-Flows bis zu einer Folgeänderung jedoch nur über einen kanonischen Auth-Host unterstützt werden.

#### Scenario: Unterstützter Auth-Flow auf dem kanonischen Host

- **WHEN** ein Operator oder Reviewer den unterstützten Login-/Logout-Flow betrachtet
- **THEN** beschreibt die Dokumentation genau einen kanonischen Auth-Host
- **AND** ordnet sie statische `redirectUri`, `postLogoutRedirectUri` und `SVA_PUBLIC_BASE_URL` diesem Host zu

#### Scenario: Nicht unterstützter Auth-Flow auf einem Instanz-Host

- **WHEN** eine Anfrage auf einem Instanz-Host einen OIDC-Login, Logout oder einen hostgebundenen Redirect erfordern würde
- **THEN** beschreibt die Dokumentation ein deterministisches fail-closed-Verhalten
- **AND** stellt klar, dass bis zur Folgeänderung keine hostdynamische Redirect-Berechnung erfolgt

### Requirement: Minimaler Betriebsvertrag für stateful Swarm-Services

Das System SHALL dokumentieren, wie stateful Services, Secrets, Configs, Migrationen und Rollback im Swarm-Referenzprofil minimal belastbar betrieben werden.

#### Scenario: Klassifizierung von Secrets und Configs

- **WHEN** ein Team die Runtime-Konfiguration des Swarm-Stacks dokumentiert
- **THEN** trennt die Dokumentation sensitive Secrets von nicht sensitiven Configs
- **AND** hält fest, dass sensitive Werte nicht in allgemeinen Stack-Variablen oder Stack-Dateien abgelegt werden
- **AND** stellt eine verbindliche Klassifizierungstabelle bereit, die jede Runtime-Variable als Secret oder Config einordnet

#### Scenario: Persistenz und Placement für stateful Services

- **WHEN** das Zielbild für Postgres und Redis beschrieben wird
- **THEN** benennt die Dokumentation persistente Volumes und Placement-Annahmen für stateful Services
- **AND** beschreibt einen Restore-Pfad für diese Services

#### Scenario: Kompatibles Rollback-Fenster

- **WHEN** ein Team Rollout und Rollback des Swarm-Stacks dokumentiert
- **THEN** beschreibt die Dokumentation ein kompatibles Rollback-Fenster für App- und Schema-Änderungen
- **AND** grenzt destruktive oder nicht rückwärtskompatible Migrationen aus diesem Change aus

#### Scenario: Acceptance-Migration nutzt gepinntes Goose ohne Vorinstallation

- **WHEN** der dokumentierte Acceptance-Migrationspfad ausgeführt wird
- **THEN** verwendet er eine gepinnte `goose`-Version
- **AND** setzt keine permanente `goose`-Installation auf dem Zielserver voraus
- **AND** beschreibt, wie Binary und Migrationsbundle temporär in den Zielkontext gelangen oder dort reproduzierbar bereitgestellt werden

### Requirement: Dokumentierte Grenzen für dynamische Multi-Host-OIDC-Redirects

Das System SHALL dokumentieren, unter welchen Bedingungen dynamische OIDC- und Logout-Redirects für Instanz-Subdomains unterstützt werden können.

#### Scenario: Bewertung dynamischer Redirects pro Instanz-Host

- **WHEN** ein Team dynamische OIDC-Redirects für `instanceId.<base-domain>` evaluieren möchte
- **THEN** beschreibt die Dokumentation die Abhängigkeit zu statischen oder dynamischen Redirect-URIs, Logout-Redirects und kanonischer Base-URL
- **AND** macht sie kenntlich, ob die Funktion sofort unterstützt wird oder eine Folgeänderung benötigt

