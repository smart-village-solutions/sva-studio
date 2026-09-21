# Design: Verifizierte und entkoppelte Tenant-Erstellung

## Context

Der bestehende Instanzpfad besitzt bereits eine zentrale Registry,
idempotente Create- und Provisioning-Runs, Keycloak-Preflight und -Plan,
Worker-Leasing, ein Instanz-Cockpit sowie kritische, challenge-geschützte
Statusaktionen. Diese Bausteine werden beibehalten.

Die maßgeblichen Lücken liegen an ihren Übergängen:

- Der aktuelle Keycloak-Preflight benötigt eine bereits gespeicherte Instanz.
- Bestands-Realms werden als Freitext angegeben und erst nach der Anlage
  gelesen.
- Die Eigentümerschaft gleichnamiger Clients und Benutzer ist nicht allgemein
  beweisbar.
- Background-Bereitschaft ist vor der Anlage nicht sichtbar.
- Ein Teil der technischen Vorbereitung läuft im Create-Commit.
- Der Kasseler Elternlauf setzt die Instanz automatisch auf `active`.
- Fehler- und Retry-Verträge sind nicht für jeden Schritt handlungsfähig.

Der Umbau betrifft UI, HTTP, Registry, Keycloak, Worker, MCP und
Betriebsnachweise. Er verändert eine sicherheitsrelevante Trust Boundary und
wird deshalb durch `assurance.md` begleitet.

## Goals

- Menschliche Fehleingaben vor der ersten Mutation erkennen oder technisch
  ausschließen.
- Keycloak-Verfügbarkeit und die notwendige Admin-Berechtigung als
  verbindliches Gate vor der Tenant-Persistenz etablieren.
- Nicht kritische Background-Fähigkeiten von der fachlichen Tenant-Anlage
  entkoppeln, ohne angenommene Arbeit vorzutäuschen.
- Bestands-Realms auswählbar, eigentumssicher und nachvollziehbar ergänzbar
  machen.
- Readiness, Plan, Mutation, Postflight und Aktivierung als getrennte,
  korrelierbare Schritte führen.
- Fehler immer dem betroffenen Feld oder Schritt zuordnen und nur sichere
  Folgeaktionen anbieten.
- UI und MCP auf denselben serverseitigen Fachvertrag binden.
- Kassel demselben fachlichen Tenant-Flow unterwerfen und
  umgebungsspezifische Unterschiede auf technische Capabilities begrenzen.

## Non-Goals

- Keine zweite Instanz-Registry oder alternative Provisioning-Orchestrierung.
- Keine generische Workflow-Engine und kein neuer Queue-Provider.
- Keine automatische Reparatur fremder oder nicht eindeutig zuordenbarer
  Keycloak-Artefakte.
- Keine Aufweichung bestehender Secret-, Logging-, Autorisierungs-,
  Idempotenz- oder Tenant-Isolationsregeln.
- Kein Browser-Credential-Lifecycle innerhalb eines Background-Workers.
- Keine Definition eines zweiten Studio-Rolloutpfads.
- Kein Kassel-spezifischer fachlicher Create-, Status-, Retry- oder
  Aktivierungsautomat.

## Terminology

- **Draft**: noch nicht persistierte Tenant-Konfiguration.
- **Create-Readiness**: read-only Prüfung des Drafts und seiner aktuellen
  externen Vorbedingungen.
- **Anlageblocker**: verhindert die Registry-Persistenz.
- **Bereitstellungsblocker**: erlaubt die Registry-Persistenz, verhindert aber
  einen oder mehrere technische Schritte.
- **Aktivierungsblocker**: erlaubt Anlage und Reparatur, verhindert aber
  `active`.
- **Realm-Eignung**: `ready`, `auto_completable` oder
  `manual_resolution_required`.
- **Plan-Fingerprint**: stabiler Fingerprint aus Sollzustand, relevantem
  Readback und Vertragsversion, an den eine Bestätigung gebunden ist.

## Decisions

### 1. Ein gemeinsamer Draft-Readiness-Vertrag

Der bestehende Instanz-Service erhält eine read-only Operation für einen noch
nicht persistierten Draft. UI und MCP verwenden denselben Vertrag. Da der
Draft optionale Secrets enthalten kann, wird die Operation als body-basierter
Read modelliert und niemals über Query-Parameter, Logs oder Telemetrie
transportiert.

Die Antwort enthält mindestens:

- die geprüfte, normalisierte fachliche Identität,
- `checkedAt` und die verwendete Vertragsversion,
- einen Draft-Fingerprint ohne Secretwerte,
- getrennte Befunde für Anlage, Bereitstellung und Aktivierung,
- bei `existing` die Realm-Eignung und einen konkreten, noch nicht
  ausführbaren Änderungsplan,
