# Design: Allgemeiner MCP-Zugang zur Studio-Tenant-Verwaltung

## Kontext und Entscheidung

Der lokale Studio-MCP ist bisher ein typisierter Client für die
Instanz-Control-Plane und verwendet einen Keycloak-Service-Token. Die
tenantlokalen Verwaltungs-APIs arbeiten dagegen mit einer Browser-Session
und deren Tenant- und Berechtigungskontext. Ein allgemeiner API-Aufruf des
heutigen MCP wäre daher noch kein authentisierter Tenant-Admin-Aufruf.

Wir wählen einen allgemeinen MCP-Zugang zu den bestehenden
Studio-Verwaltungs-APIs. Er erweitert den vorhandenen MCP und nutzt die
Studio-HTTP-Verträge statt pro Ressource eine zweite Fachimplementierung zu
schaffen. Die Einrichtung bleibt eine schrittweise Folge von API-Aufrufen
und Readbacks, kein neuer persistenter Workflow.

## Fachlicher Umfang

| Bereich              | MCP-fähige Einzelaktionen                                                                                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instanzen und Module | Vorhandene Funktionen für Anlage, Plan, Bereitstellung, Diagnose, Aktivierung und spätere Änderung verwenden.                                                                                |
| Schnittstellen       | Beauftragte Typen auflisten, konfigurieren, prüfen, ändern und löschen.                                                                                                                      |
| Accounts             | Suchen, lesen, anlegen, ändern, einladen, deaktivieren und nach bestehendem Vertrag löschen.                                                                                                 |
| Rollen und Gruppen   | Lesen, anlegen, ändern, zuweisen, entziehen und löschen, soweit Studio dies unterstützt.                                                                                                     |
| Organisationen       | Kundenorganisation und optionale weitere Organisationen anlegen, ändern, Mitgliedschaften verwalten und löschen; Mainserver-Zugang nur bei entsprechendem Auftrag provisionieren und prüfen. |

Massenaktionen, redaktionelle Inhalte und Plugin-Facheinstellungen gehören
nicht zu diesem Change. Die bestehenden Studio-Verträge bestimmen, ob eine
Ressource deaktiviert werden kann oder einen anderen Statusvertrag besitzt;
der MCP erfindet keinen einheitlichen Lifecycle.

## Anmeldung und aktiver Kontext

Der MCP bleibt ein lokal eingerichtetes Werkzeug für unsere Provider-
Operatoren. Keycloak steuert je Realm, welche persönlichen Provider-Accounts
den vorgesehenen MCP-Client nutzen und dafür Tokens erhalten dürfen.
`system_admin` gilt auch für Kunden-Admins und ist deshalb kein Kriterium
für diese Client-Freigabe. Studio führt weder eine eigene Provider-Liste noch
eine zusätzliche MCP-Rolle. Es validiert den ausgestellten Token samt
Issuer, ausstellendem Client, Studio-Audience, Host und Account; danach
entscheidet es jede fachliche Action mit den bestehenden Studio-Rechten.
Eine selbst installierte
MCP-Kopie und ein normaler Kunden-Admin-Login reichen damit nicht aus.
Bestehende servicegebundene Instanztools behalten ihren eigenen Vertrag.

1. Plattform und jeder Tenant erhalten getrennte interaktive Anmeldungen
   persönlicher Provider-Accounts im jeweiligen Realm. Der MCP verwaltet
   diese unabhängig von der Studio-Browser-Sitzung.
2. Der Operator wählt den aktiven Kontext ausdrücklich. Studio-Host, Realm,
   Tenant und angemeldeter Account sind vor einem Aufruf sichtbar. Der
   Zielhost stammt nur aus diesem Kontext, nie aus einem frei übergebenen
   URL-Parameter.
3. Studio prüft die persönliche API-Anmeldung gegen Realm und Tenant-Host
   und löst dieselben fachlichen Berechtigungen und Tenant-Grenzen wie bei
   der Browser-Anmeldung auf. Die bestehenden Handler bleiben für die
   Fachaktion zuständig; der Browser-Session-Pfad bleibt erhalten.
4. Abgelaufene oder gewechselte Anmeldungen stoppen den Aufruf. Es gibt
   keinen automatischen Fallback auf einen anderen Realm oder Account.

Der genaue OIDC-Client- und Token-Lifecycle wird vor der Implementierung
an den bestehenden Keycloak-Verträgen geprüft. Vorhandene OIDC- und lokale
Credential-Mechanismen werden verwendet; ein eigener Token-Speicher oder
Auth-Provider entsteht nur bei belegter Lücke. Browser-Cookies werden nicht
ausgelesen. Tokens und Secrets erscheinen weder in Tool-Antworten noch in
Logs oder Repository-Dateien. Die heutige MCP-Serviceidentität kann für
bereits vorhandene Instanztools bestehen bleiben; der allgemeine Tenant-
API-Zugriff verwendet den ausdrücklich gewählten persönlichen Kontext.
Eine zusätzliche Personenattribution über den authentisierten Account und
bestehende Auditdaten hinaus ist nicht Ziel des Changes.

