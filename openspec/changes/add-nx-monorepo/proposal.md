# Change: Nx Integrated Monorepo hinzufügen (experimentell)

## Warum
Wir benötigen ein einheitliches, skalierbares Workspace-Setup für Frontend-/Backend-Pakete und Shared Libraries. Ein integriertes Nx-Monorepo liefert Generatoren, Caching und konsistente Tooling-Workflows, ohne Build/Test-Skripte manuell zu verdrahten.

## Was ändert sich
- Nx **integrated** Workspace im Repo-Root initialisieren (kein Unterordner), npm-basiert, Nx Cloud deaktiviert
- Formatierung/Linting mit bestehendem Prettier beibehalten; Vorbereitung für TypeScript/React-Apps und Shared Libraries
- Minimale Workspace-Konfiguration für spätere Generatoren (Apps/Libs), ohne jetzt App-Code hinzuzufügen

## Impact
- Betroffene Specs: tooling
- Betroffener Code: Repository-Root (nx.json, package.json, Workspace-Config), .vscode-Tasks bei Bedarf später
