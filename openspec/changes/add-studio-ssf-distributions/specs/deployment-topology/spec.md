## ADDED Requirements

### Requirement: Distributionsgebundene Studio-Images

Der Build MUST für jede unterstützte Studio-Distribution ein separates,
unveränderliches OCI-Image mit attestierter Distribution erzeugen. Die
Image-Verifikation und Promotion MUST Repository, Digest und Distribution
gemeinsam prüfen.

#### Scenario: Standard-Studio-Image wird geprüft

- **GIVEN** ein Image behauptet die Distribution `studio`
- **WHEN** die Image-Verifikation läuft
- **THEN** weist sie nach, dass SSF-Plugin-Artefakte und SSF-Routen fehlen
- **AND** schlägt bei abweichendem Inventar fehl

#### Scenario: SSF-Image wird geprüft

- **GIVEN** ein Image behauptet die Distribution `ssf`
- **WHEN** die Image-Verifikation läuft
- **THEN** weist sie nach, dass nur SSF und Medienfähigkeit vorhanden sind
- **AND** schlägt bei einem regulären Studio-Fachplugin fehl

#### Scenario: Promotion erhält die Distributionsgrenze

- **GIVEN** ein verifizierter Image-Digest gehört zur Distribution `studio`
- **WHEN** er nach Staging oder Produktion promotet wird
- **THEN** akzeptiert der Zielpfad nur die passende `studio`-Erwartung
- **AND** ersetzt kein SSF-Artefakt
