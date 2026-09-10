# SSF-Control-Plane im SVA Studio: Zielbild

## Status und Zweck

Dieses Dokument hält die abgestimmte Architekturgrundlage für die Nutzung des
SVA Studios als administrative Control Plane einer Smart-Speech-Flow-
Installation (SSF) fest. Es beschreibt weiterhin das übergreifende Zielbild;
der aktuelle Implementierungsstand ist in den verlinkten OpenSpec-Changes und
den arc42-Abschnitten festgehalten. Die normative Ausarbeitung ist in fünf
aufeinander aufbauende OpenSpec-Changes gegliedert:

1. [`extend-plugin-platform-scopes-and-activation`](../../openspec/changes/extend-plugin-platform-scopes-and-activation/proposal.md)
2. [`add-plugin-tenant-lifecycle`](../../openspec/changes/add-plugin-tenant-lifecycle/proposal.md)
3. [`add-ssf-tenant-administration`](../../openspec/changes/add-ssf-tenant-administration/proposal.md)
4. [`add-ssf-runtime-configuration-api`](../../openspec/changes/add-ssf-runtime-configuration-api/proposal.md)
5. [`add-ssf-iam-permission-projection`](../../openspec/changes/add-ssf-iam-permission-projection/proposal.md)
6. [`wire-ssf-runtime-real-data`](../../openspec/changes/wire-ssf-runtime-real-data/proposal.md)
7. [`add-ssf-runtime-configuration-ui`](../../openspec/changes/add-ssf-runtime-configuration-ui/proposal.md)

Der aktuelle Studio-Zwischenstand umfasst den fail-closed Runtime-Lesepfad,
die Studio-seitige Projektionslogik, den getesteten Consumer für den
tenantgebundenen SSF-Session-Widerruf und den tenantlokalen SSF-OIDC-Client als
deaktiviertes Integrationsartefakt sowie getrennte Root- und Tenant-Editoren für
die Runtime-Konfiguration. Das Plugin deklariert dafür ausschließlich
die feste Client-ID und Audience `ssf`; die generische Keycloak-Provisionierung
entfernt Callback-, Logout- und Origin-Freigaben, deaktiviert alle Flows und
prüft Client sowie Audience-Mapper per Read-back. Bewusst offen bleiben der
später gemeinsam mit SSF festzulegende Client-Typ, exakte Callback-URIs, die
Aktivierung sowie die Anbindung an Plugin-Lifecycle und Host-Readiness-Provider
und die SSF-seitige Implementierung des Sammelwiderrufs. Bis diese Verträge
gemeinsam im Staging nachgewiesen sind, bleibt das produktive Enablement
gesperrt.

Die erste Ausbaustufe konzentriert sich auf die Anlage und Verwaltung von
Mandanten und Benutzern. Auswertungen aus ClickHouse, eine mögliche separate
Session-Datenbank, Gesprächsinhalte und Supportzugriffe sind ausdrücklich nicht
Teil dieses ersten Lieferumfangs.

## Betriebs- und Mandantenmodell

Ein Studio-Deployment läuft gemeinsam mit genau einer SSF-Installation auf
demselben Server beziehungsweise in derselben Deployment-Grenze. Eine logische
Studio-Instanz entspricht genau einem SSF-Mandanten.

```text
SSF-Server beziehungsweise Deployment
├── Smart Speech Flow
├── gemeinsame Keycloak-Instanz
├── SVA Studio
└── PostgreSQL-Datenbank des SSF-Plugins
```

Die gemeinsame Deployment-Grenze hebt die Systemgrenzen nicht auf. Studio und
SSF verwenden keine gemeinsame Fachdatenbank und greifen nicht direkt auf die
jeweils andere Persistenz zu. Die Integration erfolgt über versionierte interne
APIs und explizite technische Identitäten.

## Rollenabbildung

Die fachlichen SSF-Rollen und die technischen Studio-Rollen bleiben getrennt:

| SSF-Fachrolle  | Technische Abbildung im Studio                                           |
| -------------- | ------------------------------------------------------------------------ |
| `system_admin` | Root-Scope mit `instance_registry_admin`                                 |
| `tenant_admin` | tenantlokaler Studio-`system_admin` im Realm der Studio-Instanz          |
| `user`         | tenantlokaler Benutzer mit gezielten `ssf.*`-Permissions                 |
| `guest`        | keine reguläre Studio-Identität; Zugriff über eine begrenzte SSF-Session |

Die früher verwendeten Werte `admin` und `customer` sind ausschließlich
Übergangsaliase für `user` und `guest`; neue Projektionen verwenden die
kanonischen Werte.

