# Instanzverwaltung als Keycloak-Control-Plane

## Ziel

Dieses Dokument beschreibt den kanonischen Betriebs- und Bedienpfad für tenant-spezifisches Keycloak-Provisioning über die Root-Host-Instanzverwaltung unter `/admin/instances`.

Es beschreibt ausschließlich den verbindlichen Sollzustand. Abweichungen einer
aktuellen UI-, API-, MCP- oder Worker-Implementierung werden außerhalb dieses
Dokuments erhoben und priorisiert. Aus einer hier beschriebenen Anforderung darf
daher nicht abgeleitet werden, dass sie bereits vollständig umgesetzt ist.

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

## Verbindliche Ziel-Checkliste

Die Instanzverwaltung und der Provisioning-Worker verwenden für den fachlichen Mindestzustand dieselbe kompakte Checkliste. Jeder login-blockierende Punkt muss im Detailstatus und nach dem letzten erfolgreichen Run grün sein; ausdrücklich nicht blockierende Interop-Punkte dürfen als Warnung bestehen bleiben.

| Pflichtpunkt                         | Führende Quelle in Studio/Registry              | Zielartefakt in Keycloak                      | Prüfkriterium                                                                                                                                              | Automatische Aktion beziehungsweise Fallback                                                                                                     |
| ------------------------------------ | ----------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Realm                                | `realmMode`, `authRealm`                        | Realm `<authRealm>`                           | Realm existiert oder darf im Modus `new` erstellt werden                                                                                                   | Realm anlegen oder Bestands-Realm validieren                                                                                                     |
| OIDC-Client                          | `authClientId`                                  | Client `<authClientId>`                       | Client existiert                                                                                                                                           | Client anlegen oder aktualisieren                                                                                                                |
| Tenant-Admin-Client                  | `tenantAdminClient.clientId`                    | Client `<tenantAdminClient.clientId>`         | Technischer Client existiert und ist auf tenantlokale Administration begrenzt                                                                              | Client anlegen oder aktualisieren und Service-Account-Rechte abgleichen                                                                          |
| Redirect-URIs                        | `instanceId`, `parentDomain`, `primaryHostname` | `client.redirectUris`                         | Redirect-Ziele stimmen exakt                                                                                                                               | Client-URLs abgleichen                                                                                                                           |
| Logout-URIs                          | `instanceId`, `parentDomain`, `primaryHostname` | `client.attributes.post.logout.redirect.uris` | Logout-Ziele stimmen exakt                                                                                                                                 | Client-URLs abgleichen                                                                                                                           |
| Web-Origins                          | `instanceId`, `parentDomain`, `primaryHostname` | `client.webOrigins`                           | Origins stimmen exakt                                                                                                                                      | Client-URLs abgleichen                                                                                                                           |
| Plugin-OIDC-Clients                  | OIDC-Verträge der zugewiesenen Plugins          | Plugin-Clients und Audience-Mapper            | Alle für aktive Module deklarierten Clients und Mapper stimmen mit ihren Verträgen überein                                                                 | Vertragsgebunden anlegen oder aktualisieren; ohne aktiven Vertrag nichts kopieren                                                                |
| Tenant-Secret                        | `authClientSecret`                              | Client-Secret des Login-Clients               | `existing`: Registry-Secret und Keycloak-Secret sind identisch. `new`: Secret wird beim Provisioning erzeugt und danach in die Registry zurückgeschrieben. | Secret setzen, erzeugen, rotieren und Rückschreiben in die Registry                                                                              |
| Tenant-Admin-Client-Secret           | `tenantAdminClient.secretConfigured`            | Client-Secret des Tenant-Admin-Clients        | Registry-Secret und Keycloak-Secret sind identisch                                                                                                         | Secret erzeugen oder abgleichen und ausschließlich verschlüsselt speichern                                                                       |
| Tenant-Admin                         | `tenantAdminBootstrap.*`                        | User `<username>`                             | User existiert und ist aktiviert                                                                                                                           | User anlegen oder aktualisieren                                                                                                                  |
| Rolle `system_admin`                 | `instanceId`, `tenantAdminBootstrap.username`   | Realm-Rolle und Rollenzuweisung               | Rolle existiert mit korrekter Instanzzuordnung und ist dem Tenant-Admin zugewiesen                                                                         | Rolle und Zuweisung synchronisieren                                                                                                              |
| Ausschluss `instance_registry_admin` | `tenantAdminBootstrap.username`                 | Realm-Rolle auf Tenant-Admin                  | Rolle ist nicht zugewiesen                                                                                                                                 | Unzulässige Plattformrolle nicht vergeben beziehungsweise entfernen                                                                              |
| `instanceId`-Mapper                  | `instanceId`                                    | Protocol Mapper `instanceId`                  | Mapper existiert am Login-Client                                                                                                                           | Bei neuen Realms automatisch anlegen oder korrigieren; bei Bestands-Realms nur als ausdrücklich geplanter Bestandteil des Studio-Vertrags ändern |
| User-Attribut `instanceId`           | `instanceId`, `tenantAdminBootstrap.username`   | `attributes.instanceId` am Tenant-Admin       | Optionales, nicht für den New-Realm-Zielzustand erforderliches Interop-Artefakt                                                                            | Nur bei einem konkreten Integrationsvertrag pflegen                                                                                              |

Wichtig:

