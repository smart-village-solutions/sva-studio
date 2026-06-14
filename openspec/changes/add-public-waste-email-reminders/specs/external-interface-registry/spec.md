## ADDED Requirements
### Requirement: Das Studio bietet eine zentrale Mail-Transport-Schnittstelle für modulübergreifenden E-Mail-Versand
Das System SHALL eine zentrale Schnittstelle für technischen E-Mail-Versand bereitstellen, die von Fachmodulen wie `waste-management` genutzt werden kann.

#### Scenario: Mail-Transport wird als eigenständige technische Anbindung gepflegt
- **WHEN** ein berechtigter Benutzer im Studio technische Versandparameter für E-Mail pflegt
- **THEN** erfolgt diese Pflege in der zentralen Schnittstellen- oder Interface-Verwaltung
- **AND** die Konfiguration ist nicht an ein einzelnes Fachmodul gebunden
- **AND** Fachmodule referenzieren den Transport über einen stabilen technischen Vertrag

### Requirement: Die zentrale Mail-Transport-Schnittstelle verwaltet SMTP- oder Provider-Credentials serverseitig
Das System SHALL technische Versand-Credentials serverseitig und getrennt von Fachmodulen verwalten.

#### Scenario: SMTP-Parameter liegen außerhalb fachlicher Modulsettings
- **WHEN** die Mail-Transport-Schnittstelle SMTP oder einen alternativen E-Mail-Provider konfiguriert
- **THEN** verwaltet sie mindestens Host oder Provider, Port oder Transportmodus, TLS-Parameter, Benutzername und Secret-Referenz serverseitig
- **AND** diese Daten werden nicht in `waste-management` oder der Public-Waste-App gespeichert
- **AND** Secrets bleiben vom Browser fern

### Requirement: Die zentrale Mail-Transport-Schnittstelle besitzt einen expliziten Feldvertrag
Das System SHALL die Mail-Transport-Schnittstelle mit einem klaren, wiederverwendbaren Feldsatz modellieren.

#### Scenario: Mail-Transport wird als strukturierte technische Anbindung gespeichert
- **WHEN** eine Mail-Transport-Konfiguration im Studio gespeichert oder bearbeitet wird
- **THEN** enthält sie mindestens einen stabilen `transportId`, einen `transportType`, Host oder Provider-Endpunkt, Port oder Transportmodus, einen Security-Modus, einen Aktivstatus und eine Secret-Referenz
- **AND** sie kann zusätzlich Default-Absenderdaten, Batch-Limits und technische Gesundheitsinformationen führen
- **AND** der Vertrag bleibt von fachmodulspezifischen Texten oder Reminder-Regeln getrennt

### Requirement: Fachmodule übergeben normalisierte Versandaufträge an die Mail-Transport-Schnittstelle
Das System SHALL den Versandvertrag zwischen Fachmodulen und der zentralen Mail-Transport-Schnittstelle über normalisierte Versandaufträge abbilden.

#### Scenario: Waste nutzt die Mail-Schnittstelle ohne eigene Provider-Kopplung
- **WHEN** `waste-management` eine DOI-Mail, Aktivierungsbestätigung oder Reminder-Mail auslösen will
- **THEN** übergibt das Modul einen normalisierten Versandauftrag an die zentrale Mail-Transport-Schnittstelle
- **AND** der Auftrag enthält nur die für Template-Auflösung, Empfänger und Zustellung nötigen Daten
- **AND** das Fachmodul kennt weder SMTP-Details noch provider-spezifische API-Aufrufe