Der Root-System-Admin legt einen Mandanten und dessen initialen Tenant-Admin an.
Danach verwaltet der Tenant-Admin die Benutzer und Rollen seines eigenen
Mandanten. Eine reguläre mandantenübergreifende Benutzerverwaltung durch den
Root-System-Admin ist nicht Teil des Zielbilds. Ein späterer Support- oder
Wiederherstellungspfad muss davon getrennt, zeitlich begrenzt und vollständig
auditiert werden.

## Verantwortung von Core und Plugin

SSF-Fachlogik bleibt vollständig außerhalb des Studio Core. Der Core wird nur
um generische Plugin-Fähigkeiten erweitert, die auch weiteren Plugins zur
Verfügung stehen können.

| Ebene      | Studio Core                                                                                                                        | SSF-Plugin                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Root       | Plugin-Katalog, Instanzlebenszyklus, Root-Autorisierung, Keycloak-Provisionierung, initialer Tenant-Admin, Secrets, Jobs und Audit | SSF-Root-Navigation, SSF-Mandantenstatus, installationsweite SSF-Konfiguration und SSF-spezifische Root-Aktionen |
| Tenant     | Authentifizierung, IAM, Benutzer, Rollen, Gruppen, effektive Permissions und Modulaktivierung                                      | SSF-Konfiguration, `ssf.*`-Permissions, tenantbezogene Oberflächen und interne SSF-Fachverträge                  |
| Persistenz | zentrale Studio-Governance einschließlich Instanzen, IAM, Audit und Plugin-Aktivierungsstatus                                      | eine eigene mandantenfähige PostgreSQL-Datenbank für installationsweite und tenantbezogene SSF-Daten             |
| Runtime    | hostgeführte Authentifizierung, Autorisierung, Fehlerverträge, Audit und Jobausführung                                             | SSF-spezifische Handler, Validierung, Repositories und Aufrufe interner SSF-APIs                                 |

Der bestehende Plugin-Vertrag muss dafür generisch platformgebundene Routen,
Navigation, Aktionen und serverseitige Beiträge unterstützen. Ein Plugin darf
die Plattformrolle nicht in tenantlokale Rechte umdeuten; Root- und
Tenant-Zugriffe bleiben getrennte Autorisierungspfade.

## Installation und Aktivierungsrichtlinien

Bereits bei der Installation des SVA Studios wird entschieden, welche Plugins
in das Deployment aufgenommen werden. Ein Studio gilt als SSF-fähig, wenn das
SSF-Plugin im installierten und hostvalidierten Plugin-Katalog enthalten ist.
Der Core benötigt dafür keinen fachspezifischen Betriebsmodus wie
`isSsfStudio`.
Die Composition Root leitet aus den tatsächlich geladenen `pluginSources`
genau eine Liste deklarativer Plugin-OIDC-Anforderungen ab. Provisionierung,
Statusprüfung und Reservierung von Client-IDs konsumieren dieselbe Liste. Ohne
geladenes SSF-Plugin bleibt auch der IAM- und Keycloak-Pfad SSF-neutral.
Die Reserved-ID-Invariante liegt an der Service-/Mutation-Trust-Boundary. Vor
dem späteren SSF-Catalog-Wiring muss der eigenständige Instance-Registry-CLI
dieselbe kanonische Requirement-Quelle erhalten oder plugin-aware Mutationen
fail-closed verweigern; eine zweite CLI-spezifische SSF-Liste ist unzulässig.

Der generische Plugin-Vertrag unterscheidet drei tenantbezogene
Aktivierungsrichtlinien:

| Richtlinie  | Initialer Zustand | Manuell deaktivierbar |
| ----------- | ----------------- | :-------------------: |
| `optional`  | deaktiviert       |          Ja           |
| `automatic` | aktiviert         |          Ja           |
| `required`  | aktiviert         |         Nein          |

Das SSF-Plugin verwendet zunächst `automatic`. Eine manuelle Deaktivierung
eines automatisch aktivierten Plugins ist ein persistenter Sollzustand und darf
durch Neustart oder Reconcile nicht aufgehoben werden.

Wird ein Plugin nachträglich installiert, gilt:

- `optional` bleibt für bestehende und neue Tenants zunächst deaktiviert.
- `automatic` wird für bestehende Tenants über einen kontrollierten,
  auditierten Reconcile und für neue Tenants direkt aktiviert.
- `required` wird für alle bestehenden und neuen Tenants aktiviert. Die
  Installation ist erst bereit, wenn der Reconcile erfolgreich abgeschlossen
  ist.