Vor der Umsetzung ist zu klären, wie Keycloak die Nutzung des vorgesehenen
MCP-Clients je Realm auf freigegebene Provider-Accounts begrenzt. Der
Nachweis muss die Token-Ausgabe an einen Kunden-Admin auch dann verweigern,
wenn dieser `system_admin` besitzt oder den MCP lokal installiert. Studio
prüft die Bindung des tatsächlich ausgestellten Tokens; die Keycloak-
Freigabe ersetzt nicht die Studio-Autorisierung fachlicher Actions.

Als kleinster konkreter Kandidat wird je Realm ein eigener persönlicher
OIDC-Client für den lokalen MCP verwendet, getrennt vom heutigen
Service-Account-Client. Der Client verwendet Authorization Code mit PKCE;
Direct Grant, Implicit Grant und Service Account bleiben für ihn aus. Das
Keycloak-User-Attribut `svaStudioMcpAccess` ist bei normalen Accounts nicht
gesetzt und wird nur für freigegebene persönliche Provider-Accounts auf
`true` gesetzt. Es wird im Keycloak User Profile als ausschließlich durch
Administratoren bearbeitbares Attribut geführt; Benutzer dürfen es weder
über ihr Profil noch bei der Registrierung selbst setzen. Ein nur diesem
Client zugewiesener Browser-Authentication-Flow verwendet `Condition - User
Attribute` und `Deny Access`, um bei fehlendem `true` die Anmeldung zu
verweigern. Die normale Studio-Anmeldung behält ihren Flow. Der tatsächliche
Flow-Aufbau wird am eingesetzten Keycloak-Stand geprüft, insbesondere mit
vorhandener SSO-Sitzung, damit Cookie- oder IdP-Pfade die Attributprüfung
nicht überspringen.

Studio akzeptiert auf dem persönlichen MCP-API-Pfad nur Tokens dieses
Clients mit passendem Issuer, Studio-Audience, Host und persönlichem Subject.
Client-Bindung und Resource-Audience werden getrennt geprüft; die bloße
Nennung des MCP-Clients als Audience genügt nicht. Bearer-Authentisierung
gilt nur für die ausdrücklich freigegebenen Verwaltungsrouten und Methoden.
Ein vorhandenes Browser-Cookie darf weder einen ungültigen Bearer-Token
retten noch die Auswahl des persönlichen Accounts verdecken. Studio
verwaltet das Keycloak-Attribut nicht. Beim Entzug der Attribut-Freigabe
werden die betroffenen MCP-Sitzungen beendet; bereits ausgegebene
Access-Tokens bleiben bis zu ihrem Ablauf zu berücksichtigen. Deshalb ist
eine kurze Token-Laufzeit Teil der Betriebsprüfung. Eine sofortige Sperre
eines noch gültigen Tokens wäre ein eigener, vorab nachzuweisender Bedarf.

## Allgemeiner API-Aufruf

Der MCP bietet einen allgemeinen Aufruf mit relativem Pfad, HTTP-Methode,
Query und JSON-Body. Er bindet ihn an den aktiven Kontext und begrenzt ihn
auf die vereinbarten Verwaltungsrouten. Vorhandene Studio-Endpunkte prüfen
Schema, Action, Tenant-Bindung, Konflikte, Idempotenz und Löschschutz. Der
MCP reicht Korrelation und erforderliche Idempotenzangaben weiter und gibt
strukturierte, redigierte Ergebnisse oder Fehler zurück.

Für die vorhandenen Einzelaktionen sind mindestens `GET`, `POST`, `PATCH`,
`PUT` und `DELETE` nötig; der heutige Client unterstützt nur `GET`, `POST`
und `PATCH`. Ein fehlender API-Endpunkt ist eine sichtbare Fähigkeitslücke.
Besonders die Schnittstellenverwaltung muss vor einer MCP-Zusage auf
HTTP-Verträge geprüft werden. Die Routenbegrenzung schützt den vereinbarten
Umfang und ersetzt keine Studio-Autorisierung. Ihre Ableitung aus dem
bestehenden Routing wird in der Implementierungsplanung festgelegt, damit
kein zweiter fachlicher Rechtekatalog entsteht. Dafür wird keine eigene
Routen-Registry aufgebaut, solange eine kleine Begrenzung am bestehenden
Client und die serverseitigen Guards ausreichen.

Geheime Eingabefelder von Schnittstellen dürfen nicht als Klartext in einer
Unterhaltung oder einem protokollierten MCP-Argument landen. Für solche
Mutationen wird ein lokaler, nur während des Aufrufs aufgelöster Secret-Bezug
benötigt. Zuerst ist die vorhandene Credential-Auflösung des MCP auf Eignung
zu prüfen. Ein neuer Secret-Provider oder Dienst gehört nicht zum Zielbild;
ohne geeigneten Eingabemechanismus bleiben secrettragende Mutationen gesperrt.

## Kleinster Umsetzungszuschnitt

Bestehende Instanztools und IAM-Fachendpunkte bleiben maßgeblich. Ergänzt
werden nur der für persönliche API-Aufrufe fehlende Auth-Pfad, ein
kontextgebundener Aufruf im vorhandenen MCP und konkret benötigte fehlende
Schnittstellen-Endpunkte. Neue Zustandsmodelle, Ressourcen-Tools,
Routen-Registry, eigener Token-Speicher und Workflow-Steuerung sind nicht
vorgesehen. Vor jedem dieser zusätzlichen Artefakte müsste eine aktuelle
Lücke mit unmittelbarem Verbraucher nachgewiesen werden.

