# instance-provisioning Specification

## Purpose

Spezifikation für den automatisierten Provisioning-Workflow neuer Studio-Instanzen, einschließlich Keycloak-Realm-Verwaltung, IAM-Basis-Konfiguration und idempotenter Fehlerbehandlung.
## Requirements
### Requirement: Zentrale Instanz-Registry

Das System SHALL eine zentrale Registry für Studio-Instanzen bereitstellen, die Tenant-Identität, Hostnamen, Lebenszyklusstatus und Basis-Konfiguration führt. Persistenzverträge und SQL-nahe Registry-Zugriffe haben dafür genau eine führende Ownership in der Datenzugriffsschicht; paketinterne Komfortkanten dürfen diese Verträge nur delegierend weiterreichen.

#### Scenario: Führende Persistenz-Ownership für die Registry ist eindeutig

- **WHEN** Instanz-Registry-Daten aus fachlichen Services, Runtime oder Admin-Pfaden gelesen oder geschrieben werden
- **THEN** stammen SQL-nahe Registry-Verträge und deren Implementierung aus genau einer führenden Persistenzschicht
- **AND** führen nachgelagerte Komfort- oder Aggregator-Packages keine parallel gepflegte Registry-Implementierung mehr
- **AND** können neue Registry-Felder nicht stillschweigend nur in einem von zwei Pfaden wirksam werden

#### Scenario: Aktive Instanz ist in der Registry beschrieben

- **WHEN** eine Studio-Instanz produktiv erreichbar sein soll
- **THEN** existiert ein Registry-Eintrag mit `instanceId`, `status`, `primaryHostname` und den benötigten Basis-Metadaten
- **AND** enthält der Auth-Vertrag mindestens `authRealm`, `authClientId` und `tenantAdminClient`
- **AND** kann die Runtime daraus Tenant-Kontext, Login-Konfiguration und Tenant-Admin-Konfiguration getrennt ableiten

### Requirement: Gesteuerter Tenant-Lebenszyklus

Das System SHALL den Lebenszyklus einer Instanz über explizite Statuswerte steuern.

#### Scenario: Instanz wird aktiviert

- **WHEN** eine neue Instanz erfolgreich provisioniert und freigegeben wurde
- **THEN** wechselt ihr Status kontrolliert auf `active`
- **AND** erst ab diesem Zeitpunkt darf produktiver Traffic für ihren Host zugelassen werden

#### Scenario: Instanz wird suspendiert oder archiviert

- **WHEN** eine Instanz außer Betrieb genommen oder temporär gesperrt wird
- **THEN** wird ihr Status fachlich nachvollziehbar auf `suspended` oder `archived` gesetzt
- **AND** produktiver Host-Traffic wird danach fail-closed abgelehnt

### Requirement: Idempotenter Provisioning-Workflow

Das System SHALL neue Instanzen ueber einen idempotenten Provisioning-Workflow anlegen, der technische Teilaufgaben und Teilfehler kontrolliert behandelt. Soweit der Workflow modulbezogene IAM-Basisartefakte oder deren Reparatur ableitet, verwendet er dafuer dieselbe gemeinsame Modul-IAM-Vertragsquelle wie Runtime und Diagnose.

#### Scenario: Erfolgreiche Neuanlage einer Instanz

- **WHEN** eine berechtigte Person eine neue Instanz mit gueltiger `instanceId` und gueltigem Ziel-Hostname anfordert
- **THEN** legt das System einen Provisioning-Lauf an
- **AND** erstellt oder reserviert die benoetigten Registry- und Basis-Konfigurationsartefakte
- **AND** erzeugt oder validiert getrennt den Login-Client `authClientId` und den Tenant-Admin-Client `tenantAdminClient.clientId`
- **AND** dokumentiert den Uebergang bis zum Status `active`

#### Scenario: Modulbezogene IAM-Basis wird aus derselben Vertragsquelle repariert

- **WHEN** ein Provisioning-, Repair- oder Reseed-Pfad modulbezogene IAM-Artefakte einer Instanz auf Sollstand bringt
- **THEN** verwendet dieser Pfad dieselbe gemeinsame Modul-IAM-Vertragsquelle wie Runtime und Access-Control
- **AND** koennen Plugin-Vertragsaenderungen nicht stillschweigend nur im UI- oder nur im Runtime-Pfad wirksam werden

### Requirement: Administrativer Steuerungspfad für neue Instanzen

Das System SHALL einen administrativen Steuerungspfad für die Anlage und Verwaltung neuer Instanzen bereitstellen.

#### Scenario: Instanzanlage über Studio-Control-Plane

- **WHEN** ein berechtigter Admin eine neue Instanz im Studio anlegt
- **THEN** verwendet die UI denselben fachlichen Provisioning-Pfad wie automatisierte oder CLI-basierte Prozesse
- **AND** validiert `instanceId`, Hostname und Pflichtkonfiguration vor dem Start
- **AND** validiert der Pfad getrennt die Pflichtfelder für Login-Client und Tenant-Admin-Client
- **AND** ist der Zugriff auf dedizierte Admin-Rollen mit Least-Privilege begrenzt
- **AND** erfordern kritische Mutationen eine frische Re-Authentisierung

### Requirement: Auditierbarkeit von Tenant-Mutationen

Das System SHALL jede Anlage, Aktivierung, Suspendierung, Archivierung und relevante Rekonfiguration einer Instanz auditierbar machen.

#### Scenario: Mutationen einer Instanz werden nachvollziehbar gespeichert

- **WHEN** ein Operator den Zustand oder die Basis-Konfiguration einer Instanz ändert
- **THEN** speichert das System den fachlichen Vorgang mit Zeitbezug und Akteur-Kontext
- **AND** können spätere Betriebs- und Support-Fälle diese Änderung nachvollziehen
- **AND** enthalten Audit-Ereignisse mindestens `instanceId`, Akteur, Aktion, Ergebnis und Korrelation (`requestId` oder gleichwertig)
- **AND** werden Audit-Ereignisse append-only gespeichert

### Requirement: Tenant-Isolation bei Tenant-Mutationen

Das System SHALL tenant-fremde Lese- und Schreiboperationen für Instanzverwaltung und Provisioning fail-closed ablehnen.

#### Scenario: Tenant-fremde Mutation wird abgelehnt

- **WHEN** ein Aufruf eine Mutation für eine Instanz außerhalb des zulässigen Tenant-Kontexts ausführen will
- **THEN** lehnt das System den Aufruf fail-closed ab
- **AND** bleibt das Außenverhalten ohne tenant-spezifische Detailoffenlegung

