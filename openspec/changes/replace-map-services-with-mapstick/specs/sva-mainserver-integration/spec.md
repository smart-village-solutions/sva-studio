## ADDED Requirements

### Requirement: Mapstick-Karten mit lokalen Stilpräferenzen

Das Studio MUST den eigenen Mapstick-Dienst über den bestehenden Karten-/Geocoding-Pfad verwenden können und in den bestehenden Karteneditoren eine zugängliche Stilauswahl anbieten. Die Auswahl MUST Position, Zoom, Marker und Geometrien erhalten; die Browserpräferenz MUST bei gesperrtem Speicher optional bleiben.

#### Scenario: Farbschema wechseln

- **WHEN** ein Redakteur bei einer Mapstick-Karte ein anderes Farbschema wählt
- **THEN** wechselt nur der Kartenhintergrund
- **AND** bleiben Karteninstanz, Kamera, Marker und der aktuelle Zeichenstand erhalten

#### Scenario: Kartendaten ohne CORS-Anpassung beziehen

- **WHEN** die Karte Mapstick-Ressourcen lädt
- **THEN** liefert der autorisierte Studio-Host ausschließlich erlaubte feste Ressourcen mit begrenzten Bytebereichen aus
- **AND** kann der Client keine fremden Zieladressen abrufen

#### Scenario: Photon-Suche

- **WHEN** eine Mapstick-Schnittstelle für Adresssuche oder Rückwärtsauflösung verwendet wird
- **THEN** normalisiert der Host Photon-Treffer in das vorhandene SDK-Adressmodell
- **AND** bleiben Autorisierung, Tenantbindung und Requestbudget wirksam