## Mögliche PR-Grenzen

Nach dem API-Inventar sind drei Code-PRs sinnvoll, sofern jeder Abschnitt
am dann aktuellen Stand eigenständig build- und testbar ist:

1. **Persönliche Studio-API-Anmeldung:** Server akzeptiert persönliche
   Realm-Tokens für bestehende Verwaltungsendpunkte mit unveränderter
   Tenant-Bindung, Autorisierung und Browser-Session. Ein direkter API-Test
   belegt mindestens Lesen, zulässiges Schreiben und Ablehnungen. Dieser PR
   öffnet die neue Trust Boundary und braucht seinen vollständigen
   Sicherheitsnachweis im selben PR.
2. **Allgemeiner MCP-Verwaltungsaufruf:** Der vorhandene MCP meldet den
   Operator im gewählten Realm an und nutzt die bereits erreichbaren
   Admin-Endpunkte. Accounts, Einladungen, Rollen, Gruppen und
   Organisationen bilden die erste nutzbare Fähigkeit. Zielhost-, Routen-,
   Fehler- und Secret-Grenzen gehören zu diesem PR.
3. **Schnittstellenverwaltung:** Nur die nach Inventar fehlenden
   Interface-HTTP-Endpunkte und deren Nutzung über denselben MCP-Aufruf
   kommen hinzu. Secrettragende Aktionen und der vollständige
   Einrichtungsfall mit und ohne Mainserver werden hier nachgewiesen.

Inventar und Vertragsklärung sind Vorbereitung, kein eigener Code-PR. Die
Einrichtungsabnahme ist kein bloßer Schluss-PR: jeder Abschnitt trägt seine
eigenen Nachweise; die Gesamtabnahme schließt den letzten benötigten
Abschnitt ab. Bei enger Kopplung werden Abschnitte zusammengelegt statt
künstlich gestapelt. Ein weiterer Split braucht eine eigenständig nutzbare
und überprüfbare Fähigkeit.

## Referenzablauf für die Kundeneinrichtung

Dieser Ablauf ist ein Anwendungs- und Abnahmenachweis für die allgemeinen
MCP-Funktionen. Er wird im Gespräch geführt und nicht als festes MCP-Tool,
persistenter Workflow oder globale Sperre für Verwaltungsaktionen umgesetzt.

1. Den Einrichtungsauftrag schrittweise erfassen und benötigte Module,
   Schnittstellen, Kundenorganisation und Kunden-Admins bestimmen.
2. Im Plattformkontext die Instanz mit dem bestehenden MCP-Prozess anlegen,
   bereitstellen, diagnostizieren und ausdrücklich aktivieren. Der erste
   Provider-Admin wird dabei für den neuen Tenant bootstrappt.
3. In den Tenant-Kontext wechseln. Beauftragte Schnittstellen einrichten
   und prüfen; Mainserver und davon abhängige Plugins bei nicht angebundenen
   Tenants auslassen.
4. Die Kundenorganisation, benötigte Rollen und Gruppen sowie weitere
   Provider- und Kunden-Accounts gemäß Auftrag einrichten. Den ersten
   Kunden-Admin mit `sendPasswordSetupEmail=false` anlegen und den
   ausgebliebenen Versand zurücklesen; die bestehende Create-API versendet
   bei `true` bereits während der Anlage. Einen optionalen
   Organisations-Mainserver-Zugang gesondert bis zum bestätigten Zustand
   verfolgen.
5. Konfiguration, wirksame Berechtigungen, Provider-Login und benötigte
   Funktionen prüfen. Die erfolgreiche erste Anmeldung des Kunden kann vor
   seiner Einladung nicht vorausgesetzt werden.
6. Erst danach über `POST /api/v1/iam/users/$userId/send-password-setup-email`
   die Einladung an den Kunden-Admin auslösen und den Versandstatus prüfen.
   Fehlende API-Fähigkeiten oder offene Prüfungen bleiben sichtbar und
   verhindern die Aussage einer abgeschlossenen
   Einrichtung. Die spätere erste Kundenanmeldung ist ein eigener Nachweis.

Die Einrichtung nutzt Einzelmutationen und anschließende Readbacks. Es
entsteht kein zusätzlicher persistenter Tenant-Fertig-Status. Die spätere
Verwaltung verwendet dieselben Kontext- und API-Regeln und kann ihre
Einzelaktionen unabhängig von diesem Referenzablauf ausführen.

## Fehler und Nachweise

- Ein Request wird nie an einen anderen Host, Realm oder Tenant umgeleitet.
- Nach Timeout oder unklarer Antwort wird eine Mutation nicht stillschweigend
  wiederholt. Zuerst wird der aktuelle Zustand gelesen; vorhandene
  Idempotenzverträge bleiben maßgeblich.
- Personenbezogene Daten aus autorisierten Verwaltungsreads bleiben an den
  aktiven Kontext gebunden. PII, Einladungslinks, Passwörter, Tokens und
  Schnittstellen-Secrets erscheinen nicht in Diagnose oder Logs;
  Geheimnisse werden auch nicht als MCP-Ergebnis ausgegeben.
