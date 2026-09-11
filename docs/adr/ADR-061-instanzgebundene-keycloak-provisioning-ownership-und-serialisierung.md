# ADR-061: Instanzgebundene Keycloak-Provisioning-Ownership und -Serialisierung

## Status

Akzeptiert am 11. September 2026.

## Kontext

Das Keycloak-Provisioning verarbeitet veränderliche Instanzkonfigurationen aus
der Registry. Neue und importierte Realms, geschützte Rollen wie
`system_admin`, parallele Änderungen über Root-UI und CLI sowie abgebrochene
Worker-Läufe müssen dabei dieselben Ownership- und Konsistenzregeln einhalten.
Eine reine Statusprüfung vor dem Enqueue verhindert weder konkurrierende
Mutationen noch die Verarbeitung eines inzwischen veralteten Claims.

## Entscheidung

- Studio-verwaltete technische Rollen tragen die Attribute `managed_by=studio`,
  die kanonische `instance_id` und einen stabilen `role_key`. Mehrdeutige,
  fremde oder mehrwertige Ownership gilt als Konflikt. Eine Migration wird nur
  für eindeutig erkannte Legacy-Rollen im zugehörigen Realm ausgeführt.
- Ein von Studio neu angelegter Realm bewahrt die Herkunft des
  Tenant-Admin-Bootstraps. Bei einem importierten bestehenden Realm darf ohne
  Bootstrap ausschließlich die erforderliche Rollenstruktur repariert werden;
  `system_admin` bleibt in allen Fällen geschützt.
- Vollständige Instanzmutationen, Enqueue und Worker-Ausführung verwenden
  dieselbe PostgreSQL-Advisory-Lock-ID aus der `instanceId`. Mutierende
  CLI-Transaktionen setzen unter dieser Sperre zusätzlich Rolle und
  `app.instance_id` für den vollständigen RLS-Kontext.
- Der Claim erwirbt die Instanzsperre bereits vor dem Wechsel auf `running`.
  Die Claim-Auswahl prüft alle abarbeitbaren Kandidaten und begrenzt erst nach
  einem erfolgreichen Sperrversuch auf den ältesten Lauf. Eine gesperrte
  Instanz hält dadurch keine unabhängigen Instanzen auf.
  Die installationsweite Prüfung der Realm-Zuordnungen nutzt einen getrennten,
  nicht tenantgefilterten Repository-Read.
- Ein Worker lädt den beanspruchten Lauf innerhalb der Sperre erneut und führt
  ihn nur aus, wenn er weiterhin `running` ist.
- Ein seit 15 Minuten laufender Claim wird nur dann als verwaist beendet, wenn
  `pg_try_advisory_xact_lock` bestätigt, dass kein Worker die Instanzsperre hält.
  Ein lokaler Worker beendet außerdem ältere `planned`-Runs unter derselben
  Sperre, bevor sein Startup-Cutoff neuere Runs auswählt.
- Der Worker darf während des Laufs nur die beiden Keycloak-Secrets gezielt
  abgleichen. Auch der operative Secret-Repair liest und schreibt den aktuellen
  Instanzzustand vollständig unter derselben Sperre. Fleet-Backfills laden den
  Datensatz nach Sperrerwerb erneut und überspringen inzwischen inaktive oder
  bereits aktualisierte Instanzen. Evidenz-Snapshots enthalten Policy-Version
  und einen Fingerprint der relevanten Konfiguration einschließlich der Secret-Ciphertext-Versionen.
  Lesezugriffe wählen laufübergreifend den neuesten passenden finalen oder
  Worker-Snapshot; der Abschluss schreibt ausschließlich den aus einem
  konsistenten Postflight-Read stammenden Status. Preflight und Plan bleiben
  separate Worker-Snapshots und werden nicht durch spätere, unabhängige Reads
  mit einem erfolgreichen Abschluss vermischt.

## Folgen

Konkurrierende Registry- und Keycloak-Änderungen derselben Instanz werden
serialisiert. Ein Prozessabbruch kann einen Claim höchstens bis zum Ablauf der
Recovery-Frist blockieren; ein aktiver langsamer Worker wird dabei nicht allein
aufgrund seines Alters beendet. Ownership-Konflikte bleiben sichtbar und
werden nicht durch eine automatische Übernahme fremder Rollen verdeckt.

Die Snapshot-Leser können ältere Runs prüfen, bis ein zur aktuellen
Konfiguration passender Snapshot gefunden ist. Dafür bleibt die Reihenfolge der
Provisioning-Runs von neu nach alt Teil des Repository-Vertrags.

## Verworfene Alternativen

- Eine alleinige `NOT EXISTS`-Prüfung auf laufende Claims schließt Rennen
  zwischen Prüfung und Mutation nicht aus.
- Eine globale Provisioning-Sperre würde unabhängige Mandanten unnötig
  serialisieren.
- Eine ausschließlich zeitbasierte Wiederaufnahme könnte einen weiterhin
  aktiven Worker überholen.
- Fremde oder mehrdeutige Rollen automatisch zu übernehmen würde die
  Sicherheitsgrenze der Studio-Ownership aufheben.

## Bezüge

- [ADR-030: Registry-basierte Instance-Freigabe und Provisioning](./ADR-030-registry-basierte-instance-freigabe-und-provisioning.md)
- [ADR-033: Tenant-Login-Client und Tenant-Admin-Client](./ADR-033-tenant-login-client-vs-tenant-admin-client.md)
- [ADR-046: Plattform- vs. Tenant-Rollenmodell](./ADR-046-plattform-vs-tenant-rollenmodell-und-legacy-standardrollen.md)
- [ADR-059: Administrative Keycloak-Realm-Rollenzuweisungen](./ADR-059-administrative-keycloak-realm-rollenzuweisungen.md)
- [ADR-060: Keycloak-Serviceidentitäten und Doctor-Evidenz](./ADR-060-keycloak-serviceidentitaeten-und-doctor-evidenz.md)
- Pull Request #1315
