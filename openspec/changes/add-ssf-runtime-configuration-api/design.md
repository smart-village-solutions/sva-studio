## Context

Eine Studio-Installation läuft gemeinsam mit genau einer SSF-Installation;
eine Studio-Instanz entspricht einem SSF-Mandanten. Das Studio ist führend für
Instanzidentität, Aktivierung, IAM und Readiness. Das SSF-Plugin besitzt die
SSF-Konfiguration. SSF konsumiert ausschließlich die vollständig aufgelöste
Runtime-Antwort und hält keine persistente Kopie.

Der vorhandene Plattform-Change für scopegebundene Plugin-Beiträge stellt den
generischen Server-Dispatch und die Aktivierungsrichtlinie bereit. Dieser
Change ergänzt ausschließlich die für den SSF-Service-Aufruf benötigte
Authentisierungsart und die pluginlokale Fachlogik.

## Goals / Non-Goals

### Goals

- Einen festen und unmittelbar aktuellen V1-Read-Vertrag bereitstellen.
- Serverseitige, tenantbezogene und ausgelieferte Produktwerte deterministisch
  auflösen.
- Eine einzige plugin-eigene PostgreSQL-Datenbank sicher mandantenfähig
  betreiben.
- Bestehende Studio-Verträge für Plugin-Aktivierung, Instanzstatus, Medien,
  Logging, Audit und Service-Token-Prüfung wiederverwenden.
- Den Slice unabhängig von der späteren Administrationsoberfläche und
  Keycloak-Permission-Projektion test- und mergebar halten.

### Non-Goals

- Keine Root- oder Tenant-Konfigurationsoberfläche und keine HTTP-Schreib-API.
- Keine Benutzer-, Rollen-, Realm- oder Client-Provisionierung.
- Keine Materialisierung von `ssf_permissions` oder SSF-Personas in
  Benutzertokens.
- Keine Gesprächsinhalte, Sessions, Einwilligungsdatensätze, ClickHouse- oder
  Reportingdaten.
- Keine persistente Konfigurationskopie, Offline-Fallback- oder Cache-Schicht
  in SSF.
- Kein Draft-/Publish-Modell und kein frei erweiterbares JSON-Schema.

## Decisions

### Plugin- und Host-Ownership bleiben getrennt

`@sva/plugin-ssf` besitzt:

- V1-Produktdefaults und ihre unterstützten Sprachen,
- Fachtypen und Laufzeitvalidierung,
- PostgreSQL-Migrationen und Repositories,
- HTML-Bereinigung,
- Auflösung der effektiven Konfiguration,
- kanonische Serialisierung und `configurationRevision`,
- den fachlichen Plugin-Handler.

Der Host besitzt:

- exakten Pfad-/Methoden-Dispatch,
- Service-Token-Verifikation und Action-Prüfung,
- Auflösung der kanonischen `instanceId`,
- Instanz-, Aktivierungs- und Readiness-Gates,
- Bereitstellung der verifizierten `authorizationRevision`,
- Request-Kontext, Logging, Metriken und Sicherheits-Audit,
- Medien-URL-Auflösung über eine versionierte Host-Capability.

Der Core enthält keine SSF-Texte, Policies, Defaults oder Tabellen.

### Der erste Slice ist Read-seitig vollständig, aber produktiv fail-closed

Der Handler und der vollständige Response-Vertrag werden implementiert. Der
Host übergibt dem Handler eine verifizierte `authorizationRevision`. Solange
der spätere SSF-IAM-Projektionspfad diese Revision für einen Tenant nicht als
bereit bestätigt, antwortet der Host mit `409 ssf_tenant_not_ready` und führt
den Handler nicht aus.

Tests und lokale Integrationsprofile dürfen einen ausdrücklich als verifiziert
markierten Revisionsprovider verwenden. Es gibt keinen Platzhalterwert und
keine Ableitung aus einer lediglich gewünschten, aber nicht projizierten
Permission-Menge.

### Service-Token-Vertrag bleibt einfach und installationsweit

Der interne Endpoint lautet fest:

