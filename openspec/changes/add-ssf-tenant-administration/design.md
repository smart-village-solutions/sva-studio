## Aktueller Lieferstand: Ergänzung Issue #1319

Der nachfolgend beschriebene ursprüngliche Voraussetzungsslice wird durch #1319
bis zur lokalen Login-Bereitschaft erweitert. Der deaktivierte Client `ssf`
bleibt Ressourcenclient. Der zusätzliche Browservertrag 2.0 für `ssf-frontend`
verwendet die explizite HTTPS-Installationsorigin, PKCE S256 und den begrenzten
Redirect `/login/*`. Nach der Client-Provisionierung wird zuerst die IAM-Projektion
bestätigt und danach der Tenant-Grunddatensatz provisioniert; beides liegt vor
`ready`; Directory und Runtime prüfen denselben Readiness-Pfad. Die ursprüngliche
Stopplinie vor der Lifecycle-Anbindung ist damit für die lokale Implementierung
überholt. Der echte revisionsgleiche SSF-/Staging-Nachweis bleibt offen.

## Context

Eine Studio-Installation läuft innerhalb derselben Deployment-Grenze wie genau
eine SSF-Installation. Das Studio übernimmt deren administrative Control Plane;
SSF bleibt fachliche Runtime. Der erste eigenständig nutzbare Lieferumfang ist
Mandanten- und Nutzerverwaltung, nicht Runtime-Konfiguration oder Auswertung.

## Goals / Non-Goals

### Goals

- SSF als normales, automatisches Plugin installieren.
- Einen SSF-Mandanten über die bestehende Studio-Instanzverwaltung anlegen.
- Root-, Tenant- und Customer-Identitäten strikt trennen.
- Bestehende IAM-Oberflächen für tenantlokale Verwaltung wiederverwenden.
- Einen SSF-Tenant-Grunddatensatz sicher und idempotent provisionieren.
- Betrieb, Readiness und Reparatur im bestehenden Instanz-Cockpit zeigen.

### Non-Goals

- Keine interne Runtime-Konfigurations-API.
- Keine vollständige Branding-, Text-, Modell- oder Optionsverwaltung.
- Keine ClickHouse-, Session- oder Gesprächsauswertungen.
- Keine reguläre Root-Verwaltung tenantlokaler Benutzer nach dem Bootstrap.
- Kein Supportzugriff und keine automatische Identitätsverknüpfung.

## Decisions

### Instanz-Registry bleibt die einzige Tenant-Registry

Eine kanonische Studio-`instanceId` bezeichnet genau einen SSF-Mandanten. Das
SSF-Plugin ergänzt Status und Aktionen in Instanzdetail, Setup, Doctor und
Operations. Eine eigene SSF-Tenant-Liste würde Lebenszyklus und Audit
duplizieren und wird nicht eingeführt.

### Rollenabbildung verwendet bestehendes IAM

| SSF-Rolle      | Studio-Abbildung                                 |
| -------------- | ------------------------------------------------ |
| `system_admin` | Root-Realm, `instance_registry_admin`            |
| `tenant_admin` | Tenant-Realm, geschützter `system_admin`         |
| `admin`        | Tenant-Account mit gezielten `ssf.*`-Permissions |
| `customer`     | keine Studio-Identität                           |

Der Root-Admin erzeugt nur den initialen Tenant-Admin. Danach laufen reguläre
Benutzer-, Rollen- und Gruppenmutationen ausschließlich im Tenant-Scope.

### Plugin deklariert zusätzliche Keycloak-Artefakte, Core provisioniert sie

Der Core bleibt alleiniger Aufrufer der Keycloak Admin API. Das SSF-Plugin
deklariert die zusätzlich benötigten Studio-/SSF-Clients und Audiences. Login-,
Tenant-Admin- und spätere Service-Clients bleiben getrennt und werden im
Instanzvertrag nachgewiesen.

