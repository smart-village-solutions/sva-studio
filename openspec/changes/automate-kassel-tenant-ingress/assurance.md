# Assurance: Automatisierter Kasseler Tenant-Ingress

## Kritische Invarianten

| ID             | Invariante                                                                                                                                                                                                                                  | Geplanter Nachweis                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `KAS-RUN-01`   | Pro Instanz, Create-Operation und Idempotency-Key existiert genau ein fachlich führender Elternlauf, der in place bis zu einem terminalen Ergebnis fortgeschrieben wird.                                                                    | PostgreSQL-Integrationstest für Create, parallele Wiederholung und Status-/Step-Updates |
| `KAS-WAKE-01`  | Jede nichtterminale Stufe besitzt einen persistent claimbaren Folgepunkt, Lease-/Wake-up-Zeit und Deadline; Prozess- oder Browserabbruch kann keinen unsichtbar offenen Lauf erzeugen.                                                      | Fault-Injection für Commit-Grenzen, Claim-Abbruch, Lease-Ablauf, Neustart und Deadline  |
| `KAS-SNAP-01`  | Eltern- und Kindlauf verwenden korrelierte, versionsgebundene Sollzustände; ein alter oder abweichender Kindlauferfolg kann den aktuellen Elternlauf nicht freigeben.                                                                       | Snapshot-/Fingerprint-Integrationstests und Upgrade-/Drain-Test                         |
| `KAS-ACT-01`   | Ein Kasseler Create-Lauf ist nur nach erfolgreichem externem TLS-, Studio-Login- und modulabhängigem Readiness-Smoke erfolgreich; eine aktive Instanz mit nichtterminalem Lauf wird weiterbearbeitet oder fail-closed auf `failed` gesetzt. | Abbruchtests vor/nach Aktivierung sowie öffentliche Studio- und SSF-Smokes              |
| `KAS-SSF-01`   | Bei effektiv aktivem SSF umfasst Erfolg Browser- und Ressourcenclient, IAM-Projektion, Runtime-Baseline, Runtime-Readiness, aktuelle Authorization-Revision und Directory → Callback → Gateway; Directory-Filter allein ist keine Freigabe. | #1319-Vertragstests plus Zwei-Realm-Ende-zu-Ende-Nachweis                               |
| `KAS-IDEM-01`  | Retry oder Redelivery erzeugt höchstens einen wirksamen Router und verändert korrekte Registry-, Keycloak- oder Lifecycle-Artefakte nicht.                                                                                                  | Parallelitäts-, Retry- und Redelivery-Tests mit identischem Idempotency-Key             |
| `KAS-SEC-01`   | Nur der Kasseler Provisioner darf das Konfigurationsverzeichnis schreiben; App und Traefik können es nicht schreiben, und der Provisioner besitzt weder Docker-Socket noch DNS-/ACME-Zugangsdaten.                                          | Deployment-Vertragstest und Live-Inspection von Mounts und Secrets                      |
| `KAS-CFG-01`   | Ungültige oder unvollständige Konfiguration ersetzt niemals die letzte gültige Routerdatei.                                                                                                                                                 | Renderer-Unit-Test und Fault-Injection vor Validierung und atomarem Rename              |
| `KAS-FAIL-01`  | Terminale Fehler bewahren erzeugte Artefakte, legen keine Secrets offen und lassen Instanz, Directory und Module fail-closed.                                                                                                               | Fehlerpfad-Integrationstest, Readbacks und Log-/Audit-Redaction                         |
| `KAS-CERT-01`  | Nach Bestandsmigration besitzt jeder erfolgreiche Tenant einen expliziten Router und einen öffentlich vertrauenswürdigen Zertifikatsvertrag für seinen exakten Host.                                                                        | Traefik-Konfigurationsreadback, SNI-/SAN-Prüfung und öffentlicher HTTPS-Smoke           |
| `KAS-SCOPE-01` | Ohne expliziten Kassel-Modus bleiben Dev, Staging, Production und andere Installationen sowie der kanonische Promote-Vertrag unverändert.                                                                                                   | Default-Konfigurationstest und bestehende Deployment-Regressionstests                   |