```http
GET /internal/plugins/ssf/v1/runtime-configuration
Authorization: Bearer <service-token>
X-Studio-Instance-Id: <canonical-instance-id>
X-Correlation-Id: <correlation-id>
```

Der Host verifiziert über `jose` und JWKS mindestens:

- Signatur mit `RS256`,
- exakten Issuer,
- Audience `sva-studio-ssf-runtime`,
- Authorized Party/Client-ID `ssf-runtime`,
- vorhandenes und gültiges `exp`,
- Client-Action `ssf.runtime-configuration.read`.

Issuer, Audience und Client-ID sind deploymentseitig explizit konfigurierbar;
die genannten Werte sind die V1-Defaults. Der SSF-Service-Account benötigt
keine menschliche Plattformrolle. Ein fehlender oder unvollständiger Vertrag
ist kein Fallback, sondern `503 runtime_configuration_unavailable`.

Der installationsweite Service-Client liegt im Studio-Root-Realm der gemeinsam
von Studio und SSF verwendeten Keycloak-Instanz. Sein Token ist nicht
tenantgebunden und enthält keine `ssf_authorization_revision`. Der Host liest
die bestätigte Revision erst nach der Bindung von
`X-Studio-Instance-Id`. Tenant-Benutzertokens stammen dagegen aus dem
gemeinsamen Tenant-Realm und tragen die Revision für den SSF-seitigen Vergleich
beim Sessionaufbau.

`X-Studio-Instance-Id` wird erst nach erfolgreicher Service-Authentisierung
verwendet und gegen die kanonische Instanz-Registry aufgelöst. Pfad, Query und
Body dürfen keinen konkurrierenden Tenantwert liefern. Direkte Browserrequests
und SSF-Gast-/Benutzertokens werden nicht als Studio-Service-Identität
akzeptiert.

### Eine getrennte Datenbank enthält normalisierte Override-Daten

Die Deployment-Einheit betreibt genau eine Datenbank für das installierte
SSF-Plugin. Tabellen und Spalten verwenden lowercase `snake_case`,
`timestamptz`, benannte Constraints und explizite Indizes.

V1 verwendet folgende fachliche Tabellen:

| Tabelle               | Zweck und Schlüssel                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `ssf.server_settings` | Singleton für installationsweite skalare Overrides und Branding-Referenzen                       |
| `ssf.server_locales`  | ein Datensatz pro Locale für installationsweite Verfügbarkeit und Text-Overrides                 |
| `ssf.tenant_settings` | ein Datensatz pro `instance_id` für Policies, Standardsprache, Speichermodus und Tenant-Branding |
| `ssf.tenant_locales`  | ein Datensatz pro `(instance_id, locale)` für Aktivierung und einzelne Text-Overrides            |

Produktdefaults werden nicht in die Datenbank kopiert. Fehlende Zeilen und
`NULL`-Felder bedeuten „kein Override“, nicht einen leeren Wert. Bewusst leere
Texte werden als bereinigtes, nicht-null HTML gespeichert.

`instance_id` ist in allen Tenanttabellen Bestandteil des Primär- oder eines
eindeutigen Schlüssels. Typische Reads verwenden `(instance_id, locale)`.
Check-Constraints begrenzen Locale, Modus, Textgröße, URL- und Alternativtext.
Zeitwerte werden als `timestamptz` gespeichert.

Die Datenbank verwendet getrennte Principals für Migration, installationsweite
Root-Schreibpfade und tenantgebundene Runtime. Tenantzugriffe setzen innerhalb
einer Transaktion `app.instance_id`; erzwungene RLS und Repository-Prädikate
begrenzen Reads und Writes zusätzlich. Rootzugriffe erfolgen nur über einen
separaten Hostpfad mit minimalen Grants. Zwei-Tenant-Negativtests sind ein
Merge-Gate.

Da die Tabellen nicht in `sva_studio` liegen, bleibt
`docs/development/studio-db-schema-final.sql` strukturell unverändert. Der
Change prüft und dokumentiert diese Abgrenzung, ergänzt einen eigenen
`docs/development/ssf-plugin-db-schema-final.sql` und aktualisiert die
Schemaübersicht.

