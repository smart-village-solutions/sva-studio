## 1. Abnahmebasis

- [x] 1.1 Testumgebungs-Kontrakt für Keycloak-Realm, Test-Clients, Test-User und Seed-Instanz festlegen
- [x] 1.2 Verbindliche Gate-Kommandos für Paket-1-/Paket-2-Abnahme definieren
- [x] 1.3 Berichtsvorlage und Ablagekonvention unter `docs/reports/` festlegen

## 2. Paket 1: Basis-IAM-Abnahme

- [x] 2.1 Readiness-Nachweis für Keycloak, Datenbank und Redis spezifizieren
- [x] 2.2 OIDC-Login-Smoke mit Claim-Verifikation (`sub`, `instanceId`, Rollen) spezifizieren
- [x] 2.3 Nachweis für JIT-Provisioning bzw. Login-zu-Account-Verknüpfung spezifizieren

## 3. Paket 2: Accounts & Organisationen

- [x] 3.1 API-Smokes für Organisations-CRUD und Membership-Zuweisung spezifizieren
- [x] 3.2 UI-Smokes für Benutzerliste, Organisationsstruktur und Kontextsicht spezifizieren
- [x] 3.3 Datenbank-Smokes für Tabellenzustand, Hierarchie und Default-Kontext spezifizieren

## 4. Dokumentation

- [x] 4.1 Betroffene Guides für Setup und Abnahme aktualisieren
- [x] 4.2 Betroffene arc42-Abschnitte referenzieren und Änderungsbedarf dokumentieren
- [x] 4.3 `openspec validate update-iam-foundation-acceptance-hardening --strict` erfolgreich ausführen
