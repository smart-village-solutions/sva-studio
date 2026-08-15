## 1. Characterization

- [x] 1.1 Bestehende Event-Detailformular-, Tab- und Seitentests sowie Package-Types als Baseline ausführen.
- [x] 1.2 Optionale Felder, leere, `undefined`-, `null`-, `false`-, `0`- und ungültige Werte gegen den unveränderten Altcode charakterisieren.
- [x] 1.3 Datums-/Zeitgrenzen, Medien, Adressen/Geo, Kompatibilitätswerte und Array-Reihenfolgen per Deep Equal charakterisieren.

## 2. Implementierung

- [x] 2.1 Reine paketinterne Serializer nach redaktionellen, Datums-, Adress- und Medienbereichen extrahieren.
- [x] 2.2 `mapEventsDetailFormValuesToInput` auf verhaltensgleiche Assemblierung reduzieren.
- [x] 2.3 Plugin- und arc42-Dokumentation aktualisieren.

## 3. Verifikation

- [x] 3.1 Relevante Unit-, Type-, Lint-, Build- und Complexity-Gates ausführen.
- [x] 3.2 OpenSpec strict, File Placement, Changelog und `git diff --check` ausführen.
- [x] 3.3 Statischen und coveragegestützten Fallow-New-only-Audit mit allen eingeführten Zählern auf null nachweisen.