### Feldweise Auflösung verwendet genau drei Ebenen

Für jedes skalare Feld und jeden Text gilt:

```text
Tenant-Override
  ?? serverweiter Override
  ?? versionierter Produktdefault
```

Serverweit deaktivierte Sprachen stehen Tenants nicht zur Verfügung. Ohne
Tenant-Sprachzeile sind alle installationsweit verfügbaren Produktsprachen
aktiv. Mindestens eine Sprache bleibt aktiv und `defaultLocale` muss aktiv
sein.

Policies werden nach der Override-Auflösung angewendet:

- Ohne `custom_branding_allowed` bleibt gespeichertes Tenant-Branding
  unwirksam.
- Ohne `conversation_content_storage_allowed` ist der effektive Modus immer
  `disabled`.
- Bei effektivem Modus `disabled` ist die Speicherfrage in jeder Locale
  `null`.

Medienreferenzen werden erst nach Tenant- und Policy-Prüfung über die
hostgestellte Medien-Capability in eine URL und einen Alternativtext
aufgelöst. Die Plugin-Datenbank enthält keine Binärdaten und keine
datenbankübergreifenden Fremdschlüssel.

### HTML bleibt flexibel, aber nicht unmittelbar ausführbar

Das Plugin verwendet die bereits im Workspace etablierte Bibliothek
`sanitize-html`. Der V1-Policy-Satz erlaubt eine breite Menge semantischer
Strukturelemente, Tabellen, Links und Bilder einschließlich externer HTTP-/
HTTPS-Bilder. Er entfernt mindestens:

- `script` und andere unmittelbar ausführbare Container,
- alle `on*`-Event-Handler,
- gefährliche URL-Schemata wie `javascript:` und `data:` für externe Inhalte,
- Dokumentstruktur-/Weiterleitungs-Tags wie `base`, `meta` und `link`.

Der Editor darf eine kleinere Auswahl anbieten. Die serverseitige Policy ist
versionierter Plugin-Code und kann bewusst erweitert werden; sie wird nicht
als starre kleine Produkt-Allowlist im API-Schema festgeschrieben. Externe
Bilder erhalten keine Domain-Allowlist und keinen verpflichtenden Proxy.

### Das Schema besitzt explizite Größen- und Formatgrenzen

- maximal 20 aktive Locales pro Response,
- Locale als gültiger BCP-47-Tag mit höchstens 35 Zeichen,
- jedes HTML-Feld höchstens 65.536 UTF-8-Bytes vor und nach Bereinigung,
- Anzeigename höchstens 200 Unicode-Zeichen,
- URL höchstens 2.048 Zeichen,
- Alternativtext höchstens 500 Unicode-Zeichen,
- `X-Correlation-Id` höchstens 128 druckbare ASCII-Zeichen,
- gesamte erfolgreiche JSON-Response höchstens 4 MiB.

OpenAPI und Zod-Schemas verwenden dieselben Konstanten. Grenzverletzungen in
gespeicherten Daten führen fail-closed zu
`503 runtime_configuration_unavailable`; sie werden nicht still gekürzt.

### Revisionen sind deterministisch und getrennt

`configurationRevision` wird als `sha256:<lowercase-hex>` über UTF-8-kodiertes
RFC-8785/JCS der vollständig aufgelösten Response ohne
`configurationRevision` und `authorizationRevision` berechnet. Locales werden
vorher nach normalisiertem Locale-Tag sortiert; optionale V1-Felder werden als
explizites `null` materialisiert.

Für JCS wird `json-canonicalize` in der zum Implementierungszeitpunkt geprüften
Major-Version 3 verwendet (MIT, TypeScript). Golden vectors sichern
Schlüsselreihenfolge, Unicode, `null`, Locale-Reihenfolge und unveränderte
Revisionen bei unwirksamen Overrides ab.

`authorizationRevision` stammt ausschließlich aus dem hostseitig als
verifiziert markierten IAM-Projektionszustand und ist nie Eingabe des
Konfigurationshashs.

### Reads sind unmittelbar und ohne fachlichen Cache

