# ADR-059: Administrative Keycloak-Realm-Rollenzuweisungen

**Status:** Accepted
**Entscheidungsdatum:** 2026-09-02
**Entschieden durch:** SVA Studio Team

## Kontext

Neben lokalen IAM-Rollen des Studios verwenden angebundene Anwendungen eigene
Keycloak-Realm-Rollen. Auch reine App-Benutzer ohne lokalen `iam.accounts`-
Datensatz sollen diese Rollen im Studio erhalten können. Eine Übernahme
externer Rollen in die Studio-Autorisierung würde jedoch zwei konkurrierende
Berechtigungswahrheiten schaffen.

## Entscheidung

1. Lokale IAM-Rollen bleiben die alleinige Quelle für Studio-Permissions.
2. Keycloak-Realm-Rollen werden als getrennte Interop-Sicht angezeigt und
   ausschließlich mit `iam.role.write` zugewiesen oder entzogen.
3. Der Server löst Benutzer, Rolle und Realm immer aus der aktiven Instanz auf.
4. Mutationen sind einzelne idempotente Deltas und werden durch einen kausalen
   Re-Read der direkten Zuweisung bestätigt.
5. Direkte und über Composite Roles geerbte Rollen werden getrennt projiziert;
   nur direkte Zuweisungen sind entziehbar.
6. Keycloak-Built-ins, Client-, Service- und Plattformrollen sind geschützt.
   Reguläre Realm-Rollen benötigen keine anwendungsspezifische Allowlist.
7. `system_admin` bleibt sichtbar und zuweisbar, wird aber ausschließlich über
   den bestehenden gekoppelten lokalen IAM-Pfad mit Letztadmin-Schutz mutiert.
8. Unmapped Keycloak-Benutzer sind gültige Ziele für externe Rollen; dadurch
   wird kein lokales IAM-Konto angelegt.

## Konsequenzen

- App-Rechte können im Studio administriert werden, ohne Studio-Rechte aus
  externen Rollennamen abzuleiten.
- Nicht eindeutig bestätigte Ergebnisse werden als
  `reconciliation_required` gemeldet und auditiert.
- Rollenabhängigkeiten bleiben in Keycloak-Composites oder der konsumierenden
  Anwendung; das Studio kennt keine Mainserver-Rollennamen.

## Alternativen

- Import externer Rollen in `iam.roles`: verworfen wegen doppelter Wahrheit.
- Vollständiges Replace: verworfen wegen Verlustgefahr paralleler Zuweisungen.
- Eigene Mainserver-Permission: verworfen zugunsten von `iam.role.write`.