- pro Befund Code, Status, Auswirkung, sichere Behebung, Zuständigkeit,
  Folgeprüfung und optional eine Request-ID.

Die UI-Prüfung ist beratend. Der Create-Endpunkt führt dieselben
anlageblockierenden Prüfungen unmittelbar vor der Registry-Persistenz erneut
aus. Ein Client-Token oder eine alte UI-Antwort kann diese authoritative
Prüfung nicht ersetzen.

Die vorhandene Projektion wird ohne paralleles Statusmodell wiederverwendet:

| Aussage                   | Führende vorhandene Felder                                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| fachlicher Tenant-Zustand | `instances.status`, insbesondere `requested`, `validated`, `provisioning`, `active` und `failed`                                        |
| dauerhafter Elternlauf    | `instance_provisioning_runs.status`, `stepKey`, `desiredSnapshot`, `childKeycloakRunId`, Lease, Deadline, Fehler und `terminalEvidence` |
| Keycloak-Ausführung       | bestehender Keycloak-Run mit `overallStatus`, typisierten Schritten, `payloadFingerprint`, Request- und Akteurbindung                   |
| Readiness                 | bestehende Preflight-, Keycloak-, Tenant-IAM-, Modul-, Ingress- und TLS-Evidenz in Detail- und Run-Projektionen                         |
| sichere Diagnose          | bestehende Fehlercodes, Schrittbezug, Request-ID und redigierte Details; keine Providertexte oder Secrets                               |

`awaiting_activation` wird als fachliche Projektion aus `instances.status =
validated`, einem abgeschlossenen Create-Elternlauf und aktuell fehlenden
Aktivierungsblockern dargestellt. `provisioning_waiting` und
`provisioning_blocked` werden entsprechend aus laufendem beziehungsweise
fehlerhaftem Elternlauf, nächstem Versuch und den aktuellen Capability-Befunden
abgeleitet. Dafür entsteht weder eine neue Datenbankspalte noch ein zusätzlicher
persistenter Lifecycle; die bestehenden Runs bleiben die führende technische
Quelle.

### 2. Keycloak ist synchrones Create-Gate

Vor dem Insert prüft der Server read-only:

- Erreichbarkeit des konfigurierten Keycloak,
- Authentisierung und die für den jeweiligen Realm-Modus erforderliche
  Admin-Berechtigung,
- bei `new` die sichere Ableitung des Realm-Namens, die Abwesenheit eines
  kollidierenden Realm und die nachgewiesene Create-Fähigkeit,
- bei `existing` Listbarkeit, Lesbarkeit, Auswahlstatus und Eignung des
  konkreten Realm.

Die Prüfung mutiert Keycloak nicht. Schlägt sie fehl, entsteht weder
Registry-Tenant noch Provisioning-Auftrag.

Kann Keycloak nach erfolgreichem Registry-Commit nicht mehr erreicht werden,
bleibt der Tenant erhalten. Der Ausfall wird als Bereitstellungsblocker am
Tenant persistiert beziehungsweise aus dem führenden Run projiziert.

### 3. Autorisierter Realm-Katalog statt Freitext

Der Keycloak-Admin-Pfad erhält eine paginierbare und durchsuchbare
Realm-Discovery. Die Antwort enthält ausschließlich die für die Auswahl
erforderlichen Daten:

- stabilen Realm-Namen,
- Auswahlstatus `selectable` oder `disabled`,
- stabilen Grundcode wie `system_realm`, `already_assigned` oder
  `not_readable`,
- bei belegten Realms höchstens die sichere Studio-Zuordnung, soweit sie für
  Root-Administratoren erforderlich ist.

`master` ist immer deaktiviert und wird auch bei direktem API- oder MCP-Aufruf
serverseitig abgelehnt. Bereits einer anderen Instanz zugeordnete Realms
bleiben sichtbar, sind aber nicht auswählbar. Die eindeutige
Registry-Constraint bleibt als Race-Schutz bestehen.

Freitext ist kein regulärer UI- oder MCP-Pfad. Ein späterer expliziter
Recovery-Pfad wäre eine eigene, besonders autorisierte Anforderung und ist
nicht Bestandteil dieses Changes.

### 4. Realm-Eignung und Ownership bestimmen den Plan

Die read-only Prüfung ordnet einen Bestands-Realm genau einer Klasse zu:

- `ready`: keine anlageblockierende Abweichung,
- `auto_completable`: es fehlen ausschließlich erlaubte Studio-Artefakte oder
  eindeutig Studio-eigene Werte weichen ab,
