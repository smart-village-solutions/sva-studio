# Assurance: Tenant-IAM-Doctor und Serviceidentitäten

## Scope

Der Change verändert eine sicherheitskritische Grenze zwischen Studio Root, Tenant-Realms und technischen Keycloak-Serviceidentitäten. Er reduziert Berechtigungen und korrigiert negative Existenzaussagen, deren falsche Auswertung zu unnötigen oder falschen Reparaturmaßnahmen führen kann.

## Kritische Invarianten

### TIAM-DOC-01: Keine fehlende Ressource ohne belastbare Sichtbarkeit

`missing` darf nur aus einer erfolgreichen, kausal zugeordneten Abfrage einer für die Ressource nachweislich leseberechtigten Serviceidentität entstehen. `403`, fehlende Capability, veraltete Evidenz und Transportfehler dürfen nicht zu `missing` werden.

Geplanter Nachweis:

- Unit-Tests für leeres Ergebnis mit und ohne nachgewiesenes `view-clients`;
- Adaptertests für `403`, Timeout und widersprüchliche Realm-Zuordnung;
- Regressionstest für einen vorhandenen, für Tenant-IAM aber nicht sichtbaren Login-Client.

### TIAM-DOC-02: Jede Achse nutzt ihre zuständige Identität

Strukturprüfung nutzt Provisioner-Evidenz, Access-Probe nutzt Tenant-IAM und Reconcile nutzt die Identität seines konkreten Fachlaufs. Es gibt keinen stillen Fallback zwischen diesen Identitäten.

Geplanter Nachweis:

- Dependency-Wiring-Tests für interaktive Detailansicht, explizite Probe und Worker;
- negative Tests, die Provisioner-Fallback in der Tenant-IAM-Probe ausschließen;
- Staging-Telemetrie mit logischer Serviceidentität und `requestId`.

### TIAM-DOC-03: Tenant-IAM kann Clients nicht mutieren

Der Tenant-IAM-Service-Account besitzt `view-clients`, aber kein `manage-clients`. Sämtliche Clientmutationen bleiben beim Provisioner.

Geplanter Nachweis:

- exakter Rollensollvertrag im Provisioning-Test;
- negativer Integrationstest für Client-Update und Secret-Rotation mit Tenant-IAM;
- positiver Provisioner-Test für dieselben ausdrücklich autorisierten Operationen;
- realer Staging-Nachweis nach dem Rollen-Reconcile.

### TIAM-DOC-04: Diagnose und Reparatur bleiben getrennt

Doctor- und Probe-Aufrufe sind read-only. Keine Ausführung der Gesundheitsprüfung darf Rollen, Clients, Benutzer, Secrets oder Registry-Daten verändern.

Geplanter Nachweis:

- Adapter-Spies und Integrationsassertions gegen alle Keycloak-Schreibmethoden;
- DB-Vorher-/Nachher-Vergleich für den Probe-Endpunkt;
- E2E-Nachweis, dass Reparatur nur über eine separate bestätigte Aktion startet.

### TIAM-DOC-05: Einzelbefunde bleiben erhalten

`configuration`, `access` und `reconcile` behalten eigene Quelle, Identität, Zeit und Fehlerklassifikation. `overall` ist nur eine Ableitung und darf keine widersprüchliche neue Ursache behaupten.

Geplanter Nachweis:

- tabellengetestete Aggregation aller relevanten Achsenkombinationen;
- Contract-Tests für UI- und MCP-Projektion;
- Test für veraltete oder fehlende Evidenz als `unknown`.

### TIAM-DOC-06: Tenant- und Root-Grenze bleibt geschlossen

Die Root-initiierte Diagnose löst die Zielinstanz serverseitig auf, verleiht dem ausführenden Menschen aber keine Tenant-Rechte. Service-Credentials, Realm oder Instanz können nicht über den Client gewählt oder überschrieben werden.

Geplanter Nachweis:

- Cross-Tenant-Negativtests mit zwei Realms;
- API-Test für manipulierte Realm-, Client- und Instanzangaben;
- Autorisierungstest für Actor ohne `instance_registry_admin`.

### TIAM-DOC-07: Diagnose bleibt datensparsam und korrelierbar

Status, Logs und Audit enthalten stabile Fehlercodes, logische Identität und Korrelation, aber keine Tokens, Secrets, E-Mail-Adressen oder vollständigen Keycloak-Antworten.

Geplanter Nachweis:

- Secret-/PII-Assertions für Logs, API und Audit;
- genau ein kanonisches Probe-Ereignis pro explizitem Lauf;
- Request-ID-Korrelation zwischen Achsen und aggregiertem Ergebnis.

## Failure Modes

- `view-clients` wird ergänzt, aber `manage-clients` zu früh entzogen: Rollout stoppt vor Production; betroffener bislang unbekannter Schreibpfad wird identifiziert und dem Provisioner zugeordnet.
- Provisioner-Evidenz ist nicht aktuell verfügbar: `configuration` bleibt `unknown` oder zeigt den letzten Zeitpunkt, während `access` unabhängig geprüft werden kann.
- Tenant-IAM-Credentials fehlen oder sind falsch: `access` wird `misconfigured` beziehungsweise `forbidden`; es gibt keinen Provisioner-Fallback.
- Keycloak liefert nach Berechtigungsänderung verzögert neue Token-Rechte: Probe wird erst mit neu bezogenem Service-Token bewertet; alte Token werden nicht als aktueller Rollenbeweis verwendet.
- Teilweise grüne Achsen: UI und MCP zeigen die Einzelachsen; `overall` verdeckt keinen Blocker.

## Merge- und Rollout-Nachweis

Vor dem Merge müssen für den exakten PR-HEAD mindestens vorliegen:

- relevante Unit-, Integrations-, Typ- und Server-Runtime-Tests;
- Regressionstest der bekannten Falschmeldung;
- negative Mutations- und Cross-Tenant-Tests;
- aktualisierte arc42-Abschnitte und ADR;
- überprüfter exakter Tenant-IAM- und Provisioner-Rollenvertrag.

Vor Production müssen auf Staging zusätzlich nachgewiesen werden:

- vorhandener Login-Client wird als vorhanden erkannt;
- echte Tenant-IAM-Probe läuft nachweislich mit der Tenant-IAM-Identität;
- Tenant-IAM kann Clientmetadaten lesen, aber keinen Client verändern;
- Provisioner kann eine ausdrücklich angeforderte Strukturreparatur weiterhin durchführen;
- `403`, leeres Ergebnis und Transportfehler erscheinen mit unterschiedlichen stabilen Befunden;
- Staging und Production verwenden denselben unveränderlichen Image-Digest gemäß `docs/guides/studio-rollout-process.md`.
