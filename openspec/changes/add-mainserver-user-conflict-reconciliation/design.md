## Context

`POST /api/v2/user_provisionings` erzeugt persönliche Mainserver-Credentials für einen Keycloak-Subject. Antwortet der Mainserver mit `local_user_conflict`, darf Studio die vorhandene externe Identität nicht aus einer E-Mail-Gleichheit übernehmen. Der bestehende Reprovision-Flow wiederholt dieselbe Provisionierung und ist daher kein Konfliktlöser.

Der Prozess verändert eine externe Identitätsbindung und persönliche Credentials. Er muss deshalb explizit, tenantlokal, idempotent, auditierbar und bei jedem unklaren Zwischenzustand fail-closed sein.

## Goals

- Eine bestätigte historische Mainserver-Identität kontrolliert an den aktuellen Keycloak-Subject binden.
- Alle Zustände vor der Mutation verständlich und ohne Geheimnisse diagnostizieren.
- Teilfehler als `reconciliation_required` bewahren und sicher wiederaufnehmbar machen.
- Die bestehende credential-versionierte DataProvider-Bindung weiterverwenden.

## Non-Goals

- Keine automatische Identitätsentscheidung.
- Kein allgemeiner Account-Merge, kein Datenexport und keine Content-Ownership-Umschreibung.
- Keine externe Mutation, falls der Mainserver keinen dedizierten Rebind-Vertrag bereitstellt.

## Decisions

### Separate Reconcile-Operation statt Reprovision

Der neue Pfad erhält einen eigenen fully-qualified Action-Identifier `iam.reconcileMainserverUserConflict`. Er ist von normaler Benutzerbearbeitung und Bulk-Reprovision getrennt, damit Autorisierung, Audit und UI nicht als gewöhnliche Credential-Aktualisierung erscheinen.

### Reconciliation-Ledger

Studio speichert einen tenantlokalen Reconciliation-Vorgang mit unveränderbarer Operationsreferenz, Zielaccount, redigiertem Konflikt-Fingerprint, Antrags- und Bestätigerreferenz, Status und Zeitstempeln. Keine E-Mail im Klartext, keine Credentials und keine Upstream-Rohantworten werden gespeichert.

Zustände:

`detected` → `inspection_ready` → `requested` → `approved` → `executing` → `verified`

Terminale beziehungsweise Nacharbeitszustände: `rejected`, `reconciliation_required`, `failed`.

Nur der Server darf Übergänge ausführen. Wiederholungen verwenden die unveränderbare Operationsreferenz. Ein bereits `verified` Vorgang ist ein No-op.

### Vier-Augen-Freigabe

Ein `system_admin` derselben Instanz beantragt die Durchführung mit einer Begründung. Ein anderer `system_admin` bestätigt. Der Server erzwingt unterschiedliche Account-IDs, gültige Sitzung, Zielinstanz und weiterhin vorhandenen Konfliktbefund sowohl beim Antrag als auch unmittelbar vor der Mutation.

### Upstream-Vertrag als harte Voraussetzung

Vor jeder Studio-Implementierung wird ein Mainserver-Vertrag für Rebind, Credential-Ausstellung, Idempotency-Key, Credential-Widerruf und Read-after-write-Verifikation vereinbart und mit Contract-Tests abgesichert. Ein `POST /api/v2/user_provisionings`-Retry, direkte SQL-Änderung oder das Löschen des Altkontos sind keine zulässigen Alternativen.

### Commit- und Kompensationsgrenzen

Der Mainserver-Rebind und die Credential-Ausstellung müssen über die Operationsreferenz idempotent sein. Nach bestätigter Upstream-Antwort persistiert Studio die neuen Keycloak-Attribute, prüft die DataProvider-Bindung und widerruft erst danach alte Credentials, wenn der Mainserver dies sicher bestätigt. Schlägt Keycloak-Persistenz, Bindungsprüfung oder Widerruf fehl, wird kein Erfolg behauptet: Der Ledger bleibt `reconciliation_required` und enthält nur redigierte Diagnosecodes.

## Data Flow

1. System-Admin startet eine Read-only-Prüfung.
2. Server fragt den Mainserver nach einem redigierten Konfliktbefund und persistiert `inspection_ready`.
3. Erster System-Admin stellt einen begründeten Antrag.
4. Zweiter System-Admin bestätigt den unveränderten Antrag.
5. Server sperrt den Ledger-Vorgang, prüft Befund und Berechtigungen erneut und ruft den idempotenten Mainserver-Rebind auf.
6. Server persistiert neue Credentials in Keycloak und verifiziert Credential- und DataProvider-Zustand.
7. Server finalisiert Audit und Ledger als `verified`; die UI führt einen authentifizierten Zugangstest aus.

## Risks and Mitigations

- Falsche Identitätsübernahme → keine automatische E-Mail-Verknüpfung, Vier-Augen-Freigabe, expliziter Upstream-Read.
- Teilfehler nach Upstream-Erfolg → Ledger, idempotente Operationsreferenz, `reconciliation_required`.
- Credential-Leak → write-only Credentials, redigierte Read-Models, kein Secret in Audit oder Logs.
- Parallele Anträge → zeilenweise Sperre und ein aktiver Vorgang je Zielaccount/Instanz.
- Unklare Ownership → DataProvider bleibt Quellmetadatum; der Rebind schreibt keine Content-Owner um.

## Migration Plan

1. Erst Upstream-Vertrag und Contract-Tests bereitstellen.
2. Ledger-Migration inklusive RLS, Unique-Constraint für aktive Vorgänge und Schema-Snapshot ergänzen.
3. Serverpfad, Audit und UI hinter dem neuen expliziten Action-Vertrag ausliefern.
4. In Dev und Staging ausschließlich mit synthetischen Konfliktkonten nachweisen.
5. Production über den kanonischen Promote-Pfad; erster realer Rebind nur nach expliziter Betriebsfreigabe.

## Open Questions

- Bestätigt der Product Owner die Vier-Augen-Freigabe als verbindliche Production-Policy?
- Welchen dedizierten Rebind-/Widerrufsvertrag stellt der Mainserver bereit und welche Kompensationsgarantien enthält er?