### Requirement: Reproduzierbare lokale Test- und Seed-Pfade für Instanzen

Das System SHALL reproduzierbare lokale Seed-, Bootstrap- und Reconcile-Pfade für Instanzen bereitstellen, damit Registry-Auflösung und Provisioning ohne produktive Infrastruktur prüfbar bleiben und bestehende Umgebungsidentität nicht still überschrieben wird.

#### Scenario: Lokale Seed-Instanzen stehen für Entwicklung bereit

- **WHEN** ein Teammitglied einen lokalen Standardmodus startet
- **THEN** stehen mindestens zwei aktive Seed-Instanzen für Entwicklung und Tests reproduzierbar bereit
- **AND** ist mindestens ein negativer Tenant-Fall für fail-closed-Tests definiert

#### Scenario: Lokales Provisioning nutzt denselben fachlichen Vertrag

- **WHEN** eine neue Instanz lokal über CLI, Test-Setup oder Admin-Pfad angelegt wird
- **THEN** nutzt dieser Pfad dieselben Validierungs- und Statusregeln wie der produktive Provisioning-Vertrag
- **AND** kann die neue Instanz ohne neues App-Deployment im lokalen Multi-Tenant-Pfad getestet werden

#### Scenario: Standard-Seed ergänzt bestehende Umgebungsidentität nur nicht-destruktiv

- **WHEN** ein Standard-Seed auf eine bereits vorhandene Instanz mit gesetzten Werten für `parent_domain`, `primary_hostname`, `auth_realm`, `auth_client_id`, `tenant_admin_client_id` oder tenant-spezifische Auth-Secret-Zuordnungen trifft
- **THEN** überschreibt der Seed diese bestehenden Werte nicht stillschweigend
- **AND** darf der Seed geschützte Identitätsfelder nur setzen oder ergänzen, wenn sie noch leer oder nicht vorhanden sind

### Requirement: Seed, Bootstrap und Reconcile haben getrennte Verantwortung für Umgebungsidentität

Das System SHALL additive Baseline-Seeds normativ von autoritativen Bootstrap- und Reconcile-Pfaden trennen, damit laufzeitkritische Umgebungsidentität nicht unbemerkt durch Standard-Seeds verändert wird.

#### Scenario: Neue Umgebung wird autoritativ initialisiert

- **WHEN** eine neue lokale oder staging-nahe Umgebung erstmalig initialisiert wird
- **THEN** darf der Bootstrap-Pfad `parent_domain`, `primary_hostname`, `auth_realm`, `auth_client_id`, `tenant_admin_client_id` und tenant-spezifische Auth-Secrets autoritativ setzen
- **AND** bleibt dieser autoritative Pfad explizit von einem normalen Standard-Seed unterscheidbar

#### Scenario: Bestehende Umgebung wird nur explizit reconciled

- **WHEN** eine bestehende Umgebung bewusst auf neue Host-, Realm- oder Client-Werte ausgerichtet werden soll
- **THEN** erfolgt diese Identitätsänderung nur über einen expliziten Reconcile- oder Bootstrap-Pfad
- **AND** nicht über einen normalen Standard-Seed

### Requirement: Tenant-spezifische Auth-Secrets gehören zum geschützten Umgebungsvertrag

Das System SHALL tenant-spezifische Auth-Secret-Zuordnungen als Teil der geschützten Umgebungsidentität behandeln, damit ein korrigierter Tenant-Zustand nicht beim Callback auf globale Fallback-Secrets zurückfällt.

#### Scenario: Bestehende Tenant-Umgebung nutzt hinterlegtes Secret statt globalem Fallback

- **WHEN** eine bestehende lokale oder staging-nahe Umgebung einen tenant-spezifischen `auth_client_id` und `auth_realm` verwendet
- **THEN** ist für diesen Tenant eine lesbare tenant-spezifische Secret-Zuordnung vorhanden oder wird über einen expliziten Bootstrap-/Reconcile-Pfad wiederhergestellt
- **AND** darf ein globales Fallback-Secret nicht als dauerhafter Sollzustand für diese Umgebung gelten

#### Scenario: Readiness deckt Host- und Secret-Drift gemeinsam auf

- **WHEN** eine bestehende Tenant-Umgebung nach Seed-, Bootstrap- oder Reconcile-Läufen geprüft wird
- **THEN** umfasst die Prüfung mindestens Tenant-Host-Auflösung, Realm-/Client-Zuordnung und die Verwendung des tenant-spezifischen Secrets im Login-Flow
- **AND** wird ein Zustand, der nur mit globalem Secret-Fallback funktioniert oder am Callback scheitert, nicht als erfolgreich reconciled bewertet

### Requirement: Runtime-IAM und Provisioning verwenden kompatible Driftklassifikation

Das System SHALL Runtime-IAM-Fehler und Instanz-/Keycloak-Provisioning-Drift auf denselben kompatiblen Driftklassifikationen aufbauen, damit UI und Betrieb dieselbe Ursache entlang von Runtime, Preflight, Plan und Run nachvollziehen können.

#### Scenario: Runtime-Fehler und Instanzpanel sprechen dieselbe Drift-Sprache

- **WHEN** ein Tenant sowohl im Runtime-IAM-Fehlerfall als auch im Instanzpanel betrachtet wird
- **THEN** verwenden beide Pfade kompatible Klassifikationen für Realm-, Client-, Secret-, Mapper- und Tenant-Admin-Drift
- **AND** kann das Instanzpanel aus einem Runtime-Fehler heraus mit konsistentem Diagnosewortschatz fortgesetzt werden

### Requirement: Verzahnte Runtime- und Provisioning-Diagnose für Tenant-IAM

Das System SHALL Runtime-IAM-Fehler und Instanz-/Keycloak-Provisioning-Diagnosen so aufeinander beziehen, dass Tenant-Drift zwischen Registry, Realm, Clients, Secrets und Runtime-Konfiguration nicht in getrennten Diagnosewelten bearbeitet werden muss.

#### Scenario: Runtime-Fehler verweist auf tenant-spezifische Driftklasse

- **WHEN** ein Runtime-IAM-Fehler auf fehlende oder inkonsistente Tenant-Konfiguration hindeutet
- **THEN** ordnet das System den Fehler einer Drift- oder Provisioning-nahen Fehlerklasse zu
- **AND** kann diese Klasse mit bestehenden Keycloak-Preflight-, Plan- oder Run-Informationen korreliert werden

#### Scenario: Preflight und Runtime nutzen kompatible Diagnosebegriffe

