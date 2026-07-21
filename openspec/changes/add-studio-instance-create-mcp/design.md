## Context

Die Instance Registry stellt bereits den idempotenten fachlichen Vertrag für die Anlage von Studio-Instanzen bereit. Die Studio-Control-Plane nutzt diesen Vertrag über einen gesicherten HTTP-Endpunkt. Für Codex und CLI fehlt ein lokaler MCP-Zugang, der auf eine bereits konfigurierte Studio-Umgebung zugreift.

## Goals / Non-Goals

### Goals

- Instanzanlage über ein lokales stdio-MCP-Tool ermöglichen.
- Studio als einzige Autorisierungs-, Audit- und Provisioning-Grenze erhalten.
- Wiederholungen sicher und nachvollziehbar behandeln.
- Geheimnisse auf dem Transportweg schützen und aus Tool-Ausgaben sowie Logs ausschließen.

### Non-Goals

- Keine direkte Datenbank-, Keycloak- oder interne Service-Anbindung aus dem MCP-Prozess.
- Keine Lockerung der Browser-Session-, CSRF- oder Fresh-Reauth-Guards für interaktive Studio-Aufrufe.

## Decisions

### Decision: Lokaler MCP-Server ist ein dünner Studio-API-Client

Ein neues Workspace-Package implementiert einen stdio-MCP-Server und das Tool `studio_instances_create`. Es validiert den bereits geltenden Create-Vertrag, erzeugt oder übernimmt Idempotenz- und Korrelationskennungen und ruft ausschließlich den bestehenden Studio-API-Pfad auf. Die Instance Registry und der Service `createProvisioningRequest` bleiben unverändert der einzige fachliche Schreibpfad.

Alternativen:

- Direkte Datenbank- oder Service-Anbindung: verworfen, da sie Autorisierung, Audit und Betriebsgrenzen umgehen würde.
- MCP-Transport im `instance-registry`-Package: verworfen, da ein serverseitiges Domänenpackage keine lokalen Tool-Credentials oder Transportschicht besitzen soll.

### Decision: Separater Service-Token-Pfad mit Least Privilege

Studio akzeptiert für die MCP-Instanzanlage einen dedizierten Service-Token. Die serverseitige Prüfung bindet mindestens Aussteller, Zielumgebung (`aud`), Ablaufzeit und die Action `instance.create`. Der Token-Subject wird als Maschinenakteur in Audit und strukturierter Korrelation gespeichert. Der Token ersetzt ausschließlich die für Browser-Interaktion konzipierten Session-, CSRF- und Fresh-Reauth-Nachweise dieses expliziten Maschinenpfads. `instance_registry_admin` bleibt eine Plattformrolle für menschliche Root-Administratoren und autorisiert den Maschinenpfad nicht pauschal.

Alternativen:

- Browser-Session mit CSRF und Fresh-Reauth wiederverwenden: verworfen, weil sie für lokale Automatisierung nicht robust und nicht hinreichend maschinenidentifizierbar ist.
- Unbeschränkter Plattformtoken: verworfen, weil er das Least-Privilege-Prinzip verletzt.

### Decision: Konfiguration und Geheimnisse bleiben lokal und nicht persistiert

Basis-URL und Token werden über Umgebungsvariablen oder einen OS-Keychain-Verweis bereitgestellt. Sie dürfen weder in Repository-Konfiguration, MCP-Tool-Antworten, Fehlerdetails noch in Logs erscheinen. Der MCP-Server redigiert Eingaben und Antworten, die Auth-Client- oder Tenant-Admin-Secrets enthalten können.

### Decision: Maschinenlesbarer Fehlervertrag mit begrenzter Read-only-Diagnose

Studio liefert für die Instanzanlage einen versionierten Fehlervertrag. Jedes fehlgeschlagene Ergebnis enthält mindestens einen stabilen `code`, eine `category`, `retryable`, `recommendedAction` sowie `requestId` und `idempotencyKey`. Verständliche Texte ergänzen die Codes, ersetzen sie aber nicht. Der Create-Handler und alle weiteren Mutationspfade verwenden dieselbe serverseitige Fehlerklassifikation; unbekannte Ausnahmen bleiben `internal_unclassified` und dürfen nicht als Keycloak-Fehler umgedeutet werden.

