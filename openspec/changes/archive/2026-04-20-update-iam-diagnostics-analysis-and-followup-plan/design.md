## Context

Die bestehende IAM-Landschaft enthält bereits mehrere Diagnose- und Recovery-Mechanismen:

- tenant-spezifische Auth-Konfigurationsauflösung über Host, Registry und Secrets
- Session-Hydration und Silent-Recovery
- Actor-/Membership-Auflösung mit optionalem JIT-Provisioning
- Keycloak-User-Sync mit Drift- und Reparaturpfaden
- Keycloak-Preflight, Provisioning-Plan und Run-Protokolle auf Instanzebene

Die Mechanismen sind jedoch nicht als durchgängiger Diagnosevertrag modelliert. Dadurch können unterschiedliche Ursachen im Frontend als derselbe Fehler erscheinen, während serverseitig zwar strukturierte Logs oder sichere Diagnosedetails existieren, diese aber weder konsistent aggregiert noch UI-tauglich weitergereicht werden.

Zusätzlich besteht das Risiko, dass frühere Korrekturen, Recovery-Mechanismen oder pragmatische Sonderpfade einzelne Symptome verbessert, aber an anderer Stelle neue Drift oder Intransparenz eingeführt haben. Diese Altlasten sind eigener Analysegegenstand und dürfen nicht stillschweigend als gegeben akzeptiert werden.

## Goals

- Einen verbindlichen Analysepfad für IAM schaffen, bevor ein größeres Refactoring gestartet wird.
- Eine fachlich und technisch belastbare Fehlertaxonomie definieren.
- Bestehende Runtime- und Provisioning-Diagnosen aufeinander ausrichten.
- Die Frontend-Anforderungen für sichere, verständliche und handlungsleitende Fehlerbilder festlegen.
- Die Analysephase mit einem verpflichtenden Folgechange abschließen, damit der Refactoring-Kontext nicht verloren geht.

## Non-Goals

- Kein Vorziehen des eigentlichen Refactorings in diesem Change.
- Keine Festlegung auf eine einzelne Root Cause, bevor die Analyse abgeschlossen ist.
- Kein Ersetzen bestehender Keycloak-Preflight- oder Runtime-Mechanismen ohne nachgewiesenen Bedarf.

## Workstreams

### 1. End-to-End-IAM-Analyse

Die Analyse muss den realen Laufzeitpfad abdecken:

1. Host- und Instanzauflösung
2. Auth-Konfigurationsauflösung
3. OIDC-Login, Callback, Session und Silent-Recovery
4. Session-User-Hydration und Tenant-Host-Validierung
5. Actor-/Membership-Auflösung
6. Keycloak-Admin- und User-Sync-Pfade
7. IAM-DB, Schema-Guards und Drift-Indikatoren
8. Frontend-Fehlerbehandlung und Statusdarstellung
9. historische Sonderpfade, Workarounds und Recovery-Mechanismen aus früheren IAM-Fixes

### 2. Fehlertaxonomie

Die Analyse soll stabile Fehlerklassen definieren, mindestens für:

- `auth_resolution`
- `tenant_host_validation`
- `oidc_discovery_or_exchange`
- `session_store_or_session_hydration`
- `actor_resolution_or_membership`
- `keycloak_dependency`
- `database_or_schema_drift`
- `database_mapping_or_membership_inconsistency`
- `registry_or_provisioning_drift`
- `frontend_state_or_permission_staleness`
- `legacy_workaround_or_regression`

Jede Klasse muss enthalten:

- Auslöser und betroffene Schichten
- bereits vorhandene Signale im Code
- sichere UI-taugliche Details
- empfohlene nächste Handlung
- Bewertung, ob stilles Recovery erlaubt bleibt oder explizit sichtbar gemacht werden muss

Die Analyse muss zusätzlich festhalten, welche Fehlerklassen wahrscheinlich durch:

- fehlerhafte Keycloak-Konfiguration
- fehlerhafte Studio-Konfiguration
- falsche oder veraltete DB-Daten
- falsche Datennutzung oder Mappings im Code
- frühere Workarounds oder inkonsistente Fixes

