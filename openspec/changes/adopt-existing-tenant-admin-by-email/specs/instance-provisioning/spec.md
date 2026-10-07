## MODIFIED Requirements

### Requirement: Keycloak-Mutationen sind eigentums- und plangebunden

Das System SHALL Keycloak-Mutationen der Instanz-Provisioning- und
MCP-Instanzprozesse für neue und bestehende Realms nur anhand eines aktuellen,
ausdrücklich bestätigten Plans ausführen. Das gilt für Provisioning,
Reconcile und nachgelagerte Rollenänderungen. Der Plan SHALL bei
Bestands-Realms ausschließlich fehlende oder eindeutig Studio-eigene und genau
dieser Instanz zugeordnete Artefakte enthalten. Eine ausdrücklich freigegebene
Übernahme eines vorhandenen Tenant-Admins ist nur als eng begrenzte Ausnahme
nach der folgenden Requirement zulässig. Nachgewiesene eigene Teilerfolge
SHALL die Freigabe verbleibender Planschritte erhalten; fremde Drift oder
zusätzlicher Umfang SHALL sie entwerten.

#### Scenario: Fremder gleichnamiger Client wird nicht verändert

- **WHEN** der erwartete Login-, Tenant-Admin- oder Plugin-Client bereits
  existiert, seine Studio- und Instanz-Ownership aber nicht eindeutig belegt
  ist
- **THEN** markiert der Plan den Befund als manuellen Konflikt
- **AND** aktualisiert oder rotiert Studio diesen Client nicht

#### Scenario: Fremder gleichnamiger Benutzer bleibt ohne Freigabe geschützt

- **WHEN** der erwartete Tenant-Admin-Benutzer bereits existiert, aber nicht
  eindeutig dem Studio-Tenant-Bootstrap zugeordnet ist
- **AND** keine ausdrückliche Übernahmefreigabe vorliegt
- **THEN** markiert der Plan den Befund als manuellen Konflikt
- **AND** aktualisiert Studio weder Profil noch Passwort, Ownership oder
  Rollenzuweisung

### Requirement: Bestehende Tenant-Admins nur nach exakter Identitätsprüfung übernehmen

Für `realmMode = existing` SHALL Studio einen vorhandenen Tenant-Admin nur
übernehmen, wenn der berechtigte Aufrufer die Übernahme explizit freigibt und
der Realm und die normalisierte E-Mail-Adresse mit dem bestätigten
Bootstrap-Profil übereinstimmen und die E-Mail im Realm genau einen Benutzer
findet. Der vorhandene Username bleibt erhalten. Der aktuelle Plan SHALL die
Übernahme als eigenen Schritt ausweisen und an die gelesene Benutzeridentität
binden. Der Worker SHALL E-Mail und stabile Keycloak-User-ID unmittelbar vor
der Mutation erneut prüfen und bei jeder Abweichung ohne Mutation abbrechen.

Bei erfolgreicher Übernahme SHALL Studio die Instanz-Ownership-Attribute
setzen und ausschließlich die tenantlokale Rolle `system_admin` ergänzen.
Passwort, Enabled-Status, fremde Benutzerattribute und fremde Rollen SHALL
erhalten bleiben. `instance_registry_admin` SHALL nicht zugewiesen werden.
Passwort-Reset SHALL ein separater Schritt sein. Unmarkierte Clients, Rollen
und andere Benutzer SHALL von dieser Freigabe unberührt bleiben.

#### Scenario: Freigegebener vorhandener Admin wird instanzgebunden übernommen

- **GIVEN** ein berechtigter Root-Aufrufer hat für den ausgewählten
  Bestands-Realm die Übernahme ausdrücklich freigegeben
- **AND** die normalisierte E-Mail stimmt exakt überein und ist realmweit eindeutig
- **WHEN** der bestätigte Plan ausgeführt wird und der unmittelbare Readback
  weiterhin dieselbe Benutzer-ID und Identität zeigt
- **THEN** setzt Studio die Ownership-Marker für genau diese Instanz
- **AND** ergänzt `system_admin`, ohne Passwort, Enabled-Status, fremde
  Attribute oder fremde Rollen zu verändern
- **AND** weist der Benutzer keine Plattformrolle `instance_registry_admin`
  auf

#### Scenario: Identitätsabweichung verhindert die Übernahme

- **GIVEN** die Übernahme wurde für einen Bestands-Realm freigegeben
- **WHEN** normalisierte E-Mail oder stabile Benutzer-ID zwischen
  Plan und Ausführung abweichen oder mehrdeutig sind
- **THEN** bricht Studio vor der ersten Mutation ab
- **AND** verlangt eine neue read-only Prüfung und Planbestätigung

#### Scenario: Gleiche E-Mail in anderem Realm erteilt keine Ownership

- **WHEN** dieselbe E-Mail-Adresse in einem anderen Realm oder unter einer
  anderen Instanz vorkommt
- **THEN** überträgt Studio keine Ownership zwischen Realms oder Instanzen
- **AND** bleibt die jeweilige Tenant-Admin-Prüfung separat gebunden

#### Scenario: Passwort wird nur im separaten Reset-Schritt geändert

- **WHEN** ein vorhandener Tenant-Admin erfolgreich übernommen wird
- **THEN** setzt Studio während der Übernahme kein Passwort
- **AND** bleiben Passwort-Reset und Passwort-Setup ein getrennt bestätigter
  Schritt