- **WHEN** die UI oder der Betrieb denselben Tenant sowohl im Instanz-/Keycloak-Panel als auch in einem Runtime-IAM-Fehlerfall betrachtet
- **THEN** verwenden beide Pfade kompatible Diagnosebegriffe für Realm-, Client-, Secret-, Mapper- oder Tenant-Admin-Abweichungen
- **AND** müssen Operatoren die Ursache nicht aus widersprüchlichen Zustandsmodellen ableiten

#### Scenario: Runtime-Drift kann auf Provisioning-Evidenz verweisen

- **WHEN** ein Runtime-IAM-Fehler als `registry_or_provisioning_drift` klassifiziert wird
- **THEN** kann der Diagnosepfad auf vorhandene Preflight-, Plan- oder Run-Evidenz mit korrelierbarer Request-ID oder gleichwertigem Referenzanker verweisen
- **AND** bleibt für UI und Betrieb sichtbar, ob das Problem aus Runtime-Konfiguration, Provisioning-Blockern oder nachträglicher Drift stammt

### Requirement: Getrennter Tenant-Admin-Client-Vertrag pro Instanz
Das System SHALL pro Instanz einen separaten technischen Vertrag für den tenant-lokalen Admin-Client führen. Dieser Vertrag verwaltet tenantlokale IAM-Operationen im Tenant-Realm und setzt keine Plattformrolle `instance_registry_admin` im Tenant-Realm voraus.

#### Scenario: Registry beschreibt Login- und Admin-Client getrennt
- **WHEN** eine Instanz gelesen oder aktualisiert wird
- **THEN** enthält der Instanzvertrag `authClientId` für den interaktiven Login-Pfad
- **AND** enthält er zusätzlich `tenantAdminClient.clientId`
- **AND** bleibt der Tenant-Admin-Client auf tenantlokale IAM-Operationen des Tenant-Realm beschränkt

#### Scenario: Tenant-Admin-Client fehlt bei betriebsfähiger Tenant-Administration
- **WHEN** eine Instanz keinen vollständigen `tenantAdminClient` besitzt
- **THEN** markieren Preflight, Doctor oder Status diesen Zustand als `warning` oder `blocked`
- **AND** normale Tenant-Admin-Mutationen werden nicht freigeschaltet
- **AND** der Fehler bezieht sich auf tenantlokale IAM-Betriebsfähigkeit, nicht auf Root-Plattformrollen

### Requirement: Provisioning prüft Login-Client und Tenant-Admin-Client getrennt

Das System SHALL Login-Client und Tenant-Admin-Client im Provisioning und Reconcile getrennt prüfen und ausweisen.

#### Scenario: Preflight weist getrennte Client-Artefakte aus

- **WHEN** ein Preflight oder Statuslauf für eine Instanz ausgeführt wird
- **THEN** enthält die Checkliste getrennte Einträge für Login-Client und Tenant-Admin-Client
- **AND** zeigen Details Realm, Client-ID, Secret-Status und Drift je Artefakt getrennt

#### Scenario: Provisioning erzeugt fehlenden Tenant-Admin-Client nach

- **WHEN** Realm und Login-Client existieren, der Tenant-Admin-Client aber fehlt
- **THEN** darf der Provisioning-Lauf genau diesen Client idempotent nachziehen
- **AND** bleibt der Lauf auditierbar und deterministisch wiederholbar

### Requirement: Keycloak-Provisioning-Run-Enqueue ist idempotent

Das System SHALL Keycloak-Reconcile- und Execute-Mutationen end-to-end idempotent verarbeiten, indem ausschließlich der validierte Header `Idempotency-Key` bis zur persistenten Erzeugung von `iam.instance_keycloak_provisioning_runs` verwendet wird. `Idempotency-Key` ist der einzige unterstützte Headername für diesen Idempotenzvertrag. Die Bezeichnung `X-Idempotency-Key` kann in älteren IAM-Spezifikationen als historische Benennung vorkommen, wird jedoch von Clients nicht unterstützt und darf nicht als akzeptierter Request-Header vorausgesetzt werden.

#### Scenario: Replay mit gleichem Key und gleicher Payload nutzt den bestehenden Run

- **WHEN** ein berechtigter Client dieselbe Keycloak-Reconcile- oder Execute-Mutation für dieselbe Instanz und denselben `Idempotency-Key` mit identischer Payload erneut sendet
- **THEN** erzeugt das System keinen zusätzlichen Keycloak-Provisioning-Run
- **AND** liefert `reconcileKeycloak` deterministisch die bestehende Status-/Snapshot-Antwort aus dem ursprünglichen Auftrag zurück
- **AND** liefert `executeKeycloakProvisioning` deterministisch den bereits vorhandenen Keycloak-Provisioning-Run zurück

#### Scenario: Key-Reuse mit abweichender Payload wird abgelehnt

- **WHEN** ein Client denselben `Idempotency-Key` im selben Scope aus Instanz und Mutation wiederverwendet, aber eine abweichende Payload sendet
- **THEN** lehnt das System den Request mit `409 Conflict` ab
- **AND** liefert einen stabilen Fehlercode `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`
- **AND** erzeugt es keinen neuen Keycloak-Provisioning-Run

#### Scenario: Parallele Requests mit gleichem Key werden atomar dedupliziert

- **WHEN** zwei nahezu gleichzeitige Keycloak-Reconcile- oder Execute-Requests mit identischer Instanz, Mutation, identischem `Idempotency-Key` und identischer Payload eingehen
- **THEN** bleibt die persistierte Run-Erzeugung effektiv genau einmalig
- **AND** referenzieren alle erfolgreichen Execute-Antworten denselben Keycloak-Provisioning-Run
- **AND** geben alle erfolgreichen Reconcile-Antworten denselben Status-/Snapshot-Zustand des deduplizierten Auftrags wieder

### Requirement: Tenant-Auth-Vertrag priorisiert Host- und Realm-Scope
Das System SHALL für tenant-spezifische Studio-Instanzen den Tenant-Kontext primär über Registry, Hostname und den zugeordneten Realm modellieren.

#### Scenario: Tenant-Realm ist die führende technische Benutzergrenze

- **WHEN** eine aktive Instanz über `primaryHostname`, `authRealm` und `authClientId` in der Registry beschrieben ist
- **THEN** ist ein erfolgreicher Login im zugeordneten Tenant-Realm technisch ausreichend, um den Benutzer dem Tenant-Kontext dieser Instanz zuzuordnen
- **AND** die Runtime leitet `instanceId` für die Session aus diesem tenant-spezifischen Auth-Scope ab
- **AND** ein zusätzliches benutzerbezogenes Keycloak-Attribut `instanceId` ist dafür keine normative Vorbedingung