- Diese Checkliste ist bewusst klein. Realm, Client, URLs, Secrets, Tenant-Admin und Rollen sind login-blockierend; Mapper und User-Attribut bleiben sichtbare Interop-/Diagnosepunkte.
- Die UI-Schritte `Realm`, `Client`, `Mapper`, `Tenant-Secret` und `Tenant-Admin` gruppieren jeweils genau diese Pflichtpunkte.
- Ein Provisioning-Lauf gilt für den Login-Pfad als erfolgreich, wenn alle login-blockierenden Punkte erfüllt sind. Optionale Interop-Hinweise dürfen danach weiter sichtbar bleiben.
- Bei `realmMode = new` darf kein Punkt des erweiterten Realm-Zielzustands stillschweigend entfallen: Entweder stellt das Provisioning ihn automatisch her oder Plan, Run-Protokoll und Detailstatus nennen ihn als konkrete manuelle Nacharbeit.

## Erweiterte Ziel-Checkliste für neue Realms

Die folgende Checkliste ergänzt den login-blockierenden Mindestzustand um den
betrieblichen Zielzustand eines neuen Realms. `Manuell` bedeutet nicht optional:
Der Punkt muss nach dem Provisioning ausdrücklich als Nacharbeit angezeigt und
vor der Freigabe geprüft werden. Ob eine offene Nacharbeit die Aktivierung
blockiert oder nur als Warnung bestehen darf, richtet sich nach der Spalte
`Freigabe`.

Für neue Realms zeigt Plan, Run-Protokoll und Detailstatus die automatische
Baseline und die verbleibende manuelle SMTP-Passwort-Nacharbeit. Bestands-Realms
werden nicht auf diese erweiterte New-Realm-Baseline migriert. Änderungen an
ihnen bleiben auf die ausdrücklich geplanten, eindeutig Studio-eigenen
Artefakte ihres Bestandsvertrags begrenzt.
Beim Laden von Detailstatus und Plan wird für Studio-erstellte Realms
ausschließlich der Boolesche Nachweis, ob ein SMTP-Passwort gesetzt ist,
tenantlokal live aktualisiert. Ist dieser Read nicht möglich, bleibt der letzte
Snapshot konservativ sichtbar; ein Passwortwert wird weder gelesen noch
gespeichert. Reine Sternmasken gelten nicht als erfolgreicher Nachweis. Die
Zuordnung als Studio-erstellter Realm bleibt nur erhalten, solange der
zugehörige Status-Snapshot zum aktuellen `authRealm` passt.

| Bereich              | Zielzustand im neuen Realm                                                                                                                            | Behandlung bei `realmMode = new`                                                                                                                                                                           | Freigabe                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Realm-Basis          | Realm ist aktiviert und besitzt einen nachvollziehbaren Anzeigenamen.                                                                                 | Automatisch; Realmname und technischer Anzeigename werden aus der `instanceId` abgeleitet.                                                                                                                 | Blockierend.                                                                                                           |
| Login-Client         | Vertraulicher OIDC-Client mit Standard Flow, exakten Tenant-URLs und ohne fremde oder Wildcard-Redirects.                                             | Automatisch aus `authClientId`, `instanceId`, `parentDomain` und `primaryHostname`.                                                                                                                        | Blockierend.                                                                                                           |
| Tenant-Admin-Client  | Separater Service-Account-Client mit ausschließlich tenantlokalen Admin-Rechten.                                                                      | Automatisch, sofern der Client-Vertrag in der Registry vollständig ist. Fehlende Registry-Pflichtwerte blockieren den Preflight.                                                                           | Blockierend für tenantlokale IAM-Administration.                                                                       |
| Plugin-OIDC-Clients  | Nur Clients und Audience-Mapper der tatsächlich zugewiesenen Module sind vorhanden.                                                                   | Automatisch aus den Plugin-Verträgen; keine Übernahme aus einem Referenz-Realm.                                                                                                                            | Blockierend für das betroffene aktive Modul, sonst nicht anwendbar.                                                    |
| Secrets              | Login- und Tenant-Admin-Client-Secrets stimmen zwischen Keycloak und Registry überein.                                                                | Automatisch erzeugen oder abgleichen und ausschließlich verschlüsselt speichern. Maskierte Werte wie `********` niemals übernehmen.                                                                        | Blockierend.                                                                                                           |
| Tenant-Admin         | Aktiver Bootstrap-Benutzer mit vollständigem Profil und `system_admin`, ohne `instance_registry_admin`.                                               | Automatisch aus `tenantAdminBootstrap.*`; lokale Studio-Rollenbindung im selben Provisionierungsablauf nachziehen.                                                                                         | Blockierend.                                                                                                           |
| Benutzerprofil       | Die Attribute `instanceId`, `mainserverUserApplicationId` und `mainserverUserApplicationSecret` sind administrativ geschützt.                         | Bei neuen Realms automatisch additiv ergänzen; fremde und Keycloak-eigene Attribute bleiben erhalten.                                                                                                      | Blockierend für den automatischen Baseline-Abschluss.                                                                  |
| `instanceId`-Interop | Der `instanceId`-Mapper am Login-Client ist vorhanden.                                                                                                | Bei neuen Realms automatisch anlegen oder korrigieren. Für Bestands-Realms entsteht daraus keine allgemeine Baseline-Migration; maßgeblich ist ausschließlich ihr ausdrücklich bestätigter Studio-Vertrag. | Blockierend für den automatischen Baseline-Abschluss.                                                                  |
| Login-Theme          | Das Login-Theme `sva-kern2` ist gesetzt.                                                                                                              | Bei neuen Realms automatisch setzen. Die Theme-Dateien selbst werden serverseitig mit der Keycloak-Installation ausgeliefert.                                                                              | Blockierend für den automatischen Baseline-Abschluss.                                                                  |
| Dark Mode            | Das Realm-Attribut `darkMode` ist aktiviert.                                                                                                          | Bei neuen Realms automatisch setzen.                                                                                                                                                                       | Blockierend für den automatischen Baseline-Abschluss.                                                                  |
| Lokalisierung        | Internationalisierung ist aktiviert; einzige und standardmäßige Sprache ist `de`.                                                                     | Bei neuen Realms automatisch setzen.                                                                                                                                                                       | Blockierend für den automatischen Baseline-Abschluss.                                                                  |
| Keycloak-E-Mail      | Nicht geheime SMTP-Werte entsprechen der Baseline; das Passwort ist pro Realm gesetzt.                                                                | Host, Port, Absender, Benutzername und Transportwerte automatisch setzen. Nur das Passwort einmalig direkt in Keycloak eintragen; es wird nie in Studio übernommen.                                        | Das fehlende Passwort bleibt als manuelle Nacharbeit sichtbar, blockiert den technischen Provisioning-Lauf aber nicht. |
| Account Recovery     | Passwort-Reset ist aktiviert, E-Mail-Verifizierung bleibt gemäß Baseline deaktiviert.                                                                 | Bei neuen Realms automatisch setzen. Nach dem manuellen SMTP-Passwort sollte die Verbindung operativ in Keycloak getestet werden.                                                                          | Baseline blockierend; SMTP-Funktionstest ist betriebliche Abnahme.                                                     |
| Events und Audit     | User- und Admin-Events sind aktiv, Details deaktiviert und die Aufbewahrung beträgt sieben Tage.                                                      | Bei neuen Realms automatisch setzen.                                                                                                                                                                       | Blockierend für den automatischen Baseline-Abschluss.                                                                  |
| Sicherheitshärtung   | Passwort-Policy, Brute-Force-Schutz, MFA/WebAuthn, Session-/Token-Laufzeiten und Schlüsselrotation entsprechen einem gesondert freigegebenen Vertrag. | Nicht Teil dieser Baseline und daher keine manuelle Standardnacharbeit; niemals ungeprüft aus `bb-guben` ableiten.                                                                                         | Nur bei gesondertem Vertrag relevant.                                                                                  |
| Externe Identitäten  | Identity Provider und User Federation existieren nur bei einem freigegebenen Tenant-Vertrag.                                                          | Nicht Teil dieser Baseline und daher keine manuelle Standardnacharbeit; niemals aus einem anderen Realm kopieren.                                                                                          | Nur bei gesondertem Vertrag relevant.                                                                                  |

