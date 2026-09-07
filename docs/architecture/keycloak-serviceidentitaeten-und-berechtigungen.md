# Keycloak-Serviceidentitäten und Berechtigungen: Zielbild

## Zweck

Dieses Dokument definiert den verbindlichen Zielzustand aller vom SVA Studio
verwendeten Keycloak-Clients und der zugehörigen Studio-Komponenten. Es ist die
Referenz für den geplanten Umbau der Client-Konfigurationen, Service-Accounts,
Berechtigungen, Diagnosepfade und Benennungen.

Das Dokument beschreibt ausschließlich das Zielbild. Abweichungen bestehender
Umgebungen, Übergangsbezeichnungen und Migrationsschritte gehören in eine
separate Gap-Analyse beziehungsweise in den späteren OpenSpec-Change.

Die hier beschriebenen Services sind logische Verantwortungsbereiche. Sie
müssen nicht als eigenständige Deployments oder Microservices betrieben
werden. Eine Trennung ist jedoch immer erforderlich bei:

- fachlicher Verantwortung,
- verwendeter Keycloak-Identität,
- erlaubten und verbotenen Operationen,
- Diagnose und Audit.

## Geltungsbereich

Erfasst werden alle Studio-eigenen Verbindungen, für die Keycloak einen Client
bereitstellt:

- interaktive Anmeldung am Studio Root,
- interaktive Anmeldung an einem Studio-Tenant,
- Plattform-IAM im Root-/Plattform-Realm,
- tenantlokales IAM in jedem Tenant-Realm,
- realmübergreifendes Keycloak-Provisioning,
- eingehender Maschinenzugriff über den Studio-MCP.

Nicht erfasst werden Keycloak-interne Standardclients, nicht vom Studio
verwaltete Fremdclients und Integrationen ohne Keycloak-Bezug. Insbesondere ist
die SVA-Mainserver-Integration nur dann Teil dieses Vertrags, wenn sie einen
Studio-eigenen Keycloak-Client verwendet. Mainserver-Credentials allein machen
sie nicht zu einer Keycloak-Serviceidentität.

## Grundmodell

### Menschen und Accounts

Eine natürliche Person kann sich mit derselben E-Mail-Adresse in mehreren
Realms registrieren oder anmelden. Für Studio entstehen dadurch unabhängige
Accounts. Die E-Mail-Adresse verbindet diese Accounts nicht miteinander.

Die technische Identität eines angemeldeten Menschen ergibt sich aus dem
Keycloak-Issuer und dem Subject (`sub`). Studio bindet diese Identität zusätzlich
an genau einen Laufzeitkontext:

- `platform` für den Root-/Plattform-Host oder
- `instance` mit genau einer `instanceId` für einen Tenant-Host.

Rollen, Permissions, Sitzungen und Accounts werden nicht zwischen diesen
Kontexten übertragen. Ein Root-Account ist kein Tenant-Account. Ein Account in
Tenant A ist kein Account in Tenant B.

Die bestehenden fachlichen Rollenschlüssel bleiben erhalten:

- `instance_registry_admin` bezeichnet die Plattformrolle im Root-Realm.
- `system_admin` bezeichnet die geschützte tenantlokale Administratorrolle.
- weitere tenantlokale Rollen bilden fachliche Permissions innerhalb genau
  eines Tenants ab.

### Menschen und technische Services

Ein Mensch authentifiziert sich über einen Login-Client und autorisiert im
Studio eine Aktion. Muss Studio dafür Keycloak administrieren, führt ein
zuständiger Studio-Service die Operation mit seiner eigenen technischen
Serviceidentität aus.

Die technische Identität erbt weder die Keycloak-Sitzung noch die Realm-Rollen
des Menschen. Umgekehrt verleihen die Rechte eines Service-Accounts dem
auslösenden Menschen keine zusätzlichen Studio- oder Tenant-Rechte.

Jede administrative Kette muss nachvollziehbar bleiben:

1. menschlicher oder technischer Auslöser,
2. Studio-Kontext und autorisierende Rolle beziehungsweise Action,
3. beauftragter Studio-Service,
4. verwendeter Keycloak-Client und Ziel-Realm,
5. ausgeführte Operation und Ergebnis.

### Realms

Der Keycloak Master Realm dient ausschließlich der Keycloak-weiten
Betriebsadministration und dem realmübergreifenden Provisioning. Er ist kein
Studio-Login-Realm.

