# Instanzverwaltung als Keycloak-Control-Plane

## Ziel

Dieses Dokument beschreibt den kanonischen Betriebs- und Bedienpfad für tenant-spezifisches Keycloak-Provisioning über die Root-Host-Instanzverwaltung unter `/admin/instances`.

Die Instanzverwaltung ist die führende Control Plane für:

- Registry-Metadaten der Instanz
- Realm-Modus `new` oder `existing`
- tenant-spezifisches Login-Client-Secret oder dessen automatische Erzeugung bei `new`
- Tenant-Admin-Bootstrap
- Preflight, Plan, Ausführung und Protokoll des Keycloak-Abgleichs

Die Detaildokumente zu Realm-Vertrag und Service-Account bleiben bestehen, sind aber nur noch Referenzdokumente:

- [Keycloak-Tenant-Realm-Bootstrap für Studio](./keycloak-tenant-realm-bootstrap.md)
- [Keycloak Service-Account Setup für IAM-User- und Rollen-Management](./keycloak-service-account-setup-iam.md)

## Führende Quellen

- Registry ist führend für `authRealm`, `authClientId`, optional `authIssuerUrl`, `realmMode`, Tenant-Secret-Status und Tenant-Admin-Stammdaten.
- Keycloak ist führend für den tatsächlich angewendeten Realm-, Client- und User-Zustand.
- Temporäre Passwörter bleiben write-only und werden nicht persistiert.

Wichtig:

- `Instanzdaten speichern` schreibt nur Registry-Daten.
- `Provisioning ausführen` gleicht Keycloak gegen den gespeicherten Sollzustand ab.
- Bei `existing` bedeutet ein leeres Secret-Feld weiterhin "bestehenden Wert unverändert lassen".
- Bei `new` wird kein Secret als Benutzereingabe erwartet; es entsteht erst beim Provisioning und wird danach in die Registry zurückgeschrieben.

## Verbindliche Soll-/Ist-Checkliste

Die Instanzverwaltung und der Provisioning-Worker verwenden für den fachlichen Mindestzustand dieselbe kompakte Checkliste. Jeder login-blockierende Punkt muss im Detailstatus und nach dem letzten erfolgreichen Run grün sein; ausdrücklich nicht blockierende Interop-Punkte dürfen als Warnung bestehen bleiben.

