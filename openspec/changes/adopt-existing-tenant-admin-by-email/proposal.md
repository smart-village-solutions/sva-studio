# Bestehenden Tenant-Admin mit passender E-Mail übernehmen

## Problem

Die read-only Draft-Readiness für die 50 vorhandenen Kunden-Realms ist bei
allen Tenants ausschließlich wegen des bereits existierenden, nicht Studio-
markierten Benutzers `admin@smart-village.app` blockiert. Die Studio-Clients
fehlen dagegen und werden vom vorhandenen Provisioning-Plan als automatisch
anzulegen ausgewiesen.

Die bestehende Ownership-Sperre schützt fremde Accounts vor unbeabsichtigter
Profil- oder Rollenänderung. Für diese Einrichtung hat der Operator die
Wiederverwendung des bestehenden Benutzers ausdrücklich freigegeben, sofern
seine E-Mail-Adresse übereinstimmt.

## Änderung

- Der bestehende Studio-MCP-Provisionierungspfad erhält eine explizite,
  instanzgebundene Freigabe zur Übernahme eines vorhandenen Tenant-Admins.
- Die Übernahme wird ausschließlich über die normalisierte, realmweit eindeutige
  E-Mail-Adresse aufgelöst. Der vorhandene Benutzername bleibt erhalten; der
  aktuelle Plan bindet die Freigabe an die stabile Keycloak-User-ID.
- Studio markiert den Account für genau diese Instanz als verwaltet und weist
  ausschließlich die tenantlokale Rolle `system_admin` zu. Passwort,
  Aktivierungsstatus sowie fremde Attribute und Rollen bleiben erhalten.
- Bei Abweichungen, Mehrdeutigkeit oder geändertem Benutzerzustand bleibt der
  Tenant blockiert. Andere unmarkierte Clients, Rollen und Realm-Einstellungen
  werden nicht übernommen.
- Fehlende Studio-Login- und Tenant-Admin-Clients bleiben normale fehlende
  Artefakte und werden über den bestehenden Plan angelegt.
- Die 50 Tenants erhalten `news`, `events`, `poi`, `media` und `categories`.
  Andere optionale Module werden nicht zugewiesen. Die Aktivierung bleibt ein
  separater manueller Schritt.

## Nicht-Ziele

- Allgemeine Übernahme fremder Keycloak-Clients, Rollen oder Benutzer.
- Änderung der Realm-Baseline, SMTP-Werte oder bestehender Passwörter.
- Setzen eines gemeinsamen temporären Passworts oder Ablage von Passwörtern
  in der CSV.
- Automatische Aktivierung der Tenants.

## Review-Grenze

Die Implementierung ändert ausschließlich den bestehenden Draft-Readiness-,
Plan- und Tenant-Admin-Provisionierungspfad sowie den dafür nötigen MCP-
Vertrag und dessen Tests/Dokumentation. Sie berührt weder den generischen
Keycloak-Ownership-Schutz für andere Artefakte noch die fachliche
Tenant-Aktivierung.