Der Plattform-Realm `sva-studio` authentifiziert den Studio Root. Er enthält
Plattformaccounts und Plattformrollen, insbesondere
`instance_registry_admin`.

Jeder Studio-Tenant verweist über die Instanz-Registry auf genau einen
Tenant-Realm. Der Tenant-Realm enthält die Identitäten für diesen Tenant, den
Login-Client und die tenantlokale technische IAM-Identität. Ein Realm darf nur
dann von mehreren Studio-Tenants verwendet werden, wenn dafür später ein
eigener, ausdrücklich freigegebener Isolationsvertrag definiert wird.

## Verbindliche Benennungsregeln

Der Anzeigename einer Studio-Komponente und die technische Keycloak-Client-ID
sind verschiedene Bezeichner und müssen im Code, in der Oberfläche, in
Diagnosen und in der Dokumentation getrennt ausgewiesen werden.

Komponentennamen beschreiben Verantwortung und Ort. Die verbindlichen Namen
lauten:

- **Studio Authentication Service** für interaktive OIDC-Anmeldungen,
- **Studio Platform IAM Service** für IAM-Operationen im Plattform-Realm,
- **Studio Tenant IAM Service** für IAM-Operationen in einem Tenant-Realm,
- **Studio Keycloak Provisioning Service** für realmübergreifende
  Strukturänderungen,
- **Studio MCP Gateway** für eingehende Maschinenaufrufe der
  Studio-Control-Plane.

Keycloak-Client-IDs verwenden ausschließlich Kleinbuchstaben und Bindestriche.
Sie benennen das Produkt und den Zweck. Der Realm liefert den Geltungsbereich,
wenn derselbe Clientvertrag bewusst in mehreren Realms installiert wird.

Die kanonischen Client-IDs des Zielbilds sind:

- `sva-studio` für den interaktiven Studio-Login,
- `sva-studio-platform-iam` für technische IAM-Operationen im
  Plattform-Realm,
- `sva-studio-tenant-iam` für technische IAM-Operationen im jeweiligen
  Tenant-Realm,
- `sva-studio-provisioner` für realmübergreifendes Keycloak-Provisioning,
- `sva-studio-mcp` für eingehende Maschinenidentitäten am Studio-MCP.

Bezeichnungen wie `admin`, `realm-admin` oder `iam-service` ohne erkennbaren
Scope sind für neue Studio-eigene Clients nicht zulässig. Insbesondere darf ein
Clientname keine weitergehenden Rechte suggerieren, die der Service-Account
nicht besitzt.

## Studio Authentication Service

### Verantwortung

Der Studio Authentication Service führt interaktive Anmeldungen, OIDC-
Callbacks, Token-Austausch, Sitzungsaufbau, Token-Erneuerung und Logout aus. Er
entscheidet anhand des aufgerufenen Hosts, ob der Plattform-Realm oder der in
der Instanz-Registry hinterlegte Tenant-Realm verwendet wird.

### Keycloak-Client

Der Client trägt in jedem verwendeten Realm die ID `sva-studio`. Der Root-Host
verwendet den Client im Plattform-Realm. Jeder Tenant-Host verwendet einen
gleichnamigen, aber technisch unabhängigen Client im zugeordneten Tenant-Realm.

Die Clients sind serverseitige OIDC-Clients mit Authorization Code Flow und
PKCE S256. Redirect-URIs, Post-Logout-Redirect-URIs und Web Origins sind exakt
auf den jeweiligen Root- oder Tenant-Host begrenzt. Client-Secrets werden pro
Realm getrennt gespeichert und rotiert.

### Erlaubte Operationen

Der Authentication Service darf:

- einen Benutzer interaktiv authentifizieren,
- einen Authorization Code gegen Token tauschen,
- zulässige Token erneuern,
- eine Sitzung beenden,
- öffentliche OIDC-Metadaten und Schlüssel lesen.

### Verbotene Operationen

Der Login-Client besitzt keinen Service-Account für Keycloak-Administration und
keine `realm-management`-Rollen. Er darf insbesondere keine Benutzer, Rollen,
Clients, Realms, Identity Provider oder Authentifizierungsabläufe verwalten.

Ein erfolgreicher Login beweist nur die Funktionsfähigkeit des Login-Vertrags.
Er beweist keine administrativen Rechte eines anderen Studio-Service.

