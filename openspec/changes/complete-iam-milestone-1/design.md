## Kontext

Milestone 1 des IAM ist funktional in mehreren Schritten gewachsen. Die technische Basis ist bereits vorhanden, aber die offenen Anforderungen betreffen mehrere Querschnittsbereiche gleichzeitig:

- Identity- und Token-Verträge zwischen Keycloak, CMS und App
- Berechtigungslogik mit Rollen, Gruppen, Delegationen und Hierarchien
- Organisations- und Membership-Modell mit Mandantenisolation
- Audit, Datenschutz und Betriebsnachweise
- Admin- und Account-UI für Lifecycle- und Rechte-Workflows

Der Change beschreibt die noch fehlenden fachlichen und technischen Verträge als gemeinsamen Abschlussrahmen für Milestone 1. Er ist bewusst breiter als ein einzelner Implementierungs-Change, damit die verbleibenden Workstreams nicht widersprüchlich weiterentwickelt werden.

## Ziele

- ein verbindlicher Keycloak-/OIDC-Vertrag für alle Milestone-1-Clients
- ein vollständiges Berechtigungsmodell mit Rollen, Gruppen, Delegationen und klarer Priorisierung
- reproduzierbare Cache-, Invalidation- und Performance-Leitplanken für `POST /iam/authorize`
- ein belastbares Organisationsmodell für kommunale Mehrstufenstrukturen
- nachvollziehbare Lifecycle-Workflows für Einladung, Onboarding und Offboarding
- revisionssichere Audit- und Exportverträge
- klare Anforderungen an die Verwaltungs-UI

## Nicht-Ziele

- vollständige Keycloak-Härtung über MFA, Passwortpolicies oder Brute-Force-Detection
- finale Implementierung fachlicher Module wie News oder Rechtstexte
- produktive Betriebsfreigabe für Infrastruktur außerhalb des Repositories
- Ersetzung bestehender Child-Changes; dieser Change bündelt und erweitert den Restumfang

## Workstreams

### 1. Identity- und Token-Vertrag

Das System verwendet weiterhin Keycloak als führenden Identity Provider. Für Milestone 1 werden drei Client-Rollen unterschieden:

- CMS-OIDC-Client für interaktive Browser-Logins
- optional App-OIDC-Client mit gleichem Realm und identischem Identitätskontext
- IAM-Service-Account für Admin- und Sync-Aufrufe

Der Token-Vertrag muss die nachgelagerten IAM-Module deterministisch bedienen. Minimal erforderlich sind:

- `sub` als führender externer Benutzerbezug
- `instanceId` als kanonischer Mandantenkontext
- Rollenclaims für systemische Sofortentscheidungen
- optionaler Organisationskontext ausschließlich als Hinweis, nicht als alleinige Autoritätsquelle

Claims werden serverseitig auf interne Identitäten, Memberships und Default-Kontexte aufgelöst. Tokens bleiben transportbezogene Quellen; die verbindliche fachliche Sicht entsteht erst durch den IAM-Datenstand.

### 2. Berechtigungsmodell

Die effektive Berechtigungsentscheidung kombiniert mehrere Quellen:

- direkte Rollenzuweisungen
- gruppenvermittelte Rollenzuweisungen oder direkte Gruppen-Permissions
- temporäre Delegationen
- Org-/Geo-Hierarchien
- lokale Restriktionen und `deny`

Die Prioritätsreihenfolge bleibt fail-closed:

1. Instanzisolation
2. Gültigkeit von Delegation und Membership
3. lokale `deny`/Restriktion
4. direkte und gruppenvermittelte `allow`
5. vererbte `allow`

Gruppen werden als fachliche Bündelungseinheit modelliert. Sie sind instanzgebunden, können optional organisationsgebunden scoped sein und dienen der effizienteren Pflege vieler Benutzerzuordnungen.

### 3. Snapshot- und Invalidation-Modell

Der Snapshot-Key muss mindestens folgende Signale enthalten:

- `instanceId`
- effektive Identität
- aktiver Organisationskontext
- relevanter Geo-Kontext
- Versionssignale für Rollen, Gruppen, Memberships, Delegationen und Hierarchie

Invalidierungen werden ereignisbasiert ausgelöst. TTL und Recompute bleiben Fallback-Mechanismen, nicht der primäre Konsistenzpfad. Änderungen an folgenden Entitäten müssen Snapshots beeinflussen:

- `iam.account_roles`
- `iam.groups` und Gruppen-Memberships
- `iam.role_permissions` / `iam.permissions`
- `iam.account_organizations`
- Organisationshierarchien
- Delegationen und impersonationsnahe Vertretungsrechte

### 4. Organisations- und Lifecycle-Modell

Das Organisationsmodell wird auf kommunale Mehrstufenstrukturen ausgerichtet. Die Spezifikation erzwingt keine fixe Tiefe, definiert aber einen kanonischen ersten Pfad:

- Landkreis
- Region
- Gemeinde
- Ortsteil

Accounts können mehreren Organisationen angehören. Zusätzlich braucht Milestone 1:

- Nutzertypen `internal` und `external`
- Einladung oder Bewerbung als kontrollierter Beitritt
- Privacy-Optionen je Membership oder Rolle
- delegierbare Administration in klar begrenztem Scope
- Offboarding mit deterministischem Rechteentzug und Session-Revocation

### 5. Audit- und Datenschutzmodell

Audit bleibt Dual-Write:

- DB-seitiger Compliance-Nachweis in `iam.activity_logs`
- strukturierte operative Logs in die OTEL-Pipeline

Neu präzisiert werden:

- Rechte-, Gruppen-, Delegations- und Offboarding-Ereignisse
- exportierbare Audit- und DSGVO-Nachweise
- Erinnerungszyklen für periodische Reviews
- Datenlöschkonzept mit Trennung von PII-Löschung und pseudonymisierter Audit-Aufbewahrung

## API- und UI-Auswirkungen

Neue oder erweiterte Endpunktfamilien betreffen voraussichtlich:

- `/auth/*` für einheitliche Login-Rückkehrpfade
- `/iam/authorize` und `/iam/me/permissions`
- `/api/v1/iam/groups*`
- `/api/v1/iam/roles*`
- `/api/v1/iam/organizations*`
- `/api/v1/iam/accounts*`
- `/api/v1/iam/audit-exports*`
- `/api/v1/iam/delegations*`

Die Verwaltungs-UI wird um folgende Flows ergänzt:

- Gruppenübersicht und Gruppenzuweisungen
- Rollenzuweisung unter Berücksichtigung von Gruppen und Delegationen
- Onboarding-Status und Einladungshistorie
- Offboarding mit Sicherheitswarnungen
- Vertretungsrechte mit Laufzeit und Widerruf

## Sicherheits- und Qualitätsleitplanken

- alle neuen Mutationen bleiben CSRF-geschützt
- alle Datenpfade bleiben instanzisoliert und fail-closed
- keine Klartext-PII in Audit- oder Betriebslogs
- neue UI-Texte ausschließlich über i18n
- neue Rechte- und Lifecycle-Flows benötigen Unit-, Integrations- und UI-Nachweise

## Risiken

- Ein Sammel-Change dieser Größe kann in der Umsetzung zu groß werden
- Überschneidungen mit bereits laufenden Teil-Changes müssen aktiv synchronisiert werden
- Gruppen, Delegationen und Invalidation können die Komplexität der Permission Engine deutlich erhöhen

## Mitigations

- Umsetzung in getrennten Arbeitspaketen trotz gemeinsamem Proposal
- konsistente Testmatrix über alle Workstreams
- Performance- und Invalidation-Nachweise früh im Change absichern
