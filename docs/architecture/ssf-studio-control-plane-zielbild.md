# SSF-Control-Plane im SVA Studio: Zielbild

## Status und Zweck

Dieses Dokument hält die abgestimmte Architekturgrundlage für die Nutzung des
SVA Studios als administrative Control Plane einer Smart-Speech-Flow-
Installation (SSF) fest. Es beschreibt weiterhin das übergreifende Zielbild;
der aktuelle Implementierungsstand ist in den verlinkten OpenSpec-Changes und
den arc42-Abschnitten festgehalten. Die normative Ausarbeitung ist
in vier aufeinander aufbauende OpenSpec-Changes gegliedert:

1. [`extend-plugin-platform-scopes-and-activation`](../../openspec/changes/extend-plugin-platform-scopes-and-activation/proposal.md)
2. [`add-plugin-tenant-lifecycle`](../../openspec/changes/add-plugin-tenant-lifecycle/proposal.md)
3. [`add-ssf-tenant-administration`](../../openspec/changes/add-ssf-tenant-administration/proposal.md)
4. [`add-ssf-runtime-configuration-api`](../../openspec/changes/add-ssf-runtime-configuration-api/proposal.md)

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

## SSF-Plugin-Datenbank

Das SSF-Plugin besitzt eine einzige PostgreSQL-Datenbank pro SSF-Installation.
Sie enthält sowohl installationsweite als auch tenantbezogene Konfiguration.
Der Studio Core kennt keine SSF-Tabellen oder SSF-Fachfelder.

Tenantbezogene Datensätze führen die kanonische Studio-`instanceId` als
Mandantenschlüssel. Tenantzugriffe werden serverseitig an diesen Kontext
gebunden und durch Row-Level Security abgesichert. Root-Zugriffe verwenden
einen getrennten, ausdrücklich autorisierten Datenbankpfad. Datenbankmigrationen,
fachliche Repositories und Schema-Ownership liegen beim SSF-Plugin.

Die Datenbank kann später insbesondere enthalten:

- installationsweite Modell-, Integrations- und Standardkonfiguration,
- tenantbezogene Logos, Icons, Texte, Sprachen und Optionen,
- Quoten und tenantbezogene Konfigurationsrevisionen,
- SSF-spezifische Readiness- und Synchronisationszustände.

Binäre Medien sollen nicht dupliziert werden. Das SSF-Plugin speichert
Referenzen auf die vorhandene Studio-Medienverwaltung und liefert ausschließlich
autorisierte beziehungsweise geeignete Auslieferungsreferenzen an SSF.

## Interne API zwischen SSF und Studio

SSF bestimmt den Mandanten aus einem gültigen Session-Token oder einer
Keycloak-Anmeldung. Anschließend ruft das SSF-Backend die interne Studio-API mit
einer eigenen Service-Identität und der daraus abgeleiteten kanonischen
`instanceId` im Header `X-Studio-Instance-Id` auf.

Der Studio-Host prüft zuerst das Service-Token einschließlich Audience,
Authorized Party und `ssf.runtime-configuration.read`. Erst danach wertet er
den Header aus und bindet ihn über die Instanz-Registry, Aktivierungs- und
Readiness-Gates an den Execution-Context. Für diesen idempotenten Read gibt es
keine zweite Tenant-Signatur und keinen Replay-Speicher. Browser erhalten weder
Datenbank-Credentials noch direkten Zugriff auf diese interne API.

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