### Diagnose

Der Authentication Service prüft Discovery, Issuer, Login-Client,
Redirect-Konfiguration und den OIDC-Ablauf. Er meldet keine Aussage über die
Existenz oder Rechte technischer IAM-Clients, wenn diese nicht Bestandteil des
geprüften Login-Flows sind.

## Studio Platform IAM Service

### Verantwortung

Der Studio Platform IAM Service verwaltet Identitäten und technische
Sonderrollen ausschließlich im Plattform-Realm `sva-studio`. Er bedient
Root-seitige Benutzer- und Rollenfunktionen. Er provisioniert keine
Tenant-Realms und führt keine tenantlokalen Fachoperationen aus.

### Keycloak-Client

Der technische Client trägt die ID `sva-studio-platform-iam`, liegt im
Plattform-Realm und verwendet den Client Credentials Flow mit aktiviertem
Service-Account. Sein Secret wird ausschließlich der Studio-Server-Runtime
bereitgestellt und niemals an den Browser ausgeliefert.

### Erforderliche Keycloak-Rechte

Der Service-Account erhält im Client `realm-management` nur die Rechte, die für
die implementierten Plattform-IAM-Operationen benötigt werden:

- `manage-users`,
- `view-users`,
- `view-realm`,
- `manage-realm` ausschließlich für die vom Studio verwalteten technischen
  Plattformrollen.

Die Studio-Laufzeit muss unabhängig von den groben Keycloak-Rollen eine
serverseitige Allowlist der tatsächlich angebotenen Operationen erzwingen.
`manage-realm` ist kein allgemeiner Auftrag, beliebige Realm-Einstellungen zu
ändern.

### Verbotene Operationen

Der Platform IAM Service besitzt weder `realm-admin` noch `manage-clients` oder
`view-clients`. Er darf:

- keine Tenant-Realms verwalten,
- keine Login- oder Service-Clients verändern,
- keine Identity Provider oder Authentifizierungsabläufe konfigurieren,
- keine tenantlokalen Rollen oder Benutzer verwalten.

### Auslöser und Audit

Interaktive Plattformaktionen benötigen einen Root-Account mit der bestehenden
Rolle `instance_registry_admin` oder eine enger definierte Root-Permission.
Automatische Wartungsaufgaben benötigen eine eigene vollständig qualifizierte
Action-ID. Das Audit hält Actor, Action, Plattform-Realm, technische Client-ID,
Zielobjekt und Ergebnis fest.

### Diagnose

Der Service prüft ausschließlich seine Erreichbarkeit, Token-Ausstellung und
die für Plattform-IAM nötigen Rechte. Tenant-IAM oder realmübergreifendes
Provisioning werden getrennt bewertet.

## Studio Tenant IAM Service

### Verantwortung

Der Studio Tenant IAM Service verwaltet Benutzerkonten und die wenigen
Keycloak-relevanten technischen Rollen innerhalb genau eines Tenant-Realm. Er
arbeitet immer im Auftrag eines authentifizierten Tenant-Kontexts oder eines
expliziten, tenantgebundenen Wartungsauftrags.

Normale fachliche Tenant-Rollen, Gruppen und Permissions bleiben in der
Studio-IAM-Datenbank kanonisch. Der Tenant IAM Service spiegelt sie nicht
pauschal nach Keycloak. Die geschützte tenantlokale Rolle `system_admin` bleibt
der technische Sonderfall des bestehenden Rollenvertrags.

### Keycloak-Client

Jeder Tenant-Realm enthält einen eigenen technischen Client mit der ID
`sva-studio-tenant-iam`. Der Client verwendet den Client Credentials Flow mit
aktiviertem Service-Account. Client und Secret gelten nur für diesen Realm und
dürfen nicht als Fallback für andere Tenants oder den Plattform-Realm verwendet
werden.

### Erforderliche Keycloak-Rechte

Der Service-Account erhält im tenantlokalen Client `realm-management`:

- `manage-users`,
- `view-users`,
- `view-realm`,
- `manage-realm` ausschließlich für die vom Studio verwaltete technische Rolle
  `system_admin`,
- `view-clients`, damit der konfigurierte Login-Client eindeutig gelesen und
  bei Benutzeraktionen als Redirect-Ziel referenziert werden kann.