Nach einem Create-Fehler führt der lokale MCP-Server eine begrenzte, zeitlich budgetierte Read-only-Diagnose aus. Sie prüft abhängig von der Fehlerklasse nur sinnvolle Evidenz, etwa eine bestehende Registry-Instanz, Registry-/Datenbank-Readiness oder einen Keycloak-Preflight für eine bereits existierende Instanz. Eine fehlgeschlagene Diagnose überschreibt nie die ursprüngliche Fehlerursache. Das Tool führt keine Wiederholung oder Reparatur selbsttätig aus; `retryable: true` erlaubt ausschließlich einen expliziten, begrenzten Wiederholungsversuch durch den Aufrufer.

Die Fehlerklassen sind: Eingabe, Authentisierung, Autorisierung, Konflikt, Plattform-Readiness, Abhängigkeit und nicht klassifizierter interner Fehler. Diagnoseantworten enthalten keine Tokens, Passwörter, Client-Secrets, Connection-Strings, Stacktraces oder nicht für den Operator bestimmte Infrastrukturdetails.

Alternativen:

- Bestehende HTTP-Fehler unverändert durchreichen: verworfen, weil die heutige Klassifikation für automatisierte Diagnose zu grob ist.
- Interne Exception-Details an MCP ausgeben: verworfen, weil dies Geheimnisse und Angriffsoberfläche preisgeben kann.

### Decision: Dreistufige MCP-Control-Plane mit serverseitiger Risikopolicy

Der MCP stellt die bereits fachlich vorhandene Instanzverwaltung vollständig als getrennte Tools bereit. Tool-Namen bleiben stabil und sprechend; ihre tatsächliche Berechtigung wird serverseitig über vollständig qualifizierte Action-IDs, nicht über den Tool-Namen selbst, erzwungen.

| Risikostufe | Tools | Serverseitige Policy |
| --- | --- | --- |
| Lesen und Diagnose | `studio_instances_list`, `studio_instance_get`, `studio_instance_audit`, `studio_instances_audit`, `studio_instance_diagnose`, `studio_instance_provisioning_run_get` | Read-only-Action-Scope, keine Bestätigung |
| Kontrollierte Mutation | `studio_instances_create`, `studio_instance_update`, `studio_instance_provisioning_plan`, `studio_instance_provisioning_execute`, `studio_instance_reconcile`, `studio_instance_module_assign`, `studio_instance_iam_baseline_seed`, `studio_instance_admin_bootstrap` | action-spezifischer Scope, Idempotenz und strukturierter Fehlervertrag |
| Kritische Mutation | `studio_instance_activate`, `studio_instance_suspend`, `studio_instance_archive`, `studio_instance_module_revoke`, `studio_instance_secret_rotate` | action-spezifischer Scope, aktueller Vorab-Read oder Plan, Bestätigungs-Challenge, explizite Phrase, Idempotenz und append-only Audit |

Die Action-IDs werden vollständig qualifiziert modelliert, beispielsweise `instance.create`, `instance.provision.execute`, `instance.status.activate`, `instance.module.revoke` und `instance.secret.rotate`. In der beschlossenen ersten Ausbaustufe trägt der eine Service Account je Umgebung alle Action-Rollen. Der erhöhte Credential-Schadensradius ist bewusst akzeptiert; Studio prüft dennoch an jeder Route die konkrete Action und bei kritischen Mutationen zusätzlich die Challenge.

| Tool | Verbindliche Action-ID |
| --- | --- |
| `studio_instances_list` | `instance.list` |
| `studio_instance_get` | `instance.read` |
| `studio_instance_audit` | `instance.audit.read` |
| `studio_instances_audit` | `instance.audit.read` |
| `studio_instance_diagnose` | `instance.diagnose` |
| `studio_instance_provisioning_run_get` | `instance.provision.run.read` |
| `studio_instances_create` | `instance.create` |
| `studio_instance_update` | `instance.update` |
| `studio_instance_provisioning_plan` | `instance.provision.plan` |
| `studio_instance_provisioning_execute` | `instance.provision.execute` |
| `studio_instance_reconcile` | `instance.reconcile` |
| `studio_instance_module_assign` | `instance.module.assign` |
| `studio_instance_iam_baseline_seed` | `instance.iam.baseline.seed` |
| `studio_instance_admin_bootstrap` | `instance.admin.bootstrap` |
| `studio_instance_critical_action_prepare` | `instance.confirmation.prepare` |
| `studio_instance_activate` | `instance.status.activate` |
| `studio_instance_suspend` | `instance.status.suspend` |
| `studio_instance_archive` | `instance.status.archive` |
| `studio_instance_module_revoke` | `instance.module.revoke` |
| `studio_instance_secret_rotate` | `instance.secret.rotate` |

