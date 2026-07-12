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

#### Scenario: Live-Rollout validiert vollständige App-Netzwerke

- **WHEN** der Live-Stack für `studio` für `app-only` oder `schema-and-app` gerendert wird
- **THEN** validiert der Deploypfad vor dem Stack-Update, dass der Service `app` weiterhin die Netzwerke `internal` und `public` enthält
- **AND** verwirft der Rollout den Renderpfad, wenn diese Netzwerke oder ingressrelevante Labels fehlen

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

### Requirement: Multi-Host-Runtime nutzt tenant-spezifische Auth-Konfiguration

Die Plattform SHALL Authentifizierung und Keycloak-Admin-Operationen für Tenant-Hosts aus der Instanz-Registry auflösen statt aus globalen produktiven Realm-Variablen.

#### Scenario: Tenant-Host startet Login im eigenen Realm

- **WHEN** ein anonymer Nutzer `https://bb-guben.studio.smart-village.app/auth/login` aufruft
- **THEN** die Runtime löst `bb-guben` aus der Registry auf
- **AND** startet den OIDC-Flow gegen den für `bb-guben` gespeicherten Realm
- **AND** verwendet Redirect- und Logout-URLs auf demselben Tenant-Host

### Requirement: Bootstrap- und Seed-Pfade unterscheiden neue und bestehende Umgebungen

Das System SHALL im lokalen und staging-nahen Betrieb normativ zwischen neuer Umgebung, read-only Standardstart und explizitem Repair-Pfad unterscheiden, damit Seed-, Bootstrap- und Reconcile-Pfade keine bestehende Umgebungsidentitaet stillschweigend ueberschreiben.

#### Scenario: Standardstart bleibt read-only

- **WHEN** ein Teammitglied `pnpm env:up:local-keycloak` oder `pnpm env:update:local-keycloak` gegen eine bestehende lokale Umgebung ausfuehrt
- **THEN** schreibt der Standardpfad keine geschuetzten Identitaetsfelder und keine tenant-spezifischen Secrets still zurueck
- **AND** meldet er Drift nur sichtbar ueber `doctor` oder den read-only Drift-Check

#### Scenario: Expliziter Repair-Pfad heilt lokale Drift ohne Rebootstrap

- **WHEN** eine bestehende lokale `local-keycloak`-Umgebung Drift bei Migration, Registry-Identitaet oder tenant-spezifischen Secrets aufweist
- **THEN** steht mit `pnpm env:repair:local-keycloak` ein expliziter, idempotenter Repair-Pfad zur Verfuegung
- **AND** fuehrt dieser Pfad hoechstens Migration, Registry-Reconcile und Secret-Sync aus
- **AND** loest er weder `down` noch `reset` noch einen kompletten Rebootstrap implizit aus

#### Scenario: Gefaehrliche Runtime-Mutationen benoetigen ein Approval-Token

- **WHEN** ein Teammitglied einen gefaehrlichen Runtime-Pfad wie autoritativen lokalen Repair, autoritativen lokalen Reconcile, Remote-Migrate, Remote-Deploy, Remote-Down oder Remote-Reset ausfuehrt
- **THEN** blockiert das Repo den Befehl ohne passenden `--approve-dangerous=<token>`
- **AND** nennt die Fehlermeldung den exakt erwarteten Freigabetoken fuer die Wiederholung

### Requirement: Bestehende staging-nahe Umgebungen erhalten sichtbare Drift-Guardrails für Identitätsfelder

Das System SHALL für bestehende staging-nahe Umgebungen sichtbare Guardrails bereitstellen, wenn Bootstrap- oder Seed-Pfade auf abweichende geschützte Identitätswerte treffen.

#### Scenario: Abweichende Zielwerte werden sichtbar statt still übernommen