### Requirement: Keycloak-Artefakte unterscheiden zwischen Login-Vertrag und Interop
Das System SHALL Keycloak-Artefakte für tenant-spezifische Instanzen danach unterscheiden, ob sie für den interaktiven Login-Vertrag zwingend oder nur für Interoperabilität, Diagnose oder Zusatzprozesse relevant sind.

#### Scenario: instanceId-Mapper ist kein hartes Login-Gate mehr

- **WHEN** für eine aktive Instanz der OIDC-Client, Realm, Redirect- und Logout-URLs korrekt am Tenant-Host ausgerichtet sind
- **THEN** bleibt ein fehlender Protocol Mapper `instanceId` ein Diagnose- oder Interop-Befund
- **AND** er blockiert tenant-spezifische Studio-Logins nicht als eigener Pflichtvertrag
- **AND** Checklisten, Statusanzeigen und Doku unterscheiden explizit zwischen Login-relevanten Pflichtartefakten und optionalen Zusatzartefakten
- **AND** ein fehlendes Tenant-Admin-User-Attribut `instanceId` wird analog als Warnung oder Diagnosehinweis behandelt

### Requirement: Instanzdiagnostik korreliert Provisioning- und Runtime-Fehler

Die Instanzdiagnostik SHALL Runtime-IAM-Fehler, Provisioning-Drift, Reconcile-Befunde und Operator-Checks über gemeinsame Klassifikation, sichere Details und `requestId` korrelierbar machen.

#### Scenario: Provisioning- und Legacy-Fallbacks bleiben unterscheidbar

- **WHEN** ein Instanz- oder Tenant-Fehler aus Registry-/Provisioning-Drift entsteht
- **THEN** verwendet der Diagnosekern `registry_or_provisioning_drift`
- **AND** Legacy- oder Workaround-Pfade verwenden `legacy_workaround_or_regression`, damit Betrieb und UI die Ursache nicht vermischen

### Requirement: Instanz-Detailseite zeigt Tenant-IAM-Betriebszustand getrennt von Provisioning-Readiness

Das System SHALL nach abgeschlossenem Setup die laufende Bestandsdiagnose von
der einmaligen Inbetriebnahme trennen. Provisioning-nahe Historie und
Reparaturpfade bleiben verfuegbar, sind fuer Bestandsinstanzen aber in einem
eigenen Diagnosemodus organisiert.

#### Scenario: Historie bleibt diagnostisch verfuegbar, aber nicht als Hauptmodus

- **WENN** eine Bestandsinstanz abgeschlossen eingerichtet ist
- **UND** ein Operator technische Laeufe oder Reconcile-Evidenz nachvollziehen
  moechte
- **DANN** findet er diese Historie im Diagnosekontext des Doctor-Modus
- **UND** wird Historie nicht als gleichrangiger Hauptmodus des Bestandsbetriebs
  praesentiert

### Requirement: Instanzdiagnostik korreliert Tenant-IAM-Reconcile und Access-Probe

Das System SHALL Tenant-IAM-Reconcile, tenantlokale Rechteprobe und bestehende Provisioning-Evidenz in der Instanzdetailansicht korrelierbar zusammenführen.

#### Scenario: Reconcile-Befund verweist auf Tenant-IAM-Evidenz

- **WHEN** der Rollen- oder User-Abgleich einer Instanz fehlgeschlagen oder degradiert ist
- **THEN** kann die Instanzdetailansicht den Reconcile-Zustand mit Fehlercode, letztem Lauf und `requestId` darstellen
- **AND** bleibt sichtbar, ob zusätzlich die tenantlokale Rechteprobe oder die Strukturkonfiguration betroffen ist
- **AND** stammt dieser Befund aus vorhandener Reconcile-Evidenz statt aus einer neu erfundenen parallelen Statusquelle

#### Scenario: Access-Probe und Provisioning bleiben unterscheidbar

- **WHEN** Realm, Clients und Secrets strukturell vorhanden sind, der tenantlokale Admin-Client aber operativ keine ausreichenden Rechte hat
- **THEN** bleibt `configuration` im `tenantIamStatus` unabhängig von `access` oder `reconcile` auswertbar
- **AND** wird der Befund nicht als bloßes Fehlen eines Registry-Felds fehlklassifiziert

#### Scenario: Detailvertrag erzwingt keine neue Persistenzschicht

- **WHEN** vorhandene Registry-, Provisioning- und Reconcile-Evidenz ausreicht, um den Tenant-IAM-Befund nachvollziehbar abzuleiten
- **THEN** darf der Instanz-Detailvertrag diese Evidenz direkt aggregieren
- **AND** ist eine zusätzliche Persistenz für Probe-Snapshots oder Diagnosehistorie in diesem Change nicht verpflichtend

### Requirement: Realm-Modus steuert die UI-Semantik der Instanz-Detailbewertung

Das System SHALL fuer die Instanz-Detailansicht denselben strukturellen Datenstand je nach `realmMode` unterschiedlich bewerten, damit der Aufbau eines neuen Realms nicht mit Drift eines Bestands-Realms verwechselt wird.

#### Scenario: Neuer Realm behandelt nicht erzeugte Artefakte als erwartbaren Folgezustand

- **WHEN** eine Instanz `realmMode = new` besitzt
- **AND** Realm, Clients oder Secrets vor dem ersten Provisioning noch nicht in Keycloak existieren
- **THEN** darf die Detailansicht diese Artefakte als `geplant`, `noch nicht ausgefuehrt` oder fachlich gleichwertig markieren
- **AND** stellt sie diese Zustaende nicht automatisch als aktuellen Strukturdefekt desselben Rangs wie echte Fehlzustaende dar

#### Scenario: Bestands-Realm behandelt fehlende Artefakte als Drift oder Defekt

- **WHEN** eine Instanz `realmMode = existing` besitzt
- **AND** erwartete Realm-, Client- oder Secret-Artefakte fehlen oder weichen vom Vertrag ab
- **THEN** zeigt die Detailansicht diese Zustaende als Drift, Blocker oder fachlich gleichwertigen Defekt
- **AND** ordnet sie dazu passende Reparaturaktionen dem sichtbaren Befund zu

#### Scenario: Aktuelle Schrittphase bleibt im neuen Realm nachvollziehbar

