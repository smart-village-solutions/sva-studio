## Context

`inspectRealmAndClients` ist ein produktiv erreichbarer read-only Auditpfad. Die
Funktion authentisiert `kcadm`, liest Realm, Login- und Tenant-Admin-Client,
Secrets, Realm-Rollen, einen aktiven `system_admin`-Benutzer und dessen Rollen
sowie die realm-management-Rollen des Tenant-Admin-Serviceaccounts. Anschließend
bewertet sie vierzehn Befunde. Jede Check-ID samt Titel, Zusammenfassung,
Detailfeldern und Fail-/Warn-/Skip-Priorität ist operativer Vertrag.

## Goals / Non-Goals

- Goals:
  - Erhebung und Bewertung durch einen typisierten Snapshot trennen;
  - die Bewertung rein und vollständig durch Characterization-Tests absichern;
  - die bestehende `kcadm`-Reihenfolge und das Config-Cleanup beweisen;
  - Secret-Inhalte außerhalb der kurzlebigen Vergleichsgrenze ausschließen;
  - den kritischen Komplexitätshotspot ohne Suppression beseitigen.
- Non-Goals:
  - neue Checks, Check-IDs, Statuswerte oder Detailfelder;
  - Keycloak-Mutationen, Reconcile, Rollout oder Konfigurationsänderungen;
  - ein generisches Regel- oder Audit-Framework.

## Decisions

### Decision: Snapshot bildet nur bereits erhobene Fakten ab

Ein zweckgebundener, unveränderlicher Snapshot enthält genau die Fakten, die der
bestehende Audit bereits liest. Die `kcadm`-Adapter bleiben in der operativen
Datei; der Snapshot führt keine zweite I/O- oder Konfigurationsabstraktion ein.

Alternativen considered:

- Generische Check-Definitionen oder eine Rule Engine: verworfen, weil nur ein
  stabiler Vertrag vorliegt und zusätzliche Abstraktion keine Ownership spart.
- Einzelne I/O-Aufrufe direkt aus Check-Funktionen: verworfen, weil dadurch
  Reihenfolge, Mehrfachabfragen und reine Tests schlechter kontrollierbar wären.

### Decision: Secret-Befunde werden als Vergleichsfakten bewertet

Der Snapshot transportiert Secret-Werte nur intern und kurzlebig bis zur reinen
Bewertung. Die Funktion emittiert ausschließlich die bisherigen Aussagen
`tenant secret compared` oder `secret missing`; weder Ergebnisse noch
Testdiagnostik geben die Werte aus. Für Tests werden ausschließlich synthetische
Marker verwendet und explizit auf Abwesenheit in der Ergebnisevidenz geprüft.

### Decision: Realm-fehlt bleibt ein früher, einzelner Befund

Kann das Realm nicht gelesen werden, bleibt die Erhebung unmittelbar bei dem
einen bisherigen `keycloak.realm.exists`-Fehler stehen. Der Pfad erzeugt keinen
künstlichen Vollsnapshot und keine weiteren Checks.

## Risks / Trade-offs

- Status- oder Textdrift durch Extraktion → Vorher ergänzte Characterization-
  Matrix vergleicht komplette `AuditCheckResult[]`-Objekte.
- Veränderte `kcadm`-Reihenfolge → Adaptertest fixiert die Aufrufsequenz und
  das Cleanup der temporären Config.
- Secret-Leak durch Testfehler → Testevidenz prüft nur synthetische Marker auf
  Abwesenheit und speichert keine realen Umgebungswerte.

## Migration Plan

1. Characterization-Matrix gegen den bestehenden Monolithen ergänzen und grün
   ausführen.
2. Typisierten Snapshot und reine Bewertung extrahieren.
3. Bestehende Erhebung unverändert an die Bewertung anbinden.
4. Unit-, Skript-Type-, Complexity-, Fallow-, File-Placement- und PR-Gates
   ausführen.
5. Keine Daten-, Realm-, Secret- oder Runtime-Migration ausführen.

## Open Questions

- Keine. Jede erforderliche Auditvertrags- oder Keycloak-Änderung ist eine
  STOP-Bedingung und benötigt einen separaten Change.
