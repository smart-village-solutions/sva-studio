# ADR-064: Serverseitige Keycloak-Realm-Baseline

## Status

Akzeptiert am 15. September 2026.

## Kontext

Neue Tenant-Realms benötigen dieselben nicht geheimen Einstellungen für Theme,
deutsche Lokalisierung, Events, SMTP, Benutzerprofil und den `instanceId`-Mapper.
Eine Abfrage dieser technischen Konstanten bei jeder Tenant-Erstellung erzeugt
unnötige Varianten. Das SMTP-Passwort darf zugleich weder aus einem
Referenz-Realm übernommen noch in Quellcode, Registry oder Evidenz gespeichert
werden.

## Entscheidung

- Studio besitzt eine versionierte, serverseitige Baseline für neu angelegte
  Realms. Die Tenant-Erstellung leitet Realm-ID, Issuer sowie die technischen
  Client-IDs serverseitig ab und fragt diese Werte nicht im Dialog ab.
- Der privilegierte Keycloak-Adapter gleicht nur die ausdrücklich in der
  Baseline enthaltenen Realm-Einstellungen, Studio-Benutzerprofilattribute und
  den `instanceId`-Mapper ab. Benutzer, Rollen, Gruppen und andere
  tenant-spezifische Daten werden nicht aus einem Referenz-Realm kopiert.
- Die nicht geheimen SMTP-Werte gehören zur Baseline. Das SMTP-Passwort bleibt
  eine sichtbare manuelle Nacharbeit und wird niemals als Platzhalterwert an
  Keycloak übertragen oder in Nachweisen persistiert.
- Die Baseline gilt automatisch nur für von Studio neu angelegte Realms.
  Importierte Bestands-Realms werden nicht stillschweigend migriert.
- Schlägt die Provisionierung eines in diesem Lauf neu angelegten Realms fehl,
  entfernt der Worker genau diesen Realm als Compensation. Vor der Löschung
  prüft er den aktuellen Registry-Modus erneut; fremde oder inzwischen
  übernommene Realms werden nicht gelöscht.
- Nach erfolgreichem Abschluss wechselt die Registry erst als letzte fallible
  Operation von `new` auf `existing`. Status- und Plan-Evidenz behalten dabei
  anhand eines erfolgreich abgeschlossenen Keycloak-Laufs im Modus `new` auch
  bei späteren Keycloak-Läufen und nach Konfigurationsänderungen die Herkunft
  als Studio-verwalteter Realm, damit die offene SMTP-Nacharbeit sichtbar bleibt.
- Der lokale Bootstrap-Account wird erst nach erfolgreicher Realm-Abnahme
  synchronisiert. Ein vorheriger Abschlussfehler kann dadurch keinen lokalen
  privilegierten Account für einen anschließend kompensierten Realm hinterlassen.

## Folgen

Neue Tenant-Realms erhalten ohne zusätzliche Eingaben einen reproduzierbaren
Grundzustand. Baseline-Version und Read-back sind über die vorhandenen
Provisioning-Snapshots nachvollziehbar. Die einzige vorgesehene manuelle
Nacharbeit ist das SMTP-Passwort direkt in Keycloak.

Änderungen an der Baseline sind sicherheitsrelevant und benötigen eine neue
Version sowie passende Soll-/Ist- und Provisioning-Tests. Bestehende Realms
bleiben von solchen Änderungen unberührt, bis dafür eine eigene Migration
entschieden wird.

## Verworfene Alternativen

- Eine Kopie des Realms `bb-guben` würde auch Secrets und tenant-spezifische
  Daten in den Provisionierungsvertrag ziehen.
- Zusätzliche Felder im Tenant-Dialog würden konstante Plattformentscheidungen
  zu vermeidbarer Benutzereingabe machen.
- Ein SMTP-Passwort-Platzhalter in Keycloak sähe wie eine gültige Konfiguration
  aus und könnte versehentlich produktiv verwendet werden.
- Ein generisches Baseline- oder Konfigurationsframework wäre ohne weiteren
  aktuellen Verbraucher zusätzliche technische Oberfläche.

## Bezüge

- [ADR-030: Registry-basierte Instance-Freigabe und Provisioning](./ADR-030-registry-basierte-instance-freigabe-und-provisioning.md)
- [ADR-031: Tenant-spezifisches Realm-Auth-Routing](./ADR-031-tenant-spezifisches-realm-auth-routing.md)
- [ADR-033: Tenant-Login-Client und Tenant-Admin-Client](./ADR-033-tenant-login-client-vs-tenant-admin-client.md)
- [ADR-061: Instanzgebundene Keycloak-Provisioning-Ownership und -Serialisierung](./ADR-061-instanzgebundene-keycloak-provisioning-ownership-und-serialisierung.md)
- [Keycloak-Tenant-Realm-Bootstrap](../operations/keycloak-tenant-realm-bootstrap.md)
