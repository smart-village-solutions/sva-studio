# Runbook: Instanz-Modulverwaltung

## Zweck

Dieses Runbook beschreibt den operativen Umgang mit der kanonischen Instanz-Modul-Zuordnung in Studio. Es gilt für Studio-Administratoren auf dem Root-Host.

## Grundsätze

- Die Freigabe eines Moduls pro Instanz erfolgt ausschließlich über `iam.instance_modules`.
- Build-time-Plugin-Registrierung, `featureFlags` oder Integrationsdaten aktivieren kein Modul implizit.
- Zuweisung und Entzug arbeiten fail-closed.
- Die IAM-Basis einer Instanz besteht immer aus `Core + zugewiesene Module`.
- Die Modulübersicht zeigt den offiziellen Namen und die Kurzbeschreibung aus
  der `publiccode.yml` des jeweiligen Moduls. Die technische Modul-ID bleibt
  für IAM und Diagnose erhalten.

## Voraussetzungen

- Zugriff auf den Root-Host
- Rolle `instance_registry_admin`
- frische Re-Authentisierung für mutierende Aktionen

Tenant-Nutzer sehen den Menüpunkt `Module` und dürfen `/modules` direkt öffnen, wenn ihre effektiven Berechtigungen `modules.read` enthalten. Ohne diese Permission bleiben Navigation und Route fail-closed gesperrt. Technische Plattform-Admins mit `instance_registry_admin` behalten unabhängig davon Zugriff auf die Root-Verwaltung.

## Module zuweisen

1. `Module` im Studio-Root öffnen.
2. Zielinstanz auswählen.
3. Modul in `Verfügbare Module` auswählen.
4. `Zuweisen` auslösen.

Alternativ:

1. Instanzdetail unter `/admin/instances/$instanceId` öffnen.
2. Tab `Betrieb` wählen.
3. Das gewünschte Modul im Bereich `Verfügbare Module` zuweisen.

Erwartetes Ergebnis:

- die Instanz erhält den Eintrag in `iam.instance_modules`
- die modulbezogenen Permissions, Systemrollen und `role_permissions` werden idempotent aufgebaut
- die Detailansicht zeigt das Modul unter `zugewiesene Module`

## ivCampus-Pilot in der Studio-Sandbox

Das optionale Modul `ivcampus` wird der Staging-Instanz `de-studio-sandbox`
zugewiesen. In der Mandantenansicht unter **Module → ivCampus → Einstellungen**
können berechtigte Administratoren die Widget-URL für die Einreichung kopieren.

Vor der Einreichung wird im [versionierten Staging-Profil](../../config/runtime/remote/staging.vars)
unter `SVA_IVCAMPUS_PILOT_ORIGIN` die konkrete HTTPS-Origin des einbettenden Campus
hinterlegt, beispielsweise `https://campus.example`. Raum-URLs mit Pfad sind
dafür ungeeignet. Die öffentliche Widget-Route liefert nur auf dem
Staging-Sandbox-Host und bei zugewiesenem Modul ein Dokument aus. Sie enthält
ausschließlich die Links zum Anlegen von Meldungen und Veranstaltungen. Die
Studio-Anmeldung und Berechtigungsprüfung finden im jeweils geöffneten Tab statt.

Für die manuelle [Einreichung bei ivCampus](https://github.com/ivicos-GmbH/widget-sdk#dein-widget-einreichen)
verwendet ein Manager oder Owner die Widget-ID
`sva-studio-sandbox-app-redaktion`, den Namen **App-Redaktion**, Version `0.0.1`
und die Platzierung **Raum**. Als Icon kann das bestehende Studio-Favicon unter
`/favicon.ico` auf der Sandbox-Origin dienen. Die beiden Ziele liegen auf
derselben Origin wie die Widget-URL.

Nach der ivCampus-Freigabe wird im Test-Teamraum geprüft, ob beide Aktionen per
Maus und Tastatur bedienbar sind, sich im neuen Tab öffnen und mit einem
Redaktionskonto zum korrekten Formular führen. Zusätzlich wird geprüft, ob sich
der Einstieg bei abgelaufener Studio-Sitzung nach der Anmeldung fortsetzen
lässt. Wird das Modul entzogen oder die Staging-Origin entfernt, antwortet die
Widget-Route mit HTTP 404.

## Module entziehen

1. `Module` im Studio-Root öffnen.
2. Zielinstanz auswählen.
3. Im zugewiesenen Modul `Entziehen` auslösen.
4. die Bestätigung `REVOKE` explizit abschließen.

Alternativ kann derselbe Entzug direkt im Tab `Betrieb` der Instanz-Detailseite ausgelöst werden.

Erwartetes Ergebnis:

- der Eintrag in `iam.instance_modules` wird entfernt
- modulverwaltete `role_permissions` werden entfernt; historische Permission-Definitionen
  und manuell angelegte Grants können für Audit und Datenintegrität erhalten bleiben,
  sind bei deaktiviertem oder entzogenem Modul aber weder neu zuweisbar noch wirksam
- Core-Berechtigungen der Instanz bleiben unverändert

## IAM-Basis reparieren

Wenn die Detailansicht im Instanz-Cockpit oder im Modulbereich einen degradierten Modul-IAM-Befund zeigt:

1. Instanzdetail unter `/admin/instances/$instanceId` öffnen.
2. im Tab `Betrieb` die Aktion `IAM-Basis neu aufbauen` ausführen.

Erwartetes Ergebnis:

- Studio rekonstruiert ausschließlich `Core + zugewiesene Module`
- es werden keine zusätzlichen User-Role-Assignments für den ausführenden Admin erzeugt

## Bestandsinstanzen

- Bestandsinstanzen starten bewusst mit leerem Modulsatz.
- Ohne explizite Zuweisung bleiben Plugin-Routen und Plugin-Navigation fail-closed blockiert.
- Für die Erstbefüllung ist jede benötigte Modulfreigabe explizit zuzuweisen.

## Diagnose

- `/admin/instances/$instanceId` zeigt `IAM-Basis zugewiesener Module` als eigene Betriebsachse.
- Der Tab `Betrieb` in `/admin/instances/$instanceId` bietet denselben instanzgebundenen Root-Admin-Arbeitsbereich wie `/admin/modules`, aber ohne zusätzliche Instanzauswahl.
- `/auth/me` liefert für Instanz-Sessions die kanonische Liste `assignedModules`.
- Plugin-Routen prüfen diese Liste clientseitig fail-closed vor dem Rendern.

## Störungen

- `unknown_module`: Das Modul ist nicht in der serverseitigen Modul-IAM-Registry bekannt.
- `not_found`: Die Instanz existiert nicht mehr oder ist auf dem Root-Host nicht verfügbar.
- degradiertes Modul-IAM bei erfolgreicher Zuweisung: `IAM-Basis neu aufbauen` ausführen und Audit-/Server-Logs mit `requestId` korrelieren.
- Plugin-Navigation fehlt trotz erwarteter Berechtigung: zuerst `assignedModules` und dann die effektiven `permissionActions` der Session prüfen.
