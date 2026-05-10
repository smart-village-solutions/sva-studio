## 1. Specification

- [x] 1.1 `plugin-platform` um deklarative Job-Runtime-Anforderungen im Manifest fortschreiben
- [x] 1.2 `architecture-documentation` um den generischen Job-Runtime-Vertrag und die reduzierte Restschuld fortschreiben
- [x] 1.3 `openspec validate refactor-plugin-job-runtime-contract-resolution --strict` ausführen

## 2. Contracts and Runtime Resolution

- [x] 2.1 `PluginManifest` und `definePluginManifest(...)` um `runtimeRequirements.jobs` erweitern und Mindestkonsistenz zu `entryPoints.jobs` erzwingen
- [x] 2.2 Waste-Manifest auf deklarativen Job-Runtime-Contract umstellen
- [x] 2.3 Host-Job-Runtime-Auflösung von `pluginId` auf Runtime-Contract-ID umstellen
- [x] 2.4 deterministische Fehlerfälle für fehlende Runtime-Anforderung und fehlenden Host-Provider ergänzen

## 3. Tests and Documentation

- [x] 3.1 SDK-Contract-Tests für gültige und ungültige Manifest-Kombinationen ergänzen
- [x] 3.2 Host-Tests für erfolgreiche und fehlschlagende Job-Runtime-Auflösung ergänzen
- [x] 3.3 betroffene Type-/Unit-Checks und `openspec validate` grün ausführen