Der Service besitzt bewusst Lesesicht auf den Login-Client, aber keine
Schreibhoheit über Clients. Dadurch darf eine Diagnose zwischen einem fehlenden
Client und fehlender Sichtbarkeit unterscheiden, ohne dem Tenant IAM Service
Client-Lifecycle-Rechte zu geben.

### Erlaubte Operationen

Der Tenant IAM Service darf innerhalb seines Ziel-Realm:

- Benutzer lesen, anlegen, aktualisieren, aktivieren und deaktivieren,
- benutzerbezogene Required Actions und Passwort-Setup-Mails auslösen,
- Benutzer-Sitzungen im Rahmen expliziter Accountoperationen widerrufen,
- die technische Rolle `system_admin` lesen, sicherstellen und gezielt
  zuweisen oder entziehen,
- den in der Instanz-Registry referenzierten Login-Client lesen,
- seine eigenen erforderlichen Berechtigungen probeweise prüfen.

### Verbotene Operationen

Der Tenant IAM Service besitzt weder `realm-admin` noch `manage-clients`. Er
darf insbesondere:

- keine Clients anlegen, ändern oder löschen,
- keine Client-Secrets lesen, setzen oder rotieren,
- keine Redirect-URIs oder Protocol Mapper verändern,
- keine Identity Provider oder Authentifizierungsabläufe konfigurieren,
- keinen anderen Realm und keinen anderen Tenant verwalten,
- keine fachlichen Studio-Rollen als Keycloak-Rollenkatalog etablieren,
- keinen Plattform- oder Provisioning-Client als Ersatzidentität verwenden.

### Auslöser und Audit

Interaktive Tenant-IAM-Operationen benötigen eine tenantlokale Studio-
Permission. Die bestehende Rolle `system_admin` erhält diese Permissions über
den tenantlokalen IAM-Katalog, ist aber kein ungeprüfter Rollen-Bypass.

Jeder Aufruf protokolliert mindestens Actor, `instanceId`, Ziel-Realm,
Studio-Action, technische Client-ID, Zielobjekt und Ergebnis. Ein vom Root
ausgelöster Reparaturauftrag muss zusätzlich den Root-Actor und den
ausführenden Tenant-Service getrennt ausweisen.

### Diagnose

Die Access-Probe verwendet ausschließlich `sva-studio-tenant-iam` des
betroffenen Tenants. Sie darf keinen Plattform- oder Provisioning-Client als
Fallback verwenden.

Diagnosen unterscheiden mindestens:

- `PRESENT`: Das Zielobjekt wurde erfolgreich gelesen.
- `MISSING`: Die Abfrage war autorisiert und das Zielobjekt existiert nicht.
- `FORBIDDEN`: Keycloak ist erreichbar, aber die technische Identität besitzt
  nicht die nötige Berechtigung.
- `UNAVAILABLE`: Keycloak oder der Ziel-Realm ist technisch nicht erreichbar.
- `MISCONFIGURED`: Client, Secret, Issuer oder Registry-Zuordnung fehlen oder
  widersprechen sich.
- `UNKNOWN`: Der Zustand kann mit der vorhandenen Evidenz nicht bestimmt
  werden.

`FORBIDDEN`, `UNAVAILABLE`, `MISCONFIGURED` und `UNKNOWN` dürfen niemals als
`MISSING` dargestellt werden. Insbesondere darf fehlende Client-Sichtbarkeit
nicht zur Meldung führen, der Login-Client existiere nicht.

## Studio Keycloak Provisioning Service

### Verantwortung

Der Studio Keycloak Provisioning Service ist die einzige Studio-Komponente mit
Schreibhoheit über den Lifecycle von Realms und Clients. Er setzt explizit
geplante und autorisierte Control-Plane-Aufträge um.

Zu seinen Aufgaben gehören:

- neue Tenant-Realms anlegen,
- bestehende Tenant-Realms gegen den registrierten Sollzustand prüfen,
- Login- und Tenant-IAM-Clients anlegen oder konfigurieren,
- Redirect-URIs, Web Origins und Protocol Mapper abgleichen,
- Client-Secrets erzeugen oder nach gesonderter Freigabe rotieren,
- den initialen Tenant-Administrator und die technische Rolle `system_admin`
  für den Bootstrap sicherstellen,
- ausdrücklich freigegebene Strukturabweichungen reparieren.

