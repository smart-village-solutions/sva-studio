# Design: Automatisierter Kasseler Tenant-Ingress

## Kontext und aktueller Stand

Die Kasseler Standalone-Installation betreibt mehrere Studio-Tenant-Hosts
hinter dem Traefik des SSF-Stacks. Wildcard-DNS für genau eine Ebene unter
`dialog.kassel.de` ist vorhanden; ein für DNS-01 nutzbarer DNS-Zugang ist nicht
verfügbar. Traefik verwendet den Docker Provider und TLS-ALPN-ACME.

Die Instanzanlage besitzt inzwischen zwei unterschiedliche Persistenzebenen:

- `iam.instance_provisioning_runs` beschreibt den fachlichen Gesamtvorgang,
  wird beim Create derzeit aber nur als `requested` angelegt und noch nicht als
  terminaler Workflow fortgeschrieben.
- `iam.instance_keycloak_provisioning_runs` und seine Steps bilden den
  spezialisierten Keycloak-Auftrag ab. PR #1316 hat Claim, Advisory Lock,
  Snapshot-Bindung, Queue-Kompatibilität und Recovery für diesen Teilpfad
  gehärtet. Der eigenständige Kasseler `provisioner` verarbeitet diese Queue
  aus demselben unveränderlichen Image wie die App.

Live enthält die App-Routerregel vier explizite Hosts, darunter
`tenant-havelland` und `svs`. Beide wurden manuell ergänzt und teilen aktuell
ein SAN-Zertifikat. Es gibt weder einen File Provider noch eine automatische
Kopplung des Routers an den fachlichen Create-Lauf. Havelland liefert heute
einen Studio-Login-Redirect; `svs` endet auf `/auth/login` mit HTTP 500. Die
korrelierte Live-Diagnose zeigt als Ursache eine fehlende öffentliche
`auth_issuer_url`: Dadurch fällt die Runtime auf die ausschließlich interne
`KEYCLOAK_ADMIN_BASE_URL` zurück. Der neue Create-Pfad muss die öffentliche
Issuer-URL vor dem Keycloak-Snapshot ableiten und persistieren.

Issue #1319 hat zusätzlich belegt, dass SSF-Betriebsbereitschaft mehr als einen
Studio-OIDC-Redirect erfordert. Der dortige Vertrag bleibt in seinen
SSF-spezifischen Specs führend und wird hier nur als terminale Abhängigkeit
referenziert.

## Ziele

- Eine Kasseler Tenant-Anlage endet nachvollziehbar entweder erfolgreich oder
  terminal in `failed`; `requested` oder `provisioning` sind nur interne,
  zeitlich begrenzte Laufzustände.
- Der bestehende Kasseler Provisioner und seine bewährten Queue-/Lock-Muster
  werden erweitert, nicht durch Graphile oder einen zweiten allgemeinen
  Job-Stack ersetzt.
- Router, Zertifikat, Studio-Login und modulabhängige Readiness werden zu
  nachgewiesenen Stufen desselben fachlichen Elternlaufs.
- Wiederholung, Redelivery, konkurrierende Anfragen und Prozessabbruch
  konvergieren idempotent.
- Der Schreibzugriff auf die Traefik-Konfiguration bleibt Kassel-spezifisch und
  auf ein einzelnes Verzeichnis begrenzt.
- Das reguläre Studio-Deployment bleibt unverändert.

## Nicht-Ziele

- Kein Wildcard-Zertifikat und keine Einführung von DNS-01.
- Kein Catch-all- oder `HostRegexp`-Router für unbekannte Subdomains.
- Keine Mutation von Docker oder Compose aus der Studio-Runtime.
- Keine neue allgemeine Provider- oder Workflow-Plattform.
- Keine automatische Löschung bereits erzeugter Registry-, Keycloak-, Secret-,
  Lifecycle- oder Router-Artefakte bei Fehlern.
- Keine Neuimplementierung der SSF-Readiness aus #1319.
- Keine Verallgemeinerung auf Dev, Staging oder reguläre Production in diesem
  Change.

## Architekturentscheidung

### 1. Der vorhandene Elternlauf wird fachlich führend

`iam.instance_provisioning_runs` bleibt die eine fachliche Sicht auf Create,
Aktivierung und terminales Ergebnis. Der bisherige Datensatz pro
`instanceId`, Operation und Idempotency-Key wird in place fortgeschrieben,
statt pro Stufe konkurrierende Zeilen anzulegen.

Der Elternlauf erhält die für dauerhafte Orchestrierung fehlenden Informationen:

- eine versionierte, unveränderliche Sollzustandsreferenz oder einen
  gleichwertig beweisbaren Snapshot,
- aktuelle Stufe und terminalen Status,
- Claim-/Lease-, Wake-up-, Attempt- und Deadline-Informationen,
- Korrelationen zu spezialisierten Kindläufen,
- redigierte, stabile Fehler- und Postcondition-Evidenz.

