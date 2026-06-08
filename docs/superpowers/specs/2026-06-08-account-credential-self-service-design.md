# Keycloak-gestützter Credential-Self-Service Design

**Datum:** 2026-06-08

## Kontext

Das Studio besitzt bereits einen Self-Service-Profilpfad unter `/account` und reservierte Menüeinträge für `Passwort ändern` und `E-Mail ändern` in der Kopfzeile. Die Anwendung nutzt laut ADR-009 ein serverseitiges BFF-Muster mit Keycloak als zentralem Identity Provider. Sicherheitskritische Credential-Operationen sollen deshalb nicht als Studio-Formulare implementiert werden, sondern über Keycloak-eigene Self-Service-Flows laufen.

## Ziele

- Passwort- und E-Mail-Änderungen für angemeldete Nutzer im Studio zugänglich machen.
- Die eigentliche Credential-Mutation in Keycloak belassen.
- Für Passwort- und E-Mail-Änderungen einen tenant- und plattformfähigen, serverseitig kontrollierten Einstiegspfad im Studio bereitstellen.
- Nach Rückkehr aus Keycloak einen deterministischen Studio-Status für Erfolg oder Abbruch anzeigen.

## Nicht-Ziele

- Kein eigenes Passwortformular im Studio.
- Kein eigenes E-Mail-Änderungsformular im Studio.
- Keine direkte Browser-Integration gegen Keycloak-Admin-Endpunkte oder Login-Action-URLs.
- Keine Ausweitung auf MFA-, Passkey- oder Credential-Löschpfade in diesem Schritt.

## Entscheidungsbild

### 1. Hybrid-Self-Service wird konsequent umgesetzt

Profilstammdaten wie Name, Telefon, Position, Abteilung und Sprache bleiben im Studio-Self-Service. Credentials bleiben im IdP. Damit wird die bereits früher dokumentierte Trennung "Basisdaten im Studio, Sicherheitsdaten über Keycloak" technisch vervollständigt.

### 2. Das Studio führt nur in einen Keycloak-AIA-Pfad

Das Studio erhält einen neuen Auth-Einstiegspfad `/auth/account-action`. Dieser Pfad:

- validiert die angeforderte Aktion (`update-password` oder `update-email`)
- validiert und normalisiert `returnTo`
- baut einen OIDC-Login mit Application Initiated Action (`kc_action`) auf
- erzwingt für sensitive Aktionen frische Re-Authentisierung
- bleibt tenant- und plattformscope-fähig, weil er denselben Auth-Config-Resolver wie `/auth/login` nutzt

### 3. Die UI bleibt zunächst minimal

Die Menüeinträge in der Kopfzeile verlinken direkt auf den serverseitigen Studio-Einstiegspfad für Keycloak-AIA. Ein zusätzlicher Sicherheitsbereich wird im ersten Schritt nicht eingeführt. Nach Rückkehr zeigt die bestehende Account-Seite unter `/account` eine kleine Statusmeldung für Erfolg oder Abbruch an.

### 4. Rückkehrstatus bleibt Studio-owned

Keycloak-AIA nutzt proprietäre Query-Parameter wie `kc_action` und im Abbruchfall `kc_action_status=cancelled`. Für einen stabilen UX-Vertrag soll das Studio den Abschluss nicht nur implizit aus Keycloak-Parametern herleiten, sondern den Login-State um eine serverseitig bekannte `accountActionIntent` ergänzen. Nach erfolgreichem Callback fügt das BFF einen Studio-eigenen Rückkehrstatus wie `accountAction=password-updated` oder `accountAction=email-update-finished` an `returnTo` an. Ein Keycloak-Abbruch wird in einen Studio-eigenen Abbruchstatus übersetzt.

## Architektur

### UI