| Pflichtpunkt                         | Führende Quelle in Studio/Registry              | Zielartefakt in Keycloak                      | Prüfkriterium                                                                                                                                              | Automatische Aktion beziehungsweise Fallback                                         |
| ------------------------------------ | ----------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Realm                                | `realmMode`, `authRealm`                        | Realm `<authRealm>`                           | Realm existiert oder darf im Modus `new` erstellt werden                                                                                                   | Realm anlegen oder Bestands-Realm validieren                                         |
| OIDC-Client                          | `authClientId`                                  | Client `<authClientId>`                       | Client existiert                                                                                                                                           | Client anlegen oder aktualisieren                                                    |
| Tenant-Admin-Client                  | `tenantAdminClient.clientId`                    | Client `<tenantAdminClient.clientId>`         | Technischer Client existiert und ist auf tenantlokale Administration begrenzt                                                                              | Client anlegen oder aktualisieren und Service-Account-Rechte abgleichen              |
| Redirect-URIs                        | `instanceId`, `parentDomain`, `primaryHostname` | `client.redirectUris`                         | Redirect-Ziele stimmen exakt                                                                                                                               | Client-URLs abgleichen                                                               |
| Logout-URIs                          | `instanceId`, `parentDomain`, `primaryHostname` | `client.attributes.post.logout.redirect.uris` | Logout-Ziele stimmen exakt                                                                                                                                 | Client-URLs abgleichen                                                               |
| Web-Origins                          | `instanceId`, `parentDomain`, `primaryHostname` | `client.webOrigins`                           | Origins stimmen exakt                                                                                                                                      | Client-URLs abgleichen                                                               |
| Plugin-OIDC-Clients                  | OIDC-Verträge der zugewiesenen Plugins          | Plugin-Clients und Audience-Mapper            | Alle für aktive Module deklarierten Clients und Mapper stimmen mit ihren Verträgen überein                                                                 | Vertragsgebunden anlegen oder aktualisieren; ohne aktiven Vertrag nichts kopieren    |
| Tenant-Secret                        | `authClientSecret`                              | Client-Secret des Login-Clients               | `existing`: Registry-Secret und Keycloak-Secret sind identisch. `new`: Secret wird beim Provisioning erzeugt und danach in die Registry zurückgeschrieben. | Secret setzen, erzeugen, rotieren und Rückschreiben in die Registry                  |
| Tenant-Admin-Client-Secret           | `tenantAdminClient.secretConfigured`            | Client-Secret des Tenant-Admin-Clients        | Registry-Secret und Keycloak-Secret sind identisch                                                                                                         | Secret erzeugen oder abgleichen und ausschließlich verschlüsselt speichern           |
| Tenant-Admin                         | `tenantAdminBootstrap.*`                        | User `<username>`                             | User existiert und ist aktiviert                                                                                                                           | User anlegen oder aktualisieren                                                      |
| Rolle `system_admin`                 | `instanceId`, `tenantAdminBootstrap.username`   | Realm-Rolle und Rollenzuweisung               | Rolle existiert mit korrekter Instanzzuordnung und ist dem Tenant-Admin zugewiesen                                                                         | Rolle und Zuweisung synchronisieren                                                  |
| Ausschluss `instance_registry_admin` | `tenantAdminBootstrap.username`                 | Realm-Rolle auf Tenant-Admin                  | Rolle ist nicht zugewiesen                                                                                                                                 | Unzulässige Plattformrolle nicht vergeben beziehungsweise entfernen                  |
| `instanceId`-Mapper                  | `instanceId`                                    | Protocol Mapper `instanceId`                  | Mapper existiert am Login-Client                                                                                                                           | Bei neuen Realms automatisch anlegen oder korrigieren; Bestands-Realms nur prüfen    |
| User-Attribut `instanceId`           | `instanceId`, `tenantAdminBootstrap.username`   | `attributes.instanceId` am Tenant-Admin       | Optionales, nicht für den New-Realm-Zielzustand erforderliches Interop-Artefakt                                                                              | Nur bei einem konkreten Integrationsvertrag pflegen                                  |

Wichtig:

- Diese Checkliste ist bewusst klein. Realm, Client, URLs, Secrets, Tenant-Admin und Rollen sind login-blockierend; Mapper und User-Attribut bleiben sichtbare Interop-/Diagnosepunkte.
- Die UI-Schritte `Realm`, `Client`, `Mapper`, `Tenant-Secret` und `Tenant-Admin` gruppieren jeweils genau diese Pflichtpunkte.
- Ein Provisioning-Lauf gilt für den Login-Pfad als erfolgreich, wenn alle login-blockierenden Punkte erfüllt sind. Optionale Interop-Hinweise dürfen danach weiter sichtbar bleiben.
- Bei `realmMode = new` darf kein Punkt des erweiterten Realm-Zielzustands stillschweigend entfallen: Entweder stellt das Provisioning ihn automatisch her oder Plan, Run-Protokoll und Detailstatus nennen ihn als konkrete manuelle Nacharbeit.

## Erweiterte Ziel-Checkliste für neue Realms

Die folgende Checkliste ergänzt den login-blockierenden Mindestzustand um den betrieblichen Zielzustand eines neuen Realms. Sie beschreibt zugleich den aktuellen Automatisierungsstand. `Manuell` bedeutet nicht optional: Der Punkt muss nach dem Provisioning ausdrücklich als Nacharbeit angezeigt und vor der Freigabe geprüft werden. Ob eine offene Nacharbeit die Aktivierung blockiert oder nur als Warnung bestehen darf, richtet sich nach der Spalte `Freigabe`.