## System- und Trust-Boundaries

| ID       | Übergang                         | Failure Mode                                                   | Reaktion                                                                        |
| -------- | -------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `BND-01` | Admin → Create-API               | Fehlende Root-Berechtigung, alte Sitzung, ungültiger Host      | Vor Persistenz fail-closed ablehnen und auditieren                              |
| `BND-02` | Create-API → Instanz/Elternlauf  | Instanz gespeichert, aber Lauf oder Wake-up verloren           | Eine transaktionale oder beweisbar gleichwertige atomare Persistenzgrenze       |
| `BND-03` | Elternlauf → Keycloak-Kindlauf   | Doppelte Zustellung, alter Snapshot, Teilanlage                | Instanz-Lock, explizite Korrelation, Snapshotprüfung und idempotenter Reconcile |
| `BND-04` | Elternlauf → Plugin-Lifecycle    | Fehlende/stale Revision oder false-ready Directory             | Aktuelle Readiness read-back prüfen; keine Freigabe allein durch Sichtbarkeit   |
| `BND-05` | Provisioner → Dateisystem        | Teilwrite, Pfadinjektion, Dateirechte                          | Strikte Hostableitung, Validierung, atomarer Rename, minimales Writer-Mount     |
| `BND-06` | Datei → Traefik                  | Parse-/Reload-Fehler oder Provider-Ausfall                     | Letzte gültige Datei erhalten, Übernahme aktiv prüfen, Lauf nicht fortsetzen    |
| `BND-07` | Traefik/ACME → öffentliches Netz | Challenge-Timeout, falsches Zertifikat, falscher Router        | Begrenzter Retry; ohne Nachweis terminal `failed`                               |
| `BND-08` | Runtime → Studio-OIDC            | Falscher Realm, fehlendes Secret, Login-500, falscher Callback | Elternlauf nicht erfolgreich; Instanz innerhalb der Deadline `failed`           |
| `BND-09` | Studio → SSF-Readiness           | Client, Baseline, Projektion, Revision oder Gateway fehlen     | Lifecycle bleibt pending/blocked; Elternlauf endet nicht erfolgreich            |
| `BND-10` | UI → Elternlauf                  | Browser geschlossen oder Polling unterbrochen                  | Serverlauf unverändert fortsetzen; UI bleibt reiner Beobachter                  |
| `BND-11` | alter → neuer Worker             | Nichtkompatibler Queue-/Snapshot-Vertrag                       | Bestehenden Drain-/Cutoff-Vertrag anwenden und Elternläufe explizit nachweisen  |

## Zustands- und Konvergenzmatrix

| Ausgang                            | Ereignis                                     | Erwarteter Zustand                                                                                      |
| ---------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Kein Tenant                        | gültiges Create                              | Instanz, ein Elternlauf und ein persistent ausführbarer Startzustand entstehen ohne verlorenes Wake-up  |
| `requested`/`provisioning`         | Browser schließt                             | Lauf wird serverseitig ohne UI fortgesetzt                                                              |
| Elternlauf wartet auf Keycloak     | unpassender älterer Kindlauf ist erfolgreich | Elternlauf ignoriert ihn und wartet auf oder erzeugt den korrelierten Snapshot-Lauf                     |
| `provisioning`                     | Worker stirbt nach Router-Rename             | Lease läuft ab; Recovery erkennt die korrekte Datei und setzt bei der nächsten unbestätigten Stufe fort |
| `provisioning`                     | ACME bleibt bis Deadline erfolglos           | Instanz und Elternlauf werden terminal `failed`; Artefakte bleiben erhalten                             |
| `active`, Elternlauf nichtterminal | Prozess stirbt vor öffentlichem Smoke        | Recovery setzt die Postconditions fort oder führt fail-closed zu `failed`                               |
| `active`, Elternlauf nichtterminal | Studio-Login liefert 500                     | Instanz und Elternlauf werden terminal `failed`; Route und Evidenz bleiben erhalten                     |
| `active`, SSF effektiv aktiv       | Runtime-Baseline oder Revision fehlt         | Lifecycle bleibt pending/blocked; Directory bleibt fail-closed; Elternlauf wird nicht erfolgreich       |
| `failed`                           | autorisierter Retry                          | Vorhandene Artefakte werden idempotent reconciliiert; ein wirksamer Lauf konvergiert                    |
| statischer Bestands-Tenant         | dynamischer Router ist extern bewiesen       | Nur dieser Host darf anschließend aus der statischen Regel entfernt werden                              |
| beliebig                           | paralleles Create/Retry                      | Höchstens ein wirksamer Elternlauf pro Instanz/Operation                                                |
| normale Studio-Umgebung            | Kassel-Modus nicht aktiviert                 | Bestehendes Verhalten ohne File-Provider-Mutation                                                       |