- **WHEN** eine Instanz `realmMode = new` besitzt
- **AND** Provisioning-, Secret-Sync- oder Tenant-Admin-Schritte bereits teilweise ausgefuehrt wurden
- **THEN** kann die Detailansicht den aktuellen Fortschritt entlang einer linearen Aufbauphase darstellen
- **AND** bleibt erkennbar, welcher Schritt erfolgreich war, welcher laeuft und welcher noch offen ist

#### Scenario: Neuer Realm orientiert sich an der tatsaechlichen Worker-Schrittkette

- **WHEN** eine Instanz `realmMode = new` besitzt
- **THEN** orientiert die Detailansicht die Aufbauphase mindestens an `Registry-Vertrag`, `Preflight`, `Plan`, `Realm`, `Login-Client`, `Tenant-Admin-Client`, `Realm-Rollen`, `Tenant-Admin`, `Secret-Sync` und `Abschlussvalidierung`
- **AND** behandelt sie diese Schritte als getrennt beobachtbare Artefaktphasen
- **AND** vermeidet sie eine gleichwertige Vermischung von Registry-Vorbereitung, Keycloak-Ausfuehrung und nachgelagerter Validierung

#### Scenario: Secret-Sync ist ein eigener Folgeschritt nach erfolgreicher Keycloak-Ausfuehrung

- **WHEN** eine Instanz `realmMode = new` besitzt
- **AND** Realm und Clients in Keycloak bereits erfolgreich angelegt oder abgeglichen wurden
- **THEN** behandelt die Detailansicht das Zurueckschreiben erzeugter Tenant-Secrets in die Registry als eigene Folgeschrittphase
- **AND** bleibt erkennbar, dass ein technischer Erfolg in Keycloak noch nicht automatisch einen vollstaendig abgeschlossenen Registry-Zielzustand bedeutet

#### Scenario: Abschlussvalidierung ist vom Ausfuehrungsschritt getrennt

- **WHEN** ein Provisioning-Lauf fuer einen neuen Realm abgeschlossen wurde
- **THEN** prueft die Detailansicht den resultierenden Zustand getrennt von der eigentlichen Ausfuehrung gegen Realm, Clients, Secrets, Rollen und Tenant-Admin
- **AND** kann dadurch einen Fehler in der Abschlussvalidierung anzeigen, obwohl fruehere Ausfuehrungsschritte erfolgreich waren

#### Scenario: Neuer Realm mit bereits existierendem Live-Realm erzeugt einen Moduskonflikt

- **WHEN** eine Instanz `realmMode = new` besitzt
- **AND** der Ziel-Realm live bereits existiert
- **THEN** bewertet die Detailansicht diesen Zustand als Konflikt zwischen erwartetem Aufbaupfad und vorgefundenem Live-Zustand
- **AND** leitet daraus keine normale Erfolgsprojektion des `new`-Pfads ohne ausdruecklichen Konflikthinweis ab

#### Scenario: Bestands-Realm ohne Live-Realm bleibt ein harter Defekt

- **WHEN** eine Instanz `realmMode = existing` besitzt
- **AND** der erwartete Realm live nicht existiert
- **THEN** bewertet die Detailansicht diesen Zustand als harten Strukturdefekt
- **AND** behandelt ihn nicht wie einen geringfuegigen Driftfall

#### Scenario: Schrittfehler bleiben dem betroffenen Aufbau- oder Reconcile-Schritt zugeordnet

- **WHEN** Secret-Sync, Tenant-Admin-Bootstrap oder Reconcile fuer eine Instanz fehlschlagen
- **THEN** ordnet die Detailansicht den Fehler dem betroffenen Workflow-Schritt zu
- **AND** bleibt sichtbar, welche vorangehenden Schritte erfolgreich waren und welcher Folgeschritt dadurch blockiert ist

#### Scenario: Naechste Aktion folgt dem ersten relevanten offenen oder fehlgeschlagenen Schritt

- **WHEN** fuer einen neuen Realm mehrere Teilphasen in unterschiedlichem Zustand vorliegen
- **THEN** leitet die Detailansicht die primaere naechste Aktion aus dem ersten fachlich relevanten offenen, blockierten oder fehlgeschlagenen Schritt ab
- **AND** priorisiert sie dabei Vorbedingungen vor Worker-Start, Worker-Start vor Secret-Sync und Secret-Sync vor Abschlussvalidierung

#### Scenario: Naechste Aktion folgt einer festen Prioritaetsregel fuer neue Realms

- **WHEN** fuer eine Instanz `realmMode = new` mehrere moegliche Folgeaktionen gleichzeitig in Frage kommen
- **THEN** priorisiert die Detailansicht Konfigurationskorrektur vor Moduskonflikt, Moduskonflikt vor Preflight-Blocker, Preflight-Blocker vor Worker-Start oder Retry, Worker-Start oder Retry vor Secret-Sync, Secret-Sync vor Abschlussvalidierung und Abschlussvalidierung vor optionalen Folgearbeiten
- **AND** bleibt diese Prioritaetsregel fuer Tests und Projektion als isolierte Logik abbildbar

#### Scenario: Neuer Realm erreicht einen expliziten Abschluss vor optionalen Folgearbeiten

- **WHEN** Realm, Clients, Rollen, Tenant-Admin, Secret-Sync und Abschlussvalidierung fuer eine Instanz `realmMode = new` erfolgreich sind
- **THEN** betrachtet die Detailansicht den Realm-Grundaufbau als erfolgreich abgeschlossen
- **AND** behandelt sie optionale Aktivierung, Modulzuordnung oder modulbezogene IAM-Synchronisation nicht als blockierenden Restschritt desselben Kernflows

#### Scenario: Tenant-IAM- und Modul-IAM-Folgearbeiten bleiben ausserhalb des Kernflows

- **WHEN** nach erfolgreichem Realm-Grundaufbau weitere tenant- oder modulbezogene IAM-Arbeiten anstehen
- **THEN** stellt die Detailansicht diese Arbeiten als getrennte Folgearbeiten oder Empfehlungen dar
- **AND** mischt sie diese Folgearbeiten nicht in die Pflichtschritte der Realm-Erzeugung ein

#### Scenario: Veraltete Live-Evidenz wird nicht mit aktuellem Zustand verwechselt

- **WHEN** fuer eine Instanz nur veraltete, unvollstaendige oder widerspruechliche Live-Evidenz vorliegt
- **THEN** markiert die Detailansicht diese Evidenz als diagnostisch eingeschraenkt
- **AND** vermeidet eine gleichrangige Darstellung als sicherer aktueller Erfolgs- oder Fehlerzustand

### Requirement: Instanzen fuehren einen expliziten zugewiesenen Modulsatz

