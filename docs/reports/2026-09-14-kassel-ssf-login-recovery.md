# Kassel: Wiederherstellung der SSF-Organisationsauswahl

Stand: 14. September 2026, nach erfolgreichem Abgleich um 07:18 UTC.

## Umfang und Freigabe

Eigenständiger Testserver `136.243.39.147`, Tenant `tenant-kassel`, Keycloak-Realm
`smartcity`. Der Benutzer hat die zusammenhängende Reparatur freigegeben, die
frühere Stop-Regel aufgehoben und auf ein Backup verzichtet. Keine Tenants oder
Realms gelöscht, keine Passwörter zurückgesetzt und keine zusätzlichen lokalen
Administratorrollen vergeben.

## Ursachen und Eingriffe

1. Der separaten Plugin-Datenbank `sva_studio_ssf` fehlte Migration
   `0006_ssf_authorization_subject_evidence.sql`. Ausführung mit dem
   versionsgebundenen Goose-Runner und den Migrationen des laufenden Images;
   Ledger anschließend auf Version 6. Die NOINHERIT-Login-Rolle aktiviert ihre
   Funktionsrolle über die Verbindungsoption; der echte Studio-`pg`-Treiber
   bestätigte den erforderlichen Lesezugriff.
2. Die lokalen Kasseler IAM-Konten waren `pending`. Der Benutzer speicherte
   drei Konten als aktiv, darunter beide bestehenden Administratoren im
   Realm `smartcity`. Das historische Konto im Realm `sva-studio` blieb unberührt.
3. Der manuell aus der Root-Sitzung gestartete SSF-Abgleich erreichte Keycloak,
   scheiterte aber mit `target_readback_mismatch`: Zwei gewünschte Subjects,
   jedoch keine gespeicherten Benutzerattribute im Realm. Das über die Admin-API
   gelesene Benutzerprofil enthielt nur die vier Standardfelder; die
   SSF-Attribute waren nicht deklariert.
4. Über `kcadm.sh` wurden ausschließlich `studio_tenant_id`, `ssf_roles`,
   `ssf_permissions` und `ssf_authorization_revision` ergänzt. Rollen und
   Berechtigungen sind mehrwertig, alle vier Felder nur für `admin` lesbar und
   schreibbar. Read-back bestätigte die Definitionen und den Erhalt sämtlicher
   vorheriger Profilfelder und sonstiger Profileinstellungen.

## Live-Nachweise

- Der erste Job `b32e15d0-be72-4884-aa7c-1de0c61e1fdc` wurde nach fünf Versuchen
  mit dem genannten Read-back-Fehler beendet.
- Der nächste SSF-Reconcile-Job wurde um 07:18:21 UTC angelegt und um
  07:18:25 UTC erfolgreich abgeschlossen.
- Plugin-Lifecycle: `ready`, gewünschte und abgeschlossene Generation jeweils 25.
- Autorisierungsprojektion: Generation 2, `ready`, identische Soll-/Ist-Revision,
  zwei bestätigte Subjects, `confirmed_has_subjects = true`, kein Fehlercode.
- Die öffentliche API `https://ssf.smart-village.solutions/api/login/tenants`
  antwortete mit HTTP 200 und genau dem Eintrag `tenant-kassel`, Anzeigename
  „Smart City Kassel“, Realm `smartcity`. Für die Frontend-Origin
  `https://dialog.kassel.de` war der passende CORS-Header vorhanden.
- `https://dialog.kassel.de/login` antwortete mit HTTP 200. Der gleichnamige
  API-Pfad auf diesem Frontend-Host lieferte HTML; er ist kein Nachweis für
  den Zustand des SSF-Directorys.

## Browser-Abnahme und verbleibender Nachweis

Der Benutzer bestätigte anschließend den echten Browser-Login. Nach Auswahl von
„Smart City Kassel“ landete er erfolgreich auf
`https://dialog.kassel.de/login/tenant-kassel`. Damit ist der Kasseler Loginpfad
einschließlich Organisationsauswahl abgenommen. Havelland und SVS gehören nicht
zum aktuellen Abnahmeumfang; ein neu angelegter Tenant bleibt als Nachweis der
dauerhaften Provisioning-Korrektur offen.

Die lokale Folgereparatur aktiviert ausschließlich neu angelegte, explizite
Bootstrap-Administratoren und deklariert die SSF-Benutzerprofilattribute vor
der Projektion. Sie ist noch nicht ausgerollt. Die operative Reparatur des
Kasseler Profils bleibt deshalb bis zum Nachweis mit einem neu angelegten Tenant
ein separater Live-Eingriff.

Siehe [Betriebshinweise](../operations/ssf-standalone-hosts.md#keycloak-benutzerprofil-für-die-ssf-projektion).