- **WHEN** ein Bootstrap-, Seed- oder Reconcile-Pfad auf eine bestehende staging-nahe Umgebung mit bereits belegten geschützten Identitätsfeldern trifft
- **AND** der Zielwert von `parent_domain`, `primary_hostname`, `auth_realm`, `auth_client_id`, `tenant_admin_client_id` oder tenant-spezifischen Auth-Secret-Zuordnungen abweicht
- **THEN** wird die Abweichung mindestens als sichtbare Warnung oder harter Fehler ausgewiesen
- **AND** der Pfad übernimmt die neue Identität nicht stillschweigend als Standardverhalten

### Requirement: Betriebsfähige Tenant-Umgebungen erfordern konsistente Secret-Zuordnungen

Das System SHALL im lokalen und staging-nahen Betrieb tenant-spezifische Auth-Secrets und tenant-spezifische Tenant-Admin-Secrets als Teil der Umgebungs-Readiness behandeln.

#### Scenario: Doctor klassifiziert Secret-Drift maschinenlesbar

- **WHEN** `pnpm env:doctor:local-keycloak --json` gegen eine Umgebung mit fehlenden oder unlesbaren tenant-spezifischen Secrets laeuft
- **THEN** enthaelt der Report stabile `reasonCode`-, `repairable`- und `recommendedAction`-Felder fuer die betroffene Driftklasse
- **AND** verwendet der Report fuer Tenant-Secrets Codes wie `tenant_auth_client_secret_missing`, `tenant_auth_client_secret_unreadable`, `tenant_admin_client_secret_missing` oder `tenant_admin_client_secret_unreadable`

#### Scenario: Repair synchronisiert tenant-spezifische Secrets gegen Keycloak

- **WHEN** `pnpm env:repair:local-keycloak` auf tenant-spezifische Secret-Drift trifft
- **THEN** gleicht der Repair-Pfad die Secrets ueber vorhandene Keycloak-/Registry-Mechanik gegen den Live-Zustand ab
- **AND** heilt er fehlende oder mit dem aktuellen Verschluesselungsmaterial nicht lesbare Registry-Secrets ohne globale Fallback-Secrets

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

#### Scenario: Temp-Job-Stack verändert den Live-Stack nicht

- **WHEN** `migrate` oder `bootstrap` für `studio` in einem temporären Job-Stack ausgeführt werden
- **THEN** enthält der temporäre Stack keinen `app`-Service
- **AND** reconciled der Job-Lauf nicht den Live-Stack mit `app`, `postgres` oder `redis`
- **AND** nutzt der Job-Stack nur das vorhandene Overlay-Netz `<stack>_internal`

#### Scenario: Recovery-Pfad für Netzwerk- oder Ingress-Drift ist dokumentiert

- **WHEN** ein Live-Rollout zu einem Zustand `app 1/1`, aber externem `502` oder fehlendem Ingress-Netz führt
- **THEN** beschreibt die Betriebsdokumentation einen kanonischen Recovery-Pfad aus Diagnose, gezieltem App-Reconcile und nachgelagerter Verifikation
- **AND** behandelt sie direkte Portainer-API-Eingriffe nur als Incident-Recovery und nicht als Standardpfad

### Requirement: Dokumentierte Grenzen für dynamische Multi-Host-OIDC-Redirects

Das System SHALL dokumentieren, unter welchen Bedingungen dynamische OIDC- und Logout-Redirects für Instanz-Subdomains unterstützt werden können.

#### Scenario: Bewertung dynamischer Redirects pro Instanz-Host

- **WHEN** ein Team dynamische OIDC-Redirects für `instanceId.<base-domain>` evaluieren möchte
- **THEN** beschreibt die Dokumentation die Abhängigkeit zu statischen oder dynamischen Redirect-URIs, Logout-Redirects und kanonischer Base-URL
- **AND** macht sie kenntlich, ob die Funktion sofort unterstützt wird oder eine Folgeänderung benötigt

### Requirement: Getrennter Kanal fuer read-only Remote-Diagnostik

Das System SHALL read-only Remote-Diagnostik fuer Swarm-Stacks ueber einen stabilen Kanal bereitstellen, der nicht vom lokalen `quantum-cli`-Kontext abhaengt.

#### Scenario: Read-only Statusabfrage ohne lokale Quantum-CLI