Das System SHALL pro Instanz einen expliziten Satz zugewiesener Module persistieren und diesen Satz als kanonische Betriebsquelle fuer modulbezogene Freigaben und IAM-Basis verwenden. Die Zuweisung erfolgt ausschliesslich durch den Studio-Admin.

#### Scenario: Bestehende Instanz startet ohne impliziten Modulsatz

- **GIVEN** eine bestehende Instanz wird nach Einfuehrung des Modulvertrags gelesen
- **WHEN** fuer diese Instanz noch keine explizite Modulzuordnung durch den Studio-Admin gepflegt wurde
- **THEN** behandelt das System ihren Modulsatz als leer
- **AND** aktiviert keine Module implizit aus globaler Plugin-Registrierung, `featureFlags` oder Integrationsdaten

### Requirement: Modulzuweisung seedet die IAM-Basis in derselben Operation

Das System SHALL die Zuweisung eines Moduls zu einer Instanz als Studio-Admin-Mutation behandeln, die die fachliche Freigabe und das IAM-Baseline-Seeding fuer `Core + zugewiesene Module` in derselben Operation ausfuehrt.

#### Scenario: Modul wird einer Instanz zugewiesen

- **GIVEN** ein global bekanntes Modul ist einer Instanz noch nicht zugewiesen
- **WHEN** der Studio-Admin das Modul der Instanz zuweist
- **THEN** persistiert das System die Modulzuordnung fuer diese Instanz
- **AND** legt es fehlende modulbezogene Permissions idempotent an oder aktualisiert sie
- **AND** bringt es kanonische Systemrollen und `role_permissions` fuer `Core + zugewiesene Module` auf Sollstand
- **AND** ist das Modul nach erfolgreichem Abschluss fachlich sofort nutzbar

#### Scenario: Zuweisung eines nicht global registrierten Moduls wird abgelehnt

- **GIVEN** eine gueltige Instanz existiert
- **WHEN** der Studio-Admin ein Modul zuweist, das nicht in der globalen Plugin-Registrierung bekannt ist
- **THEN** lehnt das System die Operation mit einem Validation-Fehler ab
- **AND** wird keine Modulzuordnung persistiert
- **AND** wird kein IAM-Seeding ausgefuehrt

### Requirement: Instanz-Anlage-Flow enthaelt einen sichtbaren Abschnitt fuer den initialen Admin-Bootstrap

Das System SHALL den initialen Admin-Bootstrap nach erfolgreicher Instanzanlage
in einen separaten einmaligen Flow `Setup abschliessen` ueberfuehren. Dieser
Flow ist kein dauerhafter Bestandsmodus, sondern dient ausschliesslich dem
Abschluss der Inbetriebnahme.

#### Scenario: Setup-Abschluss ist eigener Folgeschritt nach dem Create

- **GIVEN** eine Instanz wurde erfolgreich angelegt
- **WHEN** der Studio-Admin den naechsten primaeren Schritt waehlt
- **THEN** fuehrt die UI in den separaten Flow `Setup abschliessen`
- **AND** bleibt dieser Flow klar von `Betrieb`, `Doctor` und
  `Einstellungen` getrennt

### Requirement: Initialer Admin-Bootstrap funktioniert auch ohne Modulauswahl

Das System SHALL den initialen Admin-Bootstrap auch dann zulaessen, wenn keine Module ausgewaehlt wurden. In diesem Fall muss mindestens die Core-bezogene Admin-Grundstruktur angelegt werden.

#### Scenario: Bootstrap ohne Module

- **GIVEN** eine Instanz wurde erfolgreich angelegt
- **AND** der Studio-Admin hat im Bootstrap-Abschnitt keine Module ausgewaehlt
- **WHEN** er den Sammel-Button ausloest
- **THEN** legt das System mindestens die Gruppe `Admins` und die Rolle `Core Admin` an
- **AND** ordnet es keine zusaetzlichen Module zu
- **AND** gilt der Bootstrap-Lauf bei Erfolg als abgeschlossen

### Requirement: Modulauswahl des Bootstrap-Abschnitts ist echte Instanzaktivierung

Das System SHALL die Modulauswahl im Bootstrap-Abschnitt als echte offizielle Instanz-Modulzuordnung behandeln und nicht nur als Hilfsparameter fuer die Erzeugung initialer Rollen.

#### Scenario: Ausgewaehlte Module werden der Instanz offiziell zugeordnet

- **GIVEN** die Instanz wurde erfolgreich angelegt
- **AND** der Studio-Admin waehlt im Bootstrap-Abschnitt ein oder mehrere Module aus
- **WHEN** er den Sammel-Button ausloest
- **THEN** werden diese Module der Instanz offiziell zugeordnet
- **AND** sind sie nach erfolgreicher Zuordnung fachlich als aktiv behandelt
- **AND** basiert die weitere Rollen- und Gruppeninitialisierung auf genau diesem offiziellen Modulsatz

### Requirement: Instanz gilt erst nach erfolgreichem Bootstrap-Lauf als fertig

Das System SHALL eine Instanz erst dann als fachlich fertig eingerichtet
behandeln, wenn die Inbetriebnahme vollstaendig abgeschlossen ist. Vollstaendig
abgeschlossen bedeutet mindestens: die Instanz ist aktiv und die
Tenant-Admin-Struktur wurde initialisiert.

#### Scenario: Aktivierung allein beendet das Setup noch nicht

- **GIVEN** eine Instanz wurde angelegt und aktiviert
- **AND** die Tenant-Admin-Struktur wurde noch nicht initialisiert
- **WHEN** der Studio-Admin den Setup-Status betrachtet
- **THEN** gilt die Inbetriebnahme noch nicht als abgeschlossen
- **AND** weist der Flow auf den noch ausstehenden Schritt zur
  Tenant-Admin-Struktur hin

#### Scenario: Setup ist erst nach Aktivierung und Admin-Struktur abgeschlossen

- **GIVEN** eine Instanz wurde erfolgreich angelegt
- **WHEN** die Instanz aktiv ist
- **AND** die Tenant-Admin-Struktur erfolgreich initialisiert wurde
- **THEN** behandelt das System den Setup-Abschluss als fachlich fertig
- **AND** fuehrt die UI danach standardmaessig in die Bestandsverwaltung

### Requirement: Bootstrap-Aktion darf bereits erfolgreiche Modulzuordnung bei Folgefehlern erhalten

Das System SHALL die Bootstrap-Aktion aus Usersicht als einen zusammenhaengenden Schritt anbieten, darf aber bereits erfolgreich persistierte Modulzuordnungen bei spaeteren Fehlern im Rollen- oder Gruppenaufbau erhalten.

