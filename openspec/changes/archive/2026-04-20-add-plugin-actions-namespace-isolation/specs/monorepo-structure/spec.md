## ADDED Requirements

### Requirement: Plugin-Action-Contracts bleiben an der SDK-Grenze
Plugin-Packages SHALL ihre Action-Definitionen ausschließlich über SDK-Contracts deklarieren und dieselben Definitionen sowohl für Registrierung als auch für UI-nahe Bindings wiederverwenden.

#### Scenario: Plugin wiederverwendet eine deklarierte Action-Definition
- **WHEN** ein Plugin eine Create/Edit/Delete-Oberfläche rendert
- **THEN** stammen Action-ID und Title-Key aus derselben SDK-basierten Action-Definition wie bei der Registrierung
- **AND** das Plugin führt keine zweite, ungebundene Action-Liste außerhalb des SDK-Vertrags

#### Scenario: Host-App baut Registry aus Plugin-Definitionen
- **WHEN** die Host-App Plugin-Metadaten zusammenführt
- **THEN** entsteht die Plugin-Action-Registry aus den exportierten Plugin-Definitionen
- **AND** Plugins benötigen dafür keine direkte Host-Abhängigkeit außerhalb von `@sva/sdk`