### Anforderungen an Hinweise zu manuellen Nacharbeiten

Solange ein Zielpunkt nicht automatisiert werden kann, müssen Plan, Run-Protokoll und Detailstatus mindestens enthalten:

- den betroffenen Zielpunkt,
- den Grund, warum keine automatische Änderung erfolgt,
- die konkrete manuelle Aktion ohne Secret-Werte,
- die Einstufung als `blockierend`, `Warnung` oder `nicht anwendbar`,
- den Hinweis, dass nach der manuellen Änderung ein Readback beziehungsweise Smoke-Nachweis erforderlich ist.

Ein technischer Erfolg des automatischen Provisioning-Anteils darf offene blockierende Nacharbeiten nicht als vollständig betriebsbereiten Realm darstellen. Warnungen dürfen bestehen bleiben, müssen aber vor der Aktivierung bewusst geprüft und dokumentiert werden.

## Vorbedingungen und Entkopplung der Tenant-Anlage

Die fachliche Tenant-Anlage und die technische Bereitstellung sind zwei getrennte
Vorgänge:

1. **Tenant anlegen:** Stammdaten und primären Host eindeutig und dauerhaft in
   der Registry speichern.
2. **Tenant bereitstellen:** Keycloak, Background-Prozesse, Ingress, Module und
   weitere technische Zielsysteme gegen den gespeicherten Sollzustand abgleichen.
3. **Tenant aktivieren:** Erst nach vollständigem Betriebsnachweis für die
   produktive Nutzung freigeben.

Dieser Ablauf gilt unverändert für alle Betriebsprofile einschließlich der
Kasseler Standalone-Installation. Umgebungsspezifische Provisioner dürfen
einzelne technische Bereitstellungsschritte wie Ingress oder TLS übernehmen,
aber weder Create-Gates und Fehlerklassen umgehen noch einen abweichenden
Tenant-Lebenszyklus oder eine automatische Aktivierung einführen.

Fehlende, nicht erreichbare oder blockierte Background-Prozesse dürfen die
fachliche Tenant-Anlage nicht verhindern. Der Tenant wird in diesem Fall mit
der fachlichen Zustandsklasse `Bereitstellung wartet` oder
`Bereitstellung blockiert` gespeichert. Die technische Abbildung dieser
Zustandsklassen wird im Umsetzungsvorhaben festgelegt. Es darf weder ein nicht
angenommener Auftrag als eingeplant dargestellt noch ein technischer Teilerfolg
als Betriebsbereitschaft ausgegeben werden.

Keycloak ist hiervon ausdrücklich ausgenommen. Die Tenant-Erstellung benötigt
eine aktuelle, erfolgreiche Keycloak-Verfügbarkeits- und Berechtigungsprüfung.
Ist Keycloak nicht erreichbar oder kann der vorgesehene Realm nicht verlässlich
gelesen beziehungsweise angelegt werden, darf kein neuer Tenant gespeichert
werden.