Diese Actions werden als Client-Rollen der Studio-API-Audience modelliert und vollständig dem jeweiligen Service Account zugeordnet. Zusätzlich verlangt Studio die Plattformrolle `instance_registry_admin`; sie ersetzt niemals die routenspezifische Action-Prüfung.

Kritische Tools folgen einem serverseitig erzwungenen Zwei-Schritt-Vertrag:

1. `studio_instance_critical_action_prepare` gibt nach einem expliziten Read-/Plan-Schritt eine an Action, Instanz, relevanten aktuellen Zustand und Ablaufzeit gebundene `confirmationChallenge` zurück.
2. Der kritische Tool-Aufruf muss die noch gültige Challenge, einen Idempotenz-Key und eine action-spezifische Bestätigungsphrase enthalten.
3. Studio prüft Scope, Challenge, Ablauf, Instanzzustand/-version und Phrase atomar vor der Mutation. Bei veränderter Grundlage wird die Challenge abgelehnt und ein neuer Vorab-Read verlangt.

Für besonders folgenreiche Aktionen enthält die Phrase die konkrete Wirkung, beispielsweise `ARCHIVE <instanceId>` oder `REVOKE <moduleId> FROM <instanceId>`. Secret-Rotation gibt niemals das erzeugte Geheimnis zurück, sondern ausschließlich sicheren Status, Run-ID und Korrelation.

Alternativen:

- Ein einziges generisches Mutations-Tool: verworfen, da Scope, Risiko, Bestätigung und Audit nicht hinreichend präzise erzwingbar wären.
- Schutz ausschließlich durch Codex-Anweisungen: verworfen, da die Sicherheitsgrenze serverseitig durchsetzbar sein muss.

## Data Flow

1. Codex ruft ein lokales Instanz-Tool im stdio-MCP-Server auf.
2. Der Server validiert die Eingabe, erstellt eine Korrelation und einen Idempotenz-Key und liest Basis-URL sowie Service-Token lokal.
3. Bei kritischen Aktionen liest der Server zuerst Zustand oder Plan und erhält eine kurzlebige Bestätigungs-Challenge.
4. Der Server sendet die Anfrage mit Token, Action-Kontext, Korrelation und gegebenenfalls Challenge an die konfigurierte Studio-API.
5. Studio authentisiert und autorisiert den Service-Token-Pfad und ruft den bestehenden Registry-Service auf.
6. Bei einem Fehler liefert Studio dessen stabilen Fehlervertrag; der MCP-Server liest abhängig von der Klasse begrenzte Diagnose-Evidenz.
7. Studio speichert Audit-Ereignis und fachliche Artefakte; das Tool liefert ausschließlich die sichere Ergebnis- oder Diagnosezusammenfassung zurück.

### Decision: Ein kanonisches Fehlerereignis mit stufengenauer Korrelation

Die Instance Registry erzeugt pro fehlgeschlagener Mutation genau ein kanonisches Error-Event an der HTTP-Grenze. Interne Schritte annotieren den Fehler lediglich mit einem stabilen `step_key`; sie schreiben kein zweites Fehlerlog. Der typisierte Kontext enthält `operation`, `result`, `request_id` und, soweit vorhanden, `instance_id`, `run_id`, `intent`, `dependency`, `error_type`, `error_code`, `classification` und `http_status`.