Ein installiertes `required`-Plugin ist technisch weiterhin ein Plugin und
kein Core-Bestandteil. Tenant- und Root-APIs lehnen seine Deaktivierung
serverseitig ab. Eine Entfernung aus dem Deployment ist ein eigener operativer
Vorgang und löscht weder Plugin-Daten noch Historie automatisch.

## Keycloak- und Identitätsmodell

Studio und SSF verwenden dieselbe Keycloak-Instanz. Die Realm-Grenzen bilden
Plattform- und Mandantengrenzen ab:

```text
gemeinsame Keycloak-Instanz
├── master
│   └── ausschließlich Keycloak-Administration
├── Studio-Root-Realm
│   ├── System-Admins
│   └── installationsweiter SSF-Runtime-Service-Client
├── Tenant-Realm A
│   ├── Studio-Client
│   ├── SSF-Client
│   └── gemeinsame Tenant-Benutzer
└── Tenant-Realm B
    ├── Studio-Client
    ├── SSF-Client
    └── gemeinsame Tenant-Benutzer
```

Für jeden Mandanten wird ein eigener Realm provisioniert. Ein Benutzer gehört
genau einem Mandanten. Dieselbe natürliche Person benötigt für zwei Mandanten
zwei getrennte Identitäten; gleiche E-Mail-Adressen führen nicht zu einer
automatischen Kontoverknüpfung.

Innerhalb eines Tenant-Realms verwenden Studio und SSF getrennte OIDC-Clients
und Audiences, aber dieselbe Benutzeridentität mit demselben OIDC-`sub`. Eine
zweite Subject-ID oder eine Korrelation über E-Mail beziehungsweise
Benutzername existiert nicht. Root-Benutzer werden nicht in Tenant-Realms
kopiert. Der Realm `master` ist kein Anwendungsrealm. Gäste mit
SSF-Session-Token bleiben außerhalb des Studio-IAM.

Der Studio-seitig provisionierte Client `ssf` bleibt bis zur gemeinsamen
Providerintegration deaktiviert und besitzt keine Redirect-, Logout- oder
Web-Origin-Freigaben; OIDC-Protokoll, vertraulicher Client-Modus sowie die
explizit abgeschalteten Standard-, Implicit- und Direct-Access-Flows und Service
Accounts sind Bestandteil des Read-backs. Sein
Audience-Mapper schreibt `ssf` in Access- und
Introspection-Tokens, nicht in ID-Tokens. Der Vertrag ist versioniert und
allowlist-basiert; zusätzliche, vom Plugin
eingeschleuste Keycloak-Felder werden vor jedem Read oder Write abgelehnt.
Der operative Keycloak-Status und der Instanz-Audit verdichten den Read-back
aller deklarierten Plugin-OIDC-Clients in einen gemeinsamen Alignment-Befund.
Nach einer Studio-Client-Secret-Rotation verwendet der Registry-Abgleich einen
separaten schmalen Secret-Read. Derselbe Port wird nach der initialen
Secret-Erzeugung verwendet, damit keine erneute Plugin- oder Mapper-Inspektion
zwischen erfolgreicher Erzeugung beziehungsweise Rotation und persistierter
Secret-Aktualisierung liegt.
Scheitert der SSF-Client-Abgleich direkt nach der nachweislich durch denselben
Aufruf erfolgten Realm-Anlage, wird nur dieses noch client-secret-freie Realm
kompensierend entfernt. Ein vorbestehendes Realm wird nie gelöscht; ein
fehlgeschlagener Cleanup erzeugt einen fail-closed Befund mit erforderlicher
manueller Bereinigung.

## SSF-Plugin-Datenbank

Das SSF-Plugin besitzt eine einzige PostgreSQL-Datenbank pro SSF-Installation.
Sie enthält sowohl installationsweite als auch tenantbezogene Konfiguration.
Der Studio Core kennt keine SSF-Tabellen oder SSF-Fachfelder.

Für jede vorbereitete Studio-Instanz enthält `ssf.tenants` genau einen
Tenant-Grunddatensatz mit kanonischer `instanceId`, Status `prepared` und
positiver Revision. Dieser Zustand besagt ausschließlich, dass die lokale
Plugin-Ressource angelegt wurde; die generische Lifecycle-Plattform bleibt die
führende Quelle für Readiness, Jobs und Retry. Die Root-Rolle kann den
Grunddatensatz anlegen und aktualisieren, aber nicht löschen. Die
tenantgebundene Runtime darf ausschließlich den eigenen Datensatz lesen.

