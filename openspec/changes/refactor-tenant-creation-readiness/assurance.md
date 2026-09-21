# Assurance: Verifizierte Tenant-Erstellung

## Scope

Dieser Assurance Case deckt die systemübergreifenden Invarianten zwischen
Instanz-UI, MCP, Studio-API, Registry, Keycloak, Provisioning-Worker,
nachgelagerten Zielsystemen und Runtime-Aktivierung ab.

Er belegt vor dem Merge nicht nur technische Green-Checks, sondern gezielt die
Zustandsübergänge, Fehlergrenzen und Negativfälle des exakten finalen HEAD.

## Critical Invariants

| ID            | Invariante                                                                                                                                                          | Unzulässiger Zustand                                                                                                      | Geplanter Nachweis                                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CREATE-01`   | Vor jeder neuen Registry-Persistenz liegt ein aktueller erfolgreicher Keycloak-Verfügbarkeits- und Berechtigungsnachweis für den gewählten Realm-Modus vor.         | Tenant gespeichert, obwohl Keycloak vor dem Commit nicht erreichbar, nicht lesbar oder nicht ausreichend autorisiert war. | HTTP-/Service-Integrationstests für Timeout, 401/403, Circuit Breaker, fehlenden Realm, kollidierenden New-Realm und Race zwischen UI-Preflight und Create. |
| `CREATE-02`   | Fehlende Background-Fähigkeiten verhindern die fachliche Tenant-Anlage nicht, sofern Registry-Sollzustand und dauerhafter Auftrag atomar gespeichert werden können. | Tenant-Rollback wegen gestopptem Worker, fehlendem Callback oder nicht erreichbarem Zielsystem außerhalb Keycloaks.       | PostgreSQL-Integrationstest mit erfolgreichem Commit und deaktivierten Worker-/Callback-Capabilities; Readback zeigt `waiting` oder `blocked`.              |
| `CREATE-03`   | Ohne atomaren Registry-Sollzustand und dauerhaften Bereitstellungsauftrag wird kein erfolgreicher Create gemeldet.                                                  | Registry-Tenant ohne reparierbaren Folgepunkt oder Erfolg ohne Commit.                                                    | Transaktions-, Idempotenz- und Crash-Boundary-Tests vor, während und nach Commit.                                                                           |
| `REALM-01`    | `master` und bereits fremd zugeordnete Realms sind serverseitig nicht auswählbar.                                                                                   | Direkter HTTP-/MCP-Aufruf umgeht die UI-Sperre.                                                                           | Contract- und Integrationstests für Katalog, direkte Payload, konkurrierende Zuordnung und DB-Constraint.                                                   |
| `OWN-01`      | Vorhandene Keycloak-Artefakte werden nur bei eindeutig belegter Studio- und Instanz-Ownership automatisch verändert.                                                | Gleichnamiger fremder Client, Benutzer, Mapper oder Rolle wird verändert beziehungsweise privilegiert.                    | Keycloak-Adaptertests und Plan-/Execution-Tests für fehlende, eigene, fremde, unvollständige und widersprüchliche Marker.                                   |
| `PLAN-01`     | Jede Keycloak-Mutation bleibt im bestätigten Plan; nachgewiesener eigener Fortschritt erhält dessen Freigabe, fremde Drift entwertet sie.                           | Mutation läuft mit veraltetem Readback, geändertem Sollzustand oder erweitertem Mutationsumfang.                          | Snapshot-/CAS-Tests für fremde Drift sowie Crash nach eigenem Write vor Quittung; eigene Secret-Synchronisierung bleibt zurechenbarer Fortschritt.          |
| `ACT-01`      | Ausschließlich die kritische Benutzeraktion darf `active` setzen.                                                                                                   | Worker, Scheduler, MCP-Prozess oder Recovery setzt automatisch `active`.                                                  | Statische Pfadprüfung und Unit-/Integrationstests aller Statusschreiber; Worker endet in `awaiting_activation`.                                             |
| `ACT-02`      | Aktivierung erfordert aktuelle, revisionsgebundene und vollständig grüne Blocker-Evidenz.                                                                           | `active` trotz laufendem Run, fehlendem Postflight, offenem manuellen Blocker oder fehlender technischer Bereitschaft.    | Statusaktionsmatrix mit veralteter Challenge, Evidenz-Race, fehlenden Achsen und erfolgreichem Happy Path.                                                  |
| `RETRY-01`    | Nur explizit klassifizierte, am konkreten Schritt sichere Fehler werden automatisch oder manuell wiederholt.                                                        | Unbekannter Fehler oder unklarer Commit-Zustand löst blinden Retry aus.                                                   | Fehlercode-/Retry-Matrix, Fault Injection nach jedem externen Write und Read-after-write-Nachweis.                                                          |
| `FEEDBACK-01` | Jeder sichtbare Blocker nennt sichere Auswirkung, Behebung, Folgeprüfung und Korrelation, ohne Secrets oder PII preiszugeben.                                       | Generischer Retry ohne Ursache; Providertext, Secret oder personenbezogene Daten in Antwort oder Log.                     | Schema-, Redaction-, UI-A11y- und MCP-Integrationstests mit repräsentativen bekannten und unbekannten Fehlern.                                              |
| `FLOW-01`     | Kassel verwendet denselben fachlichen Create-, Provisioning-, Retry- und Aktivierungsflow wie alle anderen Betriebsprofile.                                         | Ein Kassel-spezifischer Elternlauf umgeht gemeinsame Gates, Fehlerklassen oder die manuelle Aktivierung.                  | Gemeinsame Contract-Suite für Standard- und Kassel-Profil; zusätzliche Kassel-Capabilities verändern nur technische Schritte und Evidenz.                   |
| `UI-01`       | Einsteiger und Experten verwenden denselben geführten Flow; technische Details erweitern ihn, ohne eine zweite Fachlogik zu bilden.                                 | Separate Setup-Strecke, technische Freitextfelder oder parallele Hauptaktionen umgehen serverseitige Gates.               | Komponenten-, Accessibility- und Browser-Tests für vier Schritte, exakte Terminologie, Studio-Instanz-Namen, Review-Gruppen und eine nächste Hauptaktion.   |

Zusätzlich gelten für die vorhandenen Transportverträge:

- UI-Aktivierung prüft Session, CSRF und Fresh-Reauth; MCP prüft den
  Service-Account und die actor-/action-/state-/evidenzgebundene Einmal-Challenge
  mit exakter Phrase. Beide benötigen ausdrückliche menschliche Bestätigung,
  Idempotenz und denselben fachlichen Serverentscheid.
- `create`, `repair` und `adapt` halten vor nicht bestätigten
  Keycloak-Mutationen mit `awaiting_human_action` an. Ein anderer Endpunkt,
  insbesondere Reconcile oder Rollenabgleich, umgeht die Planbindung nicht.
- Tool-Timeout oder Kanalwechsel erzeugen keinen zweiten Auftrag. Fortsetzung
  liest den bestehenden Run; neue Aktionen werden erneut autorisiert.

## State Boundaries

| Ausgangszustand                                           | Ereignis                    | Erlaubter Folgezustand                                             | Verbotener Folgezustand                                                                       |
| --------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Draft, Keycloak nicht geprüft                             | Create angefordert          | Ablehnung ohne Registry-Mutation                                   | `requested`, `provisioning` oder `active`                                                     |
| Draft, Keycloak blockiert                                 | Create angefordert          | Ablehnung mit Anlageblocker                                        | Persistierter Tenant                                                                          |
| Draft, Keycloak bereit, Worker fehlt                      | Create angefordert          | Tenant plus dauerhafter Auftrag; Projektion `provisioning_waiting` | Rollback nur wegen fehlendem Worker oder vermeintlich gestarteter nicht persistierter Auftrag |
| Persistierter Tenant, Keycloak fällt aus                  | Provisioning angefordert    | Tenant bleibt; `provisioning_blocked` mit Behebung                 | Tenant-Löschung oder automatische Neuerstellung                                               |
| Bestands-Realm mit fehlenden Studio-Artefakten            | Plan gelesen                | `auto_completable` mit konkretem Plan                              | Mutation ohne Bestätigung                                                                     |
| Bestands-Realm mit fremdem Artefakt                       | Plan gelesen                | `manual_resolution_required`                                       | automatische Übernahme oder Update                                                            |
| Bestätigter Plan wird veraltet                            | Execute angefordert         | Ablehnung und neuer Read-only Plan                                 | Mutation des alten Plans                                                                      |
| Eigener Write vor Quittung, Effekt eindeutig nachgewiesen | Lease-Recovery              | Schritt quittieren und bestätigten Rest fortsetzen                 | Freigabe automatisch auf fremde Drift erweitern                                               |
| Plan nicht bestätigt                                      | MCP create/repair/adapt     | `awaiting_human_action`, bestehende Instanz bleibt                 | Execute oder Reconcile ohne Bestätigung                                                       |
| Technische Bereitstellung erfolgreich                     | Worker beendet Schrittfolge | `awaiting_activation`                                              | automatisches `active`                                                                        |
| `awaiting_activation` mit offenem Blocker                 | Aktivierung angefordert     | Ablehnung, Zustand bleibt erhalten                                 | `active`                                                                                      |
| Vollständige aktuelle Evidenz                             | bestätigte Aktivierung      | `active` plus Audit                                                | Aktivierung ohne Challenge-/Evidenzbindung                                                    |
| Unbekannter Fehler nach möglichem Write                   | Retry bewertet              | Diagnose erforderlich, nicht retrybar                              | automatische Wiederholung                                                                     |

## Trust-Boundary Review

### Browser und MCP zur Studio-API

- Clientseitige Validierung ist Bedienhilfe, niemals Autorisierungs- oder
  Sicherheitsnachweis.
- Realm-Auswahlstatus, Blockerklassen und erlaubte Folgeaktion stammen
  serverseitig.
- Direkte Payloads werden gegen dieselben Regeln wie UI-Eingaben geprüft.
- MCP darf Konflikte nicht allein anhand des HTTP-Status als idempotenten
  Erfolg interpretieren.

### Studio zur Keycloak Admin API

- Realm-Discovery exponiert nur minimierte Daten.
- Providerfehler werden in stabile Codes übersetzt und vor Ausgabe redigiert.
- Read-only Preflight erzeugt keine Realm-, Client-, Rollen- oder
  Benutzermutation.
- Ownership wird aus stabilen Markern und Instanzbindung abgeleitet, nicht aus
  Namen oder UI-Auswahl.

### App zum Provisioning-Worker

- Der Worker verarbeitet ausschließlich persistierte, versionierte
  Sollzustände.
- Fehlende In-Memory-Registries oder Callback-Bindings werden nicht als leere
  erfolgreiche Konfiguration interpretiert.
- Claim, Lease, Deadline, Snapshot und Idempotenz bleiben erhalten.
- Wake-up-Verlust nach Commit ist durch persistente Claimbarkeit heilbar.
- Der Kasseler Provisioner verarbeitet denselben persistenten Fachauftrag;
  seine Ingress-/TLS-Fähigkeiten erweitern nur die technische Schrittmenge.

### Aktivierung zur Runtime-Freigabe

- `active` bleibt die eine führende Registry-Freigabe.
- Kanalgeeignete Bestätigung und Evidenz werden gegen aktuelle Revisionen geprüft;
  Browser-Fresh-Reauth wird nicht von Maschinenidentitäten verlangt.
- Ingress-Erreichbarkeit allein, Directory-Sichtbarkeit allein oder ein
  erfolgreicher Keycloak-Run allein genügen nicht.
- Ein Rollback oder alter Worker darf den manuellen Gate nicht umgehen.
- Der Provisioner wird mit einer Replik und `stop-first` ohne gemischte
  Worker-Digests ersetzt. Neue Läufe tragen Snapshot-Version `3.0`, die der
  vorherige Worker vor jeder Schrittausführung ablehnt. Der neue Worker führt
  übernommene `2.0`-Läufe weiter, setzt deren Legacy-Schritt `activate` aber nur
  noch auf `validated`. Vor einem Rollback muss die im kanonischen
  Rollout-Dokument definierte read-only Inventur null nichtterminale
  `2.0`-Läufe ergeben.
- Technische Aktivierungsgates sind vor `active` ausführbar. OIDC wird über
  Konfiguration und Readbacks geprüft; interaktiver Login, `/auth/me` und
  Gateway-Nutzung sind keine Aktivierungsvoraussetzungen. Ein Test belegt den
  Abschluss ohne Browsernachweis bei weiterhin gesperrtem inaktivem Tenant.

## Failure Injection Matrix

| Grenze               | Fehlerzeitpunkt                           | Erwartung                                                                              |
| -------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------- |
| Keycloak             | vor UI-/MCP-Preflight                     | Anlageblocker; keine Mutation                                                          |
| Keycloak             | zwischen angezeigtem Preflight und Create | Create-Recheck lehnt ab; keine Registry-Zeile                                          |
| Registry             | während Tenant-/Auftrags-Commit           | vollständiger Rollback; kein Erfolg                                                    |
| Callback/Wake-up     | nach Registry-Commit                      | Tenant bleibt; wartender oder blockierter Befund                                       |
| Worker               | vor Claim oder nach Lease                 | Auftrag bleibt beziehungsweise wird erneut claimbar                                    |
| Keycloak             | nach Tenant-Commit, vor Plan              | Tenant bleibt; Plan/Mutation blockiert                                                 |
| Keycloak             | nach Teilmutation                         | Readback klassifiziert Teilerfolg; nur sicherer offener Schritt darf wiederholt werden |
| Plan                 | Sollzustand ändert sich vor Execute       | Fingerprint-Konflikt; keine Mutation                                                   |
| Ownership            | gleichnamiger fremder Client/Benutzer     | manueller Blocker; kein Update und keine Rollenzuweisung                               |
| Ingress/TLS/Module   | nicht erreichbar                          | Bereitstellungs- oder Aktivierungsblocker; Tenant bleibt                               |
| Aktivierung          | Evidenz oder Challenge wird veraltet      | Ablehnung ohne Statuswechsel                                                           |
| Fehlerklassifikation | unbekannter Fehler                        | nicht retrybar; Request-/Run-ID und Diagnosehinweis                                    |

## Required Evidence

### Unit and Contract Evidence

- Realm-Katalog und serverseitige `master`-/Zuordnungssperre.
- Draft-Readiness-Klassifikation aller drei Blockerachsen.
- Realm-Eignung und Ownership-Matrix.
- Plan-Fingerprint und Stale-Plan-Ablehnung; eigene belegte Effekte gegenüber
  fremder Drift und lediglich namensgleichen Artefakten abgrenzen.
- MCP-Planbestätigung für `create`, `repair` und `adapt`, Timeout und
  Kanalwechsel ohne doppelte Instanz oder Ausführung.
- Aktivierung über Browser-Fresh-Reauth und über MCP-Einmal-Challenge;
  fehlende, fremde, abgelaufene oder wiederverwendete Nachweise ablehnen.
- Fehler-, Remediation- und Retry-Klassifikation.
- UI-Feldzuordnung, Fokus, `aria-invalid` und `aria-describedby`.
- MCP-Teilfortschritt, 409-Differenzierung und Doctor-Gate.

### Integration Evidence

- Reale PostgreSQL-Transaktionen für Create-Commit, Rollback und
  Post-Commit-Wake-up-Fehler.
- Keycloak-Adaptertests beziehungsweise isolierte Integrationstests für
  Listen-, Berechtigungs-, Readback-, Ownership- und Mutationsgrenzen.
- Worker-Crash nach externem Write vor lokaler Quittung: eindeutiger eigener
  Effekt erlaubt Fortsetzung, fremde Drift entwertet die Freigabe,
  nicht zuordenbare Effekte blockieren mit Diagnosebedarf. Geplante eigene
  Secret-Synchronisierung und unklare Rotation explizit abdecken.
- Statusschreiber-Nachweis, dass ausschließlich die kritische Aktion
  `active` setzen kann.

### End-to-End Evidence

- Neuer Realm: Draft-Preflight, Create, bestätigter Plan, Provisioning,
  wartende Aktivierung und manuelle Freigabe.
- Bestands-Realm: Suche, deaktiviertes `master`, belegter Realm, bereit,
  automatisch ergänzbar und manuell blockiert.
- Keycloak-Ausfall vor Create und nach Registry-Commit.
- Fehlender Worker bei erfolgreicher Anlage.
- Unbekannter Fehler ohne Retry sowie bekannter sicherer Retry.
- Aktivierung mit offenem und anschließend behobenem Blocker.
- Gemeinsamer vierstufiger UI-Flow für `Smart Village App` und
  `KasselDIALOG` mit derselben fachlichen Zustandsfolge.

### Static and Architecture Evidence

- Suche nach allen produktiven `setInstanceStatus(... active)`-Pfaden.
- Keine neue direkte Keycloak- oder DB-Mutation aus UI oder MCP.
- Keine zweite Queue-, Workflow- oder Deployment-Infrastruktur.
- Profilvergleich, der für Standard und Kassel identische Create-Gates,
  Fehlerklassen, Retry-Regeln und Aktivierungsübergänge nachweist.
- Aktualisierte arc42-Abschnitte 03, 04, 05, 06, 08, 09, 10 und 11.
- Falls das Schema geändert wird: aktualisierte Migration,
  `studio-db-schema-final.sql` und `studio-db-schema.md`.

## Ausgeführte Evidenz am Implementierungsstand

Stand 2026-09-20 wurden die folgenden Nachweise gegen den vollständigen
Änderungsstand ausgeführt. Die externe Bindung an den exakten PR-HEAD erfolgt
über die GitHub-Checks und den kanonischen PR-Snapshot einschließlich offener
Review-Threads:

| Nachweis                                                                                     | Ergebnis                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registry-Service, Draft-Readiness, Realm-Katalog, Ownership-Plan, Execution und Orchestrator | `pnpm nx run instance-registry:test:unit` mit neun gezielten Dateien: 232 Tests grün; der Aktivierungsvertrag läuft für Standard und Kassel durch dieselben Blocker- und Erfolgsfälle.                                                                                    |
| Reale PostgreSQL-Persistenz                                                                  | `tenant-provisioning-recovery.integration.test.ts`: 4 Tests grün für atomaren Mindest-Commit/Rollback und Idempotenz, konkurrierende Retry-Reservierung, manuelle Aktivierung mit persistierter Evidenz sowie Recovery mit fail-closed Plan.                              |
| Authentisierung, Keycloak-Adapter und Challenge                                              | 130 gezielte Auth-/Adaptertests plus 20 Confirmation-Tests grün; Readiness-Änderung verändert den Challenge-Fingerprint, Audit-Historie nicht.                                                                                                                            |
| Repository-, Routing- und MCP-Verträge                                                       | 21 Repository-, 95 Routing- und 32 MCP-Tests grün.                                                                                                                                                                                                                        |
| Instanz-UI                                                                                   | 144 gezielte Komponenten-, Hook-, API- und Route-Tests grün; `test:types` und i18n-Key-Check grün.                                                                                                                                                                        |
| Browser                                                                                      | Playwright: New-Realm-Happy-Path, Existing-Realm-Happy-Path mit deaktiviertem `master`/belegtem Realm und serverseitiger Create-Blocker: 4 Tests inklusive Auth-Setup grün.                                                                                               |
| Typen und Server-Runtime                                                                     | `test:types` für `core`, `instance-registry`, `auth-runtime`, `routing`, `studio-mcp`, `data-repositories` und `sva-studio-react` grün; `pnpm check:server-runtime` für alle 20 Server-Packages grün.                                                                     |
| Struktur und Spezifikation                                                                   | `pnpm check:file-placement`, `git diff --check`, `pnpm complexity-gate --base origin/main` sowie Strict-Validierung dieses Changes und `automate-kassel-tenant-ingress` grün; die eigenständig zerlegbaren Complexity-Hotspots sind in GitHub-Issue `#1448` nachverfolgt. |

