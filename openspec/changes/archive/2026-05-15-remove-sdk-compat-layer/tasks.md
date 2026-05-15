## 1. OpenSpec und Architekturvertrag

- [x] 1.1 OpenSpec-Change `remove-sdk-compat-layer` mit Proposal, Design, Tasks und Deltas anlegen
- [x] 1.2 den Breaking-Cut als direkte Entfernung von `@sva/sdk` beschreiben, nicht als weitere Deprecation-Stufe
- [x] 1.3 die betroffenen aktiven arc42- und Governance-Quellen fuer die Entfernung benennen

## 2. Tests und technische Verantwortung verteilen

- [x] 2.1 plugin-bezogene SDK-Tests nach `packages/plugin-sdk/tests` verschieben und die Projektkonfiguration dafuer erweitern
- [x] 2.2 server-runtime-bezogene SDK-Tests nach `packages/server-runtime/tests` verschieben und die Projektkonfiguration dafuer erweitern
- [x] 2.3 CI-/Coverage-/Ops-nahe SDK-Tests in ein internes Nx-Projekt `tooling-testing` verschieben
- [x] 2.4 Coverage-Policy und Coverage-Baseline auf den Zustand ohne `sdk` umstellen

## 3. Aktive Code-, Skript- und Metadatenreferenzen bereinigen

- [x] 3.1 aktive Skriptimporte von `packages/sdk/src/*` auf `@sva/core` bzw. `@sva/server-runtime` umstellen
- [x] 3.2 Root-Skripte, Builder-Workspace und sonstige aktive Repo-Metadaten von `sdk` bereinigen
- [x] 3.3 aktive Tests und Tooling-Referenzen (`packages/sdk`, `sdk:*`, `scope:sdk`) auf neue Orte umstellen

## 4. Dokumentation und Governance konsolidieren

- [x] 4.1 aktive Architektur-, Governance- und Entwicklerdokumentation auf die Zielpackages ohne Compat-Layer umstellen
- [x] 4.2 den bisherigen Compat-Inventar-Report in einen Abschluss-/Removal-Report ueberfuehren
- [x] 4.3 Migrationsmapping fuer den Breaking Change dokumentieren

## 5. Entfernung und Validierung

- [x] 5.1 `packages/sdk` vollstaendig aus dem Workspace entfernen
- [x] 5.2 Repo-Suche auf verbleibende aktive `@sva/sdk`- und `packages/sdk`-Referenzen ausfuehren
- [x] 5.3 `openspec validate remove-sdk-compat-layer --strict` ausfuehren
- [x] 5.4 betroffene Unit-, Type- und Runtime-Gates ausfuehren