## Geplante Nachweise je Lieferabschnitt

### Slice A: Elternlauf und Orchestrierung

- PostgreSQL-Integrationstests für atomare Create-Persistenz,
  In-place-Statusupdates, Kindlauf-Korrelation, Claim, Lease, Deadline und
  konkurrierende Idempotenz.
- Fault-Injection vor und nach jeder Commit-Grenze sowie vor und nach
  Aktivierung.
- Upgrade-/Drain-Test gegen den bestehenden Standalone-Worker-Vertrag.
- Schema-Snapshot- und Migrations-Roundtrip, falls der Elternlauf erweitert
  wird.

### Slice B: Renderer und SSF-Infrastruktur

- Unit- und Property-Tests für Hostnormalisierung, reservierte Namen,
  Multi-Label-, Punycode-, Pfad-, YAML- und Traefik-Regel-Injektion.
- Golden-Tests für deterministische Routerdateien und
  providerqualifizierte Service-Referenz.
- Compose-/Deployment-Vertragstest für File Provider, Read-only-Traefik-Mount,
  Provisioner-Writer-Mount und fehlenden Docker-Socket.
- Test mit leerem dynamischem Verzeichnis sowie gültiger und ungültiger Datei.

### Slice C: Modulabhängige Readiness

- Wiederverwendung der #1319-Tests für Client-, IAM-, Baseline-, Runtime- und
  Revision-Readiness.
- Integrationsnachweis, dass der Elternlauf nur den aktuellen Lifecycle-
  Snapshot akzeptiert und Directory-Filter nicht als Primärfreigabe nutzt.
- Negativtests für nicht zugewiesenes SSF sowie pending, blocked und stale.

### Slice D: Kasseler Abnahme

- Live-Inspection der Provisioner- und Traefik-Mounts, Provider und
  Secret-Grenzen.
- Unterbrechungsfreie Einzelmigration von `tenant-havelland` und anschließend
  `svs` aus der statischen Regel.
- Öffentliche SNI-/SAN-, HTTPS-, Studio-Login- und bei SSF vollständige
  Directory-/Callback-/Gateway-Smokes.
- Negativ-Smoke für unbekannten Host, fehlgeschlagenen Tenant und fehlende
  modulbezogene Readiness.
- Nachweis eines abgebrochenen Provisioners mit automatischer terminaler
  Konvergenz.
- Dokumentierter Rollback ohne Löschung von Registry, Keycloak, Secrets oder
  Lifecycle-Daten.

## Merge- und Enablement-Gates

- OpenSpec-Change und Assurance sind vor Implementierung freigegeben.
- #1319/#1339 oder ein gleichwertiger Nachfolger ist für den verwendeten
  SSF-Readiness-Vertrag gemergt und am exakten HEAD grün.
- Studio- und `smart-speech-flow`-PR besitzen grüne, HEAD-gebundene Checks und
  Review.
- Studio wird über den kanonischen geschützten Promote-Prozess mit demselben in
  Staging verifizierten Digest ausgerollt.
- Der Kassel-Modus bleibt bis zum erfolgreichen SSF-File-Provider-Rollout aus.
- `svs` gilt erst nach Diagnose des Login-500 und vollständigem externem Smoke
  als akzeptiert.
- Ein grüner TLS- oder Directory-Smoke allein erfüllt das Enablement-Gate nicht.