Tenantbezogene Datensätze führen die kanonische Studio-`instanceId` als
Mandantenschlüssel. Tenantzugriffe werden serverseitig an diesen Kontext
gebunden und durch Row-Level Security abgesichert. Root-Zugriffe verwenden
einen getrennten, ausdrücklich autorisierten Datenbankpfad. Datenbankmigrationen,
fachliche Repositories und Schema-Ownership liegen beim SSF-Plugin.

## Administrationsoberflächen für die Runtime-Konfiguration

Das installierte SSF-Plugin stellt zwei bewusst getrennte Studio-Oberflächen
bereit:

- Root-`system_admin`: `System → SSF-Standards` für installationsweite
  Standards.
- Tenant-`system_admin`: `Anwendungen → Kassel DIALOG` für geerbte Werte
  und tenantbezogene Overrides.

Die Root-Oberfläche ist an den Plattform-Scope und die Rolle
`instance_registry_admin` gebunden. Die Tenant-Oberfläche trennt Lesen und
Schreiben über `ssf.configuration.tenant.read` und
`ssf.configuration.tenant.manage`; die `instanceId` stammt ausschließlich aus
dem verifizierten Plugin-Ausführungskontext. Beide Schreibpfade validieren den
vollständigen Request, bereinigen HTML nach der vorhandenen SSF-Policy und
speichern die Konfiguration in einer Transaktion.

Die Oberflächen verwalten Standardsprache, Sprachaktivierung, die drei
lokalisierten Erklärungstexte und den Modus der Gesprächsspeicherung. Branding,
Logo, Icon, Tenantname und Zeitzone gehören ausdrücklich nicht zu diesen
Schreibverträgen. Die Runtime-API bleibt die kanonische Sicht auf die vollständig
aufgelöste Konfiguration einschließlich ihrer Revision.

Die Datenbank kann später insbesondere enthalten:

- installationsweite Modell-, Integrations- und Standardkonfiguration,
- tenantbezogene Texte, Sprachen und Optionen,
- Quoten und tenantbezogene Konfigurationsrevisionen,
- SSF-spezifische Readiness- und Synchronisationszustände.

Binäre Medien sollen nicht dupliziert werden. Das SSF-Plugin speichert
Referenzen auf die vorhandene Studio-Medienverwaltung und liefert ausschließlich
autorisierte beziehungsweise geeignete Auslieferungsreferenzen an SSF.

## Interne API zwischen SSF und Studio

SSF bestimmt den Mandanten aus einem gültigen Session-Token oder einer
Keycloak-Anmeldung. Anschließend ruft das SSF-Backend die interne Studio-API mit
einer eigenen Service-Identität und der daraus abgeleiteten kanonischen
Tenant-ID im Header `X-Studio-Tenant-Id` auf. Studio löst diese externe ID auf
den internen Registry-Datensatz mit seiner `instanceId` auf.

Der Studio-Host prüft zuerst das Service-Token einschließlich Audience,
Authorized Party und `ssf.runtime-configuration.read`. Erst danach wertet er
den Header aus und bindet ihn über die Instanz-Registry, Aktivierungs- und
Readiness-Gates an den Execution-Context. Für diesen idempotenten Read gibt es
keine zweite Tenant-Signatur und keinen Replay-Speicher. Browser erhalten weder
Datenbank-Credentials noch direkten Zugriff auf diese interne API.

Datenbankbereitschaft und `authorizationRevision` liest der Host aus demselben
prozesslokalen SSF-Datenbankpool, den auch der Plugin-Handler verwendet. Die
Zeitzone stammt aus dem bereits hostvalidierten generischen Instanzprofil;
dadurch entsteht weder eine zweite Tenant-Auflösung noch eine SSF-spezifische
Kopie der Instanzstammdaten.

Das installationsweite Service-Token stammt vom technischen Client im
Studio-Root-Realm. Es ist nicht an einen einzelnen Tenant gebunden und enthält
deshalb keine `ssf_authorization_revision`. Bei einem authentifizierten
Benutzervorgang vergleicht SSF stattdessen die Revision aus dem
Tenant-Benutzertoken mit der vom Runtime-Endpunkt für genau diesen Tenant
gelieferten bestätigten Revision.

## Laufzeitablauf der ersten Ausbaustufe

### Mandant anlegen

```text
Root-System-Admin legt eine Studio-Instanz an
    → Core provisioniert den Tenant-Realm und getrennte OIDC-Clients
    → Core richtet den initialen Tenant-Admin ein
    → Core aktiviert das installierte automatische SSF-Plugin
    → Core materialisiert die tenantlokale SSF-IAM-Basis
    → SSF-Plugin legt die Tenant-Grunddaten in seiner Datenbank an
    → Readiness-Prüfungen bestätigen Realm, Clients, IAM und Plugin-Daten
    → Tenant wird als nutzbar ausgewiesen
```