Für PostgreSQL werden ausschließlich SQLSTATE, Tabelle, Spalte und Constraint übernommen. Meldung, Detail, Hint, Query, Parameter und Stacktrace bleiben ausgeschlossen. Worker-Fehler verwenden denselben sicheren Kontext; `provisioning_run_failed` ist dort das kanonische Ereignis. Request-, Instanz- und Run-IDs bleiben Log-Felder und werden weder Loki-Labels noch Metrikdimensionen. Append-only Audit und technische Logs bleiben getrennt.

Der lokale stdio-MCP schreibt keine Diagnose auf `stdout`, weil dieser Kanal dem MCP-Protokoll gehört. Seine strukturierte Tool-Antwort bleibt die lokale Diagnoseoberfläche; Tokens, Payloads und Secrets werden nicht geloggt.

### Decision: Modularer Gesamtprozess mit ehrlichem Abschlussvertrag

Die bestehenden MCP-Einzeltools bleiben für gezielte Diagnose, Reparatur und Betrieb erhalten. Ergänzend erhält der MCP einen orchestrierten Instanzprozess mit den Modi `create`, `repair` und `adapt`. Der Prozess verwendet ausschließlich die bestehenden Studio-API-Verträge; er umgeht weder Registry, Worker, Audit noch die serverseitige Risikopolicy.

Der Prozess ermittelt vor jeder Mutation den aktuellen Instanz- und Doctor-Zustand und führt nur die für den angeforderten Modus erforderlichen, idempotenten Schritte aus:

1. Registry-Konfiguration anlegen oder lesen.
2. Module zuweisen oder ihre IAM-Basis und Admin-Struktur ergänzen.
3. Keycloak-Provisioning oder -Reconcile anfordern und bis zum terminalen Worker-Ergebnis verfolgen.
4. Einen aktuellen Postflight aus Keycloak-Status, Rollenabgleich und tenantlokaler Rechteprobe bilden und persistieren.
5. Den Doctor-Zustand erneut lesen und einen verständlichen, strukturierten Fortschrittsbericht zurückgeben.

Der technische Prozessstatus ist vom Instanz-Lifecycle getrennt. `completed` bedeutet ausschließlich: Die Instanz ist aktiv und alle für den Auftrag erforderlichen Doctor-Achsen sind `ready`. Ein technisch fertiger, aber noch nicht aktivierter Tenant erhält stattdessen `awaiting_human_action` mit `completed: false`, der konkreten Action `instance.status.activate`, einer verständlichen Begründung und den Informationen für die reguläre Bestätigungs-Challenge. Kritische Aktionen bleiben immer explizit und serverseitig challenge-geschützt.

Die Prozessantwort enthält mindestens den lesbaren aktuellen Schritt, erledigte und offene Schritte, Doctor-Zusammenfassung, Korrelation, eine sichere Folgeaktion und einen eindeutigen Abschlusswert. Sie benennt verständlich, ob etwas automatisch fortgesetzt werden kann, eine Human-in-the-Loop-Bestätigung erfordert oder durch einen konkreten Befund blockiert ist. Technische Codes ergänzen diese Erklärung, ersetzen sie aber nicht.

Ein Worker-Preflight ist historische Vorbedingungs-Evidenz und darf nach einer erfolgreichen Mutation nicht als aktueller Doctor-Zustand interpretiert werden. Der Worker persistiert daher einen eigenen Postflight-Snapshot. Detailansicht, Diagnose und MCP verwenden für die Abschlussbewertung ausschließlich den aktuellen Status beziehungsweise diesen Postflight.

Alternativen:

- Einzeltools ohne Gesamtprozess: verworfen, da Operatoren Abschluss und notwendige Reihenfolge selbst erraten müssten.
- Automatische Aktivierung: verworfen, da sie die bewusste Human-in-the-Loop-Grenze für kritische Mutationen umgehen würde.
- Erfolg nach Worker-Abschluss: verworfen, da dies fehlende Rechteprobe, Rollen-Backlog oder Aktivierung verschleiern würde.

## Risks / Trade-offs