Für Realm-Katalog, Readback und Berechtigungsnachweis wird ausschließlich die
bestehende Provisioner-Identität aus `SVA_KEYCLOAK_PROVISIONER_*` verwendet;
Tenant-Admin- oder Browser-Credentials sind dafür unzulässig. Sie authentisiert
sich gegen den Admin-Realm `master`. Für neue Realms weist ihr Access-Token die
globale Realm-Rolle `create-realm` oder deren `admin`-Oberrolle nach; die
Realm-Liste und der konkrete Readback müssen zusätzlich mit genau dieser
Identität erfolgreich sein. Für einen Bestands-Realm genügen die jeweils
realmbezogenen Lese-/Query-Rechte. Schreibrechte auf Clients, Benutzer und
Rollen werden erst im getrennten, bestätigten Provisioning benötigt. Der
Readiness-Pfad probiert keine Berechtigung durch eine Testmutation aus und
speichert weder Token noch Providerfehlertext.

Die öffentlichen Endpunkte für Realm-Katalog, Draft-Readiness und
Registry-Create bleiben am App-Dienst. Dieser leitet exakt diese Methoden und
Pfade über `http://provisioner:3000` weiter. Der private Provisioner übernimmt
den Request unverändert hinsichtlich Session beziehungsweise Bearer-Token,
Origin, CSRF-Header und Idempotency-Key und prüft Authentifizierung, CSRF und
`instance.create` selbst erneut. Ein nicht erreichbarer oder falsch
konfigurierter interner Dienst endet fail-closed mit `503`; es gibt für diese
Endpunkte keinen lokalen Fallback auf die weniger privilegierte
Keycloak-Admin-Identität des App-Prozesses.

### Frühzeitige Bereitschaftsprüfung

Vor der verbindlichen Bestätigung der Tenant-Anlage führt Studio eine
read-only Bereitschaftsprüfung aus. Sie unterscheidet mindestens:

- **Blocker der Tenant-Anlage:** fehlende Berechtigung, ungültige Pflichtdaten,
  reservierte oder bereits vergebene Identitäten und Hosts, eine nicht mögliche
  Registry-Persistenz, ein nicht erreichbares Keycloak oder ein nicht
  ausreichend berechtigter Keycloak-Admin-Zugang. Bei `existing` blockieren
  zusätzlich eine nicht mögliche Realm-Auflistung, ein nicht lesbarer Realm und
  nicht automatisch behebbare Realm-Abweichungen. Diese Befunde müssen vor dem
  Speichern behoben werden.
- **Blocker der technischen Bereitstellung:** fehlende oder blockierte Queue,
  Worker, Callback- oder Provisioner-Fähigkeit, nicht erreichbare nachgelagerte
  Zielsysteme außerhalb Keycloaks, fehlende Credentials dieser Zielsysteme
  sowie noch nicht erfüllte Modul- oder Plugin-Vorbedingungen. Diese Befunde
  verhindern nicht das Speichern des Tenants, wohl aber den Start oder Abschluss
  der betroffenen technischen Schritte.
- **Blocker der Aktivierung:** offene Provisionierungsfehler, manuelle
  Nacharbeiten oder fehlende Betriebsnachweise. Sie verhindern weder die Anlage
  noch die Korrektur des Tenants, aber seine produktive Freigabe.

Der Benutzer erhält das Ergebnis noch vor der Bestätigung. Die Darstellung sagt
ausdrücklich, ob die Tenant-Anlage möglich ist, welche Bereitstellungsschritte
noch nicht ausgeführt werden können, welche Auswirkung das hat und was geändert
oder durch den Betrieb bereitgestellt werden muss. Ändert sich die Lage zwischen
Prüfung und Speicherung, wird die Klassifizierung erneut angewendet. Wird
Keycloak vor dem verbindlichen Speichern unerreichbar, wird die Tenant-Anlage
abgebrochen. Tritt der Ausfall erst nach erfolgreicher Registry-Persistenz ein,
bleibt der bereits angelegte Tenant erhalten und der neue Bereitstellungsblocker
wird direkt an ihm angezeigt.

Nach der Tenant-Anlage wird vor jeder Keycloak-Mutation die technische
Bereitschaft erneut geprüft. Ein zu diesem Zeitpunkt blockierter technischer
Preflight verhindert ausschließlich die Mutation und entfernt den bereits
angelegten Tenant nicht.

## Realm-Modi

### Neuer Realm

Verwendung für neue Tenants ohne vorhandenen Realm.

Sollverhalten:

- `authRealm`, `authClientId`, Tenant-Admin-Client, primärer Host und öffentliche
  Issuer-URL werden aus den fachlichen Eingaben und dem freigegebenen
  Umgebungskontext abgeleitet; sie sind keine freien Benutzereingaben
- Realm wird erstellt
- Login-Client wird erstellt oder vollständig eingerichtet
- Client-Secret wird von Keycloak erzeugt und anschließend in der Registry gespeichert
- `instanceId`-Mapper wird bei neuen Realms automatisch angelegt
- Realm-Rollen werden sichergestellt
- Tenant-Admin wird angelegt oder aktualisiert

### Bestehender Realm

Verwendung für Tenants mit bereits vorhandenem Realm.

Sollverhalten:

- der Realm wird über eine durchsuchbare Auswahl aus den aktuell in Keycloak
  lesbaren Realms gewählt; eine freie Texteingabe ist nicht der reguläre Pfad
