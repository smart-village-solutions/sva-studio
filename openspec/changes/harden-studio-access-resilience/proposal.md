# Change: Studio-Zugriffe konsistent prüfen und Fehler nachvollziehbar machen

## Why

Die Analyse am Studio-Stand `ecedfa460b335c35d6d138f7724eb5162332023e` zeigt konkrete Übergangsfehler zwischen Session, Organisationskontext, Effective Access und Mainserver-Fassade: Ein Refresh-Fallback verliert die aktive Organisation, konkurrierende Session-Updates können sich überschreiben und Browserkontexte bleiben nach externen Änderungen veraltet. Unvollständige Credentials werden teilweise als Berechtigungsverbot klassifiziert. Frühe Fehlerantworten umgehen den Exception-Logger; die zugehörige Request-ID erreicht die Plugin-Fehleranzeige nicht durchgängig.

Das Ziel ist ein Studio, das nicht erlaubte Aktionen ausblendet, erlaubte aber technisch blockierte Aktionen verständlich sperrt und sichtbare Betriebsfehler eindeutig zuordnen lässt. Ein Rollenname allein begründet weiterhin keine Freigabe. Die Analyse belegt mögliche Codefehler, nicht die Ursache jedes früheren Live-Vorfalls.

## What Changes

### 1. PR 1: Fehlerklassifikation, Fehlerreferenz und Diagnose

Studio klassifiziert Authentifizierung, Autorisierung, Kontextkonflikt, Credential-Readiness und Infrastrukturfehler getrennt. Vorhandene Antwort- und Logging-Grenzen erfassen auch früh zurückgegebene Fehlerantworten. Eine serverbestimmte Request-ID verbindet API-Antwort, SDK-Fehler und zugängliche Nutzeranzeige mit genau einem abschließenden operativen Fehlerereignis. Reine Browser-Betriebsfehler erhalten einen begrenzten, datensparsamen Meldepfad im bestehenden Monitoring.

### 2. PR 2: Session- und Organisationskonsistenz

Der vorhandene Sessionpfad erhält den vollständigen Kontext bei zulässigem Refresh-Fallback. Atomare Session-Updates verhindern verlorene Organisations- und Tokenänderungen sowie das Wiederanlegen gelöschter Sessions. Konkurrierende Refreshes werden innerhalb der nachgewiesenen unterstützten Topologie koordiniert. Browser-Kontextreads und -wechsel übernehmen nur zur aktuellen Identität und Generation passende Ergebnisse.

### 3. PR 3: Verlässliche UI-Freigaben und Editor-Recovery

Routen, Navigation und Plugin-Aktionen verwenden dieselbe aktuelle Access-Generation. Wiederaufnahme und Session-Recovery lösen einen deduplizierten Kontext-/Access-Recheck aus. Ressourcenverbote bleiben lokal; explizite Stale-Signale erneuern gezielt den betroffenen Kontext. Ein veralteter Editor behält Eingaben, verwirft sein altes Binding und liest Kontext sowie Capabilities neu. Credential-Readiness wird als technische Voraussetzung vor Create berücksichtigt, ohne externe Verfügbarkeit zu garantieren.

## Verbindliche Scope-Grenze

**Bearbeitet wird ausschließlich dieses Studio-Repository. Der externe SVA Mainserver wird „as is“ behandelt.** `packages/sva-mainserver` ist die Studio-eigene Fassade und liegt im Scope; das separate Mainserver-Repository, dessen Betrieb und Daten liegen außerhalb.

- Keine Änderungen an Mainserver-Code, GraphQL-/REST-Schema, OAuth-, Rollen-, Provisioning-, DataProvider- oder Ownership-Verträgen; keine Annahme neuer Upstream-Fehlerfelder oder Korrelationsheader.
- Keine Mainserver-Migration, Datenreparatur, Credential-Rotation oder Neuprovisionierung als Nebenwirkung einer Diagnose, Readiness-Abfrage oder Fehlerbehandlung.
- Keine Lockerung von `system_admin`-, Tenant-, Modul-, Ressourcen-, CSRF-, Rechtstext-, Ablauf- oder Widerrufsgrenzen; kein Fallback auf fremde Principals.
- Keine automatische Wiederholung von POST/PATCH/PUT/DELETE oder mehrstufigen Saves. Bestätigte und unklare Ergebnisse bleiben durch vorhandenes Journal/Read-back unterscheidbar.
- Keine neuen Packages, Provider, Worker, generischen Retry-/Error-Frameworks, CI-Gates oder Datenbanktabellen. Bestehende Pfade werden erweitert; ersetzte Pfade werden im jeweiligen PR entfernt.
- Keine Umgestaltung von Fachformularen, Publikationsregeln, Ownership, Credential-Recovery oder Permission-Seeding. Kein Auftrag für fremde Voucher-Änderungen im Hauptcheckout.
- Keine garantierte Telemetriezustellung bei Offlinezustand oder Prozessverlust; Meldung, Annahme und tatsächlich in Loki gefundene Evidenz bleiben getrennte Aussagen.

## PR-Aufträge und Liefermodell

