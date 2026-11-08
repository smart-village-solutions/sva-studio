## ADDED Requirements

### Requirement: Persönliche API-Tokens beachten den aktuellen Account-Lebenszyklus

Das System MUST bei persönlichen API-Tokens zusätzlich zur kryptografischen Tokenprüfung den aktuellen Account im vertrauenswürdig gebundenen Scope und die vorhandene benutzerbezogene Login-Sperre prüfen, bevor Rollen, Berechtigungen oder fachliche Handler freigegeben werden. Tenant-Konten MUST gegen persistierten Account und Membership geprüft werden; Plattformkonten MUST über den gezielten vorhandenen Keycloak-User-Read ein passendes Subject und ausdrücklich aktivierten Status nachweisen, ohne lokalen Account-Mirror. Ein fehlender, inaktiver, gesperrter oder fachlich für diesen Zugriff ausgeschlossener Account MUST abgewiesen werden; vorhandene Rollen und Permission-Caches MUST diese Sperre nicht aufheben. Die Prüfung MUST bestehende Browser-, Dev-/JIT-, Rechtstext- und DSR-Verträge erhalten und MUST aus persönlichen Bearer-Requests keine Accountanlage ableiten.

#### Scenario: Vor Deaktivierung ausgestelltes Token wird nach dem Commit abgewiesen

- **GIVEN** ein persönlicher API-Token ist kryptografisch gültig und noch nicht abgelaufen
- **AND** Rollen und ein positiver Permission-Snapshot sind weiterhin vorhanden
- **WHEN** der Account in der Datenbank erfolgreich deaktiviert wurde und danach eine neue persönliche Anfrage beginnt
- **THEN** verweigert das System die fachliche Freigabe mit HTTP 403
- **AND** gilt dies auch, wenn ein nachgelagerter Redis- oder Keycloak-Schreibschritt der Deaktivierung fehlgeschlagen ist
- **AND** wird kein Fachhandler ausgeführt

#### Scenario: Persistierte Login-Sperre ist auch für persönliche Tokens wirksam

- **WHEN** für den Subject eines ansonsten gültigen persönlichen Tokens `loginBlocked` gesetzt ist
- **THEN** wird die Anfrage vor fachlicher Freigabe abgewiesen
- **AND** eine erneute Tokenprüfung oder Rollenhydration hebt diese Sperre nicht auf

#### Scenario: Nicht verifizierbarer Accountzustand führt zu keiner Freigabe

- **WHEN** Redis-Sperrzustand oder erforderlicher persistierter Accountzustand nicht zuverlässig geprüft werden kann
- **THEN** liefert das System HTTP 503 ohne fachliche Ausführung
- **AND** ersetzt es den fehlenden Nachweis nicht durch Tokenclaims oder einen positiven Permission-Cache
- **AND** bleiben ungültige Tokens HTTP 401 und fachlich gesperrte beziehungsweise fehlende Accounts HTTP 403

#### Scenario: Scope und bestehende zulässige Zugriffe bleiben erhalten

- **WHEN** ein aktiver persönlicher Benutzer eine erlaubte Route mit passendem Scope, Mitgliedschaft und Berechtigung aufruft
- **THEN** bleibt der Zugriff innerhalb derselben Plattform- oder Tenant-Grenze zulässig
- **AND** ein fremder Tenant oder eine fehlende Account-/Membership-Zuordnung erzeugt keine neue Zuordnung
- **AND** bleiben bestehende Browser-Session-, Dev-/JIT-, Akzeptanz- und zulässige DSR-Pfade unter ihren bisherigen Voraussetzungen funktionsfähig
