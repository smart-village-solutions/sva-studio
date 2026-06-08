## Kontext

Das aktuelle Studio erlaubt auf `/account` die Pflege von Profilstammdaten, waehrend die Kopfzeile bereits deaktivierte Menueeintraege fuer `Passwort aendern` und `E-Mail aendern` enthaelt. Gleichzeitig folgt die Auth-Architektur einem serverseitigen BFF-Muster mit Keycloak als zentralem Identity Provider. Daraus ergibt sich eine klare Grenze: Credential-Aenderungen gehoeren nicht in lokale React-Formulare, sondern in Keycloak-gesteuerte Self-Service-Flows.

## Ziele / Nicht-Ziele

- Ziele:
  - Nutzer koennen Passwort- und E-Mail-Aenderung aus dem Studio heraus starten.
  - Das Studio bleibt Einstiegspunkt, Keycloak bleibt Mutationsort.
  - Rueckkehr nach dem Self-Service-Flow ist fuer Nutzer nachvollziehbar.
  - Die Loesung bleibt tenant- und plattformfaehig.
- Nicht-Ziele:
  - kein eigenes Passwort-Reset- oder E-Mail-Formular im Studio
  - keine MFA-, Passkey- oder Credential-Delete-Erweiterung in diesem Change
  - keine direkte Browser-Navigation auf interne Keycloak-Login-Action-Endpunkte

## Entscheidungen

### Entscheidung 1: Direktabsprung aus dem Menue fuer den ersten Schritt

Die Menueeintraege in der Kopfzeile fuehren direkt auf den serverseitigen Pfad `/auth/account-action`. Ein zusaetzlicher Sicherheitsbereich wird im ersten Schritt nicht eingefuehrt. Damit bleibt der Scope klein, waehrend Passwort- und E-Mail-Aenderung trotzdem sicher ueber das BFF in Keycloak-AIA starten.

### Entscheidung 2: Serverseitiger AIA-Einstiegspfad

Das Auth-Runtime-Paket erhaelt einen neuen Handler `/auth/account-action`. Der Handler validiert:

- die angeforderte Aktion
- den Rueckkehrpfad
- den Auth-Scope

Anschliessend startet er eine OIDC-Anfrage mit `kc_action`. Fuer Passwort wird `UPDATE_PASSWORD`, fuer E-Mail `UPDATE_EMAIL` verwendet.

### Entscheidung 3: Sensitive Self-Service-Aktionen erzwingen frische Re-Authentisierung

Credential-bezogene AIA werden immer mit frischer Re-Authentisierung gestartet. Damit folgt der Flow dem bereits vorhandenen Forced-Reauth-Muster der Auth-Runtime und vermeidet, dass eine alte SSO-Session ausreicht, um hochsensible Kontoaenderungen anzustossen.

### Entscheidung 4: Rueckkehrstatus wird Studio-owned

Keycloak liefert fuer AIA keinen fuer alle Faelle gleich ergonomischen Studio-UX-Vertrag. Deshalb merkt sich das Studio im Login-State die angestossene Kontoaktion. Nach erfolgreichem Callback fuegt der BFF einen Studio-eigenen Statusparamater an `returnTo` an. Abbruchfaelle werden ebenfalls in einen Studio-status uebersetzt. Die UI ist damit nicht direkt von Keycloak-spezifischen Query-Details abhaengig.

## Alternativen

### Alternative A: Direktlink in die Keycloak Account Console

- Vorteil: technisch simpel
- Nachteil: inkonsistent zum BFF, schlechtere Rueckkehrsteuerung, kein sauberer Studio-Statusvertrag, schwerer tenant-/root-scope-konsistent
- Entscheidung: verworfen

### Alternative B: Eigene Studio-Formulare fuer Passwort und E-Mail

- Vorteil: volle UX-Kontrolle
- Nachteil: falsche Verantwortungsgrenze, hohes Sicherheits- und Integrationsrisiko, E-Mail-Verifikation und Reauth muessten teilrepliziert werden
- Entscheidung: verworfen

### Alternative C: Studio-Startpunkt plus Keycloak-AIA

- Vorteil: sicher, standardnah, mit vorhandener Auth-Runtime konsistent, tenantfaehig
- Nachteil: zusaetzlicher Auth-Handler und Rueckkehrvertrag noetig
- Entscheidung: angenommen

## Risiken / Trade-offs

- Keycloak-Feature `UPDATE_EMAIL` und dessen Realm-Konfiguration muessen in Zielumgebungen aktiviert sein.
- Die Rueckkehr-UX haengt davon ab, dass Callback und Login-State sauber erweitert werden.
- Plattform- und Tenant-Hosts muessen denselben neuen Auth-Pfad korrekt aufloesen.

## Migrationsplan

1. OpenSpec- und Plan-Artefakte anlegen.
2. Auth-Runtime um AIA-Einstieg und Rueckkehrstatus erweitern.
3. Header-Menueeintraege aktivieren und Rueckkehrstatus auf `/account` anzeigen.
4. Tests und Architekturdoku aktualisieren.

## Open Questions

- Keine offenen Architekturfragen fuer diesen Change. Die Realm-seitige Aktivierung von `UPDATE_EMAIL` bleibt ein Betriebs- und Konfigurationsvoraussetzungsthema, kein Architektur-Blocker.