- **WHEN** ein Operator `status`, `doctor` oder `precheck` fuer ein Remote-Profil ausfuehrt
- **THEN** werden Stack-, Service-, Netzwerk- oder Live-Spec-Abfragen bevorzugt ueber MCP oder Portainer-API aufgeloest
- **AND** ein lokaler `quantum-cli`-Auth-Fehler blockiert diese read-only Diagnostik nicht als primaeren Kanal
- **AND** der Report macht transparent, welcher Kanal fuer den Befund verwendet wurde

### Requirement: `quantum-cli exec` ist nur Fallback fuer Diagnostik

Das System SHALL `quantum-cli exec` im Diagnosepfad nur noch als expliziten Fallback behandeln.

#### Scenario: Diagnosepfad vermeidet Websocket-`exec` als Standard

- **WHEN** `doctor` oder `precheck` einen Remote-Befund fuer Runtime-Flags, Datenbank- oder Service-Zustand erzeugt
- **THEN** nutzt der Standardpfad keinen Websocket-basierten `quantum-cli exec`, sofern ein API-, HTTP-, Loki- oder Job-basierter Nachweis verfuegbar ist
- **AND** ein `exec`-Fallback wird im Report klar als Fallback gekennzeichnet
- **AND** ein Fallback-Fehler ueberschreibt den bereits vorhandenen fachlichen Gesundheitsbefund nicht unscharf

### Requirement: Quantum bleibt auf mutierende Rollout-Pfade begrenzt

Das System SHALL `quantum-cli` im Regelbetrieb auf mutierende Rollout- und Job-Pfade begrenzen.

#### Scenario: Mutierender Rollout verwendet weiterhin Quantum

- **WHEN** ein Operator einen Remote-Deploy oder einen dedizierten Migrations- oder Bootstrap-Job startet
- **THEN** darf der kanonische Pfad weiterhin `quantum-cli stacks update` oder Quantum-basierte Temp-Job-Stacks verwenden
- **AND** dieser mutierende Pfad bleibt klar von read-only Diagnostik getrennt
- **AND** die Dokumentation bezeichnet Quantum fuer diese Faelle als verbleibenden Orchestrierungsweg statt als universellen Betriebszugang

### Requirement: Mutationen laufen in einem deterministischen Operator-Kontext

Das System SHALL mutierende Remote-Operationen in einem deterministischen Operator-Kontext ausfuehren.

#### Scenario: Lokaler Operator-Deploy bleibt auf verifizierte Digests begrenzt

- **WHEN** ein mutierender Rollout fuer `studio` ausgefuehrt wird
- **THEN** erfolgt die technische Freigabe zuvor ueber GitHub Build- und Verify-Gates fuer genau ein Digest-Artefakt
- **AND** der mutierende Schritt laeuft lokal nur ueber den dokumentierten Operator-Einstieg `env:release:studio:local`
- **AND** beliebige lokale Shell-Overlays wie `~/.config/quantum/env` gelten nicht als primaere Quelle der technischen Freigabe

### Requirement: Prod-nahes Parity-Gate vor mutierenden Remote-Rollouts

Das System SHALL vor mutierenden Remote-Rollouts fuer produktionsnahe Runtime-Profile einen prod-nahen Parity-Nachweis fuer das auszurollende Artefakt erbringen.

#### Scenario: Kandidat besteht produktionsnahen Root- und Tenant-Smoke

- **WHEN** ein Operator einen mutierenden Rollout fuer `studio` vorbereitet
- **THEN** prueft ein definierter Gate-Schritt das zugehoerige Artefakt in einem produktionsnahen Runtime-Kontext
- **AND** umfasst der Gate-Schritt mindestens einen Root-Smoke und einen Tenant-bezogenen Smoke
- **AND** wird der Remote-Rollout erst nach bestandenem Gate fortgesetzt

#### Scenario: Parity-Gate blockiert Drift vor dem Remote-Deploy