- `manual_resolution_required`: mindestens ein Konflikt unklarer oder fremder
  Eigentümerschaft beziehungsweise eine nicht automatisch verwaltete
  Realm-Voraussetzung ist vorhanden.

Fehlende Artefakte dürfen als automatisch ergänzbar gelten. Vorhandene
Artefakte dürfen nur verändert werden, wenn ihre Studio-Ownership und Bindung
an genau diese Instanz beweisbar sind. Für Legacy-Artefakte ohne Marker ist
eine ausdrücklich dokumentierte, eng begrenzte Übernahmeentscheidung
erforderlich; bloße Namensgleichheit reicht nicht.

Diese Regel gilt für Login-Client, Tenant-Admin-Client, Plugin-Clients,
Protocol Mapper, Studio-Rollen und Tenant-Admin. Fremde Clients, Rollen oder
Benutzer sowie IdP, Federation, SMTP und realmweite Sicherheitsrichtlinien
werden nicht automatisch verändert.

Clients tragen dafür die Attribute `managed_by=studio`, `instance_id=<id>`
und einen artefaktspezifischen `artifact_key`; der Tenant-Admin führt dieselben
Werte als einwertige Benutzerattribute. Studio-Rollen behalten ihre bestehenden
einwertigen Marker `managed_by`, `instance_id` und `role_key`. Mapper werden
nur unter einem so nachgewiesen eigenen Client verwaltet und erben damit dessen
Ownership-Grenze. Fehlt ein Marker, ist er mehrwertig oder widersprüchlich,
gilt das Artefakt als fremd beziehungsweise ungeklärt. Der Plan weist den
Schritt dann als blockiertes `skip` aus; weder Readiness noch Execute dürfen
das Artefakt übernehmen, aktualisieren, löschen oder sein Secret rotieren.

### 5. Fachliche Anlage endet am dauerhaften Registry-Sollzustand

Der Create-Commit enthält nur die dauerhaft erforderlichen Registry-Daten,
den Audit-Eintrag und den minimalen persistenten Bereitstellungsauftrag
beziehungsweise eine gleichwertige Wake-up-sichere Sollprojektion.

Fehlende laufende Worker, externe Callbacks oder nachgelagerte
Provisioner-Fähigkeiten dürfen den Commit nicht zurückrollen. Ihre
Verfügbarkeit wird vorab bewertet und nach dem Commit als
`provisioning_waiting` oder `provisioning_blocked` projiziert.

Eine nicht mögliche Registry-Persistenz oder das Fehlen des minimalen
dauerhaften Auftrags ist weiterhin ein Anlageblocker: Ohne beweisbar
gespeicherten Sollzustand darf das System keine erfolgreiche Tenant-Anlage
melden.

Externe Wake-ups erfolgen nach Commit. Ihr Fehlschlag wird beobachtbar
gespeichert und durch den bestehenden Recovery-/Claim-Pfad heilbar, nicht als
Rollback der fachlichen Anlage behandelt.

### 6. Planbestätigung ist snapshotgebunden

Der bestehende Registry-Service erzeugt vor der ersten Mutation einen
versionierten Plan aus normalisiertem Sollzustand, relevanter Ausgangsevidenz,
Ownership und Vertragsversion. Die ausdrückliche Bestätigung bindet diesen
Fingerprint, Instanz, Intent und berechtigten Akteur. Der bestehende Run
persistiert Planbindung und Fortschritt; es entsteht kein zweiter Plan-Service.
UI und MCP zeigen denselben serverseitigen Plan. Die Planpflicht betrifft
Keycloak-Mutationen der hier beschriebenen Instanz-Provisioning- und
MCP-Instanzprozesse, einschließlich ihrer nachgelagerten Rollenabgleiche.
Die allgemeine tenantlokale Benutzer-/Rollenverwaltung erhält dadurch keinen
zusätzlichen Plan-Workflow.

Vor Ausführung und Wiederaufnahme prüft der Worker die relevanten
Vorbedingungen erneut. Fremde Änderungen an Sollzustand, Ownership,
Vertragsversion oder relevanten Secret-Versionen sowie zusätzlicher
Mutationsumfang entwerten die Bestätigung. Ein neuer Plan muss ausdrücklich
bestätigt werden; automatisches Rebasieren einer Freigabe ist unzulässig.