Der Service entscheidet nicht selbst, dass ein erkannter Drift repariert wird.
Read, Plan und Apply bleiben getrennte Schritte. Kritische Änderungen benötigen
eine aktuelle, zustandsgebundene Bestätigung.

### Keycloak-Client

Der technische Client trägt die ID `sva-studio-provisioner`, liegt im Master
Realm und verwendet den Client Credentials Flow mit aktiviertem
Service-Account. Sein Secret ist ausschließlich für den Provisioning-Worker
bestimmt.

### Erforderliche Keycloak-Rechte

Die technische Identität benötigt die Keycloak-weiten administrativen
Fähigkeiten, um Tenant-Realms zu erstellen und den definierten Sollvertrag in
Ziel-Realms anzuwenden. Dazu gehören funktional:

- Realms auflisten, lesen und anlegen,
- verwaltete Realm-Einstellungen lesen und ändern,
- verwaltete Clients, Service-Accounts und Client-Rollenzuweisungen lesen,
  anlegen und ändern,
- die für den Bootstrap benötigten Benutzer und technischen Rollen verwalten,
- Secrets der verwalteten Clients erzeugen beziehungsweise nach expliziter
  Freigabe rotieren.

Die konkrete Zuordnung von Keycloak-Adminrollen muss im späteren
Implementierungs-Change aus dieser Capability-Liste abgeleitet und gegen die
eingesetzte Keycloak-Version geprüft werden. Ein pauschales `realm-admin` ist
nur zulässig, wenn Keycloak die benötigten realmübergreifenden Operationen
nicht feiner delegieren kann und die Studio-seitige Allowlist, Freigabe und
Auditierung den verbleibenden Umfang wirksam begrenzen.

### Verbotene Operationen

Der Provisioning Service darf:

- keine tenantfachlichen Inhalte oder Permissions verwalten,
- keine freie, nicht im Sollvertrag enthaltene Realm-Konfiguration anwenden,
- keinen Drift ohne expliziten Auftrag automatisch reparieren,
- keine Secrets an Browser, MCP-Antworten oder Logs ausgeben,
- seine Master-Realm-Identität nicht für normale Tenant-IAM-Aufrufe verwenden.

### Auslöser und Audit

Interaktive Aufträge kommen aus der Root-Control-Plane und benötigen die Rolle
`instance_registry_admin` sowie die zur Operation passende serverseitige
Action. Maschinenaufträge benötigen denselben Action-Vertrag. Kritische
Operationen verwenden zusätzlich einen aktuellen Plan und eine kurzlebige,
einmalige Bestätigung.

Das Audit verbindet Root-Actor, Action, `instanceId`, Ziel-Realm,
Provisioning-Run, technische Client-ID, Plan-Fingerprint, Änderungen und
Ergebnis. Worker-Ausführung und ursprünglicher Auftrag bleiben korrelierbar.

### Diagnose

Der Provisioning Service ist für die strukturelle Soll-/Ist-Sicht auf Realms,
Clients, Mapper, Redirect-Ziele und Bootstrap-Artefakte verantwortlich. Ein
grüner Provisioning-Status beweist nicht, dass der Tenant IAM Service seine
eigenen Alltagsoperationen ausführen darf.

## Studio MCP Gateway

### Verantwortung

Das Studio MCP Gateway stellt eine eingehende Maschinenverbindung zur
Studio-Control-Plane bereit. Es verwendet Keycloak zur Authentifizierung und
Autorisierung des aufrufenden Tools. Es ist kein Keycloak-Administrationsservice.

### Keycloak-Client

Der Client trägt die ID `sva-studio-mcp`, liegt im Plattform-Realm und
verwendet den Client Credentials Flow. Das ausgestellte Token besitzt eine
feste Audience für den Studio-MCP und vollständig qualifizierte Studio-Action-
IDs.

### Erlaubte Operationen

Das Gateway darf ausschließlich diejenigen Studio-Aktionen aufrufen, die im
Token und in der serverseitigen MCP-Policy gemeinsam erlaubt sind. Read-only,
kontrollierte Mutationen und kritische Mutationen bleiben getrennte
Risikoklassen. Kritische Mutationen benötigen denselben serverseitigen
Bestätigungsvertrag wie interaktive Root-Aktionen.

### Verbotene Operationen