- Deaktivierung und Löschung verwenden Studio-Berechtigungen, Schutzregeln
  und Audit; direkte Keycloak-, Datenbank- oder Mainserver-Mutationen sind
  kein Ersatz.
- Tests prüfen Realm- und Host-Trennung, Browser-Kompatibilität,
  erlaubte Methoden und Routen, Einzelaktionen einschließlich Löschung,
  Fehler- und Secret-Behandlung sowie Tenant-Einrichtung mit und ohne
  Mainserver. Die Kunden-Einladung erfolgt erst nach bestätigter Prüfung.

## Kritische Invarianten und geplanter Nachweis

| Grenze                 | Fehlermodus                                                                                                                                                 | Nachweis vor Abschluss                                                                                                                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anmeldung und Realm    | Ein Token des Plattform- oder Nachbar-Tenants wird am falschen Host akzeptiert oder ein Kunden-Admin erhält trotz eigener MCP-Installation einen MCP-Token. | Keycloak-Test: Token-Ausgabe für Kunden-`system_admin` verweigert, für freigegebenen Provider erlaubt; Studio-Negativtests für falsche Clients, Hosts, Realms und abgelaufene Tokens.                           |
| Autorisierung          | Der API-Pfad umgeht Browser-Guards, CSRF- oder Fresh-Reauth-Semantik oder die fachliche Action-Prüfung.                                                     | Contract-Tests derselben IAM-Aktionen über Session und persönliche API-Anmeldung, einschließlich verweigerter Mutationen und sensibler Aktionen; ungültiger Bearer mit gültigem Cookie bleibt abgewiesen.       |
| Routengrenze           | Ein allgemeiner Aufruf erreicht Fachinhalte, fremde Hosts oder interne Endpunkte.                                                                           | Tests für Pfadnormalisierung, Redirects, Methoden und erlaubte Verwaltungsrouten; Server-Autorisierung separat prüfen.                                                                                          |
| Unklarer Write-Ausgang | Timeout führt zu doppelter Einladung, Anlage oder Löschung.                                                                                                 | Fehlerfalltest mit Write vor Antwort; Zustand/Idempotenz vor erneutem Aufruf lesen und unklare Ergebnisse sichtbar lassen.                                                                                      |
| Secrets und PII        | MCP-Argumente, Tool-Antworten oder Logs enthalten Zugangsdaten oder Einladungslinks.                                                                        | Redaction- und Negativtests an Eingabe-, Ausgabe- und Log-Grenzen; secrettragende Interface-Mutationen nur mit lokalem geschütztem Bezug.                                                                       |
| Übergabe               | Technisches `active` wird als abgeschlossene Kundeneinrichtung ausgegeben oder die Create-API versendet die Einladung zu früh.                              | End-to-End-Abnahme mit und ohne Mainserver: Kunden-Admin ohne Versand anlegen, `not_requested` und Ressourcen sowie Provider-Zugriff vor Einladung prüfen; Versandstatus danach; erste Kundenanmeldung separat. |

Die Umsetzung wird an der jeweils aktuellen Codebasis und den parallel
laufenden Instanz-Changes geprüft. Diese Tabelle ist ein Plan für Belege,
keine Behauptung bereits bestandener Abnahme.

## Offene Implementierungsprüfung

### Inventar und Scope-Grenzen (Quellstand `c0ef34bd`)

Die kanonische Pfadliste steht in `packages/auth-runtime/src/routes.ts`; die
Methoden und Aufrufverträge sind in den IAM-API-Clients sowie den Handlern in
`packages/iam-admin` und `packages/auth-runtime/src/iam-account-management`
definiert. Für die allgemeine Tenant-Verwaltung ergibt sich folgende
Routenmatrix. Alle Session-Aufrufe bleiben an den Tenant-Host, den angemeldeten
Akteur, dessen effektive Rollen und den bestehenden Berechtigungspfad gebunden.