Nachgewiesene eigene Effekte eines bestätigten Schritts sind dagegen Fortschritt
innerhalb desselben Plans. Für die vorhandenen Schritte werden die relevanten
Vor- und Nachbedingungen konkret festgelegt. Run-/Schrittevidenz und aktueller
Readback müssen den Effekt und seine Instanz-/Ownership-Bindung belegen.
Der Fingerprint der Freigabe bleibt dabei unverändert; Fortschritt wird separat
im bestehenden Run geführt. Ein geplanter Secret-Abgleich darf so seine eigene
Registry-Revision ändern, ohne fremde Secret-Änderungen zu legitimieren.

Nach einem Crash zwischen externem Write und lokaler Quittung erfolgt zuerst
Readback. Nur ein eindeutig dem bestätigten Schritt zurechenbarer Effekt wird
als erledigt übernommen. Namensgleichheit oder ein lediglich passender
Zielzustand beweisen diese Zuordnung nicht. Bleibt sie unklar, stoppt der Run
mit Diagnosebedarf; insbesondere werden Secret-Rotation, Passwort-Reset und
fremde Artefakte nicht blind erneut mutiert. Bewiesene Teilerfolge bleiben
erhalten, ausschließlich verbleibende bestätigte Schritte dürfen fortgesetzt
werden. Lease-/Claim-Regeln bleiben bestehen; der Plan ist keine generische
Workflow-Beschreibung.

### 7. Aktivierung bleibt ausschließlich manuell

Provisioning-Worker, Recovery-Scheduler und MCP-Gesamtprozess dürfen
`instance.status = active` nicht setzen. Nach erfolgreicher technischer
Bereitstellung endet der Prozess in einem explizit ausweisbaren Zustand
`awaiting_activation`; die konkrete Persistenzform wird im vorhandenen Run-
und Read-Modell umgesetzt, ohne eine zweite Lifecycle-Quelle zu schaffen.

Die kritische Aktivierungsaktion:

- benötigt den bestehenden action-spezifischen Scope,
- benötigt Idempotenz und eine ausdrückliche menschliche Bestätigung,
- verwendet im Browser die bestehende Session-, CSRF- und Fresh-Reauth-Prüfung;
  der bestätigte Request bindet Instanzrevision und Evidenzrevision,
- verwendet für MCP den bestehenden Service-Account-Vertrag aus ADR-047 mit
  action-spezifischer Autorisierung und kurzlebiger Einmal-Challenge samt
  exakter Bestätigungsphrase; Browser-Fresh-Reauth ist hier nicht erforderlich,
- bindet die MCP-Challenge zusätzlich an Akteur, Instanz, Aktion sowie aktuelle
  Instanz- und Evidenzrevision; ein MCP-Gesamtprozess bestätigt sie niemals selbst,
- prüft unmittelbar vor dem Statuswechsel alle blockierenden Achsen erneut,
- lehnt veraltete, fehlende oder widersprüchliche Evidenz fail-closed ab,
- auditiert Entscheidung, Evidenzrevision und Ergebnis.

Eine bloße Erreichbarkeit, ein erfolgreicher Keycloak-Run oder ein
Registry-Status genügt nicht. Maßgeblich sind mindestens aktueller
Keycloak-Postflight, Secret-Abgleich, OIDC-Konfiguration einschließlich
Issuer, Redirect-/Callback-URLs und PKCE, Ingress/TLS, Tenant-IAM und
Modul-Readiness sowie ausdrücklich blockierende manuelle Nacharbeiten.
Diese Prüfungen verwenden die vorhandenen serverseitigen Readbacks und Probes,
die ohne aktiven Tenant ausführbar sind. Ein erwarteter Zugriffsschutz für
inaktive Tenants ist kein fehlgeschlagener Bereitschaftsnachweis.

Eine Browserabnahme oder ein erfolgreicher interaktiver Login-/Gateway-Aufruf
ist weder vor noch nach der Aktivierung ein Pflichtschritt der Tenant-Erstellung.
Es gibt keinen zusätzlichen Abnahmestatus, Freigabeschritt oder Sonderzugang
für inaktive Tenants. Nach erfolgreicher technischer Prüfung und ausdrücklich
bestätigter Aktivierung ist die Einrichtung abgeschlossen. Normale Auth- und
Tenant-Isolationsregeln gelten unverändert; Browser-/E2E-Tests bleiben Teil
der Entwicklungsqualität und werden nicht zu Betreiberaufgaben pro Tenant.

Der Kasseler Elternlauf wird in den gemeinsamen Tenant-Flow überführt. Seine
technischen Schritte liefern Evidenz an denselben Aktivierungsvertrag; weder
Instanz noch Elternlauf wechseln dadurch automatisch auf `active`.

### 8. Strukturierter Fehler- und Retry-Vertrag

Jeder vorab oder später entstehende Befund kann folgende sicheren Felder
tragen:

- `code` und `category`,
- `affectedField` oder `affectedStep`,
- laienverständliche `summary`,
- `impact` auf Anlage, Bereitstellung oder Aktivierung,
- `remediation` und `responsibility`,
- `verificationAction` beziehungsweise erlaubte nächste Aktion,
- `retryable` und eine schrittbezogene `retryClass`,
- `requestId` und gegebenenfalls Run-ID.

Die Werte enthalten keine Secrets, PII, Stacktraces oder unkontrollierte
Providertexte. Unbekannte Fehler sind nicht retrybar, bis ihre sichere
Wiederholbarkeit aus Code und persistierter Commit-Evidenz hervorgeht.

Ein manueller Retry setzt am ersten nicht nachgewiesenen, sicher
wiederholbaren Schritt fort. Erfolgreiche, zum aktuellen Snapshot gehörende
Teilschritte werden nicht pauschal wiederholt. Ist der Commit-Zustand
unbekannt, verweist die Antwort auf Diagnose und Korrelation statt auf einen
blinden Retry.

### 9. UI und MCP bleiben Adapter desselben Fachvertrags

Die UI:

- validiert alle Schritte erneut vor Submit,
- ordnet Fehler Feldern mit zugänglicher Beschreibung und Fokusführung zu,
- zeigt Realm-Auswahl, Eignung und geplante Änderungen vor der Bestätigung,
- trennt Anlage-, Bereitstellungs- und Aktivierungsblocker,
- bietet Provisioning, Retry und Aktivierung nur bei serverseitig zulässiger
  nächster Aktion an.

Der MCP-Pfad:

- bietet Realm-Discovery und Draft-Readiness als read-only Tools,
- ruft für Create denselben authoritative Serververtrag auf,
- übernimmt nur explizit als idempotente payloadgleiche Wiederholung
  bestätigte Konflikte,
- liefert bei Teilfortschritt Instanz-ID, erledigte und offene Schritte sowie
  die sichere nächste Aktion,
- empfiehlt Aktivierung erst nach vollständig aktueller Doctor-Readiness.

Für `create`, `repair` und `adapt` hält der bestehende MCP-Gesamtprozess vor
jeder nicht bereits freigegebenen Keycloak-Mutation mit `awaiting_human_action`
und `completed: false` an. Er liefert Instanz-ID, Intent, Plan-Fingerprint,
Planübersicht und die serverseitig erlaubte nächste Aktion. Das gilt auch für
Reconcile und nachgelagerte Rollenänderungen: Ein anderer Endpunkt darf die
Planbindung nicht umgehen. Änderungen außerhalb des Keycloak-Plans behalten
ihre bestehenden Autorisierungsverträge.

Nach ausdrücklicher menschlicher Bestätigung nutzt MCP die vorhandene
Execute-/Reconcile-Aktion mit dem geprüften Fingerprint. Der Server autorisiert
den ausführenden Akteur erneut und persistiert die Bindung am Run. Ein alter,
fremder oder zum Intent unpassender Fingerprint startet keine Mutation.
Die anschließende Wiederaufnahme liest den vorhandenen Run und dessen
Fortschritt; sie legt weder die Instanz erneut an noch einen zweiten Lauf an.
Ein Tool-Timeout beendet nur das Warten des Clients, nicht den Serverauftrag.
Ein Kanalwechsel UI/MCP benötigt keine Übertragung einer Bestätigung: Beide
lesen denselben autorisierten Run; neue Aktionen benötigen ihre eigenen
Identitätsnachweise. Aktivierung bleibt eine separate kritische Aktion.

Weder UI noch MCP rekonstruieren sicherheitsrelevante Gating-Entscheidungen
aus lokalen Heuristiken. Fachliche Prüfungen, Plan und Projektion bleiben in
`@sva/instance-registry`; HTTP-Authentisierung und transportbezogene Nachweise
in `@sva/auth-runtime`. `@sva/studio-mcp` konsumiert ausschließlich die
Studio-HTTP-API; die App bleibt UI-Adapter und Composition Root.
Der Registry-Service führt Planbindung und Freigabe des Instanzprozesses;
fachliche Rollenabgleiche bleiben im vorhandenen `@sva/iam-admin`-Pfad.
Es wird keine IAM-Fachlogik in die Registry dupliziert.

### 10. Kassel ist ein Betriebsprofil und kein paralleler Tenant-Flow

Die Kasseler Standalone-Installation verwendet dieselben fachlichen
Übergänge und Verträge wie jede andere Installation:

- dieselbe Realm-Discovery und Draft-Readiness,
- dieselben anlageblockierenden Keycloak-Prüfungen,
- denselben atomaren Registry- und Auftrags-Commit,
- dieselben Bereitstellungs- und Aktivierungsblocker,
- denselben bestätigten Keycloak-Plan,
- dieselben Fehler-, Remediation- und Retry-Regeln,
- dieselbe ausschließlich manuelle Aktivierung.

Der Kasseler Provisioner bleibt zuständig für die technischen Capabilities
seines Betriebsprofils, insbesondere dynamischen Ingress, TLS und die dort
benötigten Readiness-Probes. Diese Beiträge werden als Schritte des
gemeinsamen persistenten Provisioning-Auftrags ausgeführt. Sie dürfen keinen
zweiten fachlichen Create-Endpunkt, keinen abweichenden Lifecycle und keine
eigene Aktivierungsentscheidung bilden.

Der bisherige Kasseler Elternlauf wird in die gemeinsame Zustandssemantik
überführt. Seine spezifische technische Evidenz bleibt erhalten und fließt in
die allgemeine Aktivierungsentscheidung ein; sie ersetzt weder andere
Nachweise noch die menschliche Freigabe.

### 10.1 Abgleich mit den überlappenden aktiven Changes

- `automate-keycloak-realm-baseline` bleibt Eigentümer der New-Realm-Baseline.
  Dessen Verbot automatischer Baseline-Writes in Bestands-Realms hat Vorrang;
  dieser Change ergänzt dort nur eigentumsgeprüfte Instanzartefakte.
- `add-plugin-tenant-lifecycle` bleibt Eigentümer von Lifecycle-Generation,
  Queue, Claim und Recovery. Diese Zustände werden als technische
  Bereitstellungsevidenz projiziert, bilden aber keinen zweiten Create- oder
  Aktivierungspfad.
- `fix-tenant-iam-doctor-evidence` bleibt Eigentümer der getrennten
  Provisioner-, Tenant-IAM- und Diagnoseidentitäten. Doctor-Evidenz darf eine
  Aktivierung blockieren, aber weder Keycloak-Create-Gates ersetzen noch einen
  interaktiven Browsernachweis in den Worker verschieben.
- `automate-kassel-tenant-ingress` behält ausschließlich Ingress-, TLS- und
  profilspezifische Readiness-Schritte. Dessen bisheriger automatischer
  `active`-Übergang ist aufgehoben; der Elternlauf endet nach technischer
  Abnahme im gemeinsamen wartenden Zustand bis zur manuellen Aktivierung.

### 11. Gemeinsamer geführter UI-Flow mit progressiver Offenlegung

Die Instanz-Anlage verwendet einen gemeinsamen vierstufigen Ablauf für
Einsteiger und Experten:

1. **Instanz:** Anzeigename, freigegebene Domain und Vorschau der späteren
   Adresse. Die Instanz-ID wird vorgeschlagen und ist nur unter
   `Technische Details` vor der Anlage änderbar.
2. **Nutzer-Datenbank (Keycloak-Realm):** Wahl zwischen einer neuen
   Nutzer-Datenbank und einer vorhandenen Nutzer-Datenbank. Vorhandene Realms
   werden ausschließlich über den Realm-Katalog gewählt und sofort
   hinsichtlich ihrer Eignung bewertet.
3. **Erster Administrator:** Vollständiges Pflichtprofil aus Benutzername,
   E-Mail-Adresse, Vorname und Nachname. Ein Benutzername darf aus der
   E-Mail-Adresse vorgeschlagen, aber nicht ungeprüft übernommen werden.
4. **Prüfen und anlegen:** Die serverseitige Readiness wird in
   `Vor der Anlage zu beheben`, `Wird von Studio eingerichtet` und
   `Vor der Aktivierung noch erforderlich` gegliedert.

Die Oberfläche spricht durchgängig von
`Nutzer-Datenbank (Keycloak-Realm)`. `Realm` darf in technischen Details,
Codes und Diagnoseinformationen vorkommen, ist aber nicht die alleinige
Bezeichnung im geführten Pfad.

Die Studio-Instanz wird aus dem Umgebungskontext gelesen und nicht vom
Benutzer gewählt. Die beiden bestehenden Studio-Instanzen werden in der UI
exakt als `Smart Village App` und `KasselDIALOG` bezeichnet. Insbesondere
`Kassel`, `Standalone` oder interne Profilkennungen sind keine
benutzerseitigen Ersatznamen. Die angezeigte Studio-Instanz ändert keinen
fachlichen Schritt und keine Gate-Regel.