Der MCP-Service-Account besitzt keine `realm-management`-Rollen. Das Gateway
darf weder die Keycloak Admin API unmittelbar aufrufen noch technische Secrets
anderer Studio-Services erhalten. Ein MCP-Aufruf kann einen autorisierten
Provisioning-Auftrag an Studio stellen; die Keycloak-Ausführung erfolgt danach
ausschließlich durch den zuständigen Studio-Service.

### Audit und Diagnose

Jeder Aufruf hält Client-ID, Token-Subject, Audience, Action-ID, Request-ID,
Zielressource und Ergebnis fest. Token-Gültigkeit beweist nur den Zugang zum
MCP. Sie beweist weder die Erreichbarkeit Keycloaks aus dem Provisioning-Worker
noch die Rechte eines Tenant IAM Service.

## Zusammengesetzte Laufzeitabläufe

### Interaktive Tenant-Benutzerverwaltung

1. Ein Mensch meldet sich über `sva-studio` im Tenant-Realm an.
2. Studio bindet die Sitzung an die zugehörige `instanceId`.
3. Studio prüft die erforderliche tenantlokale Permission.
4. Der Studio Tenant IAM Service verwendet `sva-studio-tenant-iam` desselben
   Realm.
5. Keycloak führt die freigegebene Benutzeroperation aus.
6. Studio protokolliert menschlichen Actor und technische Ausführung gemeinsam.

Weder Root-IAM noch Provisioner sind Teil dieses Normalpfads.

### Neue Instanz und neuer Realm

1. Ein Root-Account mit `instance_registry_admin` erfasst den Sollzustand in
   der Instanz-Registry.
2. Studio erzeugt einen read-only Plan für Realm, Login-Client,
   Tenant-IAM-Client und Bootstrap-Account.
3. Der Mensch bestätigt die geplante Operation.
4. Der Studio Keycloak Provisioning Service verwendet
   `sva-studio-provisioner` im Master Realm.
5. Der Worker erstellt und konfiguriert ausschließlich die geplanten
   Artefakte.
6. Studio speichert erzeugte Secrets über den vorgesehenen Secret-Pfad und
   protokolliert das Ergebnis.
7. Login- und Tenant-IAM-Diagnosen werden anschließend mit ihren jeweils
   eigenen Identitäten ausgeführt.

### Tenant-Struktur prüfen und heilen

1. Root startet eine zusammengesetzte, zunächst read-only Diagnose.
2. Authentication Service, Tenant IAM Service und Provisioning Service liefern
   getrennte Evidenz für ihre Verantwortungsbereiche.
3. Studio aggregiert die Ergebnisse, ohne Fehlerklassen oder Identitäten zu
   vermischen.
4. Eine Reparatur wird als eigener Plan dargestellt.
5. Erst nach der erforderlichen Autorisierung führt der zuständige Service die
   freigegebenen Änderungen aus.
6. Alle Prüfungen werden nach der Änderung mit der jeweils zuständigen
   Identität wiederholt.

Eine Root-Diagnose darf mehrere Serviceprüfungen orchestrieren. Sie darf aber
nicht alle Prüfungen unter einer einzigen privilegierten Identität ausführen.

## Gesundheitszustand und Diagnosevertrag

Der Gesamtzustand einer Studio-Instanz setzt sich aus unabhängigen Teilzuständen
zusammen:

- Login-Bereitschaft,
- Plattform-IAM-Bereitschaft, soweit für den konkreten Ablauf relevant,
- Tenant-IAM-Bereitschaft,
- Provisioning- und Strukturbereitschaft,
- MCP-Bereitschaft, wenn Maschinenzugriff benötigt wird.

Jeder Teilzustand nennt:

- den prüfenden Studio-Service,
- die verwendete technische Identität,
- den geprüften Realm und das geprüfte Zielobjekt,
- die benötigte Fähigkeit,
- die beobachtete Fehlerklasse,
- die zulässige Behebung.

Die beobachtete Fehlerklasse verwendet einen stabilen, maschinenlesbaren
Vertrag: `ready`, `missing`, `forbidden`, `unknown`, `unavailable` oder
`misconfigured`. UI und MCP dürfen diese Klassen erläutern, aber nicht aus
abweichenden Freitexten neu ableiten.