Der erste Voraussetzungsslice erweitert dafür ausschließlich den vorhandenen
Provisionierungsweg um einen engen, versionierten und allowlist-basierten
Client-Vertrag. Er erlaubt keine freien Keycloak-Admin-Operationen aus Plugins,
keine zweite Tenant-Registry und keinen alternativen Provisionierungsdienst.
Realm und Tenant werden ausschließlich aus der kanonischen Instanz-Registry
aufgelöst. Die stabile Client-ID und Audience dürfen nicht aus einem
Projektionsauftrag oder einem Request übernommen werden.

Der tenantlokale SSF-Client bleibt standardmäßig deaktiviert. Ohne später
abgestimmten Client-Typ, exakte Callback-URIs und SSF-URL-Konfiguration darf die
Provisionierung keine nutzbare Anmeldung freigeben. Wildcard-Redirects sind
nicht zulässig. Read-back und Driftprüfung müssen Client und Realm nach jedem
Write erneut über den Core verifizieren; Secrets gelangen weder in die
Plugin-Datenbank noch in API-Antworten, Audit oder Logs.

### Studio-seitige Integrationsreife endet an der Providergrenze

Der erste Lieferabschnitt macht das Studio ohne Änderungen am SSF-Provider
integrationsbereit. Er umfasst den tenantlokalen Client-Vertrag, idempotente
Provisionierung, kanonische Clientauflösung für die IAM-Projektion sowie
Zwei-Tenant-, Drift-, Secret- und Teilfehlernachweise. Ein Fehler lässt den
SSF-Client deaktiviert und darf weder den Studio-Client noch Studio-Login oder
die gemeinsame Realm-Sitzung verändern.

Die bestehende Lifecycle- und Readiness-Plattform bildet fehlende
Provider-Konfiguration fail-closed als nicht bereit ab. Dafür entsteht keine
zweite Zustandsmaschine, kein neuer Jobtyp und keine eigene Retry-Schleife. Die
versionierten Runtime- und Datenbank-Aktivierungsflags bleiben bis zum späteren
gemeinsamen Nachweis deaktiviert.

Nicht Bestandteil dieses Lieferabschnitts sind:

- produktive Anbindung des Projektions-Reconcilers an den Plugin-Lifecycle,
- Aktivierung des SSF-OIDC-Clients,
- providerseitiger tenantgebundener Sammelwiderruf,
- revisionsgleiche Abnahme von Benutzertoken, Host-Readiness und Runtime,
- gemeinsamer Staging-E2E und Production-Aktivierung,
- eine über vorhandene generische Statusflächen hinausgehende SSF-Admin-UI.

Diese Punkte bilden später zusammen mit dem SSF-Provider einen vertikalen
End-to-End-Slice. Ein simulierter Provider weist bis dahin nur die
Studio-seitige Vertragstreue nach und ist kein Produktionsnachweis.

### Eine gemeinsame SSF-Datenbank bleibt plugin-owned

Pro SSF-Installation existiert eine SSF-Plugin-Datenbank. Tenanttabellen führen
`instanceId`; serverseitiger Transaktionskontext und RLS erzwingen Isolation.
Root-Operationen verwenden einen getrennten, explizit autorisierten Pfad. Das
Plugin besitzt Schema, Migrationen, Repositories und eigene Sollschema-Doku.

Die gemeinsame Lifecycle-Plattform stellt nur Job, Claim, Audit, Progress und
Readiness bereit. Sie vereinheitlicht nicht die Datenbanktopologie mit Waste.

Der lokale Tenant-Grunddatensatz liegt in `ssf.tenants`. Seine `instance_id`
ist Primärschlüssel und übernimmt unverändert die kanonische Studio-Instanz-ID.
Der anfängliche Status `prepared` bestätigt ausschließlich die lokale
Plugin-Ressource; er dupliziert weder Readiness noch Job- oder Retry-Zustände.
Die positive Revision beginnt bei `1`. Root darf den Datensatz anlegen, lesen
und aktualisieren, aber nicht löschen; die Tenant-Runtime darf nur den durch
den serverseitigen Transaktionskontext gebundenen Datensatz lesen.

### Tenant-Anlage nutzt den generischen Lifecycle

1. Studio-Instanz anlegen.
2. Tenant-Realm und deklarierte Clients provisionieren.
3. Initialen Tenant-Admin anlegen.
4. SSF über `automatic` aktivieren.
5. Tenantlokale `ssf.*`-IAM-Basis materialisieren.
6. SSF-Tenant-Grunddatensatz über `provision` anlegen.
7. Plugin- und Core-Readiness getrennt prüfen und aggregieren.

