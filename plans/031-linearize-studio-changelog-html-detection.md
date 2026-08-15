# Plan 031: Changelog-HTML-Erkennung linear begrenzen

## Status

- **Priorität**: P1
- **Aufwand**: S–M
- **Risiko**: mittel
- **Abhängigkeit**: Plan 027
- **Kategorie**: Eingabevalidierung / algorithmische Security
- **Geplant auf**: `960955af8`, 15. August 2026
- **Sonar**: `AZ9CFgkRsdqj1ar76p4t`, `typescript:S8786`

## Kontext und Scope

`apps/sva-studio-react/src/lib/studio-changelog.shared.ts:5` erkennt rohes HTML in repositorykontrollierten Changelog-Bodies mit einem potenziell superlinearen Regex. Obwohl der Angreiferradius kleiner als bei Runtime-Formularen ist, läuft der Parser in Build/Runtime-Ladepfaden und soll lange fehlerhafte Einträge zuverlässig begrenzen. In Scope: diese Source und `studio-changelog.shared.test.ts`; Out of Scope: Markdown-Renderer, Katalogpfade, Fehlermeldungstexte, Changelog-Schema.

## Characterization und Umsetzung

1. Fokussierte Baseline grün.
2. Erlaubte Vergleichs-/Textzeichen, echte Start-/End-/Self-closing-Tags, Attribute, unvollständige Tags, sehr lange und adversarial geformte Eingaben charakterisieren. Exakte Accept/Reject-Semantik vor Änderung festhalten.
3. Riskanten Regex durch eine lineare, lokal verständliche Erkennung ersetzen; keinen Voll-HTML-Parser und keine neue Dependency ohne belegten Semantikbedarf.
4. Gates: fokussierte Unit, App Types/Lint/Build, Fallow-New-only App, Changelog-Gate, OpenSpec strict/all, File Placement, `git diff --check`.

## Erwartete Wirkung und STOP

1 S8786 verschwindet, Accept/Reject-Matrix bleibt gleich, Fallow PASS. STOP bei erforderlicher Änderung der erlaubten Changelog-Syntax, Nutzertexten/i18n oder gemeinsamem Markdown-Sanitizing-Vertrag.

