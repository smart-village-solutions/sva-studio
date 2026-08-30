## ADDED Requirements

### Requirement: Least-Privilege-Authentifizierung für den nativen Studio-Nachrichtenclient

Das System SHALL einen öffentlichen nativen OIDC-Client ohne Client-Secret bereitstellen, der Authorization Code mit PKCE S256 ausschließlich im externen Systembrowser verwendet und nur die vollständig qualifizierten Rechte `studio.messages.read` und `studio.messages.read-state.update` erhalten kann.

#### Scenario: Native Anmeldung ist erfolgreich

- **WENN** ein aktiver Benutzer eine Studio-Instanz auswählt und die Anmeldung aus der macOS-Begleit-App startet
- **DANN** validiert der kanonische Auth-Host die Auswahl gegen die serverseitige Instanz-/Tenant-Registry
- **UND** bindet eine kurzlebige, integritätsgeschützte Login-Transaktion Instanz, erlaubten Realm/Issuer, Callback und API-Host
- **UND** läuft die Authentifizierung über den externen Systembrowser und ausschließlich den gebundenen Keycloak-Realm
- **UND** werden Login-Transaktion, State, Nonce, PKCE-Verifier, Issuer und der exakt erlaubte Claimed-HTTPS-Callback validiert
- **UND** enthält der native Client kein Client-Secret

#### Scenario: Instanzbindung wird manipuliert

- **WENN** Authorization Request, Callback, Token oder API-Request von der servervalidierten Instanz-, Issuer-, Callback- oder API-Host-Bindung abweichen
- **DANN** wird die Anmeldung beziehungsweise Nachrichtenoperation fail-closed abgelehnt
- **UND** übernimmt der Client keine freien Realm-, Issuer-, Redirect- oder API-Host-Werte

#### Scenario: Eingebetteter Login wird versucht

- **WENN** der native Client den Keycloak-Login in einem von der App kontrollierbaren WebView starten will
- **DANN** ist dieser Pfad nicht unterstützt

#### Scenario: Scope-Eskalation wird versucht

- **WENN** ein natives Token andere Studio-Rechte als `studio.messages.read` oder `studio.messages.read-state.update` anfordert oder präsentiert
- **DANN** wird die Anfrage fail-closed abgelehnt

### Requirement: Vollständige Bearer- und Accountprüfung für native Nachrichtenrequests

Das System MUST vor jeder nativen Nachrichtenoperation Signatur, erlaubten Algorithmus, Issuer, Audience, autorisierten Client, Zeitgrenzen, Scopes, Instanzbindung, gebundenen API-Host und aktiven lokalen Account prüfen. Die resultierende Identität SHALL denselben fachlichen Accountkontext verwenden wie eine browserseitige Studio-Sitzung.

#### Scenario: Gültiges natives Token wird aufgelöst

- **WENN** ein gültiges natives Access Token mit passender Audience, Clientbindung, Instanz und Scope eingeht
- **DANN** löst die Runtime den zugehörigen aktiven lokalen Account innerhalb genau dieser Instanz auf
- **UND** erhält die Feed-Logik keinen frei wählbaren Client-Accountkontext

#### Scenario: Tenant oder Account ist nicht mehr gültig

- **WENN** Token und Request unterschiedliche Instanzen adressieren
- **ODER** der Account unbekannt, blockiert, deaktiviert, gelöscht oder ohne aktive Membership ist
- **DANN** wird der Zugriff fail-closed abgelehnt
- **UND** enthält die Antwort keinen enumerierenden Ablehnungsgrund

### Requirement: Geschützter nativer Credential-Lifecycle

Das System MUST native Access- und Refresh-Credentials ausschließlich in einer minimalen Keychain-Access-Group für Container-App und Widget Extension speichern. Refresh Tokens SHALL rotiert und bei Logout, sicherheitsbedingtem Forced Reauth oder Kontowiderruf unwirksam werden.

#### Scenario: Credential wird gespeichert

- **WENN** der native Code-Austausch erfolgreich ist
- **DANN** werden Credentials ausschließlich im macOS-Schlüsselbund gespeichert
- **UND** erscheinen sie nicht in Preferences, App-Group-Dateien, Logs, Crash-Metadaten oder Telemetrie

#### Scenario: Logout widerruft nativen Zugriff

- **WENN** der Benutzer sich aus der nativen App abmeldet
- **DANN** wird der serverseitige native Refresh-Zugriff widerrufen
- **UND** werden lokale Credentials aus der gemeinsamen Keychain-Gruppe gelöscht

#### Scenario: Refresh Token wird wiederverwendet

- **WENN** ein bereits rotiertes oder widerrufenes Refresh Token erneut verwendet wird
- **DANN** wird der Refresh fail-closed abgelehnt
- **UND** wird ein redigiertes Security-Ereignis ohne Tokenwert erfasst

#### Scenario: App und Widget erneuern gleichzeitig

- **WENN** Container-App und Widget Extension auf demselben Gerät gleichzeitig ein ablaufendes Access Token erneuern wollen
- **DANN** serialisiert eine prozessübergreifende Sperre genau einen Refresh
- **UND** liest jeder Prozess nach Sperrenerwerb Token und Credential-Generation erneut aus der Keychain
- **UND** verwendet ein wartender Prozess das bereits rotierte Tokenpaar, ohne den zuvor gelesenen Refresh Token erneut zu senden
- **UND** sendet das Widget bei Lock-Timeout oder unklarem Zustand keinen möglicherweise veralteten Refresh Token