Für neue Realms zeigt Plan, Run-Protokoll und Detailstatus die automatische Baseline und die verbleibende manuelle SMTP-Passwort-Nacharbeit. Bestands-Realms werden nur gelesen und nicht auf diese Baseline migriert.
Beim Laden von Detailstatus und Plan wird für Studio-erstellte Realms
ausschließlich der Boolesche Nachweis, ob ein SMTP-Passwort gesetzt ist,
tenantlokal live aktualisiert. Ist dieser Read nicht möglich, bleibt der letzte
Snapshot konservativ sichtbar; ein Passwortwert wird weder gelesen noch
gespeichert. Reine Sternmasken gelten nicht als erfolgreicher Nachweis. Die
Zuordnung als Studio-erstellter Realm bleibt nur erhalten, solange der
zugehörige Status-Snapshot zum aktuellen `authRealm` passt.

| Bereich              | Zielzustand im neuen Realm                                                                                                                            | Behandlung bei `realmMode = new`                                                                                                                                    | Freigabe                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Realm-Basis          | Realm ist aktiviert und besitzt einen nachvollziehbaren Anzeigenamen.                                                                                 | Automatisch; Realmname und technischer Anzeigename werden aus der `instanceId` abgeleitet.                                                                          | Blockierend.                                                                                                           |
| Login-Client         | Vertraulicher OIDC-Client mit Standard Flow, exakten Tenant-URLs und ohne fremde oder Wildcard-Redirects.                                             | Automatisch aus `authClientId`, `instanceId`, `parentDomain` und `primaryHostname`.                                                                                 | Blockierend.                                                                                                           |
| Tenant-Admin-Client  | Separater Service-Account-Client mit ausschließlich tenantlokalen Admin-Rechten.                                                                      | Automatisch, sofern der Client-Vertrag in der Registry vollständig ist. Fehlende Registry-Pflichtwerte blockieren den Preflight.                                    | Blockierend für tenantlokale IAM-Administration.                                                                       |
| Plugin-OIDC-Clients  | Nur Clients und Audience-Mapper der tatsächlich zugewiesenen Module sind vorhanden.                                                                   | Automatisch aus den Plugin-Verträgen; keine Übernahme aus einem Referenz-Realm.                                                                                     | Blockierend für das betroffene aktive Modul, sonst nicht anwendbar.                                                    |
| Secrets              | Login- und Tenant-Admin-Client-Secrets stimmen zwischen Keycloak und Registry überein.                                                                | Automatisch erzeugen oder abgleichen und ausschließlich verschlüsselt speichern. Maskierte Werte wie `********` niemals übernehmen.                                 | Blockierend.                                                                                                           |
| Tenant-Admin         | Aktiver Bootstrap-Benutzer mit vollständigem Profil und `system_admin`, ohne `instance_registry_admin`.                                               | Automatisch aus `tenantAdminBootstrap.*`; lokale Studio-Rollenbindung im selben Provisionierungsablauf nachziehen.                                                  | Blockierend.                                                                                                           |
| Benutzerprofil       | Die Attribute `instanceId`, `mainserverUserApplicationId` und `mainserverUserApplicationSecret` sind administrativ geschützt.                         | Bei neuen Realms automatisch additiv ergänzen; fremde und Keycloak-eigene Attribute bleiben erhalten.                                                               | Blockierend für den automatischen Baseline-Abschluss.                                                                  |
| `instanceId`-Interop | Der `instanceId`-Mapper am Login-Client ist vorhanden.                                                                                                | Bei neuen Realms automatisch anlegen oder korrigieren. Bestands-Realms bleiben unverändert.                                                                         | Blockierend für den automatischen Baseline-Abschluss.                                                                  |
| Login-Theme          | Das Login-Theme `sva-kern2` ist gesetzt.                                                                                                              | Bei neuen Realms automatisch setzen. Die Theme-Dateien selbst werden serverseitig mit der Keycloak-Installation ausgeliefert.                                       | Blockierend für den automatischen Baseline-Abschluss.                                                                  |
| Dark Mode            | Das Realm-Attribut `darkMode` ist aktiviert.                                                                                                          | Bei neuen Realms automatisch setzen.                                                                                                                                | Blockierend für den automatischen Baseline-Abschluss.                                                                  |
| Lokalisierung        | Internationalisierung ist aktiviert; einzige und standardmäßige Sprache ist `de`.                                                                     | Bei neuen Realms automatisch setzen.                                                                                                                                | Blockierend für den automatischen Baseline-Abschluss.                                                                  |
| Keycloak-E-Mail      | Nicht geheime SMTP-Werte entsprechen der Baseline; das Passwort ist pro Realm gesetzt.                                                                | Host, Port, Absender, Benutzername und Transportwerte automatisch setzen. Nur das Passwort einmalig direkt in Keycloak eintragen; es wird nie in Studio übernommen. | Das fehlende Passwort bleibt als manuelle Nacharbeit sichtbar, blockiert den technischen Provisioning-Lauf aber nicht. |
| Account Recovery     | Passwort-Reset ist aktiviert, E-Mail-Verifizierung bleibt gemäß Baseline deaktiviert.                                                                 | Bei neuen Realms automatisch setzen. Nach dem manuellen SMTP-Passwort sollte die Verbindung operativ in Keycloak getestet werden.                                   | Baseline blockierend; SMTP-Funktionstest ist betriebliche Abnahme.                                                     |
| Events und Audit     | User- und Admin-Events sind aktiv, Details deaktiviert und die Aufbewahrung beträgt sieben Tage.                                                      | Bei neuen Realms automatisch setzen.                                                                                                                                | Blockierend für den automatischen Baseline-Abschluss.                                                                  |
| Sicherheitshärtung   | Passwort-Policy, Brute-Force-Schutz, MFA/WebAuthn, Session-/Token-Laufzeiten und Schlüsselrotation entsprechen einem gesondert freigegebenen Vertrag. | Nicht Teil dieser Baseline und daher keine manuelle Standardnacharbeit; niemals ungeprüft aus `bb-guben` ableiten.                                                  | Nur bei gesondertem Vertrag relevant.                                                                                  |
| Externe Identitäten  | Identity Provider und User Federation existieren nur bei einem freigegebenen Tenant-Vertrag.                                                          | Nicht Teil dieser Baseline und daher keine manuelle Standardnacharbeit; niemals aus einem anderen Realm kopieren.                                                   | Nur bei gesondertem Vertrag relevant.                                                                                  |