| Bereich                | Vorhandene Methoden und Pfade                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Berechtigung und Schutzvertrag                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instanzen              | `GET/POST /api/v1/iam/instances`, `GET/PATCH /:instanceId`; `GET /draft-readiness`, `/keycloak-realms`, `/audit`, `/:id`, `/:id/audit`, `/:id/plugin-readiness`, `/:id/keycloak/status`, `/preflight`, `/runs/:runId`; `POST /:id/provisioning/retry`, `/plugin-readiness`, `/keycloak/plan`, `/execute`, `/rotate-secret`, `/reconcile`, `/tenant-iam/access-probe`, `/tenant-iam/roles/reconcile`, `/modules/assign`, `/modules/bootstrap-admin-structure`, `/modules/revoke`, `/modules/seed-iam-baseline`, `/activate`, `/suspend`, `/archive` | Plattformkontext und bestehender Registry-Service-Token sind getrennte Identitäten. Interaktive Registry-Mutationen verlangen die vorhandenen Plattformrollen; kritische Aktionen verwenden Fresh-Reauth. Der Maschinenpfad bleibt auf seine Service-Actions begrenzt. Die Liste ist keine Freigabe dieser Routen für persönliche Tenant-Tokens.                                                                                                                                                                                                   |
| Nutzer und Einladungen | `GET/POST /users`, `GET/PATCH/DELETE /users/:userId`; `GET /:userId/timeline`, `/keycloak-roles`; `PATCH /:userId/keycloak-roles`; `POST /:userId/deactivate`, `/send-password-setup-email`, `/reprovision-mainserver`; außerdem Sync- und Bulk-Routen                                                                                                                                                                                                                                                                                             | `iam.user.read`/`iam.user.write`; physisches Löschen zusätzlich `iam.accounts.delete`. Handler behalten Tenant-Akteur, Lifecycle, Action, Audit und Idempotenz bei. Mutationen über Browser-Session prüfen CSRF. Letzter aktiver `system_admin` kann nicht deaktiviert werden; `system_admin` muss vor dem Löschen entzogen werden. Die Setup-Einladung ist eine separate POST-Mutation; beim Anlegen gilt `sendPasswordSetupEmail !== true` als `not_requested`. Sync/Bulk und Self-Service-Routen bleiben außerhalb des persönlichen MCP-Scopes. |
| Rollen                 | `GET/POST /roles`, `PATCH/DELETE /roles/:roleId`; `GET /permissions`, `/keycloak-roles`                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `iam.role.read`/`iam.role.write`; Permission-IDs und -Scopes werden serverseitig validiert. Root-only-Rechte sowie geschützte Systemrollen umgehen den bestehenden Governance-/IAM-Pfad nicht. Browser-Mutationen prüfen CSRF.                                                                                                                                                                                                                                                                                                                     |
| Gruppen                | `GET/POST /groups`, `GET/PATCH/DELETE /groups/:groupId`; `POST/DELETE /:groupId/roles`, `POST/DELETE /:groupId/memberships`                                                                                                                                                                                                                                                                                                                                                                                                                        | `iam.role.read`/`iam.role.write` über den Group-Authorizer, Actor- und Tenant-Kontext sowie CSRF bei Browser-Mutationen. Auditierte Handler schützen Gruppenzuordnungen; die getrennte Legacy-Gruppenroute wird nicht als allgemeiner Ersatz geöffnet.                                                                                                                                                                                                                                                                                             |
| Organisationen         | `GET/POST /organizations`, `GET/PATCH/DELETE /organizations/:organizationId`; `POST /:organizationId/provision-mainserver`, `/memberships`; `PATCH/DELETE /:organizationId/memberships/:accountId`                                                                                                                                                                                                                                                                                                                                                 | `iam.org.read`/`iam.org.write`, Organisation-/Tenant-Hierarchie und serverseitiger Mutation-Authorizer; Browser-Mutationen prüfen CSRF. Löschen läuft über bestehende Restriktions- und Referenzprüfungen. Die Erstellung nutzt den vorhandenen Mainserver-Provisioning-Hook, sofern die Instanz angebunden ist; die dedizierte Provisionierung bleibt ebenfalls verfügbar.                                                                                                                                                                        |
| Schnittstellen         | `GET/POST /api/v1/interfaces`, `DELETE /api/v1/interfaces/:interfaceId`; davor bestanden nur TanStack-Server-Funktionen in `apps/sva-studio-react/src/lib/interfaces-api.ts`.                                                                                                                                                                                                                                                                                                                                                                      | Alle drei Routen opten nur ihre konkrete Methode im persönlichen Bearer-Pfad ein und verwenden danach `integration.manage`, Tenant-Instanzbindung, bestehende Schema-/Healthcheck-/Verschlüsselungspfade und secretfreie Projektionen. Mainserver und pluginverwaltete Einträge bleiben außerhalb dieses Vertrags. Secretwerte kommen ausschließlich über lokale `secretRef`-Auflösung im MCP.                                                                                                                                                     |

Die Methoden sind gegen `iam-api.ts`, `iam-api-instances.ts`,
`iam-api-instance-operations.ts`, `iam-api-organizations.ts` und
`iam-api-roles-groups.ts` abgeglichen. Die Route-Map selbst benennt keine
Methoden; maßgeblich für Berechtigungen, CSRF und Löschschutz sind deshalb die
konkreten Handler, nicht der Pfad allein.

Der erste persönliche API-PR optiert nur `GET` und `POST /api/v1/iam/users`
ein. Der allgemeine Verwaltungsaufruf ergänzt danach ausschließlich die
Einzelaktionen der Routenmatrix: Accounts lesen, ändern, deaktivieren,
einladen und nach Schutzprüfung löschen; Rollen und Gruppen verwalten und
zuweisen; Organisationen und Mitgliedschaften verwalten. Server-Handler opten
jede Route samt Methode einzeln ein. Der MCP-Client beschränkt dieselben
Aktionen im vorhandenen Aufrufpfad auf relative Pfade und sichere
ID-Segmente. Bulk-, Self-Service-, Sync-, Mainserver-Provisionierungs-,
Instanz-, Content- und Plugin-Routen bleiben gesperrt. Die kryptografisch
authentisierten Requests überspringen nur Browser-CSRF; sie erhalten keine
Fresh-Reauth-Evidenz. Die vorhandene Instanz-Serviceauthentisierung bleibt
getrennt.

