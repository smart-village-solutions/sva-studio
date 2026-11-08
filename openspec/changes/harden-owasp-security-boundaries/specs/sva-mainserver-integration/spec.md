## MODIFIED Requirements

### Requirement: Tenant-owned Karten- und Geocoding-Interfaces kapseln Provider-Konfiguration

Das System MUST tenant-owned Interfaces für Karten- und Geocoding-Fähigkeiten bereitstellen, damit Providerwahl, Stil-Konfiguration, Secret-Referenzen, Rate-Limits, Timeouts und Fallback-Verhalten in der Tenant-Integrationsschicht statt in Plugin- oder Browserlogik gesteuert werden. Benutzerdefinierte Geocoding-Verbindungen MUST Zieladressen am tatsächlichen Socketaufbau prüfen; der Geocoding-Providerpfad MUST das konfigurierte Tenant-Budget über alle unterstützten App-Replikate und Geocoding-Verbraucher gemeinsam durchsetzen.

#### Scenario: POI editor consumes normalized tenant-owned capabilities

- **WENN** ein Tenant Karten- und Geocoding-Fähigkeiten über ein tenant-owned Interface konfiguriert hat
- **UND** der POI-Editor Adressvorschläge, Geocoding, Reverse-Geocoding oder Karten-Rendering benötigt
- **DANN** konsumiert er ausschließlich normierte Operationen und normierte Ergebnisformen
- **UND** greift nicht auf provider-spezifische Secrets, Keys, Endpunkte oder Rohverträge zu
- **UND** wird provider-spezifische Konfiguration über das tenant-owned Interface und dessen hostseitige Implementierung aufgelöst

#### Scenario: Tenant changes provider without editor contract change

- **WENN** ein Tenant den konfigurierten Geocoding-Provider oder die Kartenimplementierung ändert
- **UND** der POI-Editor danach genutzt wird
- **DANN** bleibt der Editor-Vertrag unverändert
- **UND** bleiben provider-spezifische Konfiguration und Secret-Handling im tenant-owned Interface und dessen Adapter isoliert

#### Scenario: DNS-Antwortwechsel oder Redirect öffnet kein internes Ziel

- **WHEN** ein benutzerdefinierter Provider ohne private Zielausnahme verwendet wird
- **THEN** nutzt jeder Verbindungsaufbau ausschließlich die für diesen Socket geprüften öffentlichen IP-Adressen
- **AND** werden direkte Literale, IPv4, IPv6 und gemappte Adressen gleichwertig geprüft
- **AND** wird vor jedem manuell verfolgten Redirect-Hop erneut geprüft
- **AND** erlauben eine frühere öffentliche DNS-Antwort oder URL-Vorprüfung keine spätere ungeprüfte Verbindung zu einem privaten Ziel

#### Scenario: Bestehende HTTP- und private Opt-in-Verträge bleiben begrenzt erhalten

- **WHEN** ein gültiger benutzerdefinierter HTTP-Provider verwendet wird
- **THEN** bleibt er unter der verbindungsbezogenen Zielprüfung erreichbar
- **AND** erfordert ein privates Ziel weiterhin die vorhandene ausdrückliche serverseitige Geocoding-Ausnahme
- **AND** können Browserdaten diese Ausnahme nicht aktivieren
- **AND** bleiben andere Verbraucher des bestehenden öffentlichen HTTPS-Exports gegen HTTP und private Ziele abgesichert

#### Scenario: Tenant-Budget gilt gemeinsam für alle Geocoding-Netzwerkversuche

- **GIVEN** das Tenant-Limit beträgt L Provideraufrufe pro Minute
- **WHEN** HTTP-, Server-Function- oder Batch-Verbraucher desselben Tenants Suggest, Geocode oder Reverse-Geocode ausführen
- **THEN** verbraucht jeder tatsächliche Netzwerkversuch einschließlich Redirect-Hop genau einmal Budget aus demselben atomaren Redis-Zähler
- **AND** gilt das Limit L für das 60-Sekunden-Fenster ab dem ersten Verbrauch über alle Replikate gemeinsam
- **AND** umgehen Modus-, Prozess- oder Providerwechsel innerhalb desselben Fensters den Tenant-Zähler nicht
- **AND** verbrauchen reine Konfigurationsreads und lokale Validierungsfehler kein Providerbudget

#### Scenario: Limitüberschreitung und Redis-Ausfall verhindern Providerarbeit

- **WHEN** das gemeinsame Budget ausgeschöpft ist
- **THEN** findet kein weiterer Provider-Netzwerkversuch statt
- **AND** antwortet der HTTP-Pfad mit 429 und aus der Restfrist abgeleitetem Retry-After
- **AND** verlängert die Ablehnung nicht die Fensterfrist
- **WHEN** das Redis-Budget nicht zuverlässig geprüft werden kann
- **THEN** antwortet der HTTP-Pfad mit 503 ohne Provideraufruf und ohne lokalen Freigabe-Fallback
- **AND** tragen Server-Function- und vorhandene Batch-Fehlerpfade dieselbe fachliche Bedeutung ohne unbegrenzte Wiederholungen

#### Scenario: Gleichzeitige Verbraucher und Fensterwechsel bleiben korrekt

- **WHEN** zwei unabhängige Redis-Verbraucher gleichzeitig mehr als L Versuche desselben Tenants auslösen
- **THEN** werden innerhalb des Fensters insgesamt höchstens L Netzwerkversuche zugelassen
- **AND** beeinflusst das Budget keinen anderen Tenant
- **AND** ist nach Ablauf des Fensters erneut das volle Budget verfügbar
- **AND** setzt ein Neustart eines Studio-Prozesses das noch laufende Fenster nicht zurück