### Anforderungen an Hinweise zu manuellen Nacharbeiten

Solange ein Zielpunkt nicht automatisiert werden kann, müssen Plan, Run-Protokoll und Detailstatus mindestens enthalten:

- den betroffenen Zielpunkt,
- den Grund, warum keine automatische Änderung erfolgt,
- die konkrete manuelle Aktion ohne Secret-Werte,
- die Einstufung als `blockierend`, `Warnung` oder `nicht anwendbar`,
- den Hinweis, dass nach der manuellen Änderung ein Readback beziehungsweise Smoke-Nachweis erforderlich ist.

Ein technischer Erfolg des automatischen Provisioning-Anteils darf offene blockierende Nacharbeiten nicht als vollständig betriebsbereiten Realm darstellen. Warnungen dürfen bestehen bleiben, müssen aber vor der Aktivierung bewusst geprüft und dokumentiert werden.

## Vorbedingungen

Vor jeder Keycloak-Mutation führt Studio einen zweistufigen Preflight aus:

1. Plattformzugriff prüfen
   - Root-Host
   - aktueller Benutzer hat `instance_registry_admin`
2. Technische Ausführbarkeit prüfen
   - Ziel-Realm ist erreichbar oder darf erstellt werden
   - Tenant-Secret ist bei `existing` vorhanden, wenn der Ziel-Client es benötigt
   - bei `new` ist fehlendes Tenant-Secret kein Blocker, sondern erwarteter Vorzustand
   - der technische Keycloak-Admin-Zugang kann den Ziel-Realm verwalten

Ein blockierter Preflight verhindert die Ausführung. Die UI zeigt die Blocker explizit an.

## Realm-Modi

### Neuer Realm

Verwendung für neue Tenants ohne vorhandenen Realm.

Sollverhalten:

- Realm wird erstellt
- Login-Client wird erstellt oder vollständig eingerichtet
- Client-Secret wird von Keycloak erzeugt und anschließend in der Registry gespeichert
- `instanceId`-Mapper wird bei neuen Realms automatisch angelegt
- Realm-Rollen werden sichergestellt
- Tenant-Admin wird angelegt oder aktualisiert