- **WHEN** der prod-nahe Gate-Schritt eine Abweichung bei Runtime-Flags, Host-Verhalten, Auth-Entry oder vergleichbaren driftrelevanten Vertragsflaechen erkennt
- **THEN** blockiert der Prozess den mutierenden Remote-Rollout
- **AND** benennt der Report die erkannte Driftklasse so, dass sie vor dem Remote-Debugging eingegrenzt werden kann

### Requirement: Deploy-Contract bewertet Registry und Auth aus Sicht von `APP_DB_USER`

Das System SHALL Registry-, Auth- und RLS-relevante Gesundheitsnachweise fuer produktionsnahe Runtime-Profile aus Sicht des laufenden App-Datenbankbenutzers bewerten.

#### Scenario: Superuser ist gruen, App-Principal jedoch durch RLS oder Grants blockiert

- **WHEN** ein Diagnose- oder Deploy-Nachweis fuer `studio` aus Sicht eines Superusers erfolgreich waere
- **AND** dieselbe fachliche Sicht fuer `APP_DB_USER` durch RLS, fehlende Grants oder unvollstaendige Registry-Daten eingeschraenkt ist
- **THEN** gilt der Deploy-Contract als nicht bestanden
- **AND** darf das Ergebnis nicht als fachlich gesund dargestellt werden

#### Scenario: Post-Deploy-Verifikation nutzt denselben Principal wie die laufende App

- **WHEN** ein mutierender Rollout erfolgreich abgeschlossen wurde
- **THEN** bewertet die nachgelagerte Verifikation Registry- und Auth-Readiness mit derselben DB-Perspektive wie die laufende App oder einer technisch gleichwertigen Abbildung
- **AND** meldet der Report Abweichungen getrennt von Superuser-only-Befunden

### Requirement: Kanonischer Reconcile-Pfad nach manuellen Runtime-Eingriffen

Das System SHALL nach manuellen Eingriffen in produktionsnahe Swarm-Stacks einen kanonischen Reconcile-Pfad zur Rueckfuehrung auf den dokumentierten Soll-Zustand bereitstellen.

#### Scenario: Incident-Recovery ueber Portainer oder Quantum endet mit kanonischem Reconcile

- **WHEN** ein Team fuer `studio` einen manuellen Portainer-, Quantum- oder vergleichbaren Live-Eingriff zur Incident-Recovery durchfuehrt
- **THEN** gilt dieser Eingriff nur als temporaere Wiederherstellung
- **AND** fuehrt der dokumentierte Betriebsweg anschliessend einen kanonischen Soll-/Ist-Abgleich mit dem regulaeren Rolloutpfad aus
- **AND** wird der Incident erst nach erfolgreicher Reconcile- und Verifikationsphase als abgeschlossen behandelt

### Requirement: Dokumentierte Vertragsgrenze zwischen lokalem Development und `studio`

Das System SHALL den lokalen Entwicklungsbetrieb in einen deterministischen `local-dev`-Pfad und staging-nahe Sonderfaelle trennen.

#### Scenario: `local-dev` nutzt Doctor, Repair und Snapshot-Check

- **WHEN** ein Teammitglied den offiziellen lokalen Betriebsvertrag fuer `local-keycloak` verwendet
- **THEN** lautet die Eskalationsfolge `up -> doctor -> repair -> reset`
- **AND** bleibt `reset` auf echte Hard-Fail-Faelle begrenzt
- **AND** steht fuer Snapshot-Drift ein eigener Verifikationsbefehl `pnpm env:verify:db-schema-snapshot` bereit

### Requirement: Kanonischer Studio-Rollout-Pfad

Das System SHALL fuer das Runtime-Profil `studio` genau einen offiziellen Rollout-Pfad ueber verifizierte Digests und einen expliziten lokalen Operator-Schritt bereitstellen.

#### Scenario: Studio-Release wird in Vorbereitung und lokalen Final-Deploy getrennt

- **WHEN** ein Operator `studio` ausrollen moechte
- **THEN** liefern GitHub Actions nur `Final Runtime Artifact Verify`, `Studio Image Build` und `Studio Artifact Verify`
- **AND** der finale mutierende Rollout laeuft lokal ueber einen expliziten Operator-Einstieg mit `env:precheck:studio`, `env:deploy:studio`, `env:smoke:studio` und `env:feedback:studio`
- **AND** GitHub-Deployworkflows gelten hoechstens als dokumentierter Legacy-Fallback und nicht mehr als offizieller Standardpfad

