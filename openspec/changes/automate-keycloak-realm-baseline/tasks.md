## 1. Verträge und Baseline

- [x] 1.1 Typisierte und versionierte Baseline im bestehenden `instance-registry`-Package anlegen; Theme, Dark Mode, ausschließlich `de`, Events, Recovery, Benutzerprofil, Mapper und nicht geheime SMTP-Werte aufnehmen.
- [x] 1.2 New-Realm-Defaults serverseitig aus `instanceId` und Baseline ableiten; passende Legacy-Eingaben tolerieren und widersprüchliche Werte vor Mutation ablehnen.
- [x] 1.3 Baseline-Version und semantischen Fingerprint in vorhandenen Tenant- und Keycloak-Provisioning-Snapshots führen, ohne neue Persistenz.
- [x] 1.4 Vorhandenen Statusvertrag um Baseline-, Profil-, Mapper- und booleschen SMTP-Passwortstatus ergänzen.

## 2. Keycloak-Adapter und Ausführung

- [x] 2.1 Realm-Repräsentation typisieren und den SMTP-Passwortwert vor Verlassen des Adapters entfernen.
- [x] 2.2 Realm-Create-Payload um ausschließlich nicht geheime Baseline-Felder erweitern.
- [x] 2.3 Vorhandene additive Benutzerprofilfunktion für die drei Studio-Attribute verwenden und fremde Attribute erhalten.
- [x] 2.4 Vorhandenen `instanceId`-Mapper am aufgelösten Login-Client einbinden.
- [x] 2.5 Automatische Baseline ausschließlich für `realmMode = new` ausführen; Bestands-Realms nur lesen.
- [x] 2.6 Realm bei Fehlern nach einer echten Neuanlage über die vorhandene Kompensation entfernen und einen zwischenzeitlich entstandenen fremden Realm nicht übernehmen.

## 3. Plan, Readback und UI

- [x] 3.1 Plan und Run-Protokoll um automatischen Baseline-Schritt und manuelles SMTP-Passwort mit stabilen Grund-/Aktionscodes ergänzen.
- [x] 3.2 Finalen Readback für neue Realms an Theme, Sprache, Events, Benutzerprofil und Mapper binden; fehlendes SMTP-Passwort als nicht blockierende Nacharbeit behandeln.
- [x] 3.3 Im New-Realm-Pfad technische Standardfelder ausblenden und die serverseitige Baseline zusammenfassen.
- [x] 3.4 Existing-Realm-Pfad und explizite technische Eingaben unverändert erhalten.
- [x] 3.5 Neue Status- und Wizard-Texte in den vorhandenen deutschen und englischen Übersetzungsressourcen ergänzen.

## 4. Tests und Dokumentation

- [x] 4.1 Baseline-, Contract-, Fingerprint-, New-/Existing-Mode-, Readback- und Kompensationstests ergänzen.
- [x] 4.2 Adaptertests für Realm-Payload und Passwort-Redaktion ergänzen.
- [x] 4.3 UI-Tests für vereinfachten New-Realm- und unveränderten Existing-Realm-Pfad ergänzen.
- [x] 4.4 Gezielte Unit-, Type-, Server-Runtime-, Dateiplatzierungs- und OpenSpec-Gates ausführen.
- [x] 4.5 Operative Realm-Checkliste und Bootstrap-Runbook auf den realen Automatisierungsstand aktualisieren.
- [ ] 4.6 In einer späteren Umgebungsabnahme einen temporären Realm erstellen und Realm-Readback, Browser-Login, `/auth/me` sowie SMTP nach manuellem Passwortsetzen prüfen.