Die aktive Change-Inventur bestätigt die Abgrenzung zum Tenant-Setup:
`refactor-tenant-creation-readiness` ordnet den allgemeinen Erstellungs- und
Aktivierungsablauf sowie die betroffenen Changes `automate-kassel-tenant-ingress`,
`automate-keycloak-realm-baseline`, `add-plugin-tenant-lifecycle` und
`fix-tenant-iam-doctor-evidence` ein. Dieses Vorhaben konsumiert deren
Instanz-/Lifecycle-Verträge und führt keinen konkurrierenden Aktivierungs- oder
Provisionierungsweg ein. Die in Abschnitt 4 erfasste Schnittstellen-HTTP-API
ist jetzt im bestehenden Interface-Pfad implementiert; sie ergänzt keinen
separaten Provisionierungsweg.

Die IAM-Account-Handler laufen durch `withAuthenticatedIamHandler` und
`withAuthenticatedUser`. Jeder persönliche Bearer-Pfad ist an der konkreten
Handler-Route und HTTP-Methode opt-in gebunden. `withAuthenticatedUser`
prüft weiter Tenant-Host, Account-Lifecycle und Legal-Text-Compliance. `sub`
wird über denselben Session-Principal- und Effective-Role-Pfad hydriert; der
vorhandene Handler erhält unverändert Action-, Rollen-, Tenant-, Audit- und
Idempotenzprüfungen. Nur die Browser-CSRF-Prüfung entfällt für einen Request,
den das Auth-Middleware zuvor kryptografisch als persönlichen Bearer-Request
markiert hat. Ein solcher Request erhält keine Fresh-Reauth-Evidenz. Ein
ungültiger oder nicht zugelassener Authorization-Header fällt nie in den
Cookie-Pfad. Die heutige Instanz-Serviceauthentisierung bleibt getrennt.

Für den ersten Kunden-Admin ist der bestehende Vertrag bestätigt:
`sendPasswordSetupEmail !== true` liefert `invitation.status = not_requested`;
der spätere Versand hat die gesonderte POST-Route
`/api/v1/iam/users/$userId/send-password-setup-email` und einen
Idempotenzschlüssel.
Für das erste Read-/Write-Paar prüft der List-Handler `iam.user.read` und
eine Akteur-Mitgliedschaft. Der Create-Handler prüft `iam.user.write`,
CSRF, Account-Kontext und Idempotenz. Ein persönlicher Token darf weder
die bestehende Akteur-Auflösung noch die Fachberechtigung umgehen.

Die lesende Admin-API-Prüfung für den ersten PR verwendet die ignorierte
`config/runtime/dev.local.vars` zusammen mit `config/runtime/remote/dev.vars`
und adressiert ausdrücklich den Realm `studio-dev` auf Keycloak 26.2.4. Der
realmgebundene IAM-Service liefert keine Clients; der vorhandene Provisioner-
Zugang kann die neun Clients dieses Realms lesen. Der Browser-Client
`sva-studio` verwendet Authorization Code; `sva-studio-mcp` ist ausschließlich
ein Service-Account-Client. Ein persönlicher MCP-Client, das Attribut
`svaStudioMcpAccess` im User Profile und ein eigener MCP-Browser-Flow waren in
`studio-dev` bei der Inventur nicht vorhanden. Die zuvor mit
`apps/sva-studio-react/.env.local` betrachtete lokale Staging-Konfiguration
war für diesen PR nicht die Zielumgebung und wurde nicht verändert.

Die Konfiguration liegt inzwischen getrennt in den **Plattform-Realms**
`studio-dev`, `studio-staging` und `sva-studio`. In jedem dieser Realms ist das User-Profile-Attribut
`svaStudioMcpAccess` ausschließlich für Admins sichtbar und änderbar. Der
eigene Browser-Flow kombiniert Cookie-/Form-Anmeldung, bedingtes OTP und
einen nachgelagerten, negierten Attribut-Guard. Nur der neue öffentliche
Authorization-Code-Client `sva-studio-mcp-personal` ist daran gebunden.
Er verlangt PKCE S256, verwendet einen lokalen Loopback-Redirect und hat
einen Access-Token-Mapper für die Audience `sva-studio`. Der normale
Studio-Client und der Realm-Standardflow wurden nicht geändert.

Die erste Dev-Probe scheiterte, weil `studio-dev` synthetische Accounts mit
der E-Mail-Adresse als Login-Namen speichert; der verwendete Kurzname
führte laut Keycloak-Log zu `user_not_found`. Mit dem tatsächlich
gespeicherten Login-Namen bestanden anschließend in **allen drei Realms**
dieselben isolierten Browser-Proben: Ein Account mit
`svaStudioMcpAccess=true` erhielt per Authorization Code einen Access Token
mit dem jeweiligen Realm-Issuer, `azp=sva-studio-mcp-personal` und
`aud=sva-studio`. Ein Account ohne Attribut erhielt weder bei direkter
persönlicher Anmeldung noch nach erfolgreicher Anmeldung beim normalen
Studio-Client über dieselbe SSO-Sitzung einen persönlichen Code. Die
Negativfälle zeigten `Access denied`. Alle synthetischen Accounts und
der kurzzeitig für die Diagnose verwendete Prüfclient wurden entfernt.
Ein abschließendes Admin-API-Readback bestätigte pro Realm genau einen
persönlichen Client, dessen PKCE-, Flow- und Audience-Bindung, das
admin-only-Profilattribut, **deaktivierten** Clientstatus und keine
synthetischen Testaccounts. Kein echter Provider-Account wurde
freigeschaltet.

