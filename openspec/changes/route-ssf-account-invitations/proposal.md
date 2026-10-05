# Change: SSF-Account-Einladungen zum KasselDIALOG führen

## Why

Keycloak beendet `UPDATE_PASSWORD` für SSF-Einladungen derzeit am Studio-Callback. Der Empfänger soll anschließend die KasselDIALOG-Anmeldung erreichen. Das bestehende Einladungs-Template verwaltet nur den Nachrichtentext; der aktuelle Versand kennt keinen gespeicherten Einladungszweck.

Die belegte Lücke ist die serverseitige Auswahl eines engen Client-/Redirect-Paars je Einladung. Verbraucher sind die vorhandenen Create- und Resend-Pfade sowie die bestehende systemweite Templates-Seite; diese werden erweitert, ohne einen weiteren Versandpfad einzuführen.

## What Changes

- Systemadministratoren können auf `System -> Templates` das Standardziel `Studio` oder `KasselDIALOG` wählen. Ohne Einstellung gilt Studio. Die Auswahl bleibt unabhängig vom Zurücksetzen des Nachrichtentexts.
- Die Nutzeranlage speichert den expliziten Einladungszweck. Für Bestandskonten ohne Wert gilt Studio. Beim Resend wird der gespeicherte Zweck verwendet, auch wenn der systemweite Standard inzwischen geändert wurde.
- SSF-Einladungen verwenden ausschließlich `ssf-frontend` und die installationsseitig konfigurierte HTTPS-URL `<SSF-Origin>/login` im zugeordneten Tenant-Realm. Fehlende oder ungültige SSF-Konfiguration bricht nur die Einladung sichtbar ab.
- Der bestehende SSF-OIDC-Client erlaubt zusätzlich die exakte `/login`-URI; die vorhandenen Login-Callback-URIs bleiben erhalten.
- Keycloak erstellt und versendet weiterhin den signierten, ablaufenden Passwort-Aktionslink.

## Non-Goals

- keine frei eingebbaren Redirect-URLs und keine Erkennung über E-Mail-Adresse oder SSF-Rolle
- kein neuer Maildienst, Token-Generator oder alternativer Keycloak-Flow
- kein automatischer Rückschluss auf den Zweck historischer Konten

## Impact

- Betroffene Specs: `iam-core`, `account-ui`, `instance-provisioning`.
- Betroffene Grenzen: systemweite Vorlageneinstellung, Accountanlage und Persistenz, Resend, SSF-OIDC-Provisionierung, Keycloak-Aktionsmail.
- Betroffene Architektur: `docs/architecture/05-building-block-view.md`, `06-runtime-view.md` und `08-cross-cutting-concepts.md`.
- Datenbank: zwei additive, eng geprüfte Spalten in vorhandenen Tabellen; kein neuer Dienst oder neue Tabelle.

## Invarianten und Nachweise

- Der Einladungszweck wird von einer autorisierten Aktion oder dem serverseitigen Standard bestimmt und pro Konto gespeichert; Rollen und Empfängeradresse beeinflussen ihn nicht. Nachweis: Create-/Resend-Vertragstests.
- Ein SSF-Versand hat genau das konfigurierte HTTPS-Origin, `/login` und `ssf-frontend`; unvollständige Konfiguration versendet keine Mail. Nachweis: Runtime- und OIDC-Tests.
- Studio-Einladungen behalten Client und Instanz-Callback. Nachweis: bestehende und neue Unit-Tests.
- Der tatsächliche Keycloak-Abschluss führt im Testrealm zum gewählten Ziel. Nachweis: Smoke-Test mit echter Aktionsmail vor Abschluss von #1771.
