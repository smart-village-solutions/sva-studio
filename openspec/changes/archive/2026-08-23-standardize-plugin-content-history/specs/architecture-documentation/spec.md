## ADDED Requirements

### Requirement: Arc42 dokumentiert die pluginübergreifende Studio-Historie

Die Architekturdokumentation SHALL Ownership, Datenfluss, Autorisierung und Abdeckungsgrenze der pluginübergreifenden Content-Historie in den betroffenen arc42-Abschnitten beschreiben.

#### Scenario: Entwickler prüft die History-Architektur

- **WENN** ein Entwickler die Baustein-, Laufzeit- und Querschnittssichten liest
- **DANN** erkennt er den Host als Owner von History-Persistenz, Autorisierung und Normalisierung
- **UND** erkennt er, dass Mainserver-Historien ausschließlich Studio-seitige Mutationen enthalten
- **UND** findet er den verbindlichen Integrationsvertrag für neue Content-Plugins