Die Bestandsinventur ergab 22 im Studio-Register referenzierte und in
Keycloak vorhandene Tenant-Realms, darunter zehn verschiedene Realms für
aktive Instanzen. `de-studio-sandbox` wird in Staging und Produktion
gemeinsam verwendet. Alle 22 wurden realmweise mit dem administrativ
geschützten Profilattribut, dem gebundenen Login-Flow und dem persönlichen
Client nachgerüstet; der geteilte Realm nur einmal. Die Audience wurde
jeweils gegen den tatsächlichen Tenant-Login-Client `sva-studio` oder
`sva-studio-login` gesetzt. Ein unabhängiger Admin-API-Readback bestätigte
22 von 22 Konfigurationen mit deaktiviertem Client, PKCE S256, korrekter
Flow-Bindung, admin-only-Attribut und Access-Token-Audience. Interaktive
Positiv- und Ablehnungsproben mit und ohne Studio-SSO bestanden in einem
Dev-Tenant, dem geteilten Staging-Sandbox-Realm und dem Produktions-Tenant
`bb-frankfurt-oder`; deren temporäre Testaccounts wurden entfernt.

Für künftige neue Realms erweitert der Code den bestehenden
`createProvisionInstanceAuthArtifacts`-Pfad. Die gespeicherte
`KEYCLOAK_REALM_BASELINE` und ihr Fingerprint bleiben unverändert, damit
bereits provisionierte Realms ihre Baseline-Zuordnung behalten. Nach Anlage des normalen
Tenant-Login-Clients wird derselbe persönliche Realm-Vertrag idempotent
angelegt und zurückgelesen; fehlt der Audience-Client oder scheitert der
Flow, greift die vorhandene Bereinigung des neu angelegten Realms. Ein
temporärer vollständiger Dev-Provisioning-Lauf bestätigte den deaktivierten
Client, `sva-studio-login` als Audience und das admin-only-Attribut; der
Test-Realm wurde entfernt. Diese Garantie für künftige Realms wird erst mit
dem Code-Rollout wirksam. Persönliche Clients bleiben bis zum API- und
MCP-Nachweis deaktiviert; Provider-Freigaben werden je Realm einzeln
gesetzt.

Die Realm-/Host-Bindung für den Bearer-Pfad wird ohne Browser-Client-Secret
aus Request-Host, aktivem Registry-Eintrag sowie dessen Issuer- und
Studio-Client-Werten aufgelöst.

### Live-Abnahme Task 3.5 (Dev, 2026-10-07)

Der neue Smoke-Tenant-Host wurde mit PR #1797 in die bestehende Dev-Ingress-
Route aufgenommen und mit dem regulären Build `37613696250` ausgerollt. Der
Host bestand TLS-Prüfung, lieferte `200` auf `/health/live` und leitete
`/auth/login` mit `realm=dev-mcp-smoke`, dem Studio-Client und demselben
Rückkehr-Host an Keycloak weiter.

Ein synthetischer Provider-Account im Realm `de-teststadt-dev` las die
bereitgestellte User-Collection (`200`) und legte einen isolierten Probeuser
ohne Einladungsversand an (`201`). Der Probeuser wurde über die API gelöscht
(`204`) und sein Fehlen per Readback bestätigt. Ein korrekt signierter Token
mit passender Realm-Audience, aber anderem Client, sowie Tokens aus dem
jeweils anderen Tenant-Realm wurden abgewiesen (`401`); das galt für beide
Richtungen zwischen `de-teststadt-dev` und `dev-mcp-smoke`. Der Token am
falschen Dev-Root-Host und ein abgelaufener Token wurden ebenfalls mit `401`
abgewiesen. Ein gültiger Smoke-Token am eigenen Tenant-Host erreichte die
Fachautorisierung und erhielt mangels Instanzrolle `403`. Nach Entzug von
`svaStudioMcpAccess` verweigerte Keycloak eine erneute persönliche Anmeldung
mit „Access denied“.

Im Keycloak-Account-Profil war `svaStudioMcpAccess` für den Kunden-
`system_admin` nicht sichtbar oder änderbar. Admin-Readback bestätigte nach
der Abnahme entfernte synthetische Testaccounts und deaktivierte persönliche
Clients in beiden Dev-Realms. Auch der nur für die falsche-Client-Probe
angelegte Client wurde entfernt. Staging- und Produktions-Realms wurden
nicht verändert; Tokens, Passwörter und personenbezogene Testdaten wurden
nicht in Repository oder Bericht abgelegt.

- Welche weiteren Verwaltungsrouten benötigen für ihre eigenen CSRF- oder
  Fresh-Reauth-Verträge eine Anpassung?
- Wie werden Secret-Eingaben aus einer lokalen geschützten Quelle nur für den
  konkreten Schnittstellen-Aufruf bereitgestellt, ohne in MCP-Argumenten zu
  erscheinen?