- der System-Realm `master` und bereits einer anderen Studio-Instanz zugeordnete
  Realms bleiben zur Erklärung sichtbar, sind aber nicht auswählbar
- Realm-Auswahl und Eignungsprüfung erfolgen read-only
- bestehende Drift wird im Plan angezeigt
- nur der dokumentierte, eindeutig Studio-eigene Sollzustand wird nach
  ausdrücklicher Bestätigung korrigiert
- kein stilles Fallback auf "Realm neu erstellen"

Nach der Auswahl ordnet die Eignungsprüfung den Realm genau einer der folgenden
Klassen zu:

- **Bereit:** Alle Voraussetzungen für die Tenant-Anlage sind erfüllt.
- **Automatisch ergänzbar:** Es fehlen ausschließlich eindeutig Studio-eigene
  Artefakte oder Werte. Vor der Tenant-Anlage wird ein konkreter Änderungsplan
  angezeigt; angewendet wird er erst im ausdrücklich bestätigten Provisioning.
- **Manuelle Klärung erforderlich:** Es bestehen Konflikte unklarer
  Eigentümerschaft oder nicht automatisch verwaltete Realm-Voraussetzungen. Die
  Tenant-Anlage bleibt bis zur Behebung und erneuten Read-only-Prüfung gesperrt.

Studio darf im bestätigten Provisioning ausschließlich folgende Artefakte eines
Bestands-Realms automatisch anlegen oder auf den dokumentierten Vertrag
abgleichen:

- Login-Client und Tenant-Admin-Client,
- tenant-spezifische Redirect-, Logout- und Origin-Werte,
- erforderliche Studio-Rollen und deren dokumentierte Zuweisungen,
- vertraglich geforderte Protocol Mapper,
- Tenant-Admin-Bootstrap,
- zugehörige Secrets über den sicheren Provisionierungspfad.

Studio verändert in einem Bestands-Realm nicht automatisch:

- fremde Clients, Rollen oder Benutzer,
- Identity Provider oder User Federation,
- SMTP-Zugangsdaten,
- Passwort-, MFA-, Session- oder Token-Richtlinien,
- andere realmweite Sicherheitseinstellungen,
- widersprüchliche Artefakte mit unklarer Eigentümerschaft.

## Geführter Soll-Ablauf

Die Tenant-Erstellung folgt einem festen Ablauf:

1. fachliche Angaben erfassen
2. technische Werte ableiten beziehungsweise bei `existing` einen verfügbaren
   Realm auswählen
3. Eingaben, Keycloak-Verfügbarkeit und Realm-Eignung read-only prüfen
4. Auswirkungen und offene Vorbedingungen vor der Bestätigung anzeigen
5. Tenant in der Registry anlegen
6. mögliche Bereitstellungsschritte starten
7. wartende oder blockierte Schritte mit Behebung anzeigen
8. Betriebsnachweise erbringen und Tenant aktivieren

Kassel verwendet denselben Ablauf. Der Kasseler Provisioner ist innerhalb
dieses Flows ausschließlich Ausführer der für dieses Betriebsprofil
erforderlichen technischen Schritte. Er ist keine zweite Control Plane und
darf den manuellen Aktivierungsschritt nicht ersetzen.

Die UI trennt bewusst zwischen:

- `Instanz anlegen`
- `Bereitstellung starten oder fortsetzen`

### UI-Zielbild

Einsteiger und Experten verwenden denselben vierstufigen Flow. Experten
erhalten zusätzliche Informationen über `Technische Details`, aber keinen
abweichenden Anlage- oder Provisioning-Pfad:

1. **Instanz:** Anzeigename, freigegebene Domain und Vorschau der späteren
   Adresse. Die abgeleitete Instanz-ID ist nur in den technischen Details vor
   der Anlage änderbar.
2. **Nutzer-Datenbank (Keycloak-Realm):** Eine neue Nutzer-Datenbank
   erstellen oder eine vorhandene Nutzer-Datenbank über die durchsuchbare
   Realm-Auswahl wählen. Die UI zeigt danach die Eignung und geplante
   Ergänzungen.
3. **Erster Administrator:** Benutzername, gültige E-Mail-Adresse, Vorname und
   Nachname vollständig erfassen.
4. **Prüfen und anlegen:** Serverseitige Befunde als
   `Vor der Anlage zu beheben`, `Wird von Studio eingerichtet` und
   `Vor der Aktivierung noch erforderlich` darstellen.

Die Oberfläche verwendet im geführten Pfad durchgängig die Bezeichnung
`Nutzer-Datenbank (Keycloak-Realm)`. Rein technische Ansichten dürfen
weiterhin von `Realm` sprechen.

Die Studio-Instanz wird aus dem Umgebungskontext ermittelt, read-only
angezeigt und nicht vom Benutzer gewählt. Die beiden bestehenden
Studio-Instanzen heißen in der UI exakt:

- `Smart Village App`
- `KasselDIALOG`

Interne Bezeichnungen wie `Kassel`, `Standalone` oder technische
Profilkennungen ersetzen diese Anzeigenamen nicht. Beide Studio-Instanzen
verwenden denselben fachlichen Flow.

Auth-Client-ID, Issuer-URL, Tenant-Admin-Client-ID, Hostname und der Name einer
neuen Nutzer-Datenbank werden, soweit eindeutig möglich, aus Vertrag und
Umgebung abgeleitet. Sie sind im Standardpfad keine freien Eingaben. Ein noch
fehlendes Secret eines Bestands-Realm wird als spätere Bereitstellungs- und
Aktivierungsvoraussetzung angezeigt und blockiert die fachliche Anlage nicht.