Die genaue Migration wird erst nach Abgleich mit der dann gemergten #1319-
Persistenz festgelegt. Eine Schemaänderung gilt nicht länger als vermeidbare
Annahme: Wenn der bestehende Vertrag die Invarianten nicht beweisen kann, wird
er gezielt erweitert und in Schema-Snapshot und Schemadokumentation
nachgeführt.

### 2. Spezialisierte Kindläufe bleiben spezialisiert

Keycloak-Provisionierung bleibt in
`iam.instance_keycloak_provisioning_runs`. Der Elternlauf persistiert eine
explizite Korrelation und wartet auf genau den zum Sollsnapshot passenden
terminalen Kindlauf. Er interpretiert keinen älteren oder für eine andere
Konfiguration erzeugten Erfolg als aktuelle Evidenz.

Plugin-Lifecycle und SSF-Readiness bleiben in ihrer vorhandenen Ownership. Für
einen Tenant mit effektiv aktivem SSF wartet der Elternlauf auf die aktuelle
Lifecycle-/Authorization-Revision und die durch #1319 definierte vollständige
Readiness. Nicht zugewiesene oder nicht wirksame Module erzeugen keine
phantomhaften Provisioning-Abhängigkeiten.

Kindläufe dürfen unabhängig diagnostizierbar bleiben. Nur der Elternlauf darf
jedoch den Create-Vorgang in der Control Plane als erfolgreich abgeschlossen
ausweisen.

### 3. Der vorhandene Kasseler Provisioner wird erweitert

Der bestehende Standalone-Prozess ist die Ausführungsgrenze für persistente
Kasseler Provisionierung. Er behält:

- dasselbe immutable Image wie die App,
- dieselbe Kasseler Datenbank und Redis-Konfiguration,
- die vorhandene instanzgebundene Advisory-Lock-ID,
- Queue-Snapshot- und Versionskompatibilitätsregeln,
- den fail-closed Start- und koordinierten Drain-Vertrag.

Der Prozess erhält im Kassel-Modus zusätzlich Schreibzugriff auf genau das
dynamische Traefik-Verzeichnis. Er erhält weiterhin keinen Docker-Socket,
keinen ACME-Speicher und keine DNS-Zugangsdaten. App und andere Studio-Prozesse
erhalten diesen Mount nicht.

Die Kombination von Keycloak- und Ingress-Schritten in diesem bereits
dedizierten Provisioner vermeidet eine zweite Worker-Koordination. Die
privilegierte Dateisystemoperation bleibt trotzdem in einem kleinen,
framework-unabhängig getesteten Ingress-Modul gekapselt und ist außerhalb des
Kassel-Modus nicht erreichbar.

### 4. Traefik File Provider als schmale Integrationskante

Der SSF-Traefik aktiviert einmalig einen beobachteten File-Provider-Ordner und
mountet ihn nur lesbar. Bestehende Root-, Keycloak- und SSF-Router dürfen
weiterhin aus Docker-Labels stammen.

Für jeden verwalteten Studio-Tenant erzeugt der Provisioner eine eigene Datei
mit:

- einem deterministisch benannten Router,
- einer expliziten Regel `Host(\`<tenant>.dialog.kassel.de\`)`,
- höherer, fest definierter Priorität gegenüber der vorübergehenden statischen
  Bestandsroute,
- dem bestehenden HTTPS-EntryPoint und ACME-Resolver,
- einer gegen die Live-Topologie getesteten providerqualifizierten Referenz auf
  den vorhandenen Studio-Service,
- dem Ausschluss öffentlicher `/internal/`-Routen.

Ein Router pro Tenant führt nach der Bestandsmigration zu einem separaten
Zertifikatsvertrag pro Host. Das ist ein Zielzustand; das heutige gemeinsame
SAN-Zertifikat bleibt während der Migration gültig und wird nicht als bereits
erreicht dargestellt.

### 5. Validierung und atomare Veröffentlichung

Die framework-unabhängige Kernlogik normalisiert den Host in Kleinschreibung,
entfernt einen abschließenden Punkt und akzeptiert genau ein zulässiges
DNS-Label unter `dialog.kassel.de`. Reservierte Hosts, zusätzliche Labels,
Punycode sowie Zeichenfolgen, die YAML-, Pfad- oder Regel-Injektion erlauben
könnten, werden abgelehnt.

Der Provisioner rendert deterministisch, validiert die vollständige Zieldatei
und ersetzt sie per atomarem Rename innerhalb desselben Verzeichnisses. Ein
Fehler vor dem Rename lässt die letzte gültige Datei unverändert. Traefik
beobachtet das Verzeichnis statt einer einzelnen Datei.

