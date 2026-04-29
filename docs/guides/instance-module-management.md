# Runbook: Instanz-Modulverwaltung

## Zweck

Dieses Runbook beschreibt den operativen Umgang mit der kanonischen Instanz-Modul-Zuordnung in Studio. Es gilt für Studio-Administratoren auf dem Root-Host.

## Grundsätze

- Die Freigabe eines Moduls pro Instanz erfolgt ausschließlich über `iam.instance_modules`.
- Build-time-Plugin-Registrierung, `featureFlags` oder Integrationsdaten aktivieren kein Modul implizit.
- Zuweisung und Entzug arbeiten fail-closed.
- Die IAM-Basis einer Instanz besteht immer aus `Core + zugewiesene Module`.

## Voraussetzungen

- Zugriff auf den Root-Host
- Rolle `instance_registry_admin`
- frische Re-Authentisierung für mutierende Aktionen

## Module zuweisen

1. `Module` im Studio-Root öffnen.
2. Zielinstanz auswählen.
3. Modul in `Verfügbare Module` auswählen.
4. `Zuweisen` auslösen.

Erwartetes Ergebnis:

- die Instanz erhält den Eintrag in `iam.instance_modules`
- die modulbezogenen Permissions, Systemrollen und `role_permissions` werden idempotent aufgebaut
- die Detailansicht zeigt das Modul unter `zugewiesene Module`

## Module entziehen

1. `Module` im Studio-Root öffnen.
2. Zielinstanz auswählen.
3. Im zugewiesenen Modul `Entziehen` auslösen.
4. die Bestätigung `REVOKE` explizit abschließen.

Erwartetes Ergebnis:

- der Eintrag in `iam.instance_modules` wird entfernt
- modulbezogene Permissions und `role_permissions` werden hart entfernt
- Core-Berechtigungen der Instanz bleiben unverändert

## IAM-Basis reparieren

Wenn die Detailansicht im Instanz-Cockpit oder im Modulbereich einen degradierten Modul-IAM-Befund zeigt:

1. Instanzdetail unter `/admin/instances/$instanceId` öffnen.
2. im Bereich `IAM-Basis zugewiesener Module` die Aktion `IAM-Basis neu aufbauen` ausführen.

Erwartetes Ergebnis:

- Studio rekonstruiert ausschließlich `Core + zugewiesene Module`
- es werden keine zusätzlichen User-Role-Assignments für den ausführenden Admin erzeugt

## Bestandsinstanzen

- Bestandsinstanzen starten bewusst mit leerem Modulsatz.
- Ohne explizite Zuweisung bleiben Plugin-Routen und Plugin-Navigation fail-closed blockiert.
- Für die Erstbefüllung ist jede benötigte Modulfreigabe explizit zuzuweisen.

## Diagnose

- `/admin/instances/$instanceId` zeigt `IAM-Basis zugewiesener Module` als eigene Betriebsachse.
- `/auth/me` liefert für Instanz-Sessions die kanonische Liste `assignedModules`.
- Plugin-Routen prüfen diese Liste clientseitig fail-closed vor dem Rendern.

## Störungen

- `unknown_module`: Das Modul ist nicht in der serverseitigen Modul-IAM-Registry bekannt.
- `not_found`: Die Instanz existiert nicht mehr oder ist auf dem Root-Host nicht verfügbar.
- degradiertes Modul-IAM bei erfolgreicher Zuweisung: `IAM-Basis neu aufbauen` ausführen und Audit-/Server-Logs mit `requestId` korrelieren.
- Plugin-Navigation fehlt trotz erwarteter Berechtigung: zuerst `assignedModules` und dann die effektiven `permissionActions` der Session prüfen.