- Sichtbar aktiviert wird zunächst nur der Header-Menüpunkt `Passwort ändern`.
- `E-Mail ändern` bleibt vorerst ausgeblendet, bis `UPDATE_EMAIL` auf dem Ziel-Keycloak serverseitig verfügbar ist.
- Der sichtbare Menüeintrag verlinkt direkt auf `/auth/account-action` mit Aktion und `returnTo=/account`.
- `/account` zeigt nach Rückkehr optional eine kleine Statusmeldung für Passwortänderung, E-Mail-Änderung oder Abbruch.

### Auth-Runtime

- Neuer Route-Handler `/auth/account-action`
- Erweiterung des Login-State-Contracts um:
  - `accountActionIntent`
  - gewünschtes Rückkehrziel
- Erweiterung des OIDC-Login-URL-Builders um `kc_action`
- Callback mappt den Action-Ausgang in sichere Studio-Query-Parameter für `returnTo`

### Keycloak-Vertrag

- Passwortänderung über `kc_action=UPDATE_PASSWORD`
- E-Mail-Änderung über `kc_action=UPDATE_EMAIL`
- Für E-Mail-Änderung wird realmseitig der Keycloak-Required-Action-Workflow `UPDATE_EMAIL` vorausgesetzt
- Wenn `UPDATE_EMAIL` auf dem Ziel-Keycloak serverseitig deaktiviert ist, darf das Studio den Flow nicht blind starten; stattdessen muss `/auth/account-action` kontrolliert mit einem Studio-eigenen Status wie `accountAction=email-update-unavailable` nach `/account` zurückleiten
- Für E-Mail-Verifikation bleibt Keycloak führend

## Sicherheits- und Betriebsentscheidungen

### Fresh Reauth

Credential-bezogene Self-Service-Aktionen gelten als sensitiv. Deshalb startet `/auth/account-action` die OIDC-Anfrage mit expliziter Frisch-Authentisierung. Das bestehende Reauth-Muster des BFF wird wiederverwendet.

### Kein direkter Deep-Link auf interne Keycloak-Seiten

Das Studio springt nicht direkt auf `/login-actions/...` oder andere interne Keycloak-Endpunkte. Der einzige erlaubte Einstieg bleibt der OIDC-Login mit `kc_action`.

### Kein lokales Spiegeln von Passwort- oder Pending-E-Mail-Zustand

Das Studio persistiert keinen lokalen Passwortstatus, keine Pending-E-Mail-Verifikation und keinen eigenen Credential-Wizard. Diese Zustände bleiben Keycloak-owned.

## Fehler- und Statusmodell

- Unauthentifizierter Aufruf der Account-Seite oder des neuen Action-Links: vorhandener Login-Flow des Studios
- Ungültige Aktion bei `/auth/account-action`: `400 invalid_request`
- Fehlende Auth-Auflösung oder Keycloak-Abhängigkeit: bestehender Auth-Fehlervertrag
- Nutzer bricht den AIA-Flow ab: Rückkehr nach `/account` mit Studio-Abbruchstatus
- Erfolgreicher AIA-Abschluss: Rückkehr nach `/account` mit Studio-Erfolgsstatus

## Teststrategie

- Unit-Tests für neuen Handler `/auth/account-action`
- Unit-Tests für Login-URL-Building mit `kc_action`
- Unit-Tests für Callback-Rückkehrstatus
- Komponenten- oder Seitentests für die Rückkehrmeldung auf `/account`
- Header-Tests für aktivierte Menüeinträge
- Betroffene Nx-Unit-Tests für `auth-runtime` und `sva-studio-react`

## Betroffene Artefakte

- `packages/auth-runtime/src/auth-route-handlers.ts`
- `packages/auth-runtime/src/auth-server/login.ts`
- möglicherweise Login-State-/Callback-nahe Dateien im Auth-Runtime-Paket
- `apps/sva-studio-react/src/components/Header.tsx`
- `apps/sva-studio-react/src/routes/account/-account-profile-page.tsx`
- i18n-Ressourcen
- OpenSpec-Specs `account-ui`, `routing`, `iam-core`
