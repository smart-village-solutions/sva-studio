# Keycloak-gestuetzter Credential-Self-Service Design

**Datum:** 2026-06-08

## Kontext

Das Studio besitzt bereits einen Self-Service-Profilpfad unter `/account` und reservierte Menueeintraege fuer `Passwort aendern` und `E-Mail aendern` in der Kopfzeile. Die Anwendung nutzt laut ADR-009 ein serverseitiges BFF-Muster mit Keycloak als zentralem Identity Provider. Sicherheitskritische Credential-Operationen sollen deshalb nicht als Studio-Formulare implementiert werden, sondern ueber Keycloak-eigene Self-Service-Flows laufen.

## Ziele

- Passwort- und E-Mail-Aenderungen fuer angemeldete Nutzer im Studio zugaenglich machen.
- Die eigentliche Credential-Mutation in Keycloak belassen.
- Fuer Passwort- und E-Mail-Aenderungen einen tenant- und plattformfaehigen, serverseitig kontrollierten Einstiegspfad im Studio bereitstellen.
- Nach Rueckkehr aus Keycloak einen deterministischen Studio-Status fuer Erfolg oder Abbruch anzeigen.

## Nicht-Ziele

- Kein eigenes Passwortformular im Studio.
- Kein eigenes E-Mail-Aenderungsformular im Studio.
- Keine direkte Browser-Integration gegen Keycloak-Admin-Endpunkte oder Login-Action-URLs.
- Keine Ausweitung auf MFA-, Passkey- oder Credential-Loeschpfade in diesem Schritt.

## Entscheidungsbild

### 1. Hybrid-Self-Service wird konsequent umgesetzt

Profilstammdaten wie Name, Telefon, Position, Abteilung und Sprache bleiben im Studio-Self-Service. Credentials bleiben im IdP. Damit wird die bereits frueher dokumentierte Trennung "Basisdaten im Studio, Sicherheitsdaten ueber Keycloak" technisch vervollstaendigt.

### 2. Das Studio fuehrt nur in einen Keycloak-AIA-Pfad

Das Studio erhaelt einen neuen Auth-Einstiegspfad `/auth/account-action`. Dieser Pfad:

- validiert die angeforderte Aktion (`update-password` oder `update-email`)
- validiert und normalisiert `returnTo`
- baut einen OIDC-Login mit Application Initiated Action (`kc_action`) auf
- erzwingt fuer sensitive Aktionen frische Re-Authentisierung
- bleibt tenant- und plattformscope-faehig, weil er denselben Auth-Config-Resolver wie `/auth/login` nutzt

### 3. Die UI bleibt zunaechst minimal

Die Menueeintraege in der Kopfzeile verlinken direkt auf den serverseitigen Studio-Einstiegspfad fuer Keycloak-AIA. Ein zusaetzlicher Sicherheitsbereich wird im ersten Schritt nicht eingefuehrt. Nach Rueckkehr zeigt die bestehende Account-Seite unter `/account` eine kleine Statusmeldung fuer Erfolg oder Abbruch an.

### 4. Rueckkehrstatus bleibt Studio-owned

Keycloak-AIA nutzt proprietaere Query-Parameter wie `kc_action` und im Abbruchfall `kc_action_status=cancelled`. Fuer einen stabilen UX-Vertrag soll das Studio den Abschluss nicht nur implizit aus Keycloak-Parametern herleiten, sondern den Login-State um eine serverseitig bekannte `accountActionIntent` ergaenzen. Nach erfolgreichem Callback fuegt das BFF einen Studio-eigenen Rueckkehrstatus wie `accountAction=password-updated` oder `accountAction=email-update-finished` an `returnTo` an. Ein Keycloak-Abbruch wird in einen Studio-eigenen Abbruchstatus uebersetzt.

## Architektur

### UI

