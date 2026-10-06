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

| Bereich | MCP-fähige Einzelaktionen |
| --- | --- |
| Instanzen und Module | Vorhandene Funktionen für Anlage, Plan, Bereitstellung, Diagnose, Aktivierung und spätere Änderung verwenden. |
| Schnittstellen | Beauftragte Typen auflisten, konfigurieren, prüfen, ändern und löschen. |
| Accounts | Suchen, lesen, anlegen, ändern, einladen, deaktivieren und nach bestehendem Vertrag löschen. |
| Rollen und Gruppen | Lesen, anlegen, ändern, zuweisen, entziehen und löschen, soweit Studio dies unterstützt. |
| Organisationen | Kundenorganisation und optionale weitere Organisationen anlegen, ändern, Mitgliedschaften verwalten und löschen; Mainserver-Zugang nur bei entsprechendem Auftrag provisionieren und prüfen. |

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

| Grenze | Fehlermodus | Nachweis vor Abschluss |
| --- | --- | --- |
| Anmeldung und Realm | Ein Token des Plattform- oder Nachbar-Tenants wird am falschen Host akzeptiert oder ein Kunden-Admin erhält trotz eigener MCP-Installation einen MCP-Token. | Keycloak-Test: Token-Ausgabe für Kunden-`system_admin` verweigert, für freigegebenen Provider erlaubt; Studio-Negativtests für falsche Clients, Hosts, Realms und abgelaufene Tokens. |
| Autorisierung | Der API-Pfad umgeht Browser-Guards, CSRF- oder Fresh-Reauth-Semantik oder die fachliche Action-Prüfung. | Contract-Tests derselben IAM-Aktionen über Session und persönliche API-Anmeldung, einschließlich verweigerter Mutationen und sensibler Aktionen; ungültiger Bearer mit gültigem Cookie bleibt abgewiesen. |
| Routengrenze | Ein allgemeiner Aufruf erreicht Fachinhalte, fremde Hosts oder interne Endpunkte. | Tests für Pfadnormalisierung, Redirects, Methoden und erlaubte Verwaltungsrouten; Server-Autorisierung separat prüfen. |
| Unklarer Write-Ausgang | Timeout führt zu doppelter Einladung, Anlage oder Löschung. | Fehlerfalltest mit Write vor Antwort; Zustand/Idempotenz vor erneutem Aufruf lesen und unklare Ergebnisse sichtbar lassen. |
| Secrets und PII | MCP-Argumente, Tool-Antworten oder Logs enthalten Zugangsdaten oder Einladungslinks. | Redaction- und Negativtests an Eingabe-, Ausgabe- und Log-Grenzen; secrettragende Interface-Mutationen nur mit lokalem geschütztem Bezug. |
| Übergabe | Technisches `active` wird als abgeschlossene Kundeneinrichtung ausgegeben oder die Create-API versendet die Einladung zu früh. | End-to-End-Abnahme mit und ohne Mainserver: Kunden-Admin ohne Versand anlegen, `not_requested` und Ressourcen sowie Provider-Zugriff vor Einladung prüfen; Versandstatus danach; erste Kundenanmeldung separat. |

Die Umsetzung wird an der jeweils aktuellen Codebasis und den parallel
laufenden Instanz-Changes geprüft. Diese Tabelle ist ein Plan für Belege,
keine Behauptung bereits bestandener Abnahme.

## Offene Implementierungsprüfung

### Inventar für den ersten PR (Quellstand `db330c730`)

Die vorhandene Route-Map bietet `GET` und `POST /api/v1/iam/users` als
kleinstes direkt prüfbares Read-/Write-Paar. Sie enthält außerdem Einzelrouten
für Nutzeränderung, Deaktivierung, Löschung und Einladung, Rollen, Gruppen,
Organisationen und Mitgliedschaften. Die Bulk-Routen, Profilrouten und
redaktionellen Routen gehören nicht zur Freigabe des allgemeinen MCP-Zugangs.
Die Instanzrouten besitzen bereits einen separaten Service-Token-Pfad; dieser
Vertrag bleibt bestehen.
Die allgemeine Schnittstellenverwaltung liegt dagegen derzeit in
`apps/sva-studio-react/src/lib/interfaces-api.ts` als TanStack-Server-Funktionen
für Liste, Upsert und Delete. In der IAM-HTTP-Route-Map gibt es dafür keine
entsprechenden Verwaltungsrouten. Diese Lücke gehört erst zum dritten
PR-Kandidaten.

Die IAM-Account-Handler laufen durch `withAuthenticatedIamHandler` und
`withAuthenticatedUser`, die derzeit ausschließlich eine Cookie-Session
auflösen. Gruppen und Organisationen verwenden denselben Auth-Kern über eigene
Wrapper. `withAuthenticatedUser` prüft den Tenant-Host, die Account-Lifecycle-
Sperre und die Legal-Text-Compliance. Schreibaktionen prüfen zusätzlich ihre
bestehenden Action-, Rollen-, Tenant-, CSRF- und Idempotenzverträge. Der neue
persönliche Bearer-Pfad muss daher die Identität vor diesen fachlichen Guards
auflösen und die abweichende CSRF-Semantik für Bearer-Requests ausdrücklich
begrenzen; ein ungültiger Authorization-Header darf nie in den Cookie-Pfad
fallen. Die heutige Instanz-Serviceauthentisierung zeigt bereits dieses
Fail-Closed-Muster, ist aber keine persönliche Tenant-Identität.

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

Vor einer Aktivierung bleiben der Nachweis mit einem echten Kunden-
`system_admin`, die Selbständerungs-Negativprobe des Profilattributs und
die persönliche Studio-API-Anmeldung des ersten PRs offen. Für den
Bearer-Pfad ist außerdem festzulegen, wie Issuer und Tenant-Host ohne den
nur für den Browser-Login benötigten Client-Secret-Lookup gebunden werden.

- Wie werden der Kunden-`system_admin` und die untersagte Selbständerung
  des Attributs ohne produktive Kundendaten nachgewiesen?
- Wie werden Issuer, Audience und Tenant-Host beim persönlichen Bearer-Pfad
  gebunden, ohne den Browser-Client-Secret-Lookup zu übernehmen?
- Welche Endpunkte brauchen neben der neuen Anmeldung eine Anpassung ihrer
  CSRF- oder Fresh-Reauth-Prüfung für API-Aufrufe?
- Wie werden Secret-Eingaben aus einer lokalen geschützten Quelle nur für den
  konkreten Schnittstellen-Aufruf bereitgestellt, ohne in MCP-Argumenten zu
  erscheinen?