Nach `Instanz anlegen` führt die UI direkt in ein gemeinsames
Einrichtungscockpit. Dieses zeigt Anlage, Vorbereitung, Bestätigung,
technische Bereitstellung, Betriebsprüfung und manuelle Aktivierung als eine
Fortschrittsfolge. Es hebt höchstens eine serverseitig erlaubte nächste Aktion
hervor. Preflight, Keycloak-Status und Plan werden automatisch geladen oder
gemeinsam über `Erneut prüfen` aktualisiert.

Die separate Setup-Strecke, clientseitig konstruierte Readiness,
frei editierbare technische Standardfelder und parallele Hauptaktionen für
Preflight, Status, Plan und Provisioning entfallen. Diagnose, Plan-Fingerprint,
Run-/Request-IDs, Historie sowie gezielte Wartungsaktionen bleiben unter
`Technische Details` verfügbar.

Zusatzaktionen wie `Tenant-Admin zurücksetzen` oder `Client-Secret rotieren` laufen als benannte Provisioning-Intents und nicht mehr als unscharfer Sammel-Reconcile.

Wichtig:

- `Tenant-Admin zurücksetzen` ist ein User-Pfad. Dieser Intent korrigiert Tenant-Admin-Profil, Rollen und optional das temporäre Passwort, überschreibt aber nicht nebenbei Login- oder Tenant-Admin-Client-Konfigurationen.
- Wenn der Plan beim Schritt `Tenant-Admin-Client` ein `update` meldet, muss die
  beabsichtigte Änderung an Root-, Redirect-, Logout- oder Origin-Werten vor der
  Ausführung ausdrücklich sichtbar sein.

## Kompakte Betriebs-Checkliste für neue Instanzen

Diese Kurzfassung ist der empfohlene operative Standardpfad für neue oder zu reparierende Instanzen unter `/admin/instances`.

1. Neue Instanz vorbereiten oder bestehende Instanz öffnen.
2. Unter `Nutzer-Datenbank (Keycloak-Realm)` wählen:
   - neue Nutzer-Datenbank erstellen
   - vorhandene Nutzer-Datenbank aus der durchsuchbaren Auswahl verwenden
3. Pflichtwerte prüfen:
   - Anzeigename
   - freigegebene Domain und resultierende Adresse
   - abgeleitete Instanz-ID unter `Technische Details`
   - bei einer vorhandenen Nutzer-Datenbank die aktuelle Realm-Eignung
4. Tenant-Admin-Stammdaten vollständig pflegen:
   - `username`
   - `email`
   - `firstName`
   - `lastName`
5. Bei einer vorhandenen Nutzer-Datenbank ein fehlendes Tenant-Secret als
   spätere Bereitstellungs- und Aktivierungsvoraussetzung ausweisen.
6. Read-only Bereitschaftsprüfung ausführen und Anlage-, Bereitstellungs- und
   Aktivierungsblocker unterscheiden.
7. Vor der Bestätigung anzeigen, ob Keycloak und der Realm die Anlage erlauben
   und welche nachgelagerten technischen Schritte warten oder blockiert sein
   werden.
8. `Instanz anlegen`. Technische Bereitstellungsblocker verhindern diesen
   Schritt nicht; fehlende Keycloak-Verfügbarkeit verhindert ihn.
9. Im gemeinsamen Einrichtungscockpit die serverseitig erlaubte nächste
   Aktion ausführen und den Provisioning-Plan vor einer Mutation bestätigen.
10. Technische Bereitstellung starten beziehungsweise fortsetzen.
11. Das SMTP-Passwort einmalig direkt in Keycloak setzen und die Verbindung dort testen.
12. Wenn `Tenant client secret aligned with Keycloak` noch nicht grün ist:
    - `Rotate client secret`
    - danach Status erneut laden und nur bei weiterem Drift erneut provisionieren
13. Erst wenn alle login-blockierenden Checklistenpunkte und manuellen Blocker grün sind:
    - `Instanz aktivieren`

## Chronologischer Sollprozess und Fehlermatrix

Die folgende Übersicht beschreibt das gewünschte Verhalten unabhängig von der
aktuellen UI-, API-, MCP- oder Worker-Umsetzung. Jeder Fehler muss einem
betroffenen Eingabewert oder Prozessschritt zugeordnet sein. Die Meldung nennt
in verständlicher Sprache Ursache, Auswirkung, erforderliche Änderung und den
anschließend auszuführenden Schritt.