Technische Werte wie Auth-Client-ID, Issuer-URL, Tenant-Admin-Client-ID und
abgeleitete Host-/Realm-Werte sind im Standardpfad keine freien Eingaben.
Studio leitet sie aus Vertrag und Umgebung ab und zeigt sie bei Bedarf
read-only unter `Technische Details`. Ein noch fehlendes Bestands-Secret
bleibt ein sichtbarer Bereitstellungs- und Aktivierungsblocker, aber kein
Anlageblocker; es wird erst in der dafür vorgesehenen sicheren Aktion
erfasst oder abgeglichen.

Nach der Registry-Persistenz wechselt die UI ohne separate Setup-Strecke in
das gemeinsame Einrichtungscockpit der Instanz. Es zeigt die fachliche
Fortschrittsfolge:

1. Instanz angelegt,
2. Bereitstellung vorbereitet,
3. Änderungen bestätigt,
4. technische Bereitstellung,
5. Betriebsbereitschaft geprüft,
6. manuelle Aktivierung.

Das Cockpit bietet höchstens eine hervorgehobene, vom Server erlaubte nächste
Aktion. Preflight, Keycloak-Status und Plan werden automatisch geladen
beziehungsweise über ein gemeinsames `Erneut prüfen` aktualisiert. Der
Standardpfad zeigt weder parallele Mutationsschaltflächen noch einen
generischen Retry.

Experten öffnen am jeweiligen Befund `Technische Details`. Dort bleiben
Plan-Fingerprint, einzelne Checks, Run-/Request-IDs, Zeitpunkte,
Diagnoseinformationen und Historie verfügbar. Wartungs-Intents wie
`Tenant-Admin zurücksetzen` oder `Client-Secret rotieren` bleiben
zustandsgebunden erhalten, erscheinen aber nicht als konkurrierende
Hauptaktionen.

Damit entfallen nach Bereitstellung des Cockpits:

- die separate Setup-Seite als zweiter fachlicher Folgepfad,
- frei editierbare technische Standardfelder,
- clientseitig konstruierte Readiness,
- getrennte Hauptkarten und Aktionen für Preflight, Keycloak-Status,
  Planvorschau und Provisioning,
- das allgemeine temporäre Passwortfeld außerhalb des gezielten
  Tenant-Admin-Reset-Intents,
- generische Wiederholungsaktionen ohne serverseitig bestätigte
  Retry-Klasse.

## State and Data Flow

1. UI oder MCP lädt den Realm-Katalog beziehungsweise erfasst einen New-Realm-
   Draft.
2. Draft-Readiness prüft Eingaben, Registry-Konflikte, Keycloak und
   Background-Fähigkeiten read-only.
3. Der Benutzer prüft Blocker, Auswirkungen und bei `existing` den
   Änderungsplan.
4. Create wiederholt die Anlage-Gates und persistiert Registry-Sollzustand,
   Audit und dauerhaften Bereitstellungsauftrag atomar.
5. Externe Wake-ups und Worker übernehmen ausschließlich die technische
   Bereitstellung.
6. Vor Keycloak-Mutation entstehen aktueller Preflight und bestätigter Plan.
7. Worker führen sichere Schritte idempotent aus und persistieren Postflight
   sowie verbleibende Blocker.
8. Der Tenant wartet nach technischer Abnahme auf manuelle Aktivierung.
9. Aktivierung prüft aktuelle Evidenz erneut und setzt erst danach `active`.

Für Kassel werden zwischen den allgemeinen Schritten die
betriebsprofilspezifischen Ingress-, TLS- und Readiness-Schritte ausgeführt.
Die fachliche Reihenfolge und die Zustandsübergänge bleiben identisch.

## Trust Boundaries

- Browser beziehungsweise MCP zu Studio-API: Eingaben sind untrusted;
  serverseitige Validierung und Autorisierung sind maßgeblich.
- App-Prozess zu privatem Provisioner: Nur Realm-Katalog, Draft-Readiness und
  Registry-Create werden mit exakter Methoden-/Pfad-Allowlist weitergeleitet.
  Der Provisioner validiert Session oder Service-Account, CSRF und
  `instance.create` erneut; bei Ausfall existiert kein lokaler Fallback.
- Studio zu Keycloak Admin API: Realm-Liste und Readback sind externe
  Evidenz; Providertexte werden klassifiziert und redigiert. Die globale
  Provisioner-Identität bleibt ausschließlich im privaten Provisioner-Prozess.
- App zu Provisioning-Worker: Nur persistierte, versionierte Sollzustände und
  Claims gelten; In-Memory-Zustand ist keine Worker-Konfiguration.
- Worker zu Ingress, Modulen und weiteren Zielsystemen: Ausfälle sind
  Bereitstellungsbefunde, keine stillen Create-Erfolge.