### Bestehender Realm

Verwendung für Tenants mit bereits vorhandenem Realm.

Sollverhalten:

- Realm wird gelesen und validiert
- bestehende Drift wird im Plan angezeigt
- nur der dokumentierte Sollzustand wird korrigiert
- kein stilles Fallback auf "Realm neu erstellen"

## Geführter Ablauf in der UI

Die Detailseite einer Instanz folgt einem festen Ablauf:

1. Vorbedingungen
2. Realm-Modus
3. Konfiguration
4. Vorschau
5. Ausführen
6. Protokoll

Die UI trennt bewusst zwischen:

- `Instanzdaten speichern`
- `Provisioning ausführen`

Zusatzaktionen wie `Tenant-Admin zurücksetzen` oder `Client-Secret rotieren` laufen als benannte Provisioning-Intents und nicht mehr als unscharfer Sammel-Reconcile.

Wichtig:

- `Tenant-Admin zurücksetzen` ist ein User-Pfad. Dieser Intent korrigiert Tenant-Admin-Profil, Rollen und optional das temporäre Passwort, überschreibt aber nicht nebenbei Login- oder Tenant-Admin-Client-Konfigurationen.
- Wenn der Plan beim Schritt `Tenant-Admin-Client` ein `update` meldet, würde ein expliziter Keycloak-Abgleich diesen technischen Client auf Root-, Redirect-, Logout- oder Origin-Werte zurückführen. Diese Drift ist in der Vorschau jetzt bewusst sichtbar.

## Kompakte Betriebs-Checkliste für neue Instanzen

Diese Kurzfassung ist der empfohlene operative Standardpfad für neue oder zu reparierende Instanzen unter `/admin/instances`.

1. Instanz anlegen oder bestehende Instanz öffnen.
2. `Realm mode` korrekt setzen:
   - vorhandener Realm: `Existing realm`
   - neuer Realm: `New realm`
3. Pflichtwerte prüfen:
   - `instanceId`
   - `parentDomain`
   - `authRealm`
   - `authClientId` entspricht dem für die Instanz vorgesehenen Login-Client
4. Tenant-Admin-Stammdaten vollständig pflegen:
   - `username`
   - `email`
   - `firstName`
   - `lastName`
5. Bei `existing` das vorhandene Tenant-Secret pflegen oder für einen späteren Abgleich leer lassen.
6. `Instanz speichern`.
7. `Check preflight` ausführen.
8. `Load provisioning preview` ausführen.
9. `Execute provisioning` ausführen.
10. Das SMTP-Passwort einmalig direkt in Keycloak setzen und die Verbindung dort testen.
11. Wenn `Tenant client secret aligned with Keycloak` noch nicht grün ist:
    - `Rotate client secret`
    - danach Status erneut laden und nur bei weiterem Drift erneut provisionieren
12. Erst wenn alle login-blockierenden Checklistenpunkte und manuellen Blocker grün sind:
    - `Activate`

## Validierte Fallstricke aus dem Live-Betrieb

Die folgenden Punkte wurden auf `studio.smart-village.app` mit den Instanzen `hb-meinquartier`, `bb-guben` und `de-musterhausen` praktisch validiert:

- `Active` in der Übersicht allein reicht nicht als Freigabekriterium.
  Maßgeblich ist die vollständige grüne Checkliste auf der Detailseite.
- Ein bestehender Realm darf nicht versehentlich auf `New realm` stehen.
  Dieser Fehler führt zu einem fachlich falschen Provisioning-Pfad.
- Das Tenant-Admin-Profil muss vollständig gepflegt sein.
  Fehlende Stammdaten blockieren oder verfälschen den Bootstrap.
- Der häufigste Restfehler bei `existing` ist Secret-Drift.
  In diesem Fall zuerst `Rotate client secret` verwenden.
- `Provisioning succeeded` ist das technische Erfolgssignal im Protokoll.
  Die Instanz gilt aber erst dann als sauber, wenn danach auch alle fachlichen Checklistenpunkte grün sind.