Beide Fragen sind mit dem Schnittstellen-PR beantwortet: jede Route erhält
ihren Bearer-Opt-in am bestehenden Auth-Middleware; der lokale MCP-Resolver
führt `SVA_STUDIO_MCP_INTERFACE_SECRET_COMMAND` ohne Shell mit
`{contextId}`, `{interfaceType}`, `{interfaceId}`, `{field}` und `{secretRef}`
aus. MCP-Argumente enthalten nur `{ "secretRef": "..." }`; der Resolverwert
geht einmalig im HTTPS-Request an den bestehenden verschlüsselnden
Interface-Pfad. Mainserver-Übersichten werden bei persönlichem Interface-Read
ausgelassen, Plugin-Interfaces bleiben verborgen und nicht mutierbar. Freie
Healthcheck-Statusmeldungen werden aus persönlichen HTTP-Antworten entfernt,
weil sie Providerdetails enthalten können.

### Produktionsabnahme Abschnitt 5: Zwischenstand 2026-10-07

Für die separat freigegebene Abnahme wurde `codex-mcp-test-prod` als dedizierte
Produktions-Testinstanz ohne Mainserver angelegt. Abschnitt 5 bleibt offen,
bis die fachlichen Abläufe einschließlich persönlichem MCP-Zugang und
Kundenanmeldung tatsächlich nachgewiesen sind.

Nach dem Rollout der Realm-Baseline 1.1 passten die bisherigen
Snapshot-Fingerprints nicht mehr zum aktuellen Vertrag. Der öffentliche
Status-Reader verwendet dann einen lokalen Ersatzstatus; dessen
`realmExists=false` ist kein Live-Nachweis eines fehlenden Realms. Auch der
lokale Plan kann in diesem Zustand bereits vorhandene Artefakte als fehlend
darstellen. `plan_source=local` und `worker_pending` müssen deshalb zusammen
mit den Worker-Snapshots ausgewertet werden.

Der kontrollierte Lauf `87212dba-d2f1-4cc5-b990-da6608f65d3b` nahm am
7. Oktober 2026 um 21:18 UTC einen neuen Live-Plan auf und brach vor der
Keycloak-Mutation wegen des abweichenden bestätigten Plans ab. Nach erneutem
Plan-Read war der Folgelauf `76e4e546-d31a-48ad-b659-7532b0bcff39` insgesamt
`succeeded`. Der anschließende Rollenabgleich korrigierte eine Rolle;
die tenantlokale IAM-Zugriffsprobe bestätigte um 21:19 UTC Konfiguration,
Rollenabgleich und Zugriff jeweils als `ready`.

Der anschließende direkte Keycloak-Readback bestätigte den durch diesen Lauf
angelegten öffentlichen PKCE-Client `sva-studio-mcp-personal` mit gebundenem
Browser-Flow, deaktivierten Direct Grants und deaktiviertem Service-Account.
Der Client ist bis zur persönlichen Zugangsprüfung deaktiviert.

Der Host `codex-mcp-test-prod.studio.smart-village.app` benötigt zusätzlich
die explizite Produktions-Ingressfreigabe und den Browser-CSRF-Origin.
Die versionierte Ergänzung ist erst nach dem regulären Build-/Promote-Pfad
und einem erfolgreichen HTTPS-/Login-Smoke als live abgenommen zu werten.
Aktivierung, persönlicher Provider-Zugang, fachliche Einrichtung, Einladung,
erste Kundenanmeldung und der Fall mit Mainserver sind hiermit nicht belegt.

Der folgende Abnahmeschritt verwendet zwei getrennte Testinstanzen gemäß
Task 5.2: `codex-mcp-test-prod` ohne Mainserver und
`codex-mcp-mainserver-prod` für die beauftragte Mainserver-Anbindung.
Beim ersten Tenant wurden die abhängigen Module `news`, `events`, `poi`
und `categories` über die challenge-geschützten Einzelaktionen entzogen;
der Readback bestätigt ausschließlich `media`. Organisations-Provisionierung
gegen einen Mainserver wird in diesem Fall nicht ausgeführt.

Nach zeitlich begrenzter Aktivierung des persönlichen Clients und Freigabe
ausschließlich des synthetischen Providers wurde dessen echter PKCE-Login
im lokalen stdio-MCP um 21:32 UTC erfolgreich abgeschlossen. Das beweist
die persönliche Anmeldung; Tenant-API-Zugriff und fachliche Verwaltung sind
erst nach HTTPS-Freigabe und separater Instanzaktivierung abzunehmen.

Der zweite Testtenant wurde über `studio_instance_process` angelegt;
der Keycloak-Lauf `9f3eb7dd-e664-4572-a3e0-47e73b292e9c` endete mit
`succeeded`. SMTP-Passwort und Versand sind für diesen neuen Realm noch
nicht nachgewiesen; die Einladungsabnahme ist dem ersten Testtenant zugeordnet.
Sein Host `codex-mcp-mainserver-prod.studio.smart-village.app` erhält dieselbe
explizite, versionierte Hostfreigabe und einen exakten CSRF-Origin.
Die vorhandenen Mainserver-Credentials wurden zuvor ausschließlich lesend
gegen den konfigurierten Staging-Mainserver geprüft: OAuth, GraphQL-Probe
und Provider-Identität jeweils HTTP 200. Dieser Zugangsnachweis ersetzt
weder die tenantgebundene Konfiguration noch Organisations-Provisionierung.
Alle Aufgaben unter Abschnitt 5 bleiben deshalb weiterhin offen.
