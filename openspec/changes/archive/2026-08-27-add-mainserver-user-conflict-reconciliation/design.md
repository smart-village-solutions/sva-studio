## Context

`POST /api/v2/user_provisionings` erzeugt persönliche Mainserver-Credentials für einen Keycloak-Subject. Antwortet der Mainserver mit `local_user_conflict`, bildet Studio den Befund bereits auf `mainserver_user_conflict` ab und zeigt die zugehörige Request-ID an. Der bestehende Reprovision-Pfad wiederholt dieselbe Provisionierung und kann die historische Bindung nicht auflösen.

Der Mainserver besitzt bereits einen kommunalen Keycloak-Sync. Dieser kann eine nachweislich veraltete lokale Keycloak-ID bereinigen und den Benutzer anschließend per E-Mail finden. Er läuft jedoch für alle Benutzer einer Kommune und behält eine noch existierende historische Keycloak-ID bewusst bei. Er ist daher kein allgemeiner Ersatz für einen gezielten Rebind-Vertrag.

## Goals

- Den Konflikt im Studio eindeutig als manuell zu behandelnden, nicht durch Wiederholung lösbaren Zustand erklären.
- Dem Mainserver-Betrieb einen begrenzten, nachweisbaren Ablauf geben.
- Nach der operativen Korrektur ausschließlich die bestehende Studio-Reprovisionierung verwenden.
- Mainserver-Code, Studio-API, Berechtigungen und Persistenz unverändert lassen.

## Non-Goals

- Kein automatischer Rebind und keine neue externe Mutation aus dem Studio.
- Kein eigener Konfliktstatus, Workflow oder Audit-Ereignistyp.
- Keine allgemeine Bereinigung aller Mainserver-/Keycloak-Abweichungen.

## Decisions

### Der Konflikt bleibt eine Betriebsaufgabe

Studio zeigt den dedizierten Fehlertext und die vorhandene Request-ID. Der Text weist ausdrücklich darauf hin, dass erneute Reprovisionierung vor der Korrektur wirkungslos ist. Es entsteht keine zusätzliche Schaltfläche oder API.

### E-Mail-Gleichheit reicht für die operative Zuordnung

Der Mainserver-Betrieb prüft Instanz beziehungsweise Kommune sowie die normalisierten E-Mail-Adressen der Studio-, Mainserver- und Ziel-Keycloak-Identität. Stimmen sie überein, darf die historische lokale Subject-Verknüpfung kontrolliert auf den Ziel-Subject korrigiert werden. Bei Abweichung endet der Ablauf ohne Mutation.

### Vorhandenen Sync nur bei veralteter Verknüpfung nutzen

Zeigt die gespeicherte Mainserver-Keycloak-ID auf keinen existierenden Keycloak-Benutzer mehr, kann der vorhandene kommunale Sync nach einer Auswirkungsprüfung verwendet werden. Weil er alle Benutzer der Kommune verarbeitet, benötigt er ein Wartungsfenster und eine Vorher-/Nachher-Kontrolle.

Existiert die historische Keycloak-ID noch, darf der Bulk-Sync nicht als Rebind missbraucht werden. Der Mainserver-Betrieb führt dann eine auf genau einen Benutzer und ein Member begrenzte Korrektur über die Rails-Anwendungsschicht durch und dokumentiert alten und neuen Subject-Bezug im Betriebsticket. Direkte SQL-Manipulation bleibt ausgeschlossen.

### Bestehende Reprovisionierung schließt den Ablauf ab

Nach bestätigter Mainserver-Korrektur löst ein berechtigter Studio-Administrator die bestehende Reprovisionierung genau einmal aus. Studio übernimmt die vom unveränderten Mainserver-Vertrag gelieferten persönlichen Credentials wie bisher serverseitig in Keycloak. Erfolg wird nur anhand der vorhandenen Erfolgsantwort und des anschließenden Zugriffs bestätigt.

## Data Flow

1. Die Studio-Reprovisionierung meldet `mainserver_user_conflict` einschließlich Request-ID.
2. Studio erklärt den manuellen Betriebsbedarf und empfiehlt keine Wiederholung.
3. Der Mainserver-Betrieb prüft Instanz, normalisierte E-Mail, lokale `User`-/`Member`-Datensätze sowie historischen und aktuellen Keycloak-Subject.
4. Bei abweichender E-Mail endet der Ablauf ohne Änderung.
5. Bei gleicher E-Mail bereinigt der Betrieb die Verknüpfung über den für den konkreten Zustand passenden vorhandenen Mainserver-Betriebspfad.
6. Der Studio-Administrator führt die bestehende Reprovisionierung erneut aus und prüft Erfolg und nachfolgenden Mainserver-Zugriff.

## Risks and Mitigations

- Gemeinsam genutzte oder falsche E-Mail-Adresse → Instanzbezug, dreiwegiger E-Mail-Abgleich und Abbruch bei Abweichung.
- Unbeabsichtigte Bulk-Wirkung → kommunalen Sync nur bei veralteter ID, nach Auswirkungsprüfung und im Wartungsfenster verwenden.
- Falscher Ziel-Subject → alten und neuen Subject vor der Mutation dokumentieren und den Ziel-Subject direkt in Keycloak prüfen.
- Unvollständige Korrektur → `User` und `Member` gemeinsam behandeln; anschließend bestehende Reprovisionierung und Zugriff verifizieren.
- Credential-Leak → keine Secrets in Ticket, UI, Logs oder Runbook-Ausgaben übernehmen.

## Rollback

Vor der operativen Mutation werden die bisherigen `User`-/`Member`-IDs im geschützten Betriebsticket erfasst. Scheitert die Korrektur vor erfolgreicher Reprovisionierung, stellt der Mainserver-Betrieb ausschließlich diese beiden Verknüpfungen über die Anwendungsschicht wieder her. Studio benötigt keinen Rollback.