Der Dateischreibvorgang allein ist kein Erfolg. Der Provisioner muss die
Übernahme des exakten Routers und anschließend öffentliches TLS für SNI und Host
nachweisen. Log- und Auditdaten enthalten Hash, Routername und Korrelation, aber
keinen ACME-Inhalt oder Secretwert.

### 6. Terminaler Ende-zu-Ende-Ablauf

Die Create-Mutation prüft Berechtigung und Eingabe und persistiert Instanz,
Elternlauf und garantiert ausführbaren Startzustand ohne verlorenes Wake-up.
Sie gibt die Run-ID als angenommenen Vorgang zurück. Die UI beobachtet den
Lauf, treibt ihn aber nicht an und bezeichnet die Annahme nicht als
abgeschlossene Anlage.

Der Provisioner arbeitet folgende Stufen unter instanzgebundener
Serialisierung idempotent ab:

1. Registry- und Hostartefakte gegen den Sollsnapshot lesen und bestätigen.
2. Öffentliche Auth-Issuer-URL aus der Kasseler Installationskonfiguration
   ableiten, persistieren und in den Sollsnapshot aufnehmen.
3. Passenden Keycloak-Kindlauf erzeugen oder referenzieren und dessen
   snapshotgebundenen terminalen Erfolg bestätigen.
4. Modulzuweisungen und die vor Aktivierung prüfbaren Lifecycle-Voraussetzungen
   reconciliieren.
5. Expliziten Traefik-Router atomar veröffentlichen und dessen Übernahme
   bestätigen.
6. Öffentlich vertrauenswürdiges Zertifikat für den exakten Host bestätigen.
7. Auth-Issuer, Studio-Login-Client, Redirect und Callback-Konfiguration
   read-back-verifizieren.
8. Alle vor Aktivierung möglichen modulabhängigen Readiness-Prüfungen
   abschließen.
9. Instanz kontrolliert auf `active` setzen.
10. Studio-Login über den öffentlichen Tenant-Host prüfen.
11. Bei effektiv aktivem SSF den vollständigen #1319-Vertrag prüfen:
    `ssf-frontend`, Ressourcenclient, IAM-Projektion, Runtime-Tenant-Baseline,
    Runtime-Readiness, aktuelle Authorization-Revision sowie
    Directory → Keycloak → Callback → Gateway.
12. Erst danach den Elternlauf terminal erfolgreich abschließen.

Öffentliche Login- und Directory-Smokes benötigen eine aktive Instanz. Zwischen
Schritt 9 und 12 existiert daher ein eng begrenztes Aktivierungsfenster. Der
Elternlauf bleibt währenddessen nichtterminal. Ein Recovery-Claim erkennt auch
nach Prozessabbruch jede aktive Instanz mit einem solchen Create-Lauf und führt
die Postconditions fort oder setzt Instanz und Elternlauf innerhalb der
festgelegten Deadline auf `failed`. Die UI darf dieses Fenster niemals als
abgeschlossene Anlage darstellen.

Jede nichtterminale Stufe besitzt einen persistenten Wake-up-/Lease-Zustand,
begrenzte Wiederholungen und eine Deadline. Technische Transienten werden
erneut versucht; fachliche Blocker oder eine überschrittene Deadline enden
terminal in `failed`.

### 7. Fehler- und Retry-Vertrag

Bei `failed` bleiben alle bis dahin erzeugten Artefakte erhalten. Runtime,
Directory und Modulzugriff müssen den Tenant trotz vorhandener Route anhand
des fachlichen Status beziehungsweise der Lifecycle-Readiness fail-closed
behandeln. Diagnose und Audit speichern Stufe, stabilen Fehlercode,
Kindlauf-Korrelation und redigierte Postcondition-Evidenz.

Ein autorisierter Retry reconciled jede Stufe gegen den aktuellen, zum
Sollsnapshot passenden Ist-Zustand. Bereits korrekte Routerdateien,
Keycloak-Clients oder Lifecycle-Evidenz werden validiert und weiterverwendet.
Parallele Create-/Retry-Anfragen für dieselbe Instanz dürfen höchstens einen
wirksamen Elternlauf besitzen.

## Bestandsmigration

Die bestehenden statischen Hosts werden ohne Unterbrechung einzeln übernommen:

1. File Provider mit leerem Ordner aktivieren und alle Bestandsrouter prüfen.
2. Für genau einen Bestands-Tenant eine dynamische Route mit explizit höherer
   Priorität veröffentlichen.
3. Routerauswahl, Einzelzertifikat, Studio-Login und gegebenenfalls SSF-
   Readiness extern prüfen.
4. Den Host erst danach aus der statischen Docker-Label-Regel entfernen und die
   verbleibenden Hosts erneut prüfen.
5. Den Vorgang nacheinander für `tenant-havelland`, `svs` und weitere
   Bestands-Tenants wiederholen.