Der PostgreSQL-Lauf verwendete eine temporäre, anschließend wieder entfernte
Testdatenbank auf Schema-Version 96. Migration 0091 wurde dort nur als
angewandt markiert, weil ihre clusterweite Rolle im lokalen PostgreSQL bereits
existierte; die für diese Tests relevanten Migrationen 0090 und 0092 bis 0096
wurden real ausgeführt.

Die Review-Nachprüfung am 21. September 2026 wiederholte die vier realen
PostgreSQL-Recovery-Tests gegen eine neue temporäre Datenbank auf
Schema-Version 96. Sie deckte Create-Commit und Rollback, konkurrierende
Retry-Reservierung, persistierte Aktivierungsevidenz sowie New-Realm-Recovery
ab; die Datenbank wurde anschließend entfernt. Der gezielte Browserlauf prüfte
erneut New-Realm, Existing-Realm samt gesperrten Realms und den autoritativen
Create-Blocker. Die Cross-Version-Tests verwenden für aktuelle Läufe Snapshot
`3.0`, halten einen Legacy-`2.0`-Lauf am früheren Schritt `activate`
fail-closed und prüfen die `stop-first`-Konfiguration aller drei
Provisioner-Services.
Das eigenständig versionierte Plugin-Snapshotformat schreibt neue Runs als
`2.0`. Ein Legacy-`1.0`-Run ohne gebundene Aktivierungsrichtlinien löst die
zum Lifecycle gehörenden Richtlinien einmalig aus dem aktuellen Katalog auf
und stoppt bei einer fehlenden Richtlinie; ein Retry persistiert anschließend
ein vollständiges `2.0`-Snapshot.

