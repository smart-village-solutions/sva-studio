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

### Eine gemeinsame SSF-Datenbank bleibt plugin-owned

Pro SSF-Installation existiert eine SSF-Plugin-Datenbank. Tenanttabellen führen
`instanceId`; serverseitiger Transaktionskontext und RLS erzwingen Isolation.
Root-Operationen verwenden einen getrennten, explizit autorisierten Pfad. Das
Plugin besitzt Schema, Migrationen, Repositories und eigene Sollschema-Doku.

Die gemeinsame Lifecycle-Plattform stellt nur Job, Claim, Audit, Progress und
Readiness bereit. Sie vereinheitlicht nicht die Datenbanktopologie mit Waste.

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
2. Den tenantlokalen SSF-OIDC-Client als kleinen Voraussetzungsslice
   deklarieren, idempotent provisionieren und für die IAM-Projektion auflösbar
   machen.
3. SSF-Plugin und eigene Datenbank installieren, aber Fachzugriffe geschlossen
   halten.
4. SSF als `automatic` registrieren und neue Testinstanzen provisionieren.
5. Bestandsinstanzen per Dry-Run klassifizieren und kontrolliert reconciliieren.
6. Erst nach vollständiger Readiness zur Nutzung freigeben.

Rollback sperrt SSF-Beiträge und Lifecycle-Jobs, entfernt aber weder Realms noch
Plugin-Daten automatisch.

## Open Questions

- Konkrete `ssf.*`-Permission-IDs der ersten Verwaltungsoberflächen.
- Exakte externe SSF-Redirect-URIs; Client-ID und Audience werden im
  Voraussetzungsslice stabil festgelegt, Redirect-URIs bleiben bis zur
  abgestimmten SSF-URL-Konfiguration fail-closed.
- Tabellen- und Indexnamen des SSF-Tenant-Grundmodells.
- Retry-Grenzen der Keycloak- und Datenbankprovisionierung.
