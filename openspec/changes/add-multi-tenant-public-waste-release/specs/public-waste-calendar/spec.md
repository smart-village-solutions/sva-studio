## MODIFIED Requirements

### Requirement: Öffentliche Abfallkalender-App hat einen isolierten Releasepfad

Das System SHALL für jeden konfigurierten öffentlichen Waste-Web-Stack einen eigenen, tag-basierten Releasepfad bereitstellen, der weder den `studio`-Stack noch den `studio`-Releaseworkflow mitverwendet. Ein Release-Tag baut das öffentliche Waste-Web-Image genau einmal und rollt denselben Image-Tag über getrennte, environment-gebundene Deploy-Jobs auf alle explizit konfigurierten Zielstacks aus.

#### Scenario: Git-Tag veröffentlicht denselben Image-Tag auf beide konfigurierten Zielstacks

- **WHEN** ein Git-Tag `waste-web-v1.2.3` gepusht wird
- **THEN** baut und publiziert das System die öffentliche Waste-Web-Runtime genau einmal mit dem Image-Tag `v1.2.3`
- **AND** deployt getrennte Jobs den identischen Image-Tag nach Prignitz und Frankfurt (Oder)
- **AND** jeder Job verwendet ausschließlich sein eigenes GitHub-Environment, seinen eigenen Stack und seine eigene Basis-URL
- **AND** der normale Studio-Releasepfad bleibt unberührt

#### Scenario: Ein Zielstack scheitert ohne Cross-Target-Mutation

- **WHEN** der Deploy oder Smoke eines der konfigurierten Ziele fehlschlägt
- **THEN** wird der Workflow terminal rot
- **AND** das andere Ziel wird nicht mit den Variablen oder Secrets des fehlgeschlagenen Ziels verändert
- **AND** ein zuvor erfolgreich aktualisiertes Ziel wird nicht automatisch zurückgerollt