Die statische Statusschreiber-Prüfung ergab für Instanzen:

- `tenant-provisioning-steps.ts` schreibt nur `provisioning` und `validated`.
- Create-/Retry-, Provisioning-, Keycloak-Finalize- und Orchestrator-Pfade
  schreiben nur `requested`, `provisioning`, `validated` oder `failed`.
- Ausschließlich `service-instance-mutations.ts` übernimmt `active` nach dem
  serverseitigen Aktivierungs-Gate; UI und MCP rufen dafür den geschützten
  Vertrag `instance.status.activate` auf.

## Merge and Rollout Gates

- `openspec validate refactor-tenant-creation-readiness --strict` ist grün.
- Alle spezialisierten Pflicht-Gates für Auth, Datenintegrität,
  Server-Runtime und Migrationen sind am exakten finalen HEAD grün.
- Die Invarianten `CREATE-01`, `OWN-01`, `PLAN-01`, `ACT-01`,
  `ACT-02`, `RETRY-01`, `FLOW-01` und `UI-01` besitzen gezielte
  Negativtests.
- Aktive Changes mit widersprüchlicher Auto-Aktivierung sind vor Merge
  angepasst oder ihre Ablösung ist explizit und reviewbar koordiniert.
- Dev bestätigt UI- und MCP-Verträge gegen denselben Serverstand.
- Staging bestätigt den vollständigen manuellen Aktivierungspfad.
- Production-Promotion verwendet denselben live verifizierten
  unveränderlichen Image-Digest wie Staging.
- Tenant-Erstellung endet nach technischer Bereitschaft und bestätigter
  Aktivierung. Eine Browserabnahme ist weder Aktivierungs- noch Abschlussgate.
  Entwicklungsseitige Browser-/E2E-Tests erzeugen keinen Betreiber-Pflichtschritt.

## Residual Risks Requiring Explicit Acceptance

- Legacy-Keycloak-Artefakte ohne Ownership-Marker können bis zu einer
  ausdrücklichen Übernahmeentscheidung nicht automatisch repariert werden.
- Nicht alle Zielsysteme besitzen möglicherweise bereits einen belastbaren
  Heartbeat; `unknown` muss dann sichtbar bleiben und darf nicht als `ready`
  gelten.
- Ein manuelles Aktivierungsmodell verlängert den operativen Ablauf, ist aber
  die bewusste Sicherheitsgrenze dieses Changes.