#### Scenario: Modulzuordnung bleibt trotz nachgelagertem Rollenfehler bestehen

- **GIVEN** eine Instanz wurde erfolgreich angelegt
- **AND** der Studio-Admin hat im Bootstrap-Abschnitt Module ausgewaehlt
- **WHEN** der Sammel-Button die Modulzuordnung erfolgreich persistiert
- **AND** ein nachgelagerter Schritt beim Anlegen, Ueberschreiben oder Verknuepfen von Rollen und Gruppen fehlschlaegt
- **THEN** duerfen die bereits erfolgreich zugeordneten Module bestehen bleiben
- **AND** meldet das System den Bootstrap-Lauf insgesamt als unvollstaendig oder fehlgeschlagen zurueck
- **AND** bietet es einen spaeteren erneuten Bootstrap-Versuch an

#### Scenario: IAM-Seeding schlaegt waehrend Modulzuweisung fehl

- **GIVEN** ein global bekanntes Modul ist einer Instanz noch nicht zugewiesen
- **WHEN** der Studio-Admin das Modul zuweist
- **AND** der IAM-Baseline-Seeding-Schritt schlaegt mit einem Fehler fehl
- **THEN** rollt das System die Modulzuordnung fuer diese Instanz zurueck
- **AND** persistiert keine Teilzuordnung
- **AND** wird der Fehler dem Studio-Admin mit Diagnosekontext zurueckgemeldet
- **AND** startet ein erneuter Zuweisungsversuch die Operation idempotent von vorn

### Requirement: Modulentzug entfernt modulbezogene IAM-Basis hart

Das System SHALL den Entzug eines Moduls von einer Instanz als Studio-Admin-Mutation behandeln, die modulbezogene Rechte und Rollenzuordnungen hart entfernt. Die Mutation erfordert ein explizites `confirmation`-Feld im Request; der Server lehnt den Entzug ohne dieses Feld mit einem eigenen Fehlercode ab.

#### Scenario: Modul wird einer Instanz entzogen

- **GIVEN** ein Modul ist einer Instanz zugewiesen
- **WHEN** der Studio-Admin den Entzug mit expliziter Bestaetigung (`confirmation: "REVOKE"`) ausfuehrt
- **THEN** entfernt das System die Modulzuordnung fuer diese Instanz
- **AND** entfernt es die modulbezogenen Permissions hart
- **AND** entfernt es modulbezogene `role_permissions` und systemische Rollenerweiterungen hart
- **AND** bleibt die Core-IAM-Basis der Instanz unveraendert erhalten

#### Scenario: Gleichzeitige Zuweisung und Entzug desselben Moduls

- **GIVEN** ein Modul ist einer Instanz zugewiesen
- **WHEN** zwei nebenlaeuifge Operationen gleichzeitig ausgefuehrt werden: Operation A entzieht das Modul, Operation B weist es erneut zu
- **THEN** laesst das System genau eine Operation atomar gewinnen
- **AND** der finale Modulsatz der Instanz ist entweder vollstaendig zugewiesen oder vollstaendig entzogen – kein Zwischenzustand wird persistiert
- **AND** die unterlegene Operation schlaegt mit einem deterministischen Conflict-Fehler fehl

### Requirement: Instanz-Cockpit diagnostiziert IAM-Basis zugewiesener Module

Das System SHALL fuer jede Instanz einen expliziten Betriebsbefund ueber die Vollstaendigkeit der IAM-Basis fuer `Core + zugewiesene Module` ableiten und dem Studio-Admin als direkte Diagnose auf der Instanz-Detailseite verfuegbar machen.

#### Scenario: Zugewiesene Module haben unvollstaendige IAM-Basis

- **GIVEN** eine Instanz hat zugewiesene Module
- **AND** mindestens eine erwartete Permission, Systemrolle oder `role_permission` fuer `Core + zugewiesene Module` fehlt
- **WHEN** der Studio-Admin die Instanzdetailansicht laedt
- **THEN** zeigt das Cockpit einen degradierten Befund fuer die IAM-Basis zugewiesener Module
- **AND** enthaelt der Befund eine direkte Reparaturaktion zum Neu-Seeden

### Requirement: Serverseitig gebundene Fresh-Reauth fuer kritische Instanz-Mutationen

Das System SHALL fuer kritische Root-Host-Control-Plane-Mutationen der Instanzverwaltung einen serverseitig gebundenen Fresh-Reauth-Nachweis verlangen.

#### Scenario: Kritische Mutation mit gueltigem Fresh-Reauth-Nachweis

- **WHEN** ein berechtigter Root-Host-Operator eine kritische Instanz- oder Keycloak-Mutation ausfuehrt
- **AND** die Session eine serverseitig gesetzte Fresh-Reauth-Evidenz innerhalb des gueltigen Frischefensters traegt
- **THEN** darf die Mutation den Reauth-Guard passieren
- **AND** bleibt die Rollen- und Root-Host-Pruefung weiterhin zusaetzlich verpflichtend

#### Scenario: Kritische Mutation ohne serverseitige Fresh-Reauth-Evidenz

- **WHEN** ein berechtigter Root-Host-Operator eine kritische Instanz- oder Keycloak-Mutation ausfuehrt
- **AND** keine gueltige serverseitige Fresh-Reauth-Evidenz im Session-Kontext vorliegt
- **THEN** lehnt das System die Mutation fail-closed mit `reauth_required` oder gleichwertigem stabilem Fehlercode ab
- **AND** fuehrt es keine fachliche Mutation aus

#### Scenario: Klientseitige Reauth-Marker heben den Guard nicht auf

- **WHEN** ein Request fuer eine kritische Instanz- oder Keycloak-Mutation nur einen klientseitigen Header, Query-Parameter oder UI-Marker fuer Reauth mitliefert
- **THEN** hebt dieser Marker den Fresh-Reauth-Guard nicht auf
- **AND** bleibt allein die serverseitig gebundene Fresh-Reauth-Evidenz entscheidend

#### Scenario: Lokaler Nicht-Produktiv-Pfad bleibt explizit

- **WHEN** dieselbe Mutation in einem explizit als lokal oder nicht-produktiv definierten Entwicklungsprofil ausgefuehrt wird
- **THEN** verwendet das System einen dokumentierten serverseitigen Dev-Pfad oder einen expliziten Nicht-Produktiv-Bypass
- **AND** ist dieses Verhalten ausserhalb dieser Profile nicht verfuegbar

