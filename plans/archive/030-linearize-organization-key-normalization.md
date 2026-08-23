# Plan 030: Organisation-Keys linear normalisieren

> **Archivstatus:** DONE

## Status

- **Priorität**: P1
- **Aufwand**: S
- **Risiko**: mittel
- **Abhängigkeit**: Plan 027
- **Kategorie**: Eingabevalidierung / algorithmische Security
- **Geplant auf**: `960955af8`, 15. August 2026
- **Sonar**: `AZ7zBU0TKoyPQ8JFyMIu`, `typescript:S8786`

## Kontext, Scope und Vertrag

`apps/sva-studio-react/src/routes/admin/organizations/-organization-shared.tsx:92-101` erzeugt aus eingegebenen Anzeigenamen vorgeschlagene eindeutige Organisation-Keys. Der Randtrim-Regex ist als superlinear markiert. In Scope sind diese Datei und `-organization-shared.test.tsx`; Out of Scope sind Mutation-Payload, Backendvalidierung, Organisationspersistenz, Mainserver-Credentials und UI-Layout.

## Characterization und Umsetzung

1. Vorhandenen fokussierten Test als Baseline ausführen.
2. Tests für Unicode/NFKD, nur Separatoren, Rand-/Mehrfachseparatoren, sehr lange/adversarial geformte Werte, bestehende Keys, Exclude-ID und Suffixreihenfolge zuerst hinzufügen und am Altcode ausführen.
3. Ausschließlich den riskanten Trim-Schritt linear formulieren; resultierende Keys und Kollisionspriorität exakt erhalten.
4. Gates: fokussierte Unit, `sva-studio-react:test:types`, `sva-studio-react:lint`, relevanter Build, Fallow-New-only `sva-studio-react`, Accessibility nur falls JSX geändert wird, OpenSpec strict/all, File Placement, Changelog, `git diff --check`.

## Erwartete Wirkung

1 S8786 verschwindet; keine Änderung gespeicherter oder vorgeschlagener Keys; Fallow PASS.

## STOP-Bedingungen

- Normalisierungs- oder Kollisionsvertrag müsste fachlich geändert werden.
- Aktive Organisation-Provisioning-Arbeit berührt Source oder dieselbe Fixture.
- Änderung zieht Backend/API/DB-Scope nach sich.
