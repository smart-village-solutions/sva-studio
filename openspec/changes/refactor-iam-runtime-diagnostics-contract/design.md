## Context

Die vorgelagerte Analyse (`update-iam-diagnostics-analysis-and-followup-plan`) hat drei zentrale Lücken bestätigt:

1. Serverpfade klassifizieren Fehler heute uneinheitlich.
2. Browserpfade lesen `requestId` und Safe-Details teilweise, halten sie aber nicht stabil bis in Hooks und Seiten.
3. Runtime-IAM-Fehler und Instanz-/Provisioning-Drift nutzen noch keine vollständig kompatible Begriffswelt.

Zusätzlich zeigt die Analyse eine konkrete Scope-Unschärfe:

4. Die produktive Tenant-Freigabe läuft bereits über die Instanz-Registry, aber `SVA_ALLOWED_INSTANCE_IDS` beeinflusst weiter SDK-Fallbacks und Ops-/Doctor-/Smoke-Scopes.

Außerdem zeigt die Live-Triage einen eigenen Hauptbefund:

5. Der User- und Rollenabgleich mit Keycloak ist tenantübergreifend instabil und wirkt direkt in Admin-UI, Self-Service-Profilen und Reconcile-Endpunkten, statt nur ein nachgelagerter Provisioning-Nebenaspekt zu sein.

Gleichzeitig existiert bereits wertvolle Infrastruktur:

- `reason_code`-basierte Diagnosedetails
- `requestId`-Transport
- Schema-Guard mit `schema_object` und `expected_migration`
- Drift- und Run-Evidenz in der Instanz-Registry

## Goals

- Einen einheitlichen, additiven öffentlichen Diagnosevertrag schaffen.
- Bestehende Fehlercodes und fail-closed-Verhalten kompatibel halten.
- Browser und UI in die Lage versetzen, degradierte und recovery-nahe Zustände explizit zu unterscheiden.
- Registry-/Provisioning-Drift sprachlich und technisch mit Runtime-IAM-Fehlern verzahnen.
- User-/Rollenabgleich mit Keycloak als eigenen Diagnose- und UI-Pfad abbilden.
- Die verbleibende Doppelrolle von `SVA_ALLOWED_INSTANCE_IDS` explizit auflösen oder sauber auf lokalen/migrierenden Fallback begrenzen.

## Non-Goals

- Kein großflächiges Refactoring fachlicher IAM-Logik außerhalb des Diagnosevertrags.
- Keine Bereinigung einzelner historischer Daten- oder Membership-Inkonsistenzen in diesem Change.
- Kein Ersatz bestehender Audit-, Readiness- oder Provisioning-Runs.

## Decisions

### 1. Öffentlicher Diagnosevertrag bleibt additiv

Bestehende Fehlercodes und öffentliche Fehlermeldungen bleiben kompatibel. Der neue Vertrag ergänzt mindestens:

- `classification`
- `status`
- `recommendedAction`
- `requestId`
- `safeDetails`

Die Felder dürfen bestehende Clients nicht brechen und müssen von UI und Betrieb gleichermaßen interpretierbar sein.

### 2. Browser-Fehlerobjekte werden diagnosefähig

Der Browserpfad in `apps/sva-studio-react/src/lib/iam-api.ts` darf Diagnoseinformationen nicht nur für Dev-Logging lesen, sondern muss sie stabil in seinem Fehlerobjekt verfügbar halten.

### 3. Self-Service und Admin teilen denselben Klassifikationskern

Die UI unterscheidet künftig nicht mehr nur `401` versus generischen Fehler, sondern verarbeitet dieselbe Klassifikation in:

- Self-Service-Flows wie `/account`
- Admin-Flows wie `/admin/users` und `/admin/instances`

Unterschiedlich bleibt nur die kontextabhängige Formulierung und Folgehilfe.

### 4. Runtime- und Provisioning-Drift nutzen denselben Drift-Wortschatz

Registry-/Provisioning-nahe Probleme sollen für UI und Betrieb auf denselben Kernbegriffen aufbauen wie Runtime-IAM-Fehler, damit Drift nicht in getrennten Diagnosewelten bearbeitet wird.

### 5. Env-Allowlist wird nicht mehr implizit als produktionsnahe Freigabequelle behandelt

Die Folgearbeit muss explizit entscheiden:

- entweder `SVA_ALLOWED_INSTANCE_IDS` aus produktionsnahen Ops- und Fallback-Pfaden entfernen
- oder die Variable klar als lokalen bzw. migrationsbezogenen Sonderpfad kapseln

Nicht akzeptabel ist der heutige Zwischenzustand, in dem Runtime bereits registrygeführt ist, während Diagnose- und Fallback-Pfade noch teilweise envgeführt denken.

### 6. Keycloak-User- und Rollenabgleich wird explizit diagnostizierbar

Die Folgearbeit muss den Fehlerraum des Keycloak-Abgleichs ausdrücklich modellieren:

- Reconcile- und Import-Endpunkte für Rollen und Benutzer
- technische IdP-Fehler wie `IDP_FORBIDDEN` und `IDP_UNAVAILABLE`
- DB-nahe Persistenzfehler wie `DB_WRITE_FAILED`
- partielle Erfolgszustände wie „technisch geprüft, aber manuell prüfen“
- Inkonsistenzen zwischen Keycloak-Rollen im Token und Studio-Projektionen in `/account`, `/admin/users` und `/admin/roles`

Dieser Pfad darf nicht länger nur implizit unter allgemeiner Drift oder Membership-Inkonsistenz laufen, sondern braucht eigene Diagnosefelder, UI-Zustände und Korrelation zu `requestId`-gebundenen Reconcile-Läufen.

## Deliverables

- serverseitiger Diagnosevertrag mit stabiler Klassifikation
- browserseitiges Fehlerobjekt mit `classification`, `status`, `requestId`, `safeDetails`, `recommendedAction`
- erste UI-Nutzung für Self-Service und Admin
- explizite Diagnosepfade für User-/Rollenabgleich mit Keycloak in `/admin/users` und `/admin/roles`
- aktualisierte Architektur- und Qualitätsdoku
- Testabdeckung für Server, Browser und UI