## Provisioning-Plan

Vor der Ausführung erstellt Studio einen Plan mit Drift-Zusammenfassung und Schritten.

Typische Planschritte:

- Realm erstellen oder vorhandenen Realm validieren
- OIDC-Client abgleichen
- Redirect-/Logout-/Origin-Werte korrigieren
- `instanceId`-Mapper bei neuen Realms automatisch sicherstellen
- Tenant-Secret abgleichen
- Realm-Rollen sicherstellen
- Tenant-Admin erstellen oder aktualisieren
- optional temporäres Passwort setzen und `UPDATE_PASSWORD` markieren

Der Plan ist read-only und zeigt, was erstellt, geändert, übersprungen oder blockiert würde.

## Ausführung und Protokoll

Jeder Provisioning-Lauf wird als eigener Run mit Schritten persistiert. Die UI zeigt:

- `mode`
- `intent`
- `overallStatus`
- `driftSummary`
- `requestId`
- chronologische Schrittliste

Jeder Schritt enthält mindestens:

- `stepKey`
- `title`
- `status`
- `startedAt`
- `finishedAt`
- `summary`
- optionale technische `details`
- `requestId`

Erlaubte Schrittzustände:

- `pending`
- `running`
- `done`
- `failed`
- `skipped`
- `unchanged`

## Minimaler Sollzustand pro Tenant

Das Provisioning stellt mindestens folgenden Zustand sicher:

- Realm `authRealm` existiert
- OIDC-Client `authClientId` existiert
- `rootUrl`, `redirectUris`, `webOrigins` und `post.logout.redirect.uris` sind tenant-spezifisch
- Realm-Rolle `system_admin` existiert
- Realm-Rolle `instance_registry_admin` existiert nur für Plattformpfade, nicht als Default-Rolle des Tenant-Admins
- Tenant-Admin existiert, trägt `system_admin` und hat nicht `instance_registry_admin`
- der konfigurierte Tenant-Admin ist nach einem Root-Host-Provisioning-Lauf auch lokal in Studio an die direkte Rolle `system_admin` gebunden, damit Permission-Projektionen nicht nur auf Keycloak-Rollen beruhen
- die Realm-Rolle `system_admin` trägt als `instance_id` die Studio-Instanz-ID; ein erneuter Provisioning-Lauf korrigiert ältere Realm-basierte Metadaten idempotent
- Root-Follow-up-Aktionen aus `/admin/instances` synchronisieren keine Gruppen wie `admins`, keine Rollen wie `core_admin` und keine modulbezogenen `*_admin`-Standardrollen mehr

Optional und weiter diagnostizierbar:

- Protocol Mapper `instanceId` existiert
- Tenant-Admin besitzt das korrekte User-Attribut `instanceId`

## Rollen- und Rechte-Modell

- `instance_registry_admin` ist eine Plattformrolle und bleibt Root-Host-exklusiv.
- `system_admin` ist die minimale Tenant-Admin-Rolle für tenant-lokale Admin-Funktionen.
- Tenant-Admins erhalten im Bootstrap nicht automatisch `instance_registry_admin`.
- Der Bootstrap löst den initialen Tenant-Admin ausschließlich über den im
  Tenant-Realm konfigurierten Benutzernamen auf. Eine gleiche E-Mail-Adresse
  verknüpft weder einen Root-Benutzer noch einen Benutzer eines anderen Realms;
  Konflikte werden sichtbar abgebrochen, statt eine fremde Identität zu
  übernehmen.
- Weitere tenantlokale Rollen werden individuell verwaltet; der Root-Bootstrap erzeugt keine zusätzlichen Default-Admin-Rollen mehr.
- Ein neu angelegtes lokales Konto des ausdrücklich konfigurierten Bootstrap-Administrators
  erhält bereits im Bootstrap den Status `active`. Voraussetzung ist, dass der exakt
  zugeordnete Keycloak-Benutzer `enabled = true` bestätigt. Ein fehlender oder deaktivierter
  Benutzerstatus beendet diesen Schritt mit `tenant_admin_bootstrap_user_not_enabled`.