Jeder Endpoint-Aufruf liest die aktuellen Override-Daten in einer konsistenten
Read-only-Transaktion und löst danach Medien sowie Produktdefaults auf. Weder
Host noch Plugin führen in V1 einen fachlichen Konfigurationscache. Änderungen
sind daher beim nächsten Abruf sichtbar; eine bereits laufende SSF-Session
behält ihre geladene Darstellung.

Erfolgreiche Reads erzeugen strukturierte Logs und Metriken mit Tenant,
Revision, Dauer und Korrelations-ID, aber kein dauerhaftes Audit-Ereignis.
Abgelehnte Sicherheitszugriffe werden ohne Token, HTML oder fremde
Tenantdaten auditiert.

## Runtime Flow

```text
SSF validiert Benutzer- oder Gäste-Kontext und leitet instanceId ab
  -> SSF-Service ruft den internen V1-Endpoint auf
  -> Host prüft Service-Token, Action und Headerformat
  -> Host löst Instanz, Status, Plugin-Aktivierung und Readiness auf
  -> Host verlangt eine verifizierte authorizationRevision
  -> Host erzeugt tenantgebundenen Plugin-Execution-Context
  -> Plugin liest Server- und Tenant-Overrides in einer DB-Transaktion
  -> Plugin löst Produktdefaults, Policies und Medien auf
  -> Plugin bereinigt HTML und berechnet configurationRevision
  -> Host liefert das feste V1-Schema
```

## Error Contract

Der Endpoint verwendet den im V1-Vertrag festgelegten Fehlerkörper und genau
diese öffentlich stabilen Codes:

| Status | Codes                                                             |
| ------ | ----------------------------------------------------------------- |
| `401`  | `service_authentication_invalid`                                  |
| `403`  | `service_action_forbidden`                                        |
| `404`  | `tenant_not_found`                                                |
| `409`  | `tenant_suspended`, `ssf_plugin_inactive`, `ssf_tenant_not_ready` |
| `503`  | `runtime_configuration_unavailable`                               |

Interne Ursachen bleiben ausschließlich in PII-armen Logs und Metriken.

## Risks / Trade-offs

- Der erste Slice ist bis zur IAM-Projektion produktiv nicht für
  authentifizierte SSF-Nutzung freigeschaltet. Das ist ein bewusster
  fail-closed Zwischenstand statt einer erfundenen Revision.
- Eine gemeinsame Plugin-Datenbank erhöht die Bedeutung korrekter
  Tenant-Isolation. RLS, getrennte Principals, Repository-Prädikate und
  Zwei-Tenant-Tests bilden deshalb eine gemeinsame Invariante.
- Ungeproxte externe Bilder können Metadaten an Dritte übertragen. Dieses
  bekannte Produktrisiko bleibt gemäß freigegebenem Vertrag in der
  Verantwortung des administrierenden Mandanten.
- Reads ohne Cache koppeln SSF an Studio und PostgreSQL. Diese einfache
  Verfügbarkeitsgrenze ist für V1 ausdrücklich akzeptiert.

## Migration Plan

1. Voraussetzung `extend-plugin-platform-scopes-and-activation` auf dem
   Implementierungsbranch verfügbar machen und dessen exakte Verträge erneut
   prüfen.
2. Plugin-Package, feste Verträge und reine Auflösungslogik implementieren.
3. Plugin-Datenbank, Principals, Migrationen und Sollschema bereitstellen.
4. Service-Token-Vertrag generalisieren und Endpoint hinter deaktivierter
   Runtime-Freigabe integrieren.
5. Lokales Integrationsprofil mit verifiziertem Revisionsprovider und zwei
   Tenants abnehmen.
6. Produktive Freigabe erst zusammen mit der SSF-IAM-Projektion aktivieren.

Rollback deaktiviert den Endpoint und das Plugin, löscht aber weder Migrationen
noch gespeicherte Server-/Tenant-Overrides.

## Open Questions

Keine für diesen Slice. Client-/Audience-Defaults, Hashverfahren,
Sanitizer-Bibliothek, Größenlimits und der fail-closed Übergang zur späteren
IAM-Projektion sind festgelegt.
