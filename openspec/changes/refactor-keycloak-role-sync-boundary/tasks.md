## 1. Spezifikation und Vertragsgrenze
- [x] 1.1 Bestehende OpenSpec-Annahmen entfernen, nach denen studioverwaltete Tenant-Rollen generell mit Keycloak-Realm-Rollen synchronisiert werden.
- [x] 1.2 Die normative Trennung dokumentieren: Keycloak für Identität und technische Sonderrollen, IAM-Datenbank für fachliche Tenant-Rollen und Permissions.
- [x] 1.3 Betroffene arc42-Abschnitte für die neue Verantwortungsgrenze referenzieren und später aktualisieren (04, 05, 06, 08, 09, 10, 11).

## 2. Lesepfade zuerst auf kanonische IAM-Sicht umstellen
- [x] 2.0 Kanonisches Session-/`/auth/me`-Schema festlegen: getrennte Felder für IAM-Rollen (inkl. impliziter Rollen aus Gruppenzuordnungen) und rohe Keycloak-Rollen.
- [x] 2.1 Session-, `/auth/me`- und Profilprojektionen auf das kanonische tenantseitige Rollen- und Permission-Modell ausrichten und beide Rollensichten konsistent befüllen.
- [x] 2.2 Route-, Sidebar- und API-Gates von rohen Keycloak-Rollen entkoppeln und auf `system_admin`, Plattform-Scope oder explizite Permissions umstellen.
- [x] 2.3 UI-Darstellungen für Rollen vereinheitlichen: kanonische IAM-Sicht als normative Fachsicht, rohe Keycloak-Rollen als getrennte technische Sicht.
- [x] 2.4 Frühe Verifikation für Phase 2 durchführen: `/auth/me`-Schema, Guard-Fail-Closed-Verhalten und Trennung der Rollensichten testen.

## 3. Drift-Gate sowie Schreib- und Sync-Pfade einengen
- [ ] 3.0 Drift-Berichte für aktive Tenants in der Zielumgebung ausführen und als Rollout-Freigabe für das Abschalten des breiten Rollenabgleichs dokumentieren.
- [x] 3.1 Rollen-CRUD für tenantlokale Custom-Rollen auf IAM-only umstellen.
- [x] 3.2 Keycloak-Rollenmutationen auf `instance_registry_admin`, `system_admin` und explizit technische Realm-Artefakte begrenzen.
- [x] 3.3 Bestehende Reconcile-, Repair- und Bootstrap-Pfade im Code so anpassen, dass sie keine tenantlokalen Fachrollen mehr in Keycloak neu materialisieren; produktive Aktivierung bleibt an das Drift-Gate aus 3.0 gebunden.
- [x] 3.4 Provisioning absichern: `system_admin` für neue Tenants idempotent im IAM-Modell seeden, bevor der Bootstrap-Lauf als erfolgreich gilt.

## 4. Legacy-Kompatibilität und Migrationssicherheit
- [x] 4.1 Legacy-Keycloak-Rollen in UI und Diagnose als Altbestand markieren statt als Sollmodell darzustellen.
- [x] 4.2 Tenantweisen Bereinigungspfad dokumentieren, bevor breiter Rollenabgleich final entfernt wird.

## 5. Verifikation, Tests und Dokumentation
- [x] 5.1 Specs, Tests und Diagnosen für Session-Projektion, Guard-Verhalten, Rollen-CRUD und Reconcile an den neuen Grenzvertrag anpassen.
- [x] 5.2 Verifizieren, dass `system_admin` tenantseitig voll funktionsfähig bleibt, ohne zusätzliche Keycloak-Fachrollen vorauszusetzen.
- [x] 5.3 Verifizieren, dass Plattformpfade weiterhin ausschließlich über `instance_registry_admin` funktionieren.
- [x] 5.4 Architektur- und Betriebsdokumentation für den schrittweisen Umbaupfad aktualisieren.

## 6. Rollout-Schritte nach Merge
- [ ] 6.1 Drift-Bericht pro aktivem Tenant erzeugen und im Betriebs-/PR-Kontext ablegen.
- [ ] 6.2 Pilot-Tenant nach dem neuen Vertrag betreiben und Login, `/auth/me`, Rollen-CRUD, User-Create/-Update und Reconcile smoke-testen.
- [ ] 6.3 Legacy-Keycloak-Rollen tenantweise freigeben oder bereinigen; keine automatische Löschung ohne Betriebsfreigabe.
- [ ] 6.4 Nach erfolgreichem Pilot den breiten Keycloak-Rollenabgleich in weiteren Tenants stufenweise deaktivieren und Monitoring auf `manual_review`, `IDP_FORBIDDEN`, `IDP_UNAVAILABLE` und Drift-Backlog prüfen.
