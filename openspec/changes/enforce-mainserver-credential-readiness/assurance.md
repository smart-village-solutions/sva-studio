# System-Assurance: Mainserver-Credential-Readiness

## Kritische Invarianten

| ID        | Invariante                                                                                              | Führender Nachweis                                    |
| --------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `MSCR-01` | Status, Logs und API enthalten keine Credentialwerte oder vollständigen Benutzeridentitäten.            | Secret-/PII-Negativtests                              |
| `MSCR-02` | Mainserver-Provisionierung gilt erst nach passendem kanonischem Read-back als Credential-erfolgreich.   | Create-, Einzel- und Bulk-Call-Order-/Read-back-Tests |
| `MSCR-03` | Nicht bereite Credentials starten keinen Mainserver-Aufruf und keinen Principal-Fallback.               | Adapter-Spies und Zwei-Principal-Negativtests         |
| `MSCR-04` | Credential-Fehler bleiben principalgenau, erhalten Accounts/Snapshots und werden persistent gedrosselt. | Repository-, Fake-Time- und Prozessneustarttests      |

## Zustandsverhalten

| Zustand       | Consumer                   | Automatische Wiederholung            |
| ------------- | -------------------------- | ------------------------------------ |
| `ready`       | Mainserver-Aufruf erlaubt  | regulär                              |
| `missing`     | blockiert vor dem Upstream | frühestens nach 15 Minuten           |
| `partial`     | blockiert vor dem Upstream | frühestens nach 15 Minuten           |
| `stale`       | blockiert vor dem Upstream | frühestens nach 15 Minuten           |
| `unavailable` | blockiert vor dem Upstream | vorhandener kurzer technischer Retry |

Ein manueller Refresh darf die Prüfung vorziehen, aber nicht das Gate umgehen.
Kein Fehler darf einen vorhandenen Snapshot löschen oder einen lokalen Account
deaktivieren.

## Merge-Gate

Vor Merge müssen die fokussierten Credential-, Provisioning- und Projection-
Tests, betroffene Type-Gates, Server-Runtime, OpenSpec, Dokumentations- und
Placement-Checks für den exakten HEAD grün sein.