- Sichtbar aktiviert wird zunaechst nur der Header-Menuepunkt `Passwort aendern`.
- `E-Mail aendern` bleibt vorerst ausgeblendet, bis `UPDATE_EMAIL` auf dem Ziel-Keycloak serverseitig verfuegbar ist.
- Der sichtbare Menueeintrag verlinkt direkt auf `/auth/account-action` mit Aktion und `returnTo=/account`.
- `/account` zeigt nach Rueckkehr optional eine kleine Statusmeldung fuer Passwortaenderung, E-Mail-Aenderung oder Abbruch.

### Auth-Runtime

- Neuer Route-Handler `/auth/account-action`
- Erweiterung des Login-State-Contracts um:
  - `accountActionIntent`
  - gewuenschtes Rueckkehrziel
- Erweiterung des OIDC-Login-URL-Builders um `kc_action`
- Callback mappt den Action-Ausgang in sichere Studio-Query-Parameter fuer `returnTo`

### Keycloak-Vertrag

- Passwortaenderung ueber `kc_action=UPDATE_PASSWORD`
- E-Mail-Aenderung ueber `kc_action=UPDATE_EMAIL`
- Fuer E-Mail-Aenderung wird realmseitig der Keycloak-Required-Action-Workflow `UPDATE_EMAIL` vorausgesetzt
- Wenn `UPDATE_EMAIL` auf dem Ziel-Keycloak serverseitig deaktiviert ist, darf das Studio den Flow nicht blind starten; stattdessen muss `/auth/account-action` kontrolliert mit einem Studio-eigenen Status wie `accountAction=email-update-unavailable` nach `/account` zurueckleiten
- Fuer E-Mail-Verifikation bleibt Keycloak fuehrend

## Sicherheits- und Betriebsentscheidungen

### Fresh Reauth

Credential-bezogene Self-Service-Aktionen gelten als sensitiv. Deshalb startet `/auth/account-action` die OIDC-Anfrage mit expliziter Frisch-Authentisierung. Das bestehende Reauth-Muster des BFF wird wiederverwendet.

### Kein direkter Deep-Link auf interne Keycloak-Seiten

Das Studio springt nicht direkt auf `/login-actions/...` oder andere interne Keycloak-Endpunkte. Der einzige erlaubte Einstieg bleibt der OIDC-Login mit `kc_action`.

### Kein lokales Spiegeln von Passwort- oder Pending-E-Mail-Zustand

Das Studio persistiert keinen lokalen Passwortstatus, keine Pending-E-Mail-Verifikation und keinen eigenen Credential-Wizard. Diese Zustaende bleiben Keycloak-owned.

## Fehler- und Statusmodell

- Unauthentifizierter Aufruf der Account-Seite oder des neuen Action-Links: vorhandener Login-Flow des Studios
- Ungueltige Aktion bei `/auth/account-action`: `400 invalid_request`
- Fehlende Auth-Aufloesung oder Keycloak-Abhaengigkeit: bestehender Auth-Fehlervertrag
- Nutzer bricht den AIA-Flow ab: Rueckkehr nach `/account` mit Studio-Abbruchstatus
- Erfolgreicher AIA-Abschluss: Rueckkehr nach `/account` mit Studio-Erfolgsstatus

## Teststrategie

- Unit-Tests fuer neuen Handler `/auth/account-action`
- Unit-Tests fuer Login-URL-Building mit `kc_action`
- Unit-Tests fuer Callback-Rueckkehrstatus
- Komponenten- oder Seitentests fuer die Rueckkehrmeldung auf `/account`
- Header-Tests fuer aktivierte Menueeintraege
- Betroffene Nx-Unit-Tests fuer `auth-runtime` und `sva-studio-react`

## Betroffene Artefakte

- `packages/auth-runtime/src/auth-route-handlers.ts`
- `packages/auth-runtime/src/auth-server/login.ts`
- moeglicherweise Login-State-/Callback-nahe Dateien im Auth-Runtime-Paket
- `apps/sva-studio-react/src/components/Header.tsx`
- `apps/sva-studio-react/src/routes/account/-account-profile-page.tsx`
- i18n-Ressourcen
- OpenSpec-Specs `account-ui`, `routing`, `iam-core`