Jeder Schritt besitzt einen persistenten, diagnostizierbaren Zustand.
Wiederholungen reconciliieren denselben Sollzustand und erzeugen weder einen
zweiten Realm noch einen zweiten SSF-Tenantdatensatz. Teilweise eingerichtete
Tenants bleiben fail-closed.

### Benutzer verwalten

Nach erfolgreicher Anlage verwaltet der Tenant-Admin Benutzer und Rollen über
die bestehende tenantlokale Studio-IAM-Oberfläche. Alle Mutationen werden gegen
den aktiven Instanzkontext autorisiert und ausschließlich im zugehörigen
Tenant-Realm ausgeführt. Root-Rechte verleihen keine tenantlokalen Rechte und
tenantlokale Rollen keine Root-Rechte.

### SSF-Plugin deaktivieren und reaktivieren

Bei einem `automatic`-Plugin darf der Root-System-Admin die Aktivierung eines
Tenants manuell aufheben. Dadurch werden tenantbezogene SSF-Routen und interne
SSF-Konfigurationszugriffe gesperrt. Persistierte Konfiguration und Auditspur
bleiben erhalten. Eine spätere Reaktivierung reconciliiert Schema, IAM-Basis und
Tenant-Grunddaten, bevor der Status erneut `ready` wird.

## Lieferumfang und spätere Ausbaustufen

### Plattformgrundlagen

- generische platformgebundene Plugin-Beiträge,
- Aktivierungsrichtlinien `optional`, `automatic` und `required`,
- generischer Plugin-Tenant-Lifecycle für Provisionierung, Reconcile,
  Suspendierung, Reaktivierung und Readiness,
- gemeinsame Plugin-Operations-, Audit- und Statusverträge.

### Erste nutzbare SSF-Ausbaustufe

- Installation und automatische Tenant-Aktivierung des SSF-Plugins,
- Studio-Root- und Tenant-Realm-Provisionierung in der gemeinsam genutzten
  Keycloak-Instanz,
- initialer Tenant-Admin,
- Tenant-Anlage, Sperrung und Reaktivierung,
- tenantlokale Benutzer- und Rollenverwaltung,
- SSF-Plugin-Datenbank und Tenant-Grunddatensatz,
- Audit, Reconcile und Readiness.

### SSF-Runtime-Konfiguration

- generischer interner Plugin-Servicevertrag,
- SSF-Service-Identität und hostvalidierte Tenant-Bindung,
- minimale interne SSF-Konfigurations-API,
- Aktivierungs-, Suspendierungs- und Readiness-Gates.

### Spätere Ausbaustufen

- vollständige Branding-, Text-, Modell- und Optionsverwaltung,
- ClickHouse- und Session-Daten-Auswertungen,
- Nutzungs-, Kosten- und Kapazitätsberichte,
- kontrollierter Supportzugriff,
- Anzeige von Gesprächsinhalten, sofern fachlich und datenschutzrechtlich
  freigegeben.

SSF bleibt für ClickHouse, Session-Daten und Gesprächsinhalte führend. Das
Studio soll diese Daten später über eine interne SSF-Admin- beziehungsweise
Reporting-API konsumieren und nicht direkt auf die SSF-Laufzeitdatenbanken
zugreifen.

## Sicherheits- und Qualitätsgrenzen

- Authentifizierung, Tenant-Auflösung und Autorisierung werden serverseitig
  durchgesetzt.
- Root- und Tenant-Scope bleiben in UI, API, Keycloak und Datenbank getrennt.
- Plugin- und Service-Secrets gelangen weder in Browserantworten noch in Logs
  oder Audit-Nutzdaten.
- Provisionierung, Reconcile und interne Mutationen sind idempotent und
  auditierbar.
- Fehlerzustände geben keine teilweise eingerichteten Fachzugriffe frei.
- Plugin-Deaktivierung löscht keine Daten automatisch.
- Gesprächsinhalte sind kein Bestandteil der ersten Ausbaustufe.

## In den OpenSpec-Changes zu präzisieren

Die normativen Spezifikationen müssen während ihrer jeweiligen Umsetzung
insbesondere konkrete API-Schemas, Permission-IDs, Datenbanktabellen,
Readiness-Zustände, Retry-Grenzen, Tokenlaufzeiten und den Migrationspfad für
bereits bestehende Studio-Instanzen festlegen. Außerdem sind die betroffenen
arc42-Abschnitte 03 bis 08, 10 und 11 sowie ADRs für Realm-, Plugin- und
Trust-Boundary-Entscheidungen zu aktualisieren.
