## MODIFIED Requirements
### Requirement: Inhalt ist ein erweiterbares Core-Element

Das System MUST `Inhalt` als kanonisches Core-Element modellieren, das über definierte SDK-Erweiterungspunkte für spezielle Datentypen erweitert werden kann und referenzbasierte Mediennutzung unterstützt.

#### Scenario: Core-Inhalt wird mit Basiskern angelegt

- **WENN** ein Inhalt gespeichert oder geladen wird
- **DANN** enthält er mindestens `contentType`, Titel, Veröffentlichungsdatum, Erstellungsdatum, Änderungsdatum, Autor, Payload, Status und Historie
- **UND** diese Core-Felder bleiben unabhängig vom konkreten Inhaltstyp verfügbar

#### Scenario: SDK erweitert einen speziellen Inhaltstyp

- **WENN** für einen registrierten `contentType` eine SDK-Erweiterung vorhanden ist
- **DANN** kann diese zusätzliche Validierung, UI-Bereiche, Tabelleninformationen oder Aktionen bereitstellen
- **UND** der Core-Vertrag des Inhalts bleibt unverändert gültig

#### Scenario: Plugin überschreibt den Core-Vertrag nicht

- **WENN** ein Plugin oder SDK-Modul einen speziellen Inhaltstyp registriert
- **DANN** darf es die Bedeutung oder Pflichtigkeit der Core-Felder nicht brechen
- **UND** Statusmodell, Historie und Core-Metadaten bleiben systemweit konsistent

#### Scenario: Inhalte binden Medien referenzbasiert an

- **WENN** ein Inhalt ein Bild, Download oder anderes Medium benötigt
- **DANN** referenziert der Inhalt Medien über die zentrale Medien-Capability und fachliche Rollen
- **UND** der Inhalt speichert keine rohen Storage-Keys oder auslieferungsrelevanten Dateipfade als führenden Vertrag
