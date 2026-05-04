# Change: Instanzbezogene Modulzuweisung mit IAM-Baseline-Seeding einfuehren

## Why

Studio-Plugins sind derzeit global registriert, aber nicht explizit pro Instanz zuweisbar. Dadurch fehlen drei zentrale Betriebsfaehigkeiten: eine bewusste Modulzuordnung je Instanz, ein daraus abgeleiteter kanonischer IAM-Basis-Seed und eine harte fachliche Sperre fuer nicht zugewiesene Module.

Fuer den Betrieb bedeutet das konkret, dass Instanzen wie `hb-meinquartier` einen unvollstaendigen Rechte- und Rollenkatalog haben koennen, ohne dass das Cockpit diesen Befund als gezielte Modul- und IAM-Drift sichtbar oder direkt behebbar macht.

## What Changes

- Einfuehrung einer kanonischen, persistenten Modulzuordnung `Instanz <-> Modul`
- Neuer zentraler Admin-Bereich `Module` auf Studio-Root-Ebene, ueber den der Studio-Admin Instanzen explizit Module zuweist oder entzieht
- Die Steuerung erfolgt ausschliesslich durch den Studio-Admin; Instanz-Operatoren koennen keine eigene Modul-Aktivierung oder -Deaktivierung ausloesen
- Zuweisung eines Moduls zu einer Instanz wird zu einer atomaren Studio-Admin-Aktion:
  - Modul der Instanz zuordnen
  - modulbezogene Permissions anlegen oder aktualisieren
  - kanonische Systemrollen und `role_permissions` fuer `Core + zugewiesene Module` auf Sollstand bringen
- Entzug eines Moduls von einer Instanz wird zu einer atomaren Studio-Admin-Aktion:
  - Modulzuordnung entfernen
  - modulbezogene Permissions hart entfernen
  - modulbezogene `role_permissions` und systemische Rollenerweiterungen hart entfernen
- Modulbezogene IAM-Artefakte werden ueber einen kanonischen Plugin-Vertrag deklariert, damit die Soll-Ableitung fuer `Core + zugewiesene Module` deterministisch bleibt
- Fachliche Nutzung nicht zugewiesener Module wird fail-closed blockiert:
  - keine Modulrouten
  - keine Modulakektionen
  - keine modulbezogene Mainserver- oder Content-Nutzung
  - keine modulbezogenen IAM-Freigaben
- Das Instanz-Cockpit zeigt einen expliziten Befund fuer fehlende oder driftende IAM-Basis zugewiesener Module und bietet dem Studio-Admin eine direkte Reparaturaktion zum Neu-Seeden an
- Bestehende Instanzen werden nicht implizit migriert; ihr Modulsatz ist nach Einfuehrung zunaechst leer und muss vom Studio-Admin explizit befuellt werden

## Impact

- Affected specs:
  - `instance-provisioning`
  - `iam-access-control`
  - `routing`
  - `account-ui`
- Affected code:
  - `packages/instance-registry`
  - `packages/data-repositories`
  - `packages/core`
  - `apps/sva-studio-react`
  - `packages/plugin-*`
  - `packages/plugin-sdk`
- Affected arc42 sections:
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/09-architecture-decisions.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
  - `docs/architecture/12-glossary.md`