- Token-Diebstahl ermöglicht Instanzanlage innerhalb des Token-Scopes. → Kurze Laufzeit, enger Audience-/Scope-Bindung, sichere lokale Ablage, Rotation und vollständiges Audit.
- Der initiale Create-Vorgang beendet das technische Setup nicht. → Tool-Ergebnis weist klar auf Status `requested` und getrennte Folgeschritte hin.
- Unterschiedliche API-Konfigurationen können Fehlbedienung verursachen. → Token-Audience muss die Zielumgebung binden und das Tool zeigt nur redigierte, handlungsfähige Fehler an.
- Unvollständige oder falsche Diagnose kann zu Fehlreparaturen verleiten. → Primärfehler und Diagnose-Evidenz getrennt darstellen, Diagnosen budgetieren und automatische Reparaturen verbieten.
- Wiederverwendete oder veraltete Bestätigungen könnten kritische Mutationen fehlleiten. → Challenge atomar an Action, Instanz und Zustands-/Versionswert binden, kurz befristen und einmalig verbrauchen.

## Migration Plan

1. Service-Token-Prüfung und Autorisierungsgrenze mit Tests ergänzen.
2. Lokales MCP-Package und seine Codex-Konfiguration ergänzen.
3. Dokumentation für Token-Ausstellung, Rotation und Tool-Aufruf bereitstellen.
4. Nach erfolgreicher Verifikation kann das Tool für berechtigte lokale Operatoren aktiviert werden.

Rollback: Die MCP-Konfiguration entfernen oder die Token-Ausstellung widerrufen; der bestehende Studio-UI- und API-Pfad bleibt unverändert nutzbar.

## Rollout und Verifikation

Der Token-Aussteller ist der zentrale Keycloak unter `keycloak.smart-village.app`. Die drei Root-Realms `studio-dev`, `studio-staging` und `sva-studio` verwenden jeweils einen getrennten vertraulichen Service-Account-Client `sva-studio-mcp`. Die Clients verwenden unterschiedliche Secrets, deaktivieren interaktive Flows, begrenzen Access Tokens auf 300 Sekunden und erhalten in der ersten Ausbaustufe alle MCP-Action-Rollen sowie `instance_registry_admin`. Die Plattformrolle ist eine zusätzliche Eingangsvoraussetzung und kein Ersatz für die routenspezifische Action-Scope-Prüfung.

Die Client-Secrets werden ausschließlich lokal über OS-Keychain oder nicht versionierte Umgebungsvariablen bereitgestellt. Studio validiert Access Tokens über Issuer-Metadaten und JWKS und benötigt kein MCP-Client-Secret. Die Rotation erfolgt mit kurzer Überlappung: neues Secret ausstellen, lokalen Client umstellen und per Read-only-Smoke verifizieren, anschließend das alte Secret widerrufen.

Der Rollout erfolgt nacheinander über `studio-dev`, `studio-staging` und `sva-studio`. Pro Stufe werden zuerst Read-/Diagnose-Tools, danach eine kontrollierte Mutation an einer eindeutig markierten Testinstanz und zuletzt eine einzelne Challenge-geschützte Mutation verifiziert. Ein serverseitiger Environment-Kill-Switch bleibt bis zur jeweiligen Freigabe deaktiviert.

Die Verifikation umfasst:

- Unit-, Type-, Lint-, Build- und Node-ESM-Runtime-Gates für alle betroffenen Nx-Projekte,
- API-Integrationstests für Signatur, Issuer, Audience, Zeitbindung, Action-Scope und JWKS-Key-Rotation,
- MCP-Vertragstests für stdio, Schemata, Idempotenz, Korrelation, Redaction, Diagnosebudget und Teilfehler,
- End-to-End-Szenarien für Read, Create, Plan, Execute und Run-Status sowie Challenge-Ablauf, Replay, Race, Zustandsänderung und Bestätigungsphrase,
- OTEL-Evidenz für Action, Risikostufe, Ergebnis, stabilen Fehlercode und Challenge-Ergebnis ohne hochkardinale oder geheime Labels.

Rollback: Zuerst wird der MCP-Kill-Switch deaktiviert, anschließend werden die Clients oder betroffenen Credentials in allen freigegebenen Realms widerrufen und die lokale MCP-Konfiguration entfernt. Der Studio-UI-/Session-Pfad bleibt unverändert. Additive Challenge-Persistenz darf bei einem App-Rollback ungenutzt bestehen bleiben; es erfolgt keine riskante Down-Migration während eines Incidents.
