# Design: Eindeutige Tenant-IAM-Diagnose

## Context

Das Studio verwendet mehrere technische Serviceidentitäten gegen Keycloak. Ihre Aufgaben sind verschieden:

- Der Login-Client authentifiziert Menschen und ist kein Admin-Client.
- Tenant-IAM verwaltet Benutzer, Realm-Rollen und tenantlokale IAM-Abläufe.
- Der Provisioner legt Realms und Clients an, verändert deren Konfiguration und repariert strukturelle Abweichungen.
- Der Doctor aggregiert Befunde, ist aber keine zusätzliche Keycloak-Identität mit eigenen Superrechten.

Heute werden diese Verantwortungen an einzelnen Diagnosepfaden vermischt. Insbesondere kann eine Clientsuche mit der Tenant-IAM-Identität ein leeres Ergebnis liefern, obwohl der Client vorhanden, aber für diese Identität nicht sichtbar ist. Die Übersetzung `[] -> AUTH_CLIENT_MISSING` macht aus unzureichender Evidenz eine falsche Tatsachenbehauptung.

## Goals / Non-Goals

Goals:

- falsche `missing`-Befunde verhindern;
- Struktur, Access und Reconcile fachlich und technisch trennen;
- Least Privilege für Tenant-IAM herstellen;
- Diagnosepfade deterministisch der zuständigen Serviceidentität zuordnen;
- Ergebnisse für UI, Betrieb, MCP und Tests nachvollziehbar machen;
- vorhandene Instanzen ohne Unterbrechung gestuft migrieren.

Non-Goals:

- Rollenbezeichner `instance_registry_admin` und `system_admin` umbenennen;
- eine neue universelle Doctor-Serviceidentität einführen;
- Tenant-IAM Schreibrechte auf Clients geben;
- Gesundheitsprüfungen mit automatischen Reparaturen vermischen;
- eine neue Diagnose-Persistenzschicht einführen;
- Root-Administratoren zu Tenant-Administratoren machen.

## Decisions

### Der Doctor aggregiert, die Fachservices erheben Evidenz

Der Doctor führt keine beliebigen Keycloak-Abfragen mit einer globalen Identität aus. Er ruft fachlich benannte Probes auf und aggregiert deren Ergebnisse:

1. `configuration`: vorhandene Provisioning- oder Strukturprobe mit Provisioner-Berechtigung;
2. `access`: nicht-destruktive Laufzeitprobe mit der Tenant-IAM-Serviceidentität des Ziel-Tenants;
3. `reconcile`: Ergebnis des Rollen- und Benutzerabgleichs mit dessen eigener Lauf- und Korrelationsinformation;
4. `overall`: ausschließlich abgeleitete Zusammenfassung, keine vierte Evidenzquelle.

Damit bleibt sichtbar, ob ein Objekt fehlt, ein Service nicht darauf zugreifen darf oder ein fachlicher Abgleich fehlschlägt.

Der bereits tenantgebundene Live-Audit für normale Tenant-IAM-Reads bleibt dabei
auf der Tenant-IAM-Identität. Nur der eigenständige strukturelle Soll-/Ist-Check
für Realm- und Clientartefakte gehört zum Provisioner. Der Change führt die
frühere Vermischung von Live-Audit und Provisioning-Credentials nicht wieder
ein.

### Negative Existenzaussagen benötigen nachgewiesene Sichtbarkeit

Ein Keycloak-Suchergebnis darf nur dann als `missing` bewertet werden, wenn alle folgenden Bedingungen erfüllt sind:

- die Anfrage wurde erfolgreich gegen den erwarteten Realm ausgeführt;
- die verwendete Serviceidentität ist im Ergebnis ausgewiesen;
- die für diese Ressource erforderliche Lesecapability wurde für diese Identität nachgewiesen;
- Keycloak lieferte ein erfolgreiches, nicht durch Scope oder Filter ambiges Ergebnis;
- die Antwort gehört kausal zum aktuellen Probe-Lauf.

Ohne diesen Nachweis gilt:

- explizites `403` oder gleichwertige Ablehnung: `forbidden`;
- fehlende oder nicht beweisbare Lesecapability: `unknown` oder `misconfigured`;
- Timeout, DNS-, TLS- oder Transportfehler: `unavailable`;
- nachweislich vorhandenes, aber abweichend konfiguriertes Objekt: `misconfigured`;
- ausschließlich ein erfolgreiches leeres Ergebnis unter nachgewiesener Sichtbarkeit: `missing`.

### Tenant-IAM darf Clients lesen, aber nicht verwalten

Die Tenant-IAM-Serviceidentität benötigt `view-clients`, um den konfigurierten Login-Client und für IAM-Abläufe relevante Clientmetadaten nicht-destruktiv zu prüfen. Sie erhält kein `manage-clients`.

Client anlegen, ändern, löschen, Secret rotieren und Service-Account-Konfiguration verändern bleiben ausschließlich Aufgaben von `sva-studio-provisioner`. Die Implementierung prüft den exakten Sollvertrag und nicht nur das Vorhandensein einer Obermenge privilegierter Rollen.

### Keine stillen Identitäts-Fallbacks

Eine fehlende oder unzureichend berechtigte Tenant-IAM-Identität darf nicht unbemerkt durch Provisioner-Credentials ersetzt werden. Ebenso darf eine Strukturprüfung nicht zufällig mit der Login- oder Tenant-IAM-Identität laufen. Der verwendete Credential-Resolver ist Teil des typisierten Probe-Vertrags und wird in Tests nachgewiesen.

