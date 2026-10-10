## ADDED Requirements

### Requirement: Studio-Images binden ihre Distribution an den Build

Das Studio SHALL veröffentlichte Images mit ihrem Build-Commit, ihrem unveränderlichen Digest und ihrer Plugin-Auswahl eindeutig binden. Für die benannten `studio`- und `ssf`-Distributionen SHALL der bestehende Build-Vertrag erhalten bleiben. Ein explizit angeforderter Plugin-Satz MUST eine eigene eindeutige Auswahlkennung in Manifest und OCI-Metadaten erhalten und vor jeder Verwendung gegen den Image-Digest verifiziert werden.

#### Scenario: Bestehende Distribution wird gebaut

- **WHEN** der reguläre Build das `studio`- oder `ssf`-Image erzeugt
- **THEN** enthält das Image weiterhin den bestehenden Distributionsvertrag
- **AND** Revision, Distribution und Digest sind konsistent verifiziert

#### Scenario: Expliziter Plugin-Satz wird gebaut

- **WHEN** ein Build mit einer validierten Plugin-Menge ausgeführt wird
- **THEN** beziehen sich Manifest, OCI-Auswahlkennung und Chunk-Provenienz auf dieselbe normalisierte Menge
- **AND** der veröffentlichte Digest ist eindeutig an Quellrevision und Auswahlkennung gebunden

#### Scenario: Auswahlkennung oder Digest stimmen nicht überein

- **WHEN** Manifest, OCI-Metadaten, Laufzeitinventar oder erwarteter Digest eine andere Plugin-Auswahl bezeichnen
- **THEN** weist die Verifikation das Image zurück
- **AND** darf der Digest nicht als erfolgreiches Build-Artefakt verwendet werden
