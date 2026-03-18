## Kontext

Die Benutzerverwaltung bearbeitet derzeit Basisdaten, Rollen und Status eines Benutzers, aber keine Mainserver-Credentials aus Keycloak. Parallel ist die Mainserver-Laufzeit auf die Attribute `sva_mainserver_api_key` und `sva_mainserver_api_secret` festgelegt, während in der realen Keycloak-Belegung die Felder `mainserverUserApplicationId` und `mainserverUserApplicationSecret` verwendet werden.

Die Erweiterung berührt damit:
- Admin-UI und API-Verträge
- Keycloak-Read-/Write-Pfade
- die serverseitige Mainserver-Delegation
- Security-/Logging-Vorgaben für Secret-Felder

## Entscheidungen

### 1. Kanonische Attributnamen

Kanonisch werden künftig folgende Keycloak-Attribute verwendet:
- `mainserverUserApplicationId`
- `mainserverUserApplicationSecret`

Der serverseitige Reader akzeptiert zusätzlich die bisherigen Legacy-Namen:
- `sva_mainserver_api_key`
- `sva_mainserver_api_secret`

Damit bleibt Bestandskonfiguration lauffähig, während UI und Doku auf die tatsächlichen Attributnamen ausgerichtet werden.

### 2. Secret-Handling im Admin-Flow

`mainserverUserApplicationSecret` wird nicht als Klartext an den Browser zurückgegeben.

Der Detail-Read liefert nur:
- ob ein Secret gesetzt ist
- optional einen neutralen Status für die UI

Der Update-Write erlaubt:
- `undefined`: Secret unverändert lassen
- nicht-leerer String: Secret überschreiben

Ein explizites Leeren des Secrets ist in dieser Änderung nicht vorgesehen, um versehentliche Ausfälle zu vermeiden.

### 3. UI-Platzierung

Die Felder werden in der Benutzer-Bearbeitung auf dem Verwaltungs-Tab ergänzt, weil sie fachlich zur administrativen Downstream-Integration gehören und nicht zu allgemeinen Profildaten.

### 4. Logging und Tests

Secret-Werte dürfen weder in Logs noch in API-Responses oder Activity-Log-Payloads landen. Tests müssen absichern:
- Klartext-Secret wird nicht zurückgegeben
- Reader-Fallback auf Legacy-Attribute funktioniert
- Update-Flow schreibt die neuen Attribute korrekt nach Keycloak

## Offene Punkte

- Ob künftig ein expliziter „Credential löschen“-Flow benötigt wird, bleibt außerhalb dieses Scopes.
- Ob `mainserverUserApplicationId` im UI voll sichtbar oder teilweise maskiert dargestellt wird, kann in der Umsetzung anhand der Admin-Anforderungen finalisiert werden; Default ist sichtbarer Wert, da nur das Secret als write-only behandelt wird.
