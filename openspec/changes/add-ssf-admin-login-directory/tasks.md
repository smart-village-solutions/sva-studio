## Umsetzung

- [x] Freigegebenen schlanken Contract und Systemgrenze dokumentieren.
- [x] Directory-Endpoint und eigene Service-Leserolle implementieren.
- [x] Studio-Routing und Service-Client-Abgleich ergänzen.
- [x] Gezielte Auth-, Directory-, Routing- und Operator-Tests abschließen.
- [x] Type-, Server-Runtime-, OpenSpec- und Dateiplatzierungs-Gates prüfen.

## Lokaler Nachweis

- 18 Auth-/Directory-Tests, 43 Server-/Routing-Tests und 5 Operator-Tests grün.
- Typechecks für `auth-runtime`, `sva-studio-react` und Root-Skripte grün.
- Server-Runtime-Check, Lint (keine Fehler), OpenSpec-Validierung und
  Dateiplatzierungsprüfung grün.
- Kein Deployment und keine Änderung am laufenden Keycloak.
