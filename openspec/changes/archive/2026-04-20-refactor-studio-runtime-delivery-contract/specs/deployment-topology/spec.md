## ADDED Requirements

### Requirement: Finaler Runtime-Artefaktvertrag fuer Studio

Das System SHALL fuer `studio` den finalen Node-Output unter `apps/sva-studio-react/.output/server/**` als einzigen technischen Freigabegegenstand vor dem Image-Build behandeln.

#### Scenario: Finales Runtime-Artefakt wird vor dem Image-Build verifiziert

- **WHEN** der kanonische `studio`-Releasepfad ein neues Image bauen will
- **THEN** prueft der CI-Pfad zuerst den finalen Node-Output `apps/sva-studio-react/.output/server/index.mjs`
- **AND** der Check validiert mindestens den Server-Entry-Vertrag, `/health/live`, `/health/ready` und `/`
- **AND** Intermediate-Artefakte unter `.nitro/vite/services/ssr/**` gelten nur als Diagnosematerial

### Requirement: Recovery-Patching bleibt expliziter Ausnahmeweg

Das System SHALL Laufzeit-Patching des finalen Nitro-Entrys nicht mehr als Standardmodell verwenden.

#### Scenario: Entrypoint startet im Standardbetrieb ohne Patch

- **WHEN** ein `studio`-Container regulaer startet
- **THEN** schreibt `deploy/portainer/entrypoint.sh` das Build-Artefakt nicht still um
- **AND** ein Recovery-Patch ist nur mit explizitem Flag `SVA_ENABLE_RUNTIME_RECOVERY_PATCH=1` zulaessig
- **AND** fehlende Startfaehigkeit ohne dieses Flag blockiert den Releasepfad
