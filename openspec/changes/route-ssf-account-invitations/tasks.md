## 1. Vertrag und Persistenz

- [ ] 1.1 Typisierten Einladungszweck und systemweite Standardauswahl im bestehenden Vorlagenvertrag ergänzen.
- [ ] 1.2 Additive Migration für Systemstandard und Accountzweck anlegen; beide Schema-Dokumente aktualisieren.
- [ ] 1.3 Create- und Resend-Reads/Writes um den zweckgebundenen Wert erweitern und gezielt testen.

## 2. Runtime und Keycloak

- [ ] 2.1 Gemeinsame serverseitige Zielauflösung mit festen Client-/Redirect-Paaren in beide Versandpfade einbinden.
- [ ] 2.2 SSF-Client-Anforderung um exakt `/login` ergänzen; ungültige oder fehlende Konfiguration vor dem Versand sichtbar ablehnen.
- [ ] 2.3 Beide Zwecke in Create und Resend sowie Fehler- und Bestandsfälle gezielt testen.

## 3. Oberfläche und Dokumentation

- [ ] 3.1 Systemweite Zielauswahl und Zweckauswahl bei der Nutzeranlage mit vorhandenen UI-Bausteinen und Übersetzungen ergänzen.
- [ ] 3.2 Betroffene arc42-Abschnitte und aktuelle Nutzerdokumentation aktualisieren.
- [ ] 3.3 Gezielte UI-/Type-/Server-Runtime-/Migrations-Gates und `pnpm check:file-placement` ausführen.
- [ ] 3.4 Keycloak-Testrealm mit echter `UPDATE_PASSWORD`-Mail und finaler Zielseite abnehmen.
