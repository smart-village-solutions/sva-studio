## ADDED Requirements

### Requirement: Tenant-owned Karten- und Geocoding-Interfaces kapseln Provider-Konfiguration

Das System MUST tenant-owned Interfaces für Karten- und Geocoding-Fähigkeiten bereitstellen, damit Providerwahl, Stil-Konfiguration, Secret-Referenzen, Rate-Limits, Timeouts und Fallback-Verhalten in der Tenant-Integrationsschicht statt in Plugin- oder Browserlogik gesteuert werden.

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

### Requirement: Studio-POI-Write-Pfad deckt den relevanten Mainserver-Vertrag vollständig ab

Das System MUST die von Studio gepflegten POI-Editor-Daten an den typed Mainserver-POI-Mutationspfad weiterleiten, ohne unterstützte, editorseitig verantwortete POI-Felder stillschweigend zu verwerfen.

#### Scenario: Full POI editor data reaches the typed write path

- **WENN** der Studio-POI-Editor `addresses`, `contact`, `openingHours`, `priceInformations`, `operatingCompany`, `webUrls`, `mediaContents`, `certificates`, `accessibilityInformation`, `tags`, `payload` und optionale `location`-Daten erfasst
- **UND** ein Benutzer den POI speichert
- **DANN** baut der hostseitige POI-Write-Pfad ein typed `SvaMainserverPoiInput`
- **UND** enthält dieses alle vorhandenen und gültigen, editorseitig verantworteten Feldgruppen
- **UND** verengt der Adapter die Editor-Payload nicht stillschweigend auf Name, Beschreibung, Kategorie, Minimaladresse und Links

#### Scenario: Unsupported field omission is explicit

- **WENN** ein Studio-POI-Editor-Feld absichtlich nicht auf den typed Mainserver-POI-Input gemappt wird
- **UND** der Write-Pfad reviewed oder getestet wird
- **DANN** ist die Omission explizit, dokumentiert und durch eine deterministische Produktentscheidung gedeckt
- **UND** entsteht sie nicht durch versehentliche Adapter-Unvollständigkeit

#### Scenario: Non-edited structured fields are preserved when declared as passthrough

- **WENN** ein geladener POI strukturierte Mainserver-Daten enthält, die im aktuellen Studio-Slice noch nicht vollständig editierbar sind
- **UND** der Benutzer andere editorseitig verantwortete POI-Bereiche aktualisiert und speichert
- **DANN** bleiben alle als Read/Passthrough markierten Feldgruppen verlustfrei über den Write-Pfad erhalten
- **UND** kollabiert der Adapter mehrwertige oder strukturierte Werte nicht stillschweigend auf die aktuell editierte Teilmenge

### Requirement: Mapping, passthrough, and omissions are deterministic per field group

Das System MUST für jede relevante POI-Feldgruppe festlegen, ob Studio sie als Read/Write, Read/Passthrough oder explizite Omission behandelt, damit Datenverlust und versehentliche Vertragsverengung reviewbar und testbar bleiben.

#### Scenario: Field group mapping mode is reviewable

- **WENN** eine relevante strukturierte Feldgruppe wie `addresses`, `openingHours`, `priceInformations`, `operatingCompany`, `mediaContents`, `certificates`, `accessibilityInformation`, `location`, `tags` oder `payload` reviewed oder getestet wird
- **DANN** besitzt die Feldgruppe einen expliziten Mapping-Modus
- **UND** sind Normalisierung, Kardinalität und Verlustfreiheitsregel für diesen Change dokumentiert

#### Scenario: Explicit omission does not masquerade as support

- **WENN** eine Feldgruppe oder Teilstruktur außerhalb des unterstützten Studio-Scopes dieses Changes liegt
- **UND** der POI-Editor implementiert und getestet wird
- **DANN** ist der nicht unterstützte Scope explizit als Omission oder Passthrough gekennzeichnet
- **UND** stellt das Produkt diese Feldgruppe nicht als voll unterstützt dar, wenn das nicht der Fall ist

### Requirement: Host POI route validates extended structured POI inputs

Das System MUST strukturierte POI-Inputs des erweiterten Studio-POI-Editors in der hostseitigen POI-Route validieren, bevor sie an den typed Mainserver-Service-Adapter weitergereicht werden.

#### Scenario: Extended POI route accepts valid structured sections

- **WENN** der Browser eine POI-Payload mit strukturierten `openingHours`, `priceInformations`, `operatingCompany`, `location`, `certificates` und `accessibilityInformation` übermittelt
- **UND** die hostseitige POI-Route die Anfrage parst
- **DANN** validiert und normalisiert sie diese Bereiche gemäß dem typed Mainserver-Integrationsvertrag
- **UND** leitet das normalisierte Ergebnis über den typed POI-Servicepfad weiter

