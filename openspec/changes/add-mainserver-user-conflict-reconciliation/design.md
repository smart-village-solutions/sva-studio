## Context

`POST /api/v2/user_provisionings` erzeugt persönliche Mainserver-Credentials für einen Keycloak-Subject. Antwortet der Mainserver mit `local_user_conflict`, wiederholt der bestehende Reprovision-Pfad nur dieselbe Provisionierung und kann die historische Bindung nicht auflösen.

Für diesen begrenzten Fall gilt dieselbe normalisierte E-Mail-Adresse im Studio und Mainserver als ausreichende fachliche Identität. Der Rebind bleibt dennoch eine sensitive Mutation: Er muss bewusst ausgelöst, atomar, idempotent, auditierbar und nach einem unklaren Upstream-Ergebnis sicher wiederholbar sein.

## Goals

- Einen bestätigten E-Mail-Konflikt durch einen berechtigten System-Admin direkt auflösen.
- Neue persönliche Mainserver-Credentials sicher in den bestehenden Keycloak- und DataProvider-Ablauf übernehmen.
- Vorhandene Autorisierungs-, Fresh-Reauth-, Audit- und Binding-Mechanismen wiederverwenden.
- Den Implementierungs- und Betriebsumfang auf den konkreten Konfliktfall begrenzen.

## Non-Goals

- Keine zusätzliche Identitätsprüfung neben der normalisierten E-Mail-Gleichheit.
- Keine Vier-Augen-Freigabe, Approval-Engine oder neue Workflow-Persistenz.
- Kein allgemeiner Account-Merge und keine automatische Auflösung abweichender E-Mail-Adressen.
- Keine externe Mutation ohne dedizierten Mainserver-Rebind-Vertrag.

## Decisions

### E-Mail-Gleichheit ist die fachliche Zuordnung

Die Read-only-Prüfung vergleicht die im Studio hinterlegte und die vom Mainserver redigiert bestätigte E-Mail-Adresse nach derselben vertraglich festgelegten Normalisierung. Nur bei Gleichheit wird die Reconcile-Aktion angeboten. Eine Abweichung bleibt `local_user_conflict` und kann über diesen Pfad nicht aufgelöst werden.

### Direkte, geschützte Admin-Aktion

Der Pfad verwendet die fully-qualified Action `iam.reconcileMainserverUserConflict` und ist auf `system_admin` der Zielinstanz begrenzt. Vor der Mutation verlangt der Server eine gültige serverseitige Fresh-Reauth-Evidenz und eine explizite Wirkungsbestätigung. Antrag und zweite Freigabe entfallen.

### Kein eigenes Reconciliation-Ledger

Studio verwendet den bestehenden Provisioning-/Binding-Zustand, das vorhandene IAM-Audit und die bestehende Sperre für konkurrierende Benutzer-/DataProvider-Mutationen. UI-Lade- und Ergebniszustände sind keine neue fachliche Statusmaschine. Unklare oder lokal unvollständige Ergebnisse bleiben über den bestehenden Fehlerzustand als `reconciliation_required` sichtbar.

### Atomarer und wiederholbarer Mainserver-Vertrag

Der Mainserver stellt einen dedizierten Rebind-Vertrag bereit. Er prüft die normalisierte E-Mail-Gleichheit erneut, bindet die historische Identität atomar an den Ziel-Subject, rotiert die persönlichen Credentials und invalidiert den alten Credential-Zustand. Eine aus Instanz, Zielaccount, Ziel-Subject und normalisierter E-Mail deterministisch abgeleitete Operationsreferenz macht Wiederholungen idempotent. Derselbe Vertrag oder ein zugehöriger Read-Endpunkt liefert nach Timeout das dauerhafte Ergebnis einschließlich eines geschützten Credential-Replays für die serverseitige Wiederherstellung.

Studio persistiert bestätigte Credentials in Keycloak und verifiziert anschließend die DataProvider-Bindung. Scheitert ein lokaler Folgeschritt, behauptet Studio keinen Erfolg und wiederholt bei der nächsten bewussten Reconcile-Aktion dieselbe Operationsreferenz, statt einen neuen Rebind zu erzeugen.

## Data Flow

1. Persönliches Provisioning meldet `local_user_conflict`.
2. Ein `system_admin` startet in der Benutzer-Detailansicht eine Read-only-Prüfung.
3. Der Server bestätigt die normalisierte E-Mail-Gleichheit und liefert nur einen redigierten Befund.
4. Der System-Admin bestätigt die Wirkung; der Server prüft Action, Instanz, CSRF, Fresh Reauth und den aktuellen Konflikt erneut.
5. Studio sperrt den bestehenden Benutzer-/DataProvider-Pfad und ruft den atomaren Mainserver-Rebind mit der deterministischen Operationsreferenz auf.
6. Studio persistiert die neuen Credentials in Keycloak, verifiziert die DataProvider-Bindung und schreibt das Audit-Ergebnis.
7. Bei Timeout oder lokalem Teilfehler bleibt der Vorgang fail-closed und kann über dieselbe Aktion und Operationsreferenz wiederaufgenommen werden.

## Risks and Mitigations

- Falsche oder gemeinsam genutzte E-Mail-Adresse → bewusste Produktentscheidung, redigierter Prüfbefund und explizite Wirkungsbestätigung.
- Unklares Upstream-Ergebnis → deterministische Operationsreferenz, idempotenter Rebind und dauerhafte Ergebnisabfrage.
- Lokaler Fehler nach Rebind → geschützter Credential-Replay, kein Erfolgsstatus und Wiederaufnahme über denselben Pfad.
- Credential-Leak → Credentials bleiben write-only und erscheinen weder in UI, Audit noch Logs.
- Parallele Mutation → bestehende Benutzer-/DataProvider-Sperre und atomare Upstream-Vorbedingung.

## Migration Plan

1. Mainserver-Rebind-, Ergebnisabfrage- und Credential-Replay-Vertrag vereinbaren und mit Contract-Tests absichern.
2. Serverpfad, Audit und UI ohne neue Datenbanktabelle implementieren.
3. In Dev und Staging mit synthetischen Konfliktkonten und Fehlerfällen nachweisen.
4. Production über den kanonischen Promote-Pfad ausrollen; erster realer Rebind erfolgt nach dokumentierter Betriebsfreigabe.
