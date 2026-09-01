## ADDED Requirements

### Requirement: Interne Plugin-Serverbeiträge können eine technische Service-Identität verlangen

Das System SHALL hostvalidierten Plugin-Serverbeiträgen erlauben, eine
konfigurierte technische Service-Identität mit exakter Audience, Client-ID und
vollständig qualifizierter Action zu verlangen. Der Host MUST die
Authentifizierung und Autorisierung vor Erzeugung des Plugin-Execution-Context
abschließen; das Plugin darf weder Token prüfen noch Actor, Tenant oder Action
selbst festlegen.

#### Scenario: Gültiger Service-Request erreicht den Plugin-Handler

- **GIVEN** ein hostaktives Plugin deklariert einen internen Serverbeitrag mit Service-Authentisierung
- **AND** das Token besitzt gültige Signatur, Issuer, Audience, Client-ID, Ablauf und erforderliche Action
- **WHEN** der Request den exakt registrierten Pfad und die registrierte Methode verwendet
- **THEN** erzeugt der Host den gebundenen Execution-Context
- **AND** ruft erst danach den zugeordneten Plugin-Handler auf

#### Scenario: Ungültige technische Identität führt keine Plugin-Logik aus

- **GIVEN** Signatur, Issuer, Audience, Client-ID, Ablauf oder Action des Service-Tokens ist ungültig
- **WHEN** der interne Plugin-Endpoint aufgerufen wird
- **THEN** lehnt der Host den Request fail-closed mit einem stabilen Fehler ab
- **AND** erzeugt keinen Plugin-Execution-Context
- **AND** führt keinen Plugin-Handler aus

#### Scenario: Browser- oder Benutzertoken ersetzt keine Service-Identität

- **GIVEN** ein Browser, Gast oder regulärer Tenant-Benutzer präsentiert sein Token am internen Service-Endpoint
- **WHEN** der Host die deklarierte Authentisierungsart prüft
- **THEN** akzeptiert er das Token nicht als technische Service-Identität
- **AND** leitet daraus weder Service-Action noch Tenant-Kontext ab

### Requirement: Service-authentisierte Tenantangaben werden ausschließlich hostseitig gebunden

Das System SHALL einen vom authentifizierten Backend übermittelten
Tenant-Identifier erst nach erfolgreicher Service-Authentisierung gegen die
kanonische Instanz-Registry auflösen. Konkurrierende Tenantangaben und
unbekannte, suspendierte oder nicht bereite Instanzen MUST vor Ausführung der
Plugin-Logik abgewiesen werden.

#### Scenario: Authentifizierter Service bindet eine bekannte Instanz

- **GIVEN** der interne Service ist erfolgreich authentifiziert
- **AND** der Request enthält die kanonische ID einer aktiven Studio-Instanz
- **WHEN** der Host Aktivierung und Readiness erfolgreich geprüft hat
- **THEN** bindet er genau diese `instanceId` unveränderlich an den Execution-Context
- **AND** ignoriert keine widersprüchliche Tenantangabe zugunsten eines Fallbacks

#### Scenario: Freier Tenantwert ohne Service-Authentisierung bleibt unvertraut

- **GIVEN** ein Request enthält eine syntaktisch gültige `instanceId`, aber keine gültige Service-Identität
- **WHEN** er den internen Plugin-Endpoint aufruft
- **THEN** löst der Host keinen Tenant-Kontext auf
- **AND** liest keine tenantbezogenen Plugin-Daten
