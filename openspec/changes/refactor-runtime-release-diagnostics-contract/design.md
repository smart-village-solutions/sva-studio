# Design: Runtime-Release- und Diagnosevertrag

## Kontext

Der bestehende Releasepfad nutzt bereits `verify:runtime-artifact`, Studio Image Verify und den lokalen Operator-Einstieg `env:release:studio:local`. Der bestehende IAM-Diagnosekern liegt in `@sva/core` und wird server- und browserseitig konsumiert. Dieser Change schließt Vertragslücken, ohne die Paketarchitektur oder IAM-Hotspots groß umzubauen.

## Entscheidungen

- `@sva/core` bleibt alleinige Quelle für öffentliche Diagnoseklassen, Statuswerte, empfohlene Aktionen und `safeDetails`.
- Neue Diagnoseklassen sind additiv und werden aus vorhandenen `reason_code`-, Dependency- und HTTP-Fehlerdaten abgeleitet.
- `safeDetails` bleibt allowlist-basiert; rohe Provider-Payloads, Tokens, Secrets, E-Mail-Adressen und nicht freigegebene Felder werden nicht übertragen.
- Release-Freigabe bezieht sich auf den finalen Node-Output und den gepushten Image-Digest. Intermediate-Artefakte bleiben Diagnosematerial.
- `env:precheck:studio` erzeugt eine eigene Evidenzprüfung für passende Studio-Image-Verify-Berichte. Fehlende Evidenz wird als `warn` gemeldet, damit lokale Sonderfälle sichtbar bleiben, ohne den Operator-Pfad pauschal zu blockieren.

## Rollout

Der Change ist rückwärtskompatibel. Bestehende Clients sehen zusätzliche Klassifikationswerte; unbekannte Werte fallen in der UI weiterhin sicher auf generische Anzeige zurück.
