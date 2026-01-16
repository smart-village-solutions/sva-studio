# Monorepo Struktur

## Ordner
- apps/: laufende Anwendungen (z. B. sva-studio-react)
- packages/: publishable Libraries und Plugins
- tooling/: gemeinsame Tools und Konfigurationen
- scripts/: Automations-Skripte

## Package-Konventionen
- Scope: @sva/*
- Core: @sva/core
- Data: @sva/data
- SDK: @sva/sdk
- Plugins: @sva/plugin-*

## Neues Package anlegen

### Standard-Workflow: Nx-Generator (empfohlen)

**@nx/js:lib Generator verwenden** — das ist der Nx-Standard und garantiert:
- ✅ Korrekte project.json mit build/test/lint Targets
- ✅ TypeScript-Setup (tsconfig.json, tsconfig.lib.json)
- ✅ Automatische Integration in tsconfig.base.json
- ✅ Sofortige Sichtbarkeit im Nx-Projektgraphen
- ✅ Caching und affected-Commands funktionieren sofort

#### Schnell-Command (mit npm-Script)
```bash
pnpm new:lib my-package
```

#### Vollständiger Command mit allen Options
```bash
nx g @nx/js:lib my-package \
  --directory=packages/my-package \
  --importPath=@sva/my-package \
  --tags=scope:shared,type:lib \
  --bundler=tsc \
  --publishable=false
```

**Was der Generator automatisch macht:**
1. Erstellt `packages/my-package/` mit src/index.ts
2. Generiert `project.json` mit Nx Targets
3. Erstellt `tsconfig.json` und `tsconfig.lib.json`
4. Aktualisiert `tsconfig.base.json` mit Path-Mapping
5. Registriert Package im Nx-Projektgraphen

**Nach dem Generator (falls nötig):**
- Ergänze Abhängigkeiten in `package.json` (z.B. Peer Dependencies für Plugins)
- Implementiere Code in `src/`
- Exportiere Public API über `src/index.ts`

**Weitere Informationen:**
- 📖 [Nx TypeScript Library Generators](https://nx.dev/nx-api/js/generators/library)
- 📖 [Generator Options](https://nx.dev/nx-api/js/generators/library#options)

#### Tipps für spezifische Cases

**Plugin mit React-Dependencies:**
```bash
pnpm new:lib plugin-foo --tags=scope:plugin,type:lib
# Dann in package.json peerDependencies hinzufügen:
# "@tanstack/react-router": "^1.x", "react": "^19.x", etc.
```

**Publishable Library (für npm Publishing):**
```bash
nx g @nx/js:lib my-lib \
  --directory=packages/my-lib \
  --importPath=@sva/my-lib \
  --publishable=true \
  --bundler=tsc
```

---

### Alternatives Workflow: Manuelles Setup (nur wenn Generator nicht passt)

> ⚠️ **Nur in Ausnahmefällen verwenden.** Der Generator ist flexibel genug für 90% der Fälle.

**Wann manuell?**
- Externe bestehende Library wird ins Monorepo integriert
- Extrem spezifisches Build-Setup (sehr selten)
- Experimentelle Struktur

**Nachteile manueller Setups:**
- ❌ Keine automatischen Targets
- ❌ Keine path-Mapping-Integration
- ❌ Nicht im Nx-Projektgraphen (bis manuell registriert)
- ❌ affected-Commands berücksichtigen es nicht
- ❌ Höhere Fehleranfälligkeit

**Falls du manuell starten musst:**
1. Lege einen Ordner unter packages/ an
2. Erstelle package.json, project.json, tsconfig.json, tsconfig.lib.json
3. Exportiere die Public API über src/index.ts
4. Füge einen Pfad in tsconfig.base.json hinzu
5. Registriere das Package in Nx:
   ```bash
   nx detect
   # oder manuell in nx.json konfigurieren
   ```

**Dann:** Wende den Generator-Workflow retrospektiv an, um Targets zu ergänzen.

## Warum Nx (statt Turborepo)?
Wir nutzen Nx, weil es als integrierte Monorepo-Plattform mehr liefert als „nur“ Task-Running:

- **Projektgraph & affected commands:** Nx modelliert Abhängigkeiten zwischen Apps und Packages und kann dadurch in CI/CD gezielt nur die betroffenen Projekte bauen/testen.
- **Generatoren & Konsistenz:** Neue Apps/Packages lassen sich mit `nx g @nx/js:lib` etc. scaffolden — das bedeutet automatisches Setup von Targets, TypeScript-Konfiguration und Projektgraph-Integration. Das reduziert manuellen Aufwand und hält Konventionen über Zeit konsistent (weniger Copy/Paste, weniger Drift).
- **Architektur-Governance:** Mechanismen wie Tags/Boundaries helfen, Schichten (Core vs. Plugins) langfristig sauber zu halten.
- **Caching & Skalierung:** Lokales/Remote-Caching ist integriert; optional kann Nx Cloud für Team-Setups genutzt werden.

Details und Trade-offs: siehe openspec/specs/monorepo-structure/design.md

## Warum Nx (statt Turborepo)?
Wir nutzen Nx, weil es als integrierte Monorepo-Plattform mehr liefert als „nur“ Task-Running:

- **Projektgraph & affected commands:** Nx modelliert Abhängigkeiten zwischen Apps und Packages und kann dadurch in CI/CD gezielt nur die betroffenen Projekte bauen/testen.
- **Generatoren & Konsistenz:** Neue Apps/Packages/Plugins lassen sich mit wiederholbaren Konventionen scaffolden (geringerer Setup-Aufwand, weniger Drift).
- **Architektur-Governance:** Mechanismen wie Tags/Boundaries helfen, Schichten (Core vs. Plugins) langfristig sauber zu halten.
- **Caching & Skalierung:** Lokales/Remote-Caching ist integriert; optional kann Nx Cloud für Team-Setups genutzt werden.

Details und Trade-offs: siehe openspec/specs/monorepo-structure/design.md

## Nx Targets
Standardisierte Targets:
- build: tsc -p packages/<name>/tsconfig.lib.json
- lint: Platzhalter (noch zu konfigurieren)
- test: Platzhalter (noch zu konfigurieren)

## Hinweise
- TanStack Start benötigt Node >= 22.12.0
- Routing erfolgt über eine Code-Registry; siehe docs/routing.md
- Package-Manager ist pnpm (siehe pnpm-workspace.yaml)