Ein gemeinsamer Change, genau drei aufeinanderfolgende Liefer-PRs. Jeder PR ist eigenständig build-, test- und reviewbar. Keine leeren Folge-PRs und kein zusätzlicher Proposal-PR: PR 1 beginnt als Draft mit diesem vollständigen Vorschlag; nach menschlicher Freigabe wird ausschließlich Abschnitt 1 ergänzt. Ein reiner Proposal-Stand ist nicht als implementierter Abschnitt merge-reif.

| PR  | Verbindliches Ziel                                                                                                         | Explizite Nicht-Ziele                                                                                               | Maximal betroffene Implementierungsbereiche                                                                                                                                                                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Sichtbare Studio-Betriebsfehler korrekt klassifizieren und mit einer sicheren Fehlerreferenz beobachtbar machen.           | Session-Speicher, Access-Lifecycle, neues Upstream-Verhalten, fachliche Credential-Reparatur.                       | `core`, Studio-Fassade `sva-mainserver`, `auth-runtime` ausschließlich Error-Mapping und additive rein lesende Grundcodes des bestehenden Credential-Readers, `server-runtime`, `monitoring-client`, `plugin-sdk`, Studio-Server/HTTP-Clients/Fehlerflächen und unmittelbar konsumierende Plugin-Fehleranzeigen/Übersetzungen. |
| 2   | Gültige Sessions und bestätigte Organisationswechsel trotz Parallelität und transientem Refreshfehler konsistent erhalten. | Neue Permission-Semantik, Editor-UX, Logging-Neuentwurf, externe Keycloak-Konfiguration.                            | Bestehender Session-/Redis-Pfad in `auth-runtime`, Organisationswechsel in `iam-admin`, Organisationsprovider sowie unmittelbar nötige Session-Projektion im Studio.                                                                                                                                                           |
| 3   | Nur aktuell erlaubte und technisch bereite Aktionen anbieten und veraltete Editor-Kontexte ohne Datenverlust auflösen.     | Session-Persistenz-Neuentwurf, fachliche Formularänderungen, Credential-Schreib-Recovery, Upstream-API-Anpassungen. | Effective-Access-/Auth-Anbindung und Routing im Studio, bestehende Principal-/Readiness-Fassade in `auth-runtime`/`sva-mainserver`, `plugin-sdk`, vorhandene Fehler-/Editorflächen und unmittelbar betroffene Standard-Content-Plugins.                                                                                        |

Tests und betroffene Dokumentation gehören jeweils zum liefernden PR. PR 2 beginnt nach Merge von PR 1 von aktuellem `main`, PR 3 nach Merge von PR 2 ebenfalls von `main`; Zielbranch ist jeweils `main`. Ein ungeplanter Eingriff in neue Verträge außerhalb der Tabelle stoppt den Abschnitt und benötigt einen neu zugeschnittenen Entwurf.

## Coordination and Impact

- Bestehende Specs: `routing`, `monitoring-client`, `iam-core`, `iam-organizations`, `account-ui`, `sva-mainserver-integration`.
- ADR-018 wird für verbindliche Studio-Fehlerreferenzen und den begrenzten Browser-Meldepfad fortgeschrieben; ADR-023 behält die führende Session-Gültigkeit; ADR-050 behält zentrale scopegebundene UI-Entscheidungen; ADR-046 behält Plattform-/Tenant-Trennung. Die Umsetzungen schreiben diese ADRs gezielt fort und referenzieren Änderungen im Architekturindex, statt neue Parallelkonzepte zu schaffen.
- Arc42 04/05/06/08 werden pro Abschnitt geprüft und betroffene Aussagen aktualisiert; 09 bei ADR-Fortschreibung. Der reine Proposal-Stand beschreibt heutige Architektur nicht als bereits geändert.
- `enforce-mainserver-credential-readiness` bleibt Owner von Credential-Erkennung und Provisioning-Read-back; `reduce-mainserver-credential-gaps` bleibt Owner der begrenzten lokalen Credential-Rücksicherung. Dieser Change konsumiert deren Status nur für Klassifikation und UI-Readiness und setzt keine weitere Implementierung dieser offenen Changes voraus. PR 1 darf sichere Grundcodes additiv durch den bestehenden Reader reichen; Nutzbarkeit, Autorisierung, Provisioning und Recovery bleiben dabei unverändert.
- `add-content-ownership-transfer` bleibt Owner von DataProvider-/Owner-Bindungen. `add-content-create-onepagers` bleibt Owner von Formularen und Änderungs-/Verlassensschutz. `add-contextless-action-feedback` erhält keinen zusätzlichen globalen Fehler-Toast-Vertrag.
- Keine DB-Schemaänderung vorgesehen. Wird sie erforderlich, vor weiterer Umsetzung stoppen und Schema-Snapshot sowie Scope erneut prüfen. Normativer Rollout bleibt ausschließlich `docs/guides/studio-rollout-process.md`.

## Review- und Freigabestand

Status: **Freigegeben; PR 1 gemerged, PR 2 in Umsetzung, fachliche Gesamtabnahme offen.** Die drei Abschnitte sind im [Design](./design.md), in den [Tasks](./tasks.md) und im [Assurance Case](./assurance.md) konkretisiert. Formale Validierung oder grüne allgemeine Checks ersetzen weder direkte Evidenz für den exakten Implementierungs-HEAD noch eine gesonderte Live-/Fachabnahme.
