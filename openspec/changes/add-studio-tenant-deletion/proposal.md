# Änderung: Archivierte Studio-Tenants endgültig löschen

## Warum

Nach dem Umzug eines Test-Tenants bleiben lokale Instanzdaten und alte Hostnamen zurück.
Die vorhandene Archivierung entfernt diese Daten nicht.

## Änderungen

- Bestehende Instanzverwaltung um eine explizit bestätigte, atomare lokale Löschung ergänzen.
- Ausschließlich archivierte Instanzen ohne laufende Arbeit oder aktive Aufbewahrungssperren zulassen.
- Mainserver und Keycloak vollständig unverändert lassen, einschließlich aller Realms, Clients, Benutzer und Rollen.
- Externe Objektspeicher und Plugin-Datenbanken nicht verändern; lokale Verknüpfungen und Secrets entfernen.

## Entwurf und Freigabe

Der Nutzer hat die lokale Tenant-Löschung beauftragt und Mainserver- sowie Keycloak-Mutationen ausdrücklich ausgeschlossen.
Die bestehende Root-Admin-Autorisierung, CSRF-Prüfung, frische Anmeldung und eine instanzgebundene Bestätigung schützen den Einstieg.
Die bestehende Scoped-Transaktion verwendet für diese Mutation keine Aktivierungs-Reconciliation oder Lifecycle-Follow-ups.
Die Datenbankfunktion prüft Archivstatus, Änderungsstand, laufende Arbeit und Aufbewahrungssperren vor der ersten Löschung.
Sie entfernt nur den aktuellen Tenant und hinterlässt einen Plattform-Audit-Eintrag; SQL-Fehler rollen den gesamten Aufruf zurück.
Nach Erfolg wird der lokale Host-Cache geleert. Andere Prozesse verwenden ihre bestehende begrenzte Cache-Laufzeit.

## Nachweise und Grenzen

Gezielte HTTP-/Service-/UI-Tests sowie PostgreSQL-Tests mit realem Schema, RLS, Cascades, Fehler-Rollback und zweitem Tenant.
Keine produktive Löschung, kein Rollout und keine externen Änderungen im Implementierungsauftrag.
Maximal betroffen: Instanzverwaltung, Auth-/Routing-Anbindung, Datenzugriff und eine Migration, Instanzübersicht/i18n sowie aktuelle Architektur-/Schema-Dokumentation.

## Auswirkungen

- Spezifikation: `instance-provisioning`
- Architektur: Bausteinsicht und Querschnittskonzepte
