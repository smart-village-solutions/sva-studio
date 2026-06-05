# Change: Öffentlicher Releasepfad für den Abfallkalender

## Why

Die öffentliche Webversion des Abfallkalenders benötigt einen eigenen
Release- und Deployvertrag, damit Releases nicht über den normalen
Studio-Stack laufen und operative Änderungen am Bürger-Frontend den
bestehenden Studio-Betrieb nicht beeinflussen.

## What Changes

- eigener Produktionspfad für `apps/public-waste-calendar-web`
- eigener Swarm-/Portainer-Stack `public-waste-calendar`
- Git-Tag-getriebener Releaseworkflow `waste-web-vX.Y.Z`
- produktive Runtime-Konfiguration über einzelne `PUBLIC_WASTE_*`-Variablen
- eigener Produktionsserver für die öffentliche Web-App mit Health- und
  öffentlichen Read-Endpunkten
- **BREAKING (betrieblich):** produktionsführende Konfiguration ist nicht mehr
  `PUBLIC_WASTE_CONFIG_JSON`, sondern aufgetrennte Variablen

## Impact

- Affected specs: `public-waste-calendar`, `deployment-topology`, `architecture-documentation`
- Affected code: `apps/public-waste-calendar-web`, `deploy/portainer/*`, `.github/workflows/*`, `scripts/ops/*`
- Affected arc42 sections: `05-building-block-view`, `07-deployment-view`, `08-cross-cutting-concepts`
