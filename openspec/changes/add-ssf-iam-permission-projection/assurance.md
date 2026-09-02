# System-Assurance: SSF-IAM-Permission-Projektion

## Kritische Invarianten

| ID           | Invariante                                                                                                        | Führender Nachweis                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `SSF-IAM-01` | Eine Sollprojektion oder ein Cachewert wird nie als bestätigte `authorizationRevision` veröffentlicht.            | Repository-Unit-Test und PostgreSQL-Integrationstest                                                |
| `SSF-IAM-02` | Readiness setzt identische Soll-, Read-back- und Session-Widerrufsrevisionen derselben Generation voraus.         | DB-Constraint, Repository-CAS und Reconciler-Unit-Test                                              |
| `SSF-IAM-03` | Projektion, Read-back, Retry und Session-Widerruf bleiben tenantgebunden; ein Tenant beeinflusst keinen zweiten.  | RLS-Policy, tenantgebundene Advisory-Lock, deterministischer Widerrufsrequest und Zwei-Tenant-Tests |
| `SSF-IAM-04` | Tenant-Benutzertokenclaim, bestätigte Projektion und Runtime-Antwort verwenden dieselbe Revision.                 | Tokenprojektions-, Runtime-Host- und SSF-Session-Vertragstests                                      |
| `SSF-IAM-05` | Studio und SSF verwenden im Tenant-Realm dieselbe Benutzeridentität und dasselbe unveränderte OIDC-`sub`.         | Vertragstest des Tenant-Clients, Staging-Token und tenantgenauer Widerruf                           |
| `SSF-IAM-06` | Ein SSF-Permission-Wechsel widerruft nur SSF-Sessions und beendet keine Studio-Sitzung desselben Realm-Benutzers. | SSF-Session-Adaptertest und Staging-Sessionnachweis                                                 |
| `SSF-IAM-07` | Studio→SSF verwendet eine eigene technische Identität und niemals den gegenläufigen SSF→Studio-Runtime-Client.    | Deploymentkonfiguration, Tokenprovider- und Transport-Vertragstest                                  |

## Failure Modes

- Write- oder Read-back-Fehler setzen die exakte Generation auf `blocked`.
- Ein Read-back-Mismatch veröffentlicht keine Revision.
- Ein Widerrufsfehler lässt den Zustand außerhalb von `ready` und ist retrybar.
- Ein unterlegener konkurrierender Lauf erhält keinen Claim und führt keinen
  externen Write aus.
- Ein Prozessabbruch gibt die tenantgebundene Datenbanksperre frei; der
  verwaiste Zwischenzustand ist durch einen idempotenten Folgelauf wieder
  beanspruchbar.
- Eine neue Sollgeneration macht alte Readiness vor dem externen Write
  unwirksam.
- Ein nicht vorhandener oder inkompatibler SSF-Provider lässt den Consumer
  begrenzt fehlschlagen und die Projektion außerhalb von `ready`; er wird nicht
  durch einen lokalen Erfolgsstub ersetzt.

## Freigabegate

Der produktive Schalter bleibt gesperrt, bis Staging für denselben Image-Digest
die Projektion im gemeinsamen Tenant-Realm, vollständigen Read-back,
Benutzertokenclaim, Runtime-Revision und tenantgenauen Session-Widerruf
nachweist. Das installationsweite Service-Token wird dabei getrennt auf
Identität, Audience und Action geprüft.
