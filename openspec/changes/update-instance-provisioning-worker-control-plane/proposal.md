# Change: Worker-basierte Keycloak-Control-Plane für Instanz-Provisioning

## Why
Die bisherige Instanzverwaltung koppelt interaktive Root-Studio-Requests direkt an globale Keycloak-Admin-Zugriffe. Das vergrößert den Secret-Blast-Radius, erschwert nachvollziehbare Fehlerbilder und blockiert das Zielbild einer Control Plane, die neue Realms automatisiert anlegen und bestehende Tenant-Realms kontrolliert abgleichen kann.

## What Changes
- Root-Studio-Requests erzeugen für Keycloak-Provisioning künftig nur noch Aufträge statt synchroner Keycloak-Mutationen.
- Ein dedizierter Provisioning-Worker verarbeitet diese Aufträge mit eigenen `KEYCLOAK_PROVISIONER_*`-Secrets gegen `master` oder einen gleichwertigen globalen Admin-Kontext.
- Die Instanz-Detailseite liest Preflight, Plan und Status aus Worker-Snapshots und bleibt ohne direkten Global-Admin-Zugriff benutzbar.
- Das Swarm-Referenzprofil ergänzt einen nicht öffentlich exponierten `provisioner`-Service mit eigener Laufzeitkonfiguration.

## Impact
- Affected specs: `instance-provisioning`, `deployment-topology`
- Affected code: `packages/auth/src/iam-instance-registry/*`, `packages/data/src/instance-registry/index.ts`, `apps/sva-studio-react/src/routes/admin/instances/*`, `deploy/portainer/*`, `config/runtime/studio.vars.example`
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`, `12-glossary`