- Aktivierungsaktion zu Runtime-Freigabe: `active` ist ein sicherheitskritischer
  Gate-Wechsel und benötigt aktuelle, revisionsgebundene Evidenz.

## Alternatives Considered

### Bestandslogik nur in der UI ergänzen

Verworfen. API und MCP könnten die UI-Prüfungen umgehen; außerdem bliebe das
Race zwischen Anzeige und Create ungelöst.

### Keycloak vollständig vom Create entkoppeln

Verworfen. Das widerspricht dem Produktentscheid, dass Studio und insbesondere
die Tenant-Erstellung ohne erreichbares und autorisiertes Keycloak nicht
nutzbar sind.

### Alle technischen Vorbedingungen als Create-Blocker behandeln

Verworfen. Ein fehlender Worker oder nachgelagertes Zielsystem würde die
fachliche Anlage unnötig verhindern und den geforderten reparierbaren
Zwischenzustand ausschließen.

### Automatische Aktivierung nach vollständigem Worker-Smoke beibehalten

Verworfen. Die technische Bereitschaft ersetzt nicht die ausdrücklich
bestätigte Aktivierungsentscheidung des berechtigten Operators.

### Zwei getrennte Changes für Backend und UI

Nicht gewählt. Der gemeinsame serverseitige Gating-Vertrag ist die zentrale
Invariante; getrennte normative Changes würden widersprüchliche
Zwischenzustände begünstigen. Die Umsetzung bleibt dennoch in eigenständig
prüfbare Lieferabschnitte gegliedert.

## Risks and Mitigations

- **Keycloak-Ausfall blockiert nun Create:** Das ist beabsichtigt; die UI zeigt
  Ursache, Auswirkung und erneute Prüfung vor jeder Mutation.
- **Realm-Listenberechtigung ist weitreichend:** Antwortdaten werden minimiert,
  nur für Root-Administratoren autorisiert und nicht tenantöffentlich
  exponiert.
- **Legacy-Artefakte besitzen keine Ownership-Marker:** Sie werden nicht
  automatisch übernommen; eine eng begrenzte Migrationsentscheidung bleibt
  explizit.
- **Preflight wird zwischen Anzeige und Create veraltet:** Create wiederholt
  die maßgeblichen Prüfungen und verlässt sich nicht auf die UI-Antwort.
- **Worker-Ausfall nach Commit:** Persistierter Auftrag und Statusprojektion
  verhindern verlorene Arbeit; Recovery bleibt idempotent.
- **Umstellung des bisherigen Kasseler Sonderablaufs:** Rollout erfolgt erst,
  wenn der gemeinsame Flow, der manuelle Freigabepfad und die wartende
  Projektion verfügbar und getestet sind. Kassel-spezifische Ingress- und
  TLS-Evidenz bleibt dabei als Capability-Beitrag erhalten.
- **Zu breite Retries können Teilerfolge beschädigen:** Retry-Klassen werden
  schrittbezogen und unbekannte Fehler fail-closed.

## Migration and Rollout

1. Read-only Verträge und Projektionen abwärtskompatibel einführen.
2. UI und MCP auf Draft-Readiness und Realm-Katalog umstellen.
3. Authoritative Create-Gates aktivieren und alte Freitextpfade schließen.
4. Ownership-Prüfung und planbestätigte Keycloak-Ausführung aktivieren.
5. Wartende Aktivierungsprojektion und manuelle serverseitige Gates ausrollen.
6. Erst danach den Kasseler Elternlauf vollständig auf den gemeinsamen Flow
   umstellen und seine automatische Aktivierung entfernen.
7. Bestehende nicht aktive Instanzen neu diagnostizieren; keine automatische
   Ownership- oder Aktivierungsentscheidung migrieren.
8. Dev, Staging und Production ausschließlich über den kanonischen
   Build-/Promote-Prozess mit demselben Image-Digest ausrollen.

Ein Rollback darf die automatische Aktivierung nicht still wieder einschalten,
wenn bereits neue manuelle Blocker oder Ownership-Befunde persistiert wurden.
In diesem Fall bleibt der Tenant fail-closed und wird über den vorherigen
kompatiblen Read-/Diagnosepfad betrieben.

## Open Questions

- Welche Legacy-Artefakte besitzen bereits belastbare Ownership-Marker, und
  für welche ist ein separater, ausdrücklich bestätigter Übernahmepfad nötig?
- Welche Background-Capabilities besitzen bereits Heartbeats beziehungsweise
  Readiness-Endpunkte, die ohne neue Kontrollschicht wiederverwendet werden
  können?
