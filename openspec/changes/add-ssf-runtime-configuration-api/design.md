## Context

SSF bestimmt einen Tenant aus einem gültigen SSF-Session-Token oder einer
Keycloak-Anmeldung. Das Studio darf diese ungebundene Behauptung nicht direkt
übernehmen. Die Runtime benötigt deshalb einen server-to-server-Vertrag, der
technische Identität und Tenant-Bindung getrennt belegt.

## Goals / Non-Goals

### Goals

- Wiederverwendbare interne Plugin-Service-Endpunkte bereitstellen.
- Service-Identität und Tenant-Bindung kryptografisch und serverseitig prüfen.
- Eine minimale versionierte SSF-Konfiguration sicher ausliefern.
- Replay, fremde Tenants und freie `instanceId` fail-closed ablehnen.

### Non-Goals

- Keine Browser-API für SSF-Konfiguration.
- Keine Studio-Verarbeitung von SSF-Customer-Session-Token.
- Keine vollständige Konfigurations- oder Branding-Oberfläche.
- Keine Analytics-, Session- oder Gesprächsdaten.

## Decisions

### Zwei unabhängige Nachweise sind erforderlich

1. Ein Keycloak-Service-Token belegt die SSF-Service-Identität und Action.
2. Eine kurzlebige Tenant-Assertion belegt den abgeleiteten Tenant.

Der Host bindet erst nach erfolgreicher Prüfung beider Nachweise die kanonische
`instanceId`. Freie Pfad-, Query-, Body- oder Headerwerte dürfen den Scope
weder erzeugen noch ersetzen.

### Interne Service-Handler sind generische Plugin-Beiträge

Ein Plugin deklariert Action, Audience-Anforderung, Tenant-Bindung und Handler.
Der Host besitzt Authentifizierung, Scope-Auflösung, Rate Limits, Fehlervertrag,
Audit und Execution-Context. Das Plugin besitzt Schema, Fachvalidierung und
Response.

### Replay-Schutz ist host-owned

Tenant-Assertions enthalten Issuer, Audience, `instanceId`, Ablaufzeit und
eindeutige Token-ID. Der Host speichert die Token-ID höchstens bis zum Ende des
zulässigen Zeitfensters und akzeptiert sie nur einmal. Schlüsselrotation und
Zeitabweichung werden explizit konfiguriert und getestet.

### Die erste SSF-Antwort bleibt minimal

Die Antwort enthält nur Vertragsversion, Konfigurationsrevision und die für die
SSF-Runtime freigegebene Basiskonfiguration. Sie enthält keine Service-Secrets,
Studio-IAM-Interna oder Installations-/Fremdtenantdaten.

## Runtime Flow

```text
SSF authentifiziert Customer oder Benutzer
  -> SSF leitet Tenant ab
  -> SSF-Service-Token + signierte Tenant-Assertion
  -> Host validiert Identität, Action, Assertion und Replay
  -> Host löst kanonische instanceId und Plugin-Readiness auf
  -> Host erzeugt tenantgebundenen Execution-Context
  -> SSF-Plugin liest per RLS-gebundenem Repository
  -> minimale versionierte Konfiguration
```

## Risks / Trade-offs

- Zwei Nachweise erhöhen Betriebsaufwand. → Gemeinsamer Hostvertrag,
  rotationsfähige Konfiguration und stabile Diagnosecodes.
- Replay-Speicher kann ausfallen. → Fail-closed und eigener Readiness-Befund.
- Zeitabweichung kann gültige Requests blockieren. → Eng begrenztes,
  dokumentiertes Clock-Skew-Fenster und Monitoring.
- Service-Handler könnten unkontrolliert wachsen. → Extension-Tier,
  namespaced Actions und deklarative Allowlist.

## Migration Plan

1. Generischen internen Service-Execution-Context und Validator bereitstellen.
2. SSF-Service-Client und Signaturschlüssel konfigurieren.
3. Replay-Speicher und Readiness aktivieren.
4. SSF-Handler zunächst gegen Testtenants integrieren.
5. Runtime-Abruf erst nach vollständigen Negativtests freigeben.

Rollback sperrt den internen Endpoint und lässt Tenant-Administration sowie
persistierte SSF-Konfiguration unverändert bestehen.

## Open Questions

- Konkreter API-Pfad und Versionsschema.
- Signaturalgorithmus, Assertion-Laufzeit und Clock-Skew.
- Replay-Speicher und maximale Aufbewahrungsdauer.
- Exaktes Schema der minimalen Basiskonfiguration.