#### Scenario: Invalid structured POI section is rejected deterministically

- **WENN** der Browser einen ungültigen strukturierten POI-Bereich wie fehlerhafte Geo-Koordinaten oder invalide Teilobjekte übermittelt
- **UND** die hostseitige POI-Route die Anfrage parst
- **DANN** weist die Route die Anfrage mit einem deterministischen Validierungsfehler zurück
- **UND** leitet kein teilweise defektes Objekt an den Mainserver-Write-Pfad weiter

### Requirement: Host POI write and geocoding paths emit structured observability signals

Das System MUST für POI-Write-Validierung, Geocoding-Operationen, Reverse-Geocoding, Nicht-Treffer und Providerfehler strukturierte, PII-bewusste Observability-Signale emittieren, damit Produktionsdiagnose nicht von Roh-Payloads oder geleakten Secrets abhängt.

#### Scenario: Provider and validation outcomes are distinguishable

- **WENN** der Host einen POI-Write oder eine tenant-owned Geocoding-Operation verarbeitet
- **UND** die Operation erfolgreich endet, fehlschlägt, keinen Treffer liefert oder auf einen Fallback wechselt
- **DANN** emittiert der Host ein strukturiertes Outcome, das mindestens `success`, `no_result`, `invalid_input`, `provider_error`, `rate_limited`, `timeout` und `fallback_used` unterscheidet
- **UND** kann das Signal dem betroffenen Host-Pfad zugeordnet werden, ohne Provider-Secrets oder Rohverträge offenzulegen

#### Scenario: Diagnostics stay PII-aware

- **WENN** Geocoding oder POI-Write-Validierung auf ungültige Adressen, Kontaktdaten oder providerseitige Fehler stößt
- **UND** der Host Logs oder Metriken zur Diagnose ausgibt
- **DANN** lässt das Signal Roh-Secrets, Provider-Tokens und unredigierte Provider-Payloads aus
- **UND** stützt sich die Standarddiagnose nicht auf vollständige Suchqueries oder vollständige Kontaktfelder

## MODIFIED Requirements

### Requirement: Typed POI GraphQL Adapters

Das System MUST typed, server-only SVA-Mainserver-Adapter für Point-of-Interest-Liste, Detail, Create, Update und Archive-or-Delete bereitstellen.

Die Adapter MUST die policy-gesteuerte SVA-Mainserver-Credential-Resolution-Chain des effektiven Organisationskontexts verwenden und dürfen keinen generischen GraphQL-Executor an Browsercode, Plugincode oder App-UI-Komponenten exponieren.

#### Scenario: POI list is loaded through typed adapter

- **WENN** ein Benutzer eine gültige Studio-Session, einen Instanzkontext, lokale Content-Berechtigung und effektive Mainserver-Credentials besitzt
- **UND** die POI-Liste angefordert wird
- **DANN** ruft der Host einen typed serverseitigen POI-List-Adapter in `@sva/sva-mainserver/server` auf
- **UND** führt der Adapter die GraphQL-Abfrage `pointsOfInterest` über den bestehenden Mainserver-Servicepfad aus
- **UND** erhält der Browser nur das gemappte Plugin-POI-Listenmodell

#### Scenario: POI detail is loaded through typed adapter

- **WENN** ein Benutzer eine gültige Studio-Session, einen Instanzkontext, lokale Content-Berechtigung und effektive Mainserver-Credentials besitzt
- **UND** ein einzelner POI angefordert wird
- **DANN** ruft der Host einen typed serverseitigen POI-Detail-Adapter in `@sva/sva-mainserver/server` auf
- **UND** führt der Adapter die GraphQL-Abfrage `pointOfInterest(id: ID!)` mit typed Variablen aus
- **UND** werden fehlende oder invalide Antwortdaten auf einen deterministischen Integrationsfehler gemappt

#### Scenario: POI update preserves structured editor sections

- **WENN** ein Benutzer einen POI in Studio über den redaktionsorientierten Voll-Editor bearbeitet
- **UND** der Host die Mainserver-Mutation vorbereitet
- **DANN** bewahrt der typed POI-Adapter strukturierte Bereiche für `addresses`, `contact`, `priceInformations`, `openingHours`, `operatingCompany`, `webUrls`, `mediaContents`, `certificates`, `accessibilityInformation`, `tags`, `payload` und editorseitig verantwortete `location`-Daten
- **UND** bleiben diese strukturierten Daten über Host-Route, Service-Adapter, GraphQL-Dokument und Mapping-Layer hinweg typed
