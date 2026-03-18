## MODIFIED Requirements

### Requirement: User-Bearbeitungsseite

Das System MUST eine User-Bearbeitungsseite unter `/admin/users/:userId` bereitstellen, die eine detaillierte Bearbeitung eines Benutzer-Accounts in einer Tab-Ansicht ermöglicht.

#### Scenario: Verwaltung – Status, Rollen und Mainserver-Credentials

- **WENN** ein Administrator den Tab „Verwaltung" öffnet
- **DANN** kann er den Account-Status ändern (aktiv/inaktiv/ausstehend)
- **UND** Rollen zuweisen oder entfernen (unter Beachtung des Privilege-Escalation-Schutzes)
- **UND** Sprach- und Zeitzone-Präferenzen setzen
- **UND** administrative Notizen hinterlegen (max. 2000 Zeichen)
- **UND** die Mainserver-Felder `mainserverUserApplicationId` und `mainserverUserApplicationSecret` bearbeiten
- **UND** das Secret-Feld wird nicht mit seinem aktuellen Klartextwert vorbefüllt
- **UND** die UI zeigt stattdessen an, ob bereits ein Secret hinterlegt ist

### Requirement: IAM-Service-API

Das System MUST serverseitige API-Endpunkte unter `/api/v1/iam/` für User-CRUD, Rollen-Management und Profil-Updates bereitstellen, die IAM-DB und Keycloak synchron halten.

#### Scenario: Admin aktualisiert Mainserver-Credentials eines Benutzers

- **WENN** ein authentifizierter Administrator `PATCH /api/v1/iam/users/:userId` mit `mainserverUserApplicationId` und/oder `mainserverUserApplicationSecret` aufruft
- **DANN** werden die Mainserver-Credentials in die Keycloak-User-Attribute des Zielbenutzers geschrieben
- **UND** `mainserverUserApplicationSecret` wird nicht im Response-Körper zurückgegeben
- **UND** leere Secret-Werte überschreiben ein bestehendes Secret nicht implizit
- **UND** die restlichen Benutzerdaten bleiben unverändert, sofern sie nicht ebenfalls im Payload enthalten sind

#### Scenario: Admin lädt Benutzerdetail mit Mainserver-Credential-Status

- **WENN** ein authentifizierter Administrator `GET /api/v1/iam/users/:userId` aufruft
- **DANN** enthält die Antwort `mainserverUserApplicationId`, falls in Keycloak gesetzt
- **UND** die Antwort enthält einen booleschen Status, ob `mainserverUserApplicationSecret` vorhanden ist
- **UND** der Klartext des Secrets wird nie an den Browser übertragen