| Nr. | Aktivität                                         | Mögliche Fehler oder offene Vorbedingung                                                                                                                                                                                                                                                                     | Verbindliches Sollverhalten und Behebung                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Fachliche Tenant-Daten erfassen                   | Pflichtangabe fehlt; Instanz-ID, Name oder Administrator ist ungültig; Wert enthält unzulässige Zeichen.                                                                                                                                                                                                     | Eingaben werden unmittelbar am Feld geprüft. Die Meldung nennt das erwartete Format und bietet, soweit eindeutig möglich, einen gültigen Vorschlag an.                                                                                                                                 |
| 2   | Technische Werte bestimmen                        | Instanz-ID, Host, Realm oder Client-ID ist reserviert, bereits vergeben oder widersprüchlich; ein bestehender Realm beziehungsweise Client ist nicht eindeutig zuordenbar.                                                                                                                                   | Ableitbare Werte werden automatisch erzeugt. Bestands-Realms werden über eine durchsuchbare Live-Auswahl gewählt; `master` und bereits zugeordnete Realms sind sichtbar, aber deaktiviert. Echte Konflikte blockieren die Tenant-Anlage.                                               |
| 3   | Bereitschaft und Bestands-Realm vorab prüfen      | Keycloak ist nicht erreichbar oder nicht ausreichend autorisiert; der ausgewählte Realm kann nicht gelesen werden, weist automatisch ergänzbare Lücken oder manuell zu klärende Konflikte auf; Queue, Worker, Provisioner, Callback, Ingress-Fähigkeit oder ein benötigter Modulvertrag ist nicht verfügbar. | Keycloak-Ausfälle und manuelle Realm-Konflikte blockieren die Tenant-Anlage. Automatisch ergänzbare Realm-Lücken werden vorab als Änderungsplan gezeigt. Nachgelagerte Background-Blocker verhindern die Anlage nicht, werden aber vor der Bestätigung mit ihrer Auswirkung angezeigt. |
| 4   | Tenant in der Registry anlegen                    | Keycloak ist vor dem Speichern nicht mehr erreichbar; Berechtigung fehlt; Pflichtdaten sind nach der Vorabprüfung ungültig geworden; Identität oder Host wurde zwischenzeitlich vergeben; die Registry kann den Tenant nicht atomar speichern.                                                               | Diese Fehler verhindern die Anlage. Die Meldung benennt das betroffene Feld oder die betriebliche Voraussetzung. Fällt Keycloak erst nach erfolgreicher Persistenz aus, bleibt der Tenant erhalten und erhält einen sichtbaren Bereitstellungsblocker.                                 |
| 5   | Bereitstellungsauftrag einplanen                  | Queue oder Worker fehlt, ist gestoppt, nimmt keinen Auftrag an oder ein benötigter Callback ist nicht registriert.                                                                                                                                                                                           | Der bereits angelegte Tenant bleibt erhalten. Sein Zustand lautet `Bereitstellung wartet` oder `Bereitstellung blockiert`. Die Meldung nennt die fehlende Fähigkeit, die zuständige Behebung und wie die Bereitschaft danach erneut geprüft wird.                                      |
| 6   | Keycloak-Preflight und bestätigten Plan ausführen | Keycloak ist nach der Tenant-Anlage nicht mehr erreichbar oder autorisiert; Realm-Modus, Realm, Client, Secret oder Tenant-Admin-Konfiguration ist widersprüchlich; der geprüfte Sollzustand hat sich geändert.                                                                                              | Es beginnt keine Keycloak-Mutation. Der Tenant bleibt erhalten. Nur ausdrücklich geplante Studio-Artefakte werden automatisch ergänzt; Konflikte unklarer Eigentümerschaft verlangen manuelle Klärung und eine neue Read-only-Prüfung.                                                 |
| 7   | Keycloak bereitstellen                            | Realm, Client, Rollen, Mapper, Benutzer oder Plugin-OIDC-Verträge können nicht erstellt beziehungsweise abgeglichen werden; Timeout oder Zielsystemfehler tritt auf.                                                                                                                                         | Erfolgreiche Teilschritte bleiben nachvollziehbar. Nur der fehlgeschlagene beziehungsweise noch offene Anteil wird nach aktueller Prüfung idempotent wiederholt. Unsichere Wiederholungen werden nicht angeboten.                                                                      |
| 8   | Secrets sicher übernehmen                         | Secret kann nicht erzeugt, gelesen, verschlüsselt gespeichert oder gegen Keycloak abgeglichen werden.                                                                                                                                                                                                        | Der Tenant bleibt angelegt, aber nicht aktivierbar. Secret-Werte erscheinen nie in Meldung oder Protokoll. Die Meldung verweist auf Konfiguration, Rotation oder einen sicheren erneuten Abgleich.                                                                                     |
| 9   | Ingress, DNS und TLS bereitstellen                | Provisioner-Fähigkeit fehlt; Hostvertrag ist ungültig; DNS, Zertifikat oder Routing kann nicht hergestellt werden.                                                                                                                                                                                           | Der Tenant bleibt angelegt. Der betroffene Infrastrukturpunkt wird als Bereitstellungsblocker geführt und nach seiner Behebung gezielt erneut geprüft; es entsteht kein zweiter Tenant und kein konkurrierender Deploypfad.                                                            |
| 10  | Module und Plugins bereitstellen                  | Vertrag oder Snapshot fehlt beziehungsweise ist veraltet; Lifecycle-Auftrag kann nicht gestartet werden; Readiness bleibt wartend oder ist blockiert.                                                                                                                                                        | Der Tenant und bereits erfolgreiche Basisschritte bleiben erhalten. Betroffene Module werden nicht freigegeben. Die Meldung nennt Modul, fehlende Vorbedingung, Zuständigkeit und erneute Prüfung.                                                                                     |
| 11  | OIDC-Konfiguration und Tenant-IAM prüfen          | Issuer, Redirect-/Callback-URLs, PKCE, Rollenabgleich oder Rechteprobe sind fehlerhaft.                                                                                                                                                                                                                      | Vorhandene serverseitige Readbacks und Probes prüfen die technische Bereitschaft ohne interaktiven Tenant-Login. Fehler blockieren die Aktivierung und nennen den konkreten Korrekturschritt.                                                                                          |
| 12  | Tenant aktivieren und Einrichtung abschließen     | Provisionierung läuft noch, ein technischer oder manueller Blocker ist offen oder die Bestätigung ist ungültig.                                                                                                                                                                                              | Aktivierung erfolgt nach aktueller technischer Prüfung und ausdrücklicher Bestätigung. Es gibt keine zusätzliche Browserabnahme.                                                                                                                                                       |