#### Scenario: Lokaler Operator-Deploy verwendet einen expliziten Digest

- **WHEN** der lokale `studio`-Release-Einstieg aufgerufen wird
- **THEN** ist `--image-digest=sha256:...` verpflichtend
- **AND** der Einstieg loest keinen Digest still aus GitHub-Runs, Branches oder Tags auf
- **AND** `schema-and-app` erfordert weiterhin ein explizites Wartungsfenster

### Requirement: Pragmaticher Runtime-Contract fuer Studio

Das System SHALL fuer `studio` einen kleinen, expliziten Runtime-Contract bereitstellen, der harte Pflichtwerte von ableitbaren Verbindungswerten trennt.

#### Scenario: Ableitbare Laufzeitverbindungen fuer Studio

- **WHEN** `IAM_DATABASE_URL` oder `REDIS_URL` im `studio`-Profil nicht explizit gesetzt sind
- **THEN** darf der Rollout-Pfad diese Werte aus den vorhandenen Datenbank- und Redis-Bausteinen ableiten
- **AND** bei fehlenden Ableitungsgrundlagen bricht der Rollout mit klarer Diagnose ab
- **AND** lokale Profile duerfen weiterhin explizite Verbindungs-URLs als Pflicht verlangen

#### Scenario: Kein stiller Fallback auf fremde Profile oder Stack-Namen

- **WHEN** das `studio`-Profil geladen wird
- **THEN** verwendet der Runtime-Pfad den konfigurierten `SVA_STACK_NAME`, `QUANTUM_ENDPOINT` und `SVA_RUNTIME_PROFILE`
- **AND** er faellt fuer Remote-Operationen nicht still auf andere Profile oder Stack-Namen zurueck

### Requirement: Diagnostischer Deploy-Report fuer Studio

Das System SHALL fuer `studio` einen belastbaren Deploy-Report mit technischen Gates und Rollout-Kontext erzeugen.

#### Scenario: Studio-Deploy-Report wird erzeugt

- **WHEN** ein `studio`-Deploy oder Precheck ausgefuehrt wird
- **THEN** enthalten die Artefakte mindestens Commit-SHA, Image-Ref/Digest, Stack, Endpoint, Runtime-Profil und Gate-Ergebnisse
- **AND** Fehler werden mit stabilen Codes und menschenlesbaren Kurzbeschreibungen dokumentiert
- **AND** die Artefakte liegen unter `artifacts/runtime/deployments/`

### Requirement: Studio-Drift- und Tenant-Gates

Das System SHALL fuer `studio` vor und nach dem Rollout minimale Drift- und Tenant-Gates auswerten.

#### Scenario: Drift-Check fuer Live-Service und Runtime-Contract

- **WHEN** `env:precheck:studio` oder `env:deploy:studio` laeuft
- **THEN** prueft der Prozess mindestens den Ziel-Digest gegen den Live-Service
- **AND** er prueft den effektiven Runtime-Kontext fuer den App-Service ohne Secrets offenzulegen
- **AND** er meldet Abweichungen als deterministische Diagnose statt als stillen Best-Effort-Fallback

#### Scenario: Tenant- und Hostname-Smokes fuer Studio

- **WHEN** die externen Smokes fuer `studio` ausgefuehrt werden
- **THEN** pruefen sie den Root-Host und mindestens die freigegebenen Tenant-Hosts
- **AND** sie validieren, dass `/auth/login` tenant-spezifische Redirects erzeugt
- **AND** sie pruefen, dass IAM-API-Pfade keine HTML-Fallback-Antworten liefern

### Requirement: Pragmaticher Migrations- und Bootstrap-Pfad fuer Studio

Das System SHALL fuer `studio` einen fruehphasen-tauglichen Migrations- und Bootstrap-Pfad fuer Schema und Hostname-Bestand bereitstellen.

