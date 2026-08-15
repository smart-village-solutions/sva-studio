# Change: Öffentliche Waste-Konfiguration verhaltensneutral normalisieren

## Why

Die Normalisierung der öffentlichen E-Mail-Reminder-Konfiguration bündelt Validierung, Normalisierung und Ausgabeaufbau in einer kritischen Funktion. Ihre hohe Komplexität erschwert Änderungen an der öffentlichen Konfigurations- und Secret-Grenze, obwohl der bestehende Vertrag unverändert bleiben soll.

## What Changes

- charakterisiert gültige, partielle, fehlerhafte und unbekannte Eingaben einschließlich Serialisierung und Secret-Grenze
- zerlegt die Normalisierung in kleine typsichere Parser für Grundwerte, Adressen, URLs, Pfade, Grenzwerte und optionale Felder
- erhält Fail-closed-Verhalten, Defaults, Feldreihenfolge und serialisierten Vertrag
- senkt die kanonisch gemessene Komplexität ohne Suppression oder neue Validierungsabhängigkeit

## Out of Scope

- keine neuen Konfigurationsfelder oder Defaults
- keine Änderung an E-Mail-, URL-, Pfad- oder Grenzwertregeln
- keine Änderung an Secret-Werten, Speicherung oder Laufzeitquellen
- keine Datenbank-, HTTP-, UI- oder Cache-Änderung
- keine Abschwächung von `public_waste_config_invalid`

## Impact

- Affected specs:
  - `waste-management`
  - `complexity-quality-governance`
- Affected code:
  - `packages/core/src/waste-management-settings-public-config.ts`
  - `packages/core/src/waste-management-settings-public-config.test.ts`
  - `tooling/quality/complexity-policy.json` nur bei kanonisch belegter Senkung
- Affected arc42 sections:
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/10-quality-requirements.md`
  - `docs/architecture/11-risks-and-technical-debt.md`

## Success Criteria

- Der öffentliche Reminder-Konfigurationsvertrag bleibt für gültige und ungültige Eingaben semantik- und serialisierungsgleich.
- Unbekannte Felder und Secret-Werte gelangen nicht in das normalisierte Reminder-Konfigurationsobjekt.
- Ungültige Pflichtwerte führen weiterhin fail-closed zu keiner lesbaren Konfiguration.
- Der Fallow-Hotspot ist nicht mehr kritisch und die Complexity-Baseline sinkt ausschließlich über den kanonischen Gate-Vertrag.