verursacht oder verschärft werden können.

### 3. UI-Diagnosevertrag

Das Frontend soll nicht nur generische Fehlercodes darstellen, sondern:

- Request-ID und sichere Diagnosedetails anzeigen können
- Fehler pro Fehlerklasse unterschiedlich behandeln
- zwischen Re-Login, Retry, Operator-Hinweis, Drift-Hinweis und Support-Fall unterscheiden
- Self-Service- und Admin-Flows unterschiedlich aufbereiten
- degradierte IAM-Zustände, temporäre Recovery-Zwischenzustände und driftverdächtige Status explizit anzeigen können
- einen klaren Statuspfad zwischen "gesund", "degradiert", "Recovery läuft" und "manuelle Prüfung erforderlich" unterstützen

### 4. Verzahnung mit Instanz-Provisioning

Bestehende Instanz- und Keycloak-Preflight-Diagnosen bleiben führend für Registry-/Realm-/Client-Drift. Die Analyse muss zeigen, wie Runtime-IAM-Fehler auf diese Diagnosepfade verweisen oder von ihnen abgeleitet werden können, statt parallele Diagnosewelten aufzubauen.

### 5. Hybrid-Live-Triage als Pflichtblock

Die Analyse endet nicht mit Repo-Lektüre. Nach der statischen und dokumentarischen Bestandsaufnahme folgt ein verpflichtender Live-Triage-Block gegen eine reale Dev- oder Staging-Umgebung.

Der Block arbeitet nicht explorativ, sondern anhand einer festen Szenario-Matrix für:

- Host- und Tenant-Auflösung
- OIDC-Discovery, Login, Callback und Session-Wiederaufnahme
- Silent-Recovery nach `401`
- Actor-/Membership-Auflösung in Self-Service- und Admin-Flows
- Registry-/Provisioning-Korrelation
- Schema-/DB-/Membership-Drift

Wenn keine nutzbare Umgebung oder keine geeigneten Testdaten verfügbar sind, bleibt dieser Workstream explizit offen; der Change darf dann nicht stillschweigend als abgeschlossen gelten.

### 6. Folgechange als harte Abschlussbedingung

Der Abschluss der Analysephase reicht nicht aus. Vor dem Schließen dieses Changes muss ein Folgechange angelegt werden, der mindestens enthält:

- konsolidierte Befunde und priorisierte Problemfelder
- abgegrenzten Refactoring-Scope
- UX-/Frontend-Änderungen für Fehler- und Statusanzeigen
- Test- und Migrationsstrategie
- Architektur- und ADR-Bedarf

## Deliverables

Die Analysephase liefert mindestens:

- eine Problemkarte der IAM-Fehlerklassen und ihrer Ursachenpfade
- eine Bestandsaufnahme vorhandener Recovery- und Diagnosemechanismen
- eine Bestandsaufnahme historischer Workarounds, Sonderpfade und potenziell verschlimmbesserter IAM-Fixes
- eine Untersuchung typischer DB-, Mapping- und Membership-Inkonsistenzen mit ihren beobachtbaren Symptomen
- einen priorisierten Maßnahmenkatalog
- ein Zielbild für Frontend-Fehler- und Statusanzeigen in Self-Service- und Admin-Flows
- einen versionierten Analysebericht unter `docs/reports/`
- eine dokumentierte Live-Triage-Matrix samt offenem Status oder realen Befunden
- aktualisierte Architektur- und Risikodokumentation
- einen separaten Folgechange mit Proposal, Design, Tasks und betroffenen Spec-Deltas

## Risks

- Bestehende Recovery-Pfade kaschieren strukturelle Drift und erschweren klare Root-Cause-Zuordnung.
- Ein vorschnelles Refactoring ohne Diagnosevertrag würde weitere Sonderfälle einführen.
- Zu breite UI-Fehlertransparenz könnte unsichere Interna offenlegen; deshalb bleiben nur allowlist-basierte Diagnosedetails zulässig.
- Eine nur repo-interne Analyse ohne Live-Triage würde besonders Host-, Cookie-, Keycloak- und Datenzustandsprobleme nur unvollständig erfassen.