- Der Bootstrap überschreibt den Status vorhandener Konten nicht. Insbesondere werden
  bestehende `pending`- oder `inactive`-Konten durch Wiederholungen nicht automatisch
  freigeschaltet. Deren Aktivierung erfolgt über die tenantlokale Benutzerverwaltung
  beziehungsweise `PATCH /api/v1/iam/users/{userId}` mit `status: active` und
  Berechtigung `iam.user.write`. Normale JIT-Anmeldungen legen weiterhin `pending`-Konten an.

## Secret-Policy

- Das Tenant-Client-Secret wird verschlüsselt in der Registry gespeichert.
- Antworten und Protokolle zeigen nur den Konfigurationszustand, nie den Klartext.
- Bei `existing` schreibt Provisioning den gespeicherten Secret-Wert nach Keycloak oder gleicht ihn dagegen ab.
- Bei `new` liest Provisioning das neu erzeugte Secret aus Keycloak zurück und speichert es anschließend verschlüsselt in der Registry.
- Secret-Rotation ist eine bewusste Aktion mit eigenem Intent und kein Nebeneffekt eines normalen Speichervorgangs.
- Fehlt bei `existing` ausschließlich der verschlüsselte Registry-Wert, erzeugt nur der explizite Intent `Client-Secret rotieren` einen neuen Keycloak-Secret-Wert und schreibt ihn anschließend verschlüsselt zurück. Ein normaler Abgleich erzeugt oder löscht kein Secret.

## Fehler- und Retry-Verhalten

- Es gibt kein stilles Fallback zwischen den Realm-Modi.
- Teilfehler markieren den Run als `failed`.
- Wiederholte Ausführung ist idempotent.
- Bereits erfüllte Schritte dürfen bei Wiederholung als `unchanged` oder `skipped` enden.

## Betriebsnachweis

Ein Tenant gilt erst dann als betriebsbereit, wenn zusätzlich folgende Nachweise grün sind:

1. Preflight ist `ready`
2. Plan ist nicht `blocked`
3. letzter Provisioning-Run ist `succeeded`
4. Tenant-Login gegen `https://<instanceId>.studio.smart-village.app/auth/login` funktioniert
5. `/auth/me` liefert den korrekten `instanceId`-Kontext aus Host, Registry und Realm

### Read-only Studio-Instanz-Audit

Der operative Studio-Instanz-Audit ergänzt den Provisioning-Nachweis, ersetzt
aber weder Preflight noch Plan oder Ausführung. Sein Keycloak-Pfad arbeitet in
zwei festen Schritten:

1. Die Erhebung authentisiert den in der Registry hinterlegten
   Tenant-Admin-Client direkt in seinem Tenant-Realm und liest Realm,
   Login-Client, Tenant-Admin-Client, Rollen und Serviceaccount-Zustand in
   fester Reihenfolge. Die globale Provisioner-Identität bleibt dem separaten
   Provisioning-Worker vorbehalten und wird nicht in den Web-Request-Pfad
   eingebunden.
2. Eine reine Bewertung leitet aus dem typisierten Snapshot die bestehenden
   vierzehn Check-Ergebnisse ab. Check-IDs, Titel, Zusammenfassungen, Details
   und Fail-/Warn-/Skip-Semantik sind ein stabiler Betriebsvertrag.

Der Pfad ist ausschließlich lesend. Ein fehlendes Realm beendet die Erhebung
fail-closed mit dem einzelnen Realm-Befund. Secret-Werte dienen nur dem
kurzlebigen Gleichheitsvergleich; Bericht, Fehler und Logs enthalten weiterhin
nur `tenant secret compared` oder `secret missing`. Die Tenant-Credentials
werden ausschließlich für den kurzlebigen Live-Read verwendet.

## Referenzen

- [Keycloak-Tenant-Realm-Bootstrap für Studio](./keycloak-tenant-realm-bootstrap.md)
- [Keycloak Service-Account Setup für IAM-User- und Rollen-Management](./keycloak-service-account-setup-iam.md)
- [Deployment-Runbook: IAM Account- und Admin-UI](./iam-deployment-runbook.md)