### Requirement: Tenant-Admin-Bootstrap vergibt nur tenantlokale Sonderrechte
Das System SHALL beim Bootstrap einer neuen Instanz dem initialen Tenant-Admin ausschließlich tenantlokale Sonderrechte des Tenant-Realm zuweisen.

#### Scenario: Bootstrap vergibt system_admin, aber keine Plattformrolle
- **WHEN** der initiale Tenant-Admin einer neuen Instanz angelegt oder aktualisiert wird
- **THEN** synchronisiert das System im Tenant-Realm mindestens die Rolle `system_admin`
- **AND** es synchronisiert für `system_admin` die vollständige tenantlokale Permission-Basis aus der führenden Permission-Quelle
- **AND** es synchronisiert dabei nicht die Plattformrolle `instance_registry_admin`

#### Scenario: Tenant-Status fordert keine Plattformrolle im Tenant-Realm
- **WHEN** der Keycloak-Status oder Preflight einer Tenant-Instanz gelesen wird
- **THEN** bewertet das System tenantlokale Rollen und Tenant-Admin-Zustand ohne Erwartung einer Rolle `instance_registry_admin` im Tenant-Realm
- **AND** fehlende Plattformrollen im Tenant-Realm werden nicht als Drift des Tenant-Realm interpretiert

#### Scenario: Tenant-Admin-Repair erkennt fehlende Vollzugriffs-Permissions
- **WHEN** ein Bootstrap-, Repair- oder Reconcile-Pfad einen Tenant mit `system_admin` prüft
- **THEN** behandelt das System fehlende tenantlokale Permissions auf `system_admin` als Drift
- **AND** der Repair-Pfad kann diese Permission-Bündelung idempotent wiederherstellen

#### Scenario: Root-Bootstrap materialisiert keine Legacy-Admin-Struktur mehr
- **WHEN** ein Root-/Plattform-Administrator in der Instanzverwaltung die Tenant-Admin-Struktur bootstrappt oder repariert
- **THEN** synchronisiert das System nur die geschützte Tenant-Rolle `system_admin` sowie die IAM-Basis der zugewiesenen Module
- **AND** es materialisiert dabei keine Gruppen wie `admins`, keine Rollen wie `core_admin` und keine modulbezogenen Standard-Admin-Rollen mehr

#### Scenario: Legacy-Admin-Artefakte bleiben als reparierbarer Drift sichtbar
- **WHEN** eine Bestandsinstanz weiterhin Komfortartefakte wie die Gruppe `admins` oder die Rolle `core_admin` enthält
- **THEN** weist das System diesen Zustand im Tenant-IAM- oder Rollenabgleich als Drift bzw. manuellen Nacharbeitsbedarf aus
- **AND** der Zustand bleibt über die regulären Tenant-Rollen- und Gruppenverwaltungswege bereinigbar, ohne `system_admin` als normative Vollzugriffsrolle zu ersetzen

### Requirement: Root- und Tenant-Provisioning-Evidenz bleiben getrennt
Das System SHALL Provisioning-, Status- und Diagnosepfade für Root-Control-Plane und Tenant-Realm getrennt ausweisen.

#### Scenario: Root- und Tenant-Befunde bleiben semantisch getrennt
- **WHEN** eine Instanz im Root-Control-Plane-Cockpit betrachtet wird
- **THEN** bleiben Plattformzugang, Root-Operator-Rechte und tenantlokale Realm-Befunde als getrennte Achsen oder Diagnosen modelliert
- **AND** ein tenantlokaler Rollenfehler wird nicht als Root-Realm-Problem dargestellt

### Requirement: Lokaler Bootstrap bewahrt bestehende Umgebungsidentität

Das System SHALL fuer bestehende lokale Instanzdatenbanken den normalen Startpfad, explizite Registry-Korrektur und tenant-spezifische Secret-Reparatur trennen.

#### Scenario: Bestehende lokale Instanz wird nicht beim Start ueberschrieben

- **WHEN** eine bereits konfigurierte lokale Instanzdatenbank erneut ueber `pnpm env:up:local-keycloak` gestartet wird
- **THEN** bleiben bestehende Host-, Realm- und Client-Identitaeten unveraendert
- **AND** werden Abweichungen nur als Drift sichtbar gemacht

#### Scenario: Lokaler Repair nutzt vorhandene Provisioning-Vertraege

- **WHEN** `pnpm env:repair:local-keycloak` eine lokale Instanz mit fehlenden tenant-spezifischen Secrets oder Registry-Drift bearbeitet
- **THEN** verwendet der Repair-Pfad dieselben Provisioning- und Registry-Vertraege wie die vorhandene Instanzverwaltung
- **AND** fuehrt keine parallelen Direkt-SQL-Pfade fuer Secret-Heilung ein

### Requirement: Gefaehrlicher lokaler Bootstrap benoetigt explizite Freigabe

Das System SHALL repo-gesteuerte lokale Bootstrap-Pfade fuer bestehende oder neu anzulegende Instanzdatenbanken nur mit expliziter Freigabe ausfuehren.

#### Scenario: Lokaler Instanz-DB-Bootstrap bleibt ohne Approval gesperrt

- **WHEN** `pnpm env:bootstrap:local-instance-db` eine lokale Zielinstanz initialisieren oder neu aufbauen soll
- **THEN** blockiert das Skript den Lauf ohne passenden `--approve-dangerous=bootstrap-local-instance-db:<target-instance-id>`
- **AND** nennt die Fehlermeldung den exakt erwarteten Freigabetoken

### Requirement: Lokaler DB-Snapshot bleibt migrationsbasiert ableitbar

Das System SHALL den eingecheckten DB-Snapshot als aus Migrationen ableitbares Artefakt behandeln.

#### Scenario: Snapshot-Check erkennt nicht migrierte Objekte

- **WHEN** `pnpm env:verify:db-schema-snapshot` gegen den lokalen Datenbankstand ausgefuehrt wird
- **THEN** schlaegt der Befehl fehl, wenn der Snapshot Objekte enthaelt, die der migrationsbasierte Datenbankstand nicht besitzt
- **AND** meldet er fehlende und unerwartete Objekte maschinenlesbar

#### Scenario: Runtime-Schemas werden aus dem Snapshot-Check ausgeschlossen

- **WHEN** der Snapshot-Check einen lokalen Datenbank-Dump mit reinen Runtime- oder Infra-Schemas liest
- **THEN** ignoriert der Check mindestens `graphile_worker`
- **AND** behandelt diese Schemata nicht als fachliche Snapshot-Drift