#### Scenario: Schema-and-App-Deploy fuer Studio

- **WHEN** ein `studio`-Deploy im Modus `schema-and-app` ausgefuehrt wird
- **THEN** laufen Migrationen kontrolliert vor dem App-Rollout oder innerhalb des dokumentierten Flow
- **AND** der Deploy-Report dokumentiert den Modus und das Wartungsfenster
- **AND** Rollback bleibt fuer das Schema pragmatisch auf dokumentierten Roll-forward oder App-Digest-Rollback beschraenkt

#### Scenario: Hostname-Bootstrap fuer erlaubte Testinstanzen

- **WHEN** der Reset- oder Bootstrap-Pfad fuer `studio` laeuft
- **THEN** werden erlaubte Testinstanzen und ihre primaeren Hostnames idempotent sichergestellt
- **AND** fehlende Hostname-Mappings werden als Diagnose sichtbar

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

### Requirement: Root-Host rendert die globale Instanzverwaltung

Der Root-Host SHALL die globale Instanzverwaltung bereitstellen und dabei Registry-, Preflight-, Plan- und Keycloak-Basiszustand pro Instanz bearbeiten und verifizieren koennen.

#### Scenario: Plattform-Admin pflegt Tenant-Realm-Grundeinstellungen

- **WHEN** ein Benutzer mit `instance_registry_admin` die Seite `/admin/instances` auf dem Root-Host oeffnet
- **THEN** kann er die Realm-Grundeinstellungen einer Instanz bearbeiten
- **AND** das Studio kann Preflight, Plan und Keycloak-Status der Instanz gegen Realm, Client, Mapper und Tenant-Admin pruefen
- **AND** die UI trennt zwischen `Instanzdaten speichern` und `Provisioning ausfuehren`

#### Scenario: Tenant-Host zeigt keine globale Instanzverwaltung

- **WHEN** dieselbe Seite auf einem Tenant-Host angefragt wird
- **THEN** bleibt die globale Instanzverwaltung gesperrt

### Requirement: Studio-Remoteprofil hat einen reproduzierbaren Rollout-Pfad

Das System SHALL den Rollout fuer das Runtime-Profil `studio` ueber feste diagnostische und fachliche Gates absichern.

#### Scenario: Observability ist Teil des Release-Gates

- **WHEN** `pnpm env:doctor:studio` oder `pnpm env:precheck:studio` ausgefuehrt wird
- **THEN** prueft das System neben Runtime- und Stack-Zustand auch den aktiven Logger-Modus und die Sichtbarkeit frischer App-Logs in Loki
- **AND** meldet den Gate-Zustand als `observability-readiness`

#### Scenario: Tenant-Auth ist Teil des Release-Gates

- **WHEN** `pnpm env:doctor:studio` oder `pnpm env:precheck:studio` ausgefuehrt wird
- **THEN** prueft das System mindestens tenant-spezifische Login-Redirects und zugehoerige Diagnose-Events in Loki
- **AND** meldet den Gate-Zustand als `tenant-auth-proof`

### Requirement: Finaler Runtime-Artefaktvertrag fuer Studio

Das System SHALL fuer `studio` den finalen Node-Output unter `apps/sva-studio-react/.output/server/**` als einzigen technischen Freigabegegenstand vor dem Image-Build behandeln.

#### Scenario: Release-Gate bündelt Runtime- und PR-Prüfungen

- **WHEN** ein Operator oder CI-Pfad eine produktionsnahe Studio-Freigabe vorbereitet
- **THEN** steht ein Script `test:release:studio` zur Verfügung
- **AND** dieses Script führt `test:pr` und anschließend `verify:runtime-artifact` aus

#### Scenario: Lokaler Studio-Precheck dokumentiert Image-Verify-Evidenz

- **WHEN** `env:precheck:studio` mit einem Image-Digest ausgeführt wird
- **THEN** dokumentiert der Precheck den Digest und die passende Studio-Image-Verify-Evidenz, sofern sie im Artefaktverzeichnis vorhanden ist
- **AND** fehlende Evidenz wird als Warnung oder Blocker sichtbar, nicht still ignoriert