Ein Teilzustand darf nur dann `healthy` sein, wenn der tatsächliche
Produktionspfad mit seiner vorgesehenen Identität geprüft wurde. Allgemeine
HTTP-Erreichbarkeit, ein erfolgreicher Login oder ein grüner
Provisioning-Status ersetzen keinen Tenant-IAM-Rechtenachweis.

Read-only Diagnose und mutierende Reparatur sind getrennte Verträge. Keine
Health-Prüfung darf automatisch Secrets rotieren, Rollen erweitern, Clients
ändern oder Realms reparieren.

## Secret- und Lebenszyklusregeln

Jeder vertrauliche Client besitzt ein eigenes Secret. Secrets werden nicht
zwischen Plattform, Tenants, MCP und Provisioning geteilt. Ein globales Secret
darf nicht als stiller Tenant-Fallback dienen.

Secrets werden ausschließlich serverseitig gespeichert, verschlüsselt oder
über den vorgesehenen Runtime-Secret-Mechanismus injiziert. Sie erscheinen
weder in Browserantworten noch in Auditdetails, Diagnosepayloads oder Logs.

Rotation ist eine explizite Operation des jeweils zuständigen Owners:

- Login- und Tenant-IAM-Client-Secrets im Tenant-Realm werden durch den Studio
  Keycloak Provisioning Service rotiert.
- Das Platform-IAM-Secret wird über den Plattform-Betrieb rotiert.
- Das Provisioner-Secret wird über den Keycloak-/Plattform-Betrieb rotiert.
- Das MCP-Client-Secret wird über den MCP-/Plattform-Betrieb rotiert.

Nach jeder Rotation muss der konsumierende Laufzeitpfad mit der neuen
Credential-Version geprüft werden. Eine erfolgreiche Rotation in Keycloak
allein ist kein End-to-End-Nachweis.

## Sicherheitsinvarianten

Die folgenden Regeln sind nicht verhandelbarer Teil des Zielzustands:

1. Eine E-Mail-Adresse ist kein realmübergreifender Identitätsschlüssel.
2. Ein Token gilt nur für seinen Issuer, seine Audience und seinen Studio-
   Kontext.
3. Root-Rollen verleihen keine tenantlokalen Fachrechte.
4. Tenant-Rollen verleihen keine Root- oder realmübergreifenden Rechte.
5. Login-Clients besitzen keine administrativen Keycloak-Rechte.
6. Plattform-IAM und Tenant-IAM verwenden getrennte Serviceidentitäten.
7. Tenant-IAM verwendet niemals Provisioning-Credentials als Fallback.
8. Nur der Provisioning Service verändert Realm- und Clientstrukturen.
9. Lesesicht darf sich dort überschneiden, wo eine korrekte Diagnose sie
   benötigt; Schreibhoheit bleibt eindeutig.
10. Fehlende Sichtbarkeit ist nicht gleichbedeutend mit einem fehlenden
    Zielobjekt.
11. Diagnose, Plan und Mutation bleiben getrennt.
12. Jeder administrative Effekt ist auf einen menschlichen oder technischen
    Auftrag und den tatsächlich ausführenden Service zurückführbar.
13. Kein Client erhält Rechte allein aufgrund seines Namens; wirksam sind nur
    die geprüften Keycloak-Zuweisungen und die serverseitige Studio-Policy.

## Verbindlichkeit für den Umbau

Der spätere Umbau muss für jeden hier beschriebenen Client einen eigenen
Soll-/Ist-Nachweis liefern. Eine Umstellung gilt erst als abgeschlossen, wenn:

- Client-ID und Realm dem Zielbild entsprechen,
- Service-Account und OAuth-Flow korrekt konfiguriert sind,
- erlaubte Rechte positiv nachgewiesen sind,
- verbotene Operationen durch Negativtests nachweislich scheitern,
- Secret-Quelle und Rotation geklärt sind,
- Diagnosefehler korrekt klassifiziert werden,
- Audit Actor, Serviceidentität, Ziel und Ergebnis verbindet,
- der echte Login-, IAM-, Provisioning- oder MCP-Laufzeitpfad erfolgreich
  geprüft wurde.

Die konkrete Migration wird in einem separaten OpenSpec-Change geplant. Dieser
muss mindestens die betroffenen Abschnitte der Lösungsstrategie,
Bausteinsicht, Laufzeitsicht, Verteilungssicht, querschnittlichen Konzepte,
Qualitätsanforderungen sowie Risiken und technische Schulden aktualisieren.