Teilzustände bleiben sichtbar, aber SSF-Fachzugriffe fail-closed. Suspendierung
und Reaktivierung erhalten Instanz-, Realm- und Datenidentität.

## Risks / Trade-offs

- Keycloak-Client-Deklarationen können zu mächtig werden. → Enger,
  allowlist-basierter Vertrag; keine freien Admin-Operationen aus Plugins.
- RLS-Fehler könnten Tenant-Isolation verletzen. → Getrennte DB-Principals,
  transaktionsgebundener Kontext und Zwei-Tenant-Negativtests.
- Root-UI könnte SSF-spezifisch verzweigen. → Generische Pluginstatusflächen;
  SSF-Texte und Fachaktionen bleiben Contributions.

## Migration Plan

1. Voraussetzungen in Plugin-Scope/Aktivierung und Lifecycle bereitstellen.
2. Den laufenden Runtime-/IAM-Foundation-PR ohne zusätzliche Fachfunktion auf
   aktuellem `main` review- und mergebereit abschließen.
3. Den tenantlokalen SSF-OIDC-Client als kleinen, rein Studio-seitigen Slice
   deklarieren, idempotent provisionieren und für die IAM-Projektion kanonisch
   auflösbar machen; der Client bleibt deaktiviert.
4. An der Providergrenze bewusst stoppen. SSF-Plugin-Datenbank und Runtime
   bleiben in den Remote-Profilen deaktiviert; fehlende Provider-Konfiguration
   bleibt ein nicht bereiter Zustand.
5. Später gemeinsam mit SSF die exakten Callback-/Clientparameter, den
   tenantgebundenen Sammelwiderruf und die produktive Lifecycle-Anbindung
   umsetzen.
6. Projektion, Tokenclaim, Runtime-Antwort und Widerruf im Staging-E2E an
   denselben Digest binden.
7. Erst nach vollständiger Readiness über den kanonischen Promote-Workflow zur
   Nutzung freigeben.

Rollback sperrt SSF-Beiträge und Lifecycle-Jobs, entfernt aber weder Realms noch
Plugin-Daten automatisch.
Davon getrennt ist die enge Kompensation innerhalb desselben initialen
Provisionierungsaufrufs: Hat genau dieser Aufruf das Realm neu erzeugt und
scheitert der unmittelbar folgende SSF-Client-Abgleich noch vor der Anlage
geheimnistragender Studio- oder Tenant-Admin-Clients, darf er dieses Realm
entfernen. Vorbestehende Realms sind ausgeschlossen; ein Cleanup-Fehler verlangt
eine explizite manuelle Bereinigung und darf keine Retryfähigkeit vortäuschen.
Nach der Erzeugung oder Rotation von Client-Secrets verwendet deren
Registry-Synchronisierung ausschließlich den schmalen Secret-Read und führt
keinen weiteren SSF-Client- oder Mapper-Read aus. Die Composition Root leitet
die deklarativen Plugin-OIDC-Anforderungen aus den tatsächlich geladenen
Plugin-Quellen des validierten Host-Katalogs ab; dieselbe Liste steuert
Provisionierung und Client-ID-Reservierung. Die Reservierung wird an der
Service-/Mutation-Trust-Boundary erzwungen; HTTP validiert nur ergänzend früh.
Vor der späteren Aufnahme von SSF in den Host-Katalog muss auch der direkte
Instance-Registry-CLI dieselbe kanonische Requirement-Quelle erhalten oder
plugin-aware Mutationen fail-closed ablehnen.

## Open Questions

- Konkrete `ssf.*`-Permission-IDs der ersten Verwaltungsoberflächen.
- Exakte externe SSF-Redirect-URIs; Client-ID und Audience werden im
  Voraussetzungsslice stabil festgelegt, Redirect-URIs bleiben bis zur
  abgestimmten SSF-URL-Konfiguration fail-closed.
- Retry-Grenzen der Keycloak- und Datenbankprovisionierung.