### Requirement: Recovery-Patching bleibt expliziter Ausnahmeweg

Das System SHALL Laufzeit-Patching des finalen Nitro-Entrys nicht mehr als Standardmodell verwenden.

#### Scenario: Entrypoint startet im Standardbetrieb ohne Patch

- **WHEN** ein `studio`-Container regulaer startet
- **THEN** schreibt `deploy/portainer/entrypoint.sh` das Build-Artefakt nicht still um
- **AND** ein Recovery-Patch ist nur mit explizitem Flag `SVA_ENABLE_RUNTIME_RECOVERY_PATCH=1` zulaessig
- **AND** fehlende Startfaehigkeit ohne dieses Flag blockiert den Releasepfad

### Requirement: Root and Tenant Host Smoke Separation

Deployment verification SHALL test the root platform host separately from tenant hosts.

#### Scenario: Root smoke validates platform IAM
- **WHEN** post-deploy smoke tests run against `studio.smart-village.app`
- **THEN** they validate platform login, instance management, platform users, platform roles, account page, and platform user sync

#### Scenario: Tenant smoke validates tenant IAM
- **WHEN** post-deploy smoke tests run against tenant hosts
- **THEN** they validate tenant login, tenant user sync, tenant role reconcile, content access, and no browser crash

### Requirement: Öffentliche Waste-Web-App hat einen eigenen Swarm-Stack

Das System SHALL für `web-waste-calendar` einen eigenen Portainer-/Swarm-Stack
bereitstellen, der nicht Teil des normalen `studio`-Stacks ist.

#### Scenario: Öffentliche Waste-Web-App wird getrennt von Studio ausgerollt

- **WHEN** ein Operator oder Workflow die öffentliche Waste-Web-App ausrollt
- **THEN** erfolgt der Rollout gegen den dedizierten Stack `web-waste-calendar`
- **AND** der bestehende `studio`-Stack bleibt unverändert
- **AND** die Compose-Definition des Waste-Web-Stacks erweitert nicht die Studio-Compose

### Requirement: Öffentliche Waste-Web-App nutzt tag-basiertes Image-Deployment

Das System SHALL die öffentliche Waste-Web-App im produktiven Stack über einen
parametrisierbaren Image-Tag referenzieren.

#### Scenario: Git-Tag steuert den produktiven Image-Tag

- **WHEN** ein Git-Tag `waste-web-v1.2.3` den öffentlichen Releaseworkflow auslöst
- **THEN** veröffentlicht der Workflow das Waste-Web-Image mit dem Tag `v1.2.3`
- **AND** aktualisiert im Zielstack nur die Variable `PUBLIC_WASTE_IMAGE_TAG`
- **AND** andere Laufzeitvariablen des Stacks bleiben dabei unverändert

#### Scenario: Rollback erfolgt über vorherigen SemVer-Tag

- **WHEN** ein Operator einen öffentlichen Waste-Web-Release zurücknehmen muss
- **THEN** kann der Stack auf einen früheren `PUBLIC_WASTE_IMAGE_TAG` zurückgesetzt werden
- **AND** der Rollback benötigt keinen Eingriff in den normalen Studio-Stack

### Requirement: Öffentliche Waste-Web-App verwendet isoliertes Host-Routing

Das System SHALL die öffentliche Waste-Web-App über eigene Ingress-Hosts und
eigene Runtime-Variablen routen.

#### Scenario: Öffentlicher Host wird über eigenen Variablenraum aufgelöst

- **WHEN** der produktive Waste-Web-Stack gerendert wird
- **THEN** leitet die Compose-Datei den öffentlichen Host aus `PUBLIC_WASTE_PUBLIC_HOST` ab
- **AND** die Runtime nutzt `PUBLIC_WASTE_BASE_URL` als kanonische Base-URL
- **AND** weder Host noch Base-URL werden aus `SVA_PARENT_DOMAIN` oder `SVA_PUBLIC_BASE_URL` des Studios abgeleitet
