## 1. Abnahmebasis

- [ ] 1.1 Testumgebungs-Kontrakt für Keycloak-Realm, Test-Clients, Test-User und Seed-Instanz festlegen
- [ ] 1.2 Verbindliche Gate-Kommandos für Paket-1-/Paket-2-Abnahme definieren
- [ ] 1.3 Berichtsvorlage und Ablagekonvention unter `docs/reports/` festlegen

## 2. Paket 1: Basis-IAM-Abnahme

- [ ] 2.1 Readiness-Nachweis für Keycloak, Datenbank und Redis spezifizieren
- [ ] 2.2 OIDC-Login-Smoke mit Claim-Verifikation (`sub`, `instanceId`, Rollen) spezifizieren
- [ ] 2.3 Nachweis für JIT-Provisioning bzw. Login-zu-Account-Verknüpfung spezifizieren

## 3. Paket 2: Accounts & Organisationen

- [ ] 3.1 API-Smokes für Organisations-CRUD und Membership-Zuweisung spezifizieren
- [ ] 3.2 UI-Smokes für Benutzerliste, Organisationsstruktur und Kontextsicht spezifizieren
- [ ] 3.3 Datenbank-Smokes für Tabellenzustand, Hierarchie und Default-Kontext spezifizieren

## 4. Dokumentation

- [ ] 4.1 Betroffene Guides für Setup und Abnahme aktualisieren
- [ ] 4.2 Betroffene arc42-Abschnitte referenzieren und Änderungsbedarf dokumentieren
- [ ] 4.3 `openspec validate update-iam-foundation-acceptance-hardening --strict` erfolgreich ausführen