`svs` darf wegen des aktuellen Login-500 nicht als erfolgreiche Migration
gelten. Seine Route darf für Diagnose erhalten bleiben, während Instanz und
Elternlauf fail-closed bleiben.

## Sicherheitsgrenzen

| Grenze                             | Vertrag                                                                             |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| Admin → Create-API                 | Root-Administration, frische Re-Authentisierung, strikte Hostvalidierung            |
| Create-API → Elternlauf            | Instanz, Idempotenz-Snapshot und ausführbarer Startzustand ohne verlorenes Wake-up  |
| Elternlauf → Keycloak-Kindlauf     | Explizite Run-/Snapshot-Korrelation; keine fremde oder veraltete Erfolgsevidenz     |
| Elternlauf → Plugin-Lifecycle      | Nur aktuelle modulbezogene Readiness; keine Freigabe durch Directory-Filter allein  |
| Provisioner → Konfigurationsordner | Nur ein Zielverzeichnis schreibbar; deterministische Dateinamen; kein Docker-Socket |
| Traefik → Konfigurationsordner     | Nur lesbar; keine Rückschreibmöglichkeit                                            |
| Öffentlicher Smoke → Tenant/SSF    | Exakter SNI/Host, erwarteter Realm, Callback, Audience, Tenant und Revision         |
| UI → Elternlauf                    | Reine Beobachtung; kein Polling als Recovery- oder Fortschrittsmechanismus          |

## Cross-Repository-Lieferung

1. PR #1339 oder ein gleichwertig freigegebener Nachfolger etabliert zuerst den
   vollständigen SSF-Readiness-Vertrag.
2. `smart-speech-flow` liefert File Provider, Read-only-Verzeichnis und
   Traefik-Vertragstests ohne Änderung der vorhandenen Router.
3. `sva-studio` liefert Elternlauf-Orchestrierung, Ingressmodul und
   Provisioner-Erweiterung zunächst bei ausgeschaltetem Kassel-Modus.
4. Die Control-Plane-UI wechselt auf den terminalen Elternlaufvertrag.
5. Kassel aktiviert beide freigegebenen Artefakte und migriert Bestandsrouten
   einzeln mit Live-Evidenz.

Der Studio-Rollout folgt weiterhin ausschließlich dem kanonischen
Build-/Promote-Prozess. Die SSF-Infrastrukturänderung besitzt einen eigenen PR
und ihren dortigen Rolloutnachweis.

## Rollback und Recovery

Der Kassel-Modus kann deaktiviert werden, ohne Registry, Keycloak, Secrets oder
Lifecycle-Daten zu löschen. Für noch nicht migrierte Hosts bleibt die statische
Route unverändert. Für einen bereits migrierten Host wird die gesicherte
explizite Docker-Label-Regel wiederhergestellt und extern geprüft, bevor seine
dynamische Datei deaktiviert wird.

Ein Rollback der App und des Provisioners beachtet den bestehenden
Queue-Drain-/Snapshot-Kompatibilitätsvertrag. Nichtterminale Elternläufe werden
vor dem Versionswechsel entweder mit dem bisherigen Worker terminalisiert oder
nach einem dokumentierten kompatiblen Recovery-Pfad übernommen; sie dürfen
nicht unsichtbar offen bleiben.

## Verworfene Alternativen

- **Wildcard-Zertifikat plus `HostRegexp`:** Ohne DNS-01 nicht sicher
  ausstellbar; außerdem würde ein Catch-all unbekannte Hosts unnötig routen.
- **Compose-/Docker-Mutation aus Studio:** Benötigt hochprivilegierten
  Docker-Zugriff und koppelt Tenant-Anlage an Container-Recreation.
- **Zweiter Graphile- oder allgemeiner Job-Stack:** Passt nicht zur inzwischen
  etablierten spezialisierten PostgreSQL-Queue und verdoppelt Claim-, Lock- und
  Upgrade-Ownership.
- **Separater Ingress-Worker zusätzlich zum Standalone-Provisioner:** Reduziert
  zwar die kombinierte Berechtigung eines Prozesses, erzeugt aber eine weitere
  persistente Übergabe- und Recovery-Grenze. Das begrenzte Writer-Mount im
  bereits dedizierten Provisioner ist für den Kassel-Scope proportionaler.
- **Manueller PR oder Compose-Edit pro Tenant:** Auditierbar, aber kein
  terminaler und vollautomatischer Create-Pfad.
- **Directory-Filter als Readiness-Mechanismus:** Bleibt eine letzte
  fail-closed Sicherung, verhindert aber keinen unvollständigen
  Erstinstallationszustand.
- **Browser-Polling als Orchestrierung:** Verliert Arbeit bei Navigation,
  Tab-Schluss oder Netzwerkabbruch und ist daher kein Recovery-Mechanismus.
