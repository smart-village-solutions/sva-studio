# Change: SSF aus der Standard-Studio-Distribution entfernen

## Why

Das Standard-Studio-Artefakt registriert das SSF-Plugin trotz deaktivierter
SSF-Datenbank und Runtime. Dadurch erscheinen SSF-Navigation und -Routen auf
Staging und Produktion, obwohl diese Umgebungen keinen SSF-Dienst betreiben.

## What Changes

- Das Build-Profil `studio` enthält kein SSF-Plugin und keine SSF-Runtime.
- Das explizite Profil `ssf` enthält nur das SSF-Plugin und die benötigte
  hosteigene Medienfähigkeit.
- Browser, Server, Jobs, IAM und Modulverwaltung leiten ihre sichtbaren und
  ausführbaren Beiträge aus derselben Build-Zeit-Distribution ab.
- CI baut und prüft getrennte, immutable Studio- und SSF-Images; Promotion
  bindet Repository, Digest und Distribution zusammen.

## Impact

- Affected specs: `plugin-platform`, `deployment-topology`
- Affected code: Plugin-Katalog, App-Build, Server-/Job-Registrierung,
  Modul-IAM, Docker- und Build-Workflows
- Affected arc42: `05-building-block-view.md`, `07-deployment-view.md`,
  `08-cross-cutting-concepts.md`, `10-quality-requirements.md`,
  `11-risks-and-technical-debt.md`