### Einheitlicher Evidenzvertrag

Jede Diagnoseachse liefert mindestens:

- `status` aus einem stabilen, achsenspezifischen Zustandsvokabular;
- `summary` als lokalisierbaren, nicht-sensitiven Befund;
- `source` als fachliche Probe oder vorhandene Evidenzquelle;
- `serviceIdentity` als logische Identität, nicht als Secret oder Token;
- `checkedAt` bei aktuell erhobener Evidenz;
- optional `errorCode` und `requestId`.

Veraltete, fehlende oder aus einem anderen Realm stammende Evidenz darf nicht als aktueller `ready`- oder `missing`-Nachweis verwendet werden. `overall` bewahrt die Einzelachsen und reduziert sie nicht zu einer ursachenlosen Fehlermeldung.

### Doctor bleibt read-only

Eine Probe liest und bewertet. Eine Reparatur ist eine separate, explizit autorisierte Aktion mit eigenem Audit- und Ergebnisvertrag. Die UI darf aus einem Befund eine passende Reparatur anbieten, aber der Probe-Aufruf selbst verändert weder Rollen noch Clients noch Secrets.

## Runtime Flow

1. Ein berechtigter `instance_registry_admin` startet die Tenant-IAM-Probe im Root-Tenant.
2. Das Studio löst die Zielinstanz und deren erwarteten Realm serverseitig auf.
3. Die Strukturachse lädt aktuelle oder bereits kausal vorhandene Provisioning-Evidenz. Falls eine Live-Strukturprüfung erforderlich ist, nutzt sie den Provisioner.
4. Die Access-Achse nutzt ausschließlich den Tenant-IAM-Client des Ziel-Tenants und prüft nicht-destruktiv Realm-, Benutzer-, Rollen- und Client-Lesecapabilities.
5. Die Reconcile-Achse übernimmt den letzten oder explizit neu gestarteten Reconcile-Befund, ohne ihn als Strukturbeweis umzudeuten.
6. Der Aggregator bildet `overall` und liefert die drei Einzelachsen unverändert an UI und MCP aus.
7. Eine separat ausgelöste Reparatur wird an Provisioner oder Tenant-IAM geroutet, abhängig vom betroffenen Artefakt.

## Error Handling

- Ein fachlich erwartetes Keycloak-`403` wird in einen stabilen `forbidden`-Befund übersetzt und nicht als allgemeiner Serverfehler verschluckt.
- Ein erfolgreiches leeres Client-Array ohne nachgewiesene Sichtbarkeit bleibt `unknown`; es erzeugt nicht `AUTH_CLIENT_MISSING`.
- Ein fehlender Tenant-IAM-Client oder Secret-Vertrag wird als `misconfigured` ausgewiesen, sofern der Strukturdefekt belastbar nachgewiesen ist.
- Transportprobleme werden als `unavailable` ausgewiesen und verändern keinen zuletzt bekannten Strukturzustand zu `missing`.
- Logs und Audit enthalten Realm-/Instanzreferenz, logische Serviceidentität, Fehlercode und Korrelation, aber keine Tokens, Secrets oder vollständigen Keycloak-Antworten.

## Alternatives Considered

- Nur den UI-Text abschwächen: verworfen, weil die falsche Klassifikation in Serververtrag, MCP und Automatisierung bestehen bliebe.
- Alle Probes mit dem Provisioner ausführen: verworfen, weil dadurch die tatsächliche Betriebsfähigkeit von Tenant-IAM nicht geprüft und eine zu starke Identität in Laufzeitpfade eingebracht würde.
- Tenant-IAM weiterhin `manage-clients` geben: verworfen, weil Lese- und Schreibverantwortung vermischt bleiben und ein kompromittierter Tenant-Service Clients verändern könnte.
- Einen neuen globalen Doctor-Client einführen: verworfen, weil er Verantwortungen dupliziert und eine weitere weitreichende Identität erzeugt. Der Doctor soll vorhandene Fachprobes orchestrieren.

## Migration Plan

1. Fehler- und Evidenzverträge additiv einführen und die aktuelle Falschmeldung durch Regressionstests festhalten.
2. Tenant-IAM-Probe auf eindeutige Sichtbarkeitsprüfung und stabile Fehlerklassifikation umstellen.
3. `view-clients` in den Sollvertrag des Tenant-IAM-Service-Accounts aufnehmen und zunächst zusätzlich provisionieren.
4. Auf Staging nachweisen, dass alle Tenant-IAM-Probes mit der beabsichtigten Identität erfolgreich sind und Clientmutationen mit dieser Identität scheitern.
5. `manage-clients` über den expliziten Provisioning-/Reconcile-Pfad aus bestehenden Tenant-IAM-Service-Accounts entfernen.
6. Doctor-UI, MCP-Ausgabe und Betriebsdokumentation auf den gemeinsamen Evidenzvertrag umstellen.
7. Mit unverändertem Image-Digest nach Production ausrollen und dort einen echten Tenant prüfen.

Ein Rollback stellt vorübergehend `manage-clients` für Tenant-IAM wieder her, falls ein bislang unbekannter produktiver Pfad davon abhängt. Die neue konservative Fehlerklassifikation bleibt bestehen, weil eine Rückkehr zu falschen `missing`-Aussagen nicht zulässig ist.

## Open Questions

Keine fachlichen Open Questions. Konkrete Type-Namen und Fehlercode-Bezeichner werden im bestehenden Tenant-IAM-Statusmodell umgesetzt, ohne parallelen Statusvertrag.
