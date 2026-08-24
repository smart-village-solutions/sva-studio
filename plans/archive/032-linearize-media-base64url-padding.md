# Plan 032: Media-Base64url-Padding linear entfernen

> **Archivstatus:** DONE

## Status

- **Priorität**: P2
- **Aufwand**: S
- **Risiko**: mittel
- **Abhängigkeit**: Plan 027
- **Kategorie**: Eingabevalidierung / algorithmische Security
- **Geplant auf**: `960955af8`, 15. August 2026
- **Sonar**: `AZ7zBUuvKoyPQ8JFyMIq`, `typescript:S8786`

## Kontext und Scope

`apps/sva-studio-react/src/routes/admin/media/-media-ui.shared.tsx:19-31` entfernt Base64-Padding im Browser-Fallback mit `/=+$/g`. Storage-Keys können lang und extern geprägt sein; Node- und Browserpfad müssen exakt dieselbe Base64url-Ausgabe und Roundtrip-Semantik behalten. In Scope sind diese Source und `-media-ui.shared.test.ts`; Out of Scope: Media-ID-Präfix, Storage-Key-Schema, Upload, Asset-API, globale Base64-Helfer.

## Characterization und Umsetzung

1. Fokussierte Baseline grün.
2. Node- und Browser-Fallback für Paddinglängen 0/1/2, Unicode, leere und sehr lange/adversarial geformte Storage-Keys charakterisieren; Altcodeausgabe und Roundtrip festhalten. Bestehenden Source-Shape-Test nicht als alleinigen Beleg verwenden.
3. Nur das Padding linear/konstant begrenzt entfernen; keine neue Utility-Abstraktion.
4. Gates: fokussierte Unit, App Types/Lint/Build, Fallow-New-only App, OpenSpec strict/all, File Placement, Changelog, `git diff --check`.

## Erwartete Wirkung und STOP

1 S8786 verschwindet; Node-/Browser-Ausgabe bleibt bytegleich; Fallow PASS. STOP, wenn Browser-Fallback im Test nicht realistisch isolierbar ist oder eine gemeinsame Encoding-Vertragsänderung nötig wird.