Ein fehlendes SMTP-Passwort ist bei einem neuen Realm eine manuelle Nacharbeit
und kein technischer Provisioning-Fehler. Die operative Abnahme bleibt offen, bis
das Passwort direkt in Keycloak gesetzt und die SMTP-Verbindung dort erfolgreich
getestet wurde.

### Anforderungen an verständliche Rückmeldungen

Jeder Befund wird zu dem Zeitpunkt angezeigt, zu dem der Benutzer seine
Entscheidung noch ohne Rücknahme bereits ausgeführter technischer Schritte
ändern kann. Vor der Tenant-Anlage betrifft das insbesondere Eingabe- und
Bereitschaftsfehler; nach der Anlage betrifft es wartende, fehlgeschlagene oder
manuell fortzusetzende Bereitstellungsschritte.

Jede Rückmeldung enthält mindestens:

- eine laienverständliche Beschreibung des Problems,
- den betroffenen Eingabewert, Prozessschritt oder Zielzustand,
- die Auswirkung auf Anlage, Bereitstellung oder Aktivierung,
- die konkrete Änderung oder betriebliche Maßnahme,
- die danach auszuführende Prüfung oder Fortsetzung,
- eine Vorgangskennung, wenn der Benutzer den Fehler nicht selbst beheben kann.

Unbekannte Fehler dürfen keine erfundene Lösung oder einen unsicheren Retry
anbieten. In diesem Fall lautet die sichere Handlungsanweisung, keine Daten auf
Verdacht zu ändern, die Diagnose mit der Vorgangskennung bereitzustellen und den
betroffenen Schritt erst nach Einordnung erneut auszuführen.

## Verbindliche Aktivierungsregeln

- `Active` in der Übersicht allein reicht nicht als Freigabekriterium.
  Maßgeblich ist die vollständige grüne Checkliste auf der Detailseite.
- Ein bestehender Realm darf nicht versehentlich auf `New realm` stehen.
  Dieser Fehler führt zu einem fachlich falschen Provisioning-Pfad.
- Das Tenant-Admin-Profil muss vollständig gepflegt sein.
  Fehlende Stammdaten blockieren oder verfälschen den Bootstrap.
- Bei Secret-Drift im Modus `existing` muss die Abweichung vor der Aktivierung
  durch einen sicheren Secret-Abgleich beziehungsweise die explizite Aktion
  `Rotate client secret` behoben und anschließend erneut geprüft werden.
- `Provisioning succeeded` ist das technische Erfolgssignal im Protokoll.
  Die Instanz gilt aber erst dann als betriebsbereit, wenn danach auch alle
  fachlichen Checklistenpunkte grün sind.

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
- `pending` ist kein terminaler Fehler. Abhängige Schritte werden nur innerhalb
  des Laufbudgets und mit begrenztem Backoff wiederholt.
- Vor einem Retry müssen der aktuelle Instanzzustand, `failedStep`, `errorCode`,
  `deadlineAt`, der letzte Keycloak-Run und die aktuelle Doctor-Evidenz gelesen
  werden. Historische Preflight-Evidenz ist kein aktueller Abschlussnachweis.
- Ein Retry verwendet einen neuen `Idempotency-Key`. Der vorhandene Registry-,
  Plugin-, OIDC- und Lifecycle-Zustand wird erneut gebunden; bereits vorhandene
  Instanzen, Realms und Hosts dürfen nicht dupliziert werden.
- `internal_unclassified` wird nicht blind wiederholt. Der Befund wird zuerst
  über `requestId`, Run-Protokoll, Audit und Doctor eingegrenzt.

## Betriebsnachweis

Die Aktivierung verwendet die bestehenden technischen Nachweise:

1. Aktueller Postflight bestätigt den Keycloak-Sollzustand und den Secret-Abgleich.
2. Letzter bestätigter Provisioning-Run ist erfolgreich; keine offenen Blocker.
3. Issuer, Redirect-/Callback-URLs und PKCE entsprechen dem OIDC-Vertrag.
4. Hostfreigabe und TLS sowie Tenant-IAM und erforderliche Module sind bereit.

Die serverseitigen Prüfungen müssen vor Aktivierung ausführbar sein.
Normaler Zugriff auf inaktive Tenant-Routen bleibt gesperrt. Eine interaktive
Browserabnahme, ein `/auth/me`-Aufruf oder ein Gateway-Durchlauf ist weder
Freigabevoraussetzung noch nachgelagerter Pflichtschritt. Die Einrichtung endet
mit der ausdrücklich bestätigten Aktivierung nach technischer Prüfung.

### Read-only Studio-Instanz-Audit

Der operative Studio-Instanz-Audit ergänzt den Provisioning-Nachweis, ersetzt
aber weder Preflight noch Plan oder Ausführung. Sein Keycloak-Pfad arbeitet in
zwei festen Schritten:

1. Die Erhebung authentisiert den in der Registry hinterlegten
   Tenant-Admin-Client direkt in seinem Tenant-Realm und liest Realm,
   Login-Client, Tenant-Admin-Client, Rollen und Serviceaccount-Zustand in
   fester Reihenfolge. Die globale Provisioner-Identität bleibt dem privaten
   Provisioner-Prozess vorbehalten. Sie wird weder in den App-Prozess noch an
   Browser oder MCP weitergegeben; nur die drei allowlisteten Create-Control-
   Plane-Requests erreichen den Provisioner über das interne Netz.
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
