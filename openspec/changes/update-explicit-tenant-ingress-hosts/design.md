## Context

SVA Studio betreibt pro Umgebung ein App-Deployment für Root- und Tenant-Hosts. Die Anwendung löst den Tenant aus Host und Registry auf und lehnt unbekannte oder inaktive Hosts fail-closed ab. Der vorgelagerte Traefik routet aktuell jedoch nicht alle in der Registry vorhandenen Hosts: Dev und Staging enthalten nur Root-Host-Regeln, Production eine fest codierte Tenant-Liste.

Wildcard-DNS ist für die drei Parent-Domains bereits vorhanden. Die ausgelieferten Let’s-Encrypt-Zertifikate decken aktuell aber nur die Root-Hosts ab. Ein automatisiertes Wildcard-Zertifikat würde DNS-01 und Zugang des zentralen Traefik zur AutoDNS-API erfordern. Diese Infrastrukturgrenze soll mit diesem Change nicht erweitert werden.

## Goals / Non-Goals

### Goals

- Den vorgesehenen Dev- und Staging-Tenant über HTTPS erreichbar machen.
- Production auf eine explizit vom Betreiber bereitgestellte Tenant-Hostliste begrenzen.
- Einzelzertifikate über den bereits vorhandenen Traefik Certificate Resolver verwenden.
- Ingress-Freigabe, Registry-Aktivierung und externe Verifikation als sichtbaren Betriebsvertrag dokumentieren.
- Unbekannte Hosts trotz möglicher DNS-Auflösung weiterhin fail-closed behandeln.

### Non-Goals

- Keine Wildcard-Zertifikate und keine DNS-01-Konfiguration.
- Keine AutoDNS-Zugangsdaten im Studio-Stack.
- Keine dynamische Traefik-Konfiguration oder Zertifikatsausstellung aus dem Tenant-Erstellungsprozess.
- Keine Änderung der Registry-, IAM-, Keycloak- oder Datenbankmodelle.
- Keine Einführung eines zweiten Rolloutpfads neben GitHub Actions `Build` und `Promote`.

## Decisions

### Explizite Hostregeln pro Umgebung

Jede freigegebene Domain wird in der jeweiligen Compose-Datei als expliziter `Host(...)`-Matcher modelliert. Der Root-Host bleibt erhalten.

- Dev: `studio-dev.smart-village.app` und `de-teststadt-dev.studio-dev.smart-village.app`
- Staging: `studio-staging.smart-village.app` und `de-studio-sandbox.studio-staging.smart-village.app`
- Production: `studio.smart-village.app` und die nachfolgend bestätigte Production-Liste

Damit kann Traefik konkrete ACME-Domains aus der Routerregel ableiten und je Host ein Einzelzertifikat verwalten.

#### Bestätigte Production-Tenant-Liste

Die initiale Production-Freigabe umfasst exakt diese 63 `instanceId`s; der vollständige Host entsteht jeweils als `<instanceId>.studio.smart-village.app`:

```text
bb-ahrensfelde
bb-amt-schlieben
bb-angermuende
bb-bad-belzig
bb-bernau
bb-birkenwerder
bb-briesen
bb-dahme-spreewald
bb-eberswalde
bb-eisenhuettenstadt
bb-falkenberg-elster
bb-frankfurt-oder
bb-gransee
bb-gruenheide
bb-guben
bb-havelland
bb-herzberg-elster
bb-hohen-neuendorf
bb-kloster-lehnin
bb-koenigs-wusterhausen
bb-kyritz
bb-michendorf
bb-neuzelle
bb-nuthetal
bb-oberspreewald-lausitz
bb-panketal
bb-petershagen-eggersdorf
bb-prenzlau
bb-prignitz
bb-ruedersdorf
bb-schoenefeld
bb-seelow
bb-spremberg
bb-storkow
bb-uckermark
bb-wandlitz
bw-kommone
by-amorbach
by-augsburg
de-musterhausen
de-studio-sandbox
demo
eichenzell
hb-meinquartier
he-kassel
mv-crivitz
mv-hagenow
ni-goslar
ni-harsum
ni-lehrte
ni-osnabrueck
ni-papenburg
ni-wittingen
nrw-detmold
nrw-legden
rp-linz-am-rhein
sh-kiel
sh-nordapp
sl-sankt-wendel
st-arneburg-goldbeck
st-magdeburg
st-wittenberg
st-zeitz
```

Die Liste ist auf Eindeutigkeit und das zulässige einteilige DNS-/Instance-ID-Format geprüft. Ihre Reihenfolge ist kanonisch lexikografisch, damit Reviews und generierte Routerregeln deterministisch bleiben.

### Registry bleibt fachliche Sicherheitsgrenze

Eine Ingress-Regel autorisiert keinen Tenant fachlich. Die Runtime muss den normalisierten Host weiterhin gegen einen aktiven, exakt passenden Registry-Eintrag prüfen. Ein Host, der nur in Traefik steht, aber nicht aktiv registriert ist, bleibt abgelehnt. Umgekehrt ist ein Registry-Eintrag erst extern betriebsbereit, wenn Ingress, TLS und Smoke erfolgreich sind.

### Production-Änderungen nur über Promote

Die Production-Hostliste ist versionierte Deployment-Konfiguration. Ergänzungen oder Entfernungen werden geprüft, committed und mit dem kanonischen Promote-Prozess ausgerollt. Tenant-Erstellung verändert Traefik nicht direkt. Die Aktivierung eines neuen Production-Tenants darf erst erfolgen, wenn Hostregel, Zertifikat und externer Smoke nachweislich bereit sind.

### Kein vorgetäuschtes Wildcard-Zielbild

Dokumentation und Tests beschreiben den tatsächlich betriebenen expliziten Hostvertrag. Wildcard-DNS darf vorhanden bleiben, gilt aber ohne Wildcard-TLS und passenden Router nicht als Tenant-Freigabe. Eine spätere Umstellung auf `HostRegexp` plus Wildcard-Zertifikat benötigt einen eigenen Change.

## Alternatives Considered

### Wildcard-TLS über AutoDNS DNS-01

Technisch voraussichtlich möglich und langfristig skalierbarer. Nicht gewählt, weil Resolver-Konfiguration, API-Benutzer, Berechtigungsumfang und Ownership des gemeinsamen Traefik noch nicht geklärt sind.

### Einzelzertifikat bei Tenant-Erstellung

Nicht gewählt. Traefik benötigt für ACME konkrete `Host(...)`-Regeln oder explizite TLS-Domains. Eine Tenant-Erstellung müsste deshalb dynamische Ingress-Konfiguration mutieren und erhielte zusätzliche Infrastrukturrechte.

### Nur Staging reparieren

Nicht gewählt, weil Dev dasselbe Routingdefizit besitzt und das Verhalten vor Production realistisch validieren soll.

## Risks / Trade-offs

- Neue Production-Tenants sind nicht sofort nach Registry-Erstellung erreichbar. Mitigation: Hostfreigabe als expliziten Aktivierungs-Preflight und Rolloutschritt dokumentieren.
- Eine wachsende Production-Liste erhöht Konfigurations- und Review-Aufwand. Mitigation: deterministische Validierung, Duplikatprüfung und Smoke-Matrix; bei relevantem Wachstum separaten Wildcard-TLS-Change eröffnen.
- Einzelne ACME-Ausstellungen können Rate-Limits oder temporäre Challenge-Fehler treffen. Mitigation: vorhandenen Resolver-Speicher persistent halten, keine unnötigen Router-Neuanlagen und Rollout fail-closed verifizieren.
- Wildcard-DNS kann den Eindruck erwecken, unbekannte Hosts seien unterstützt. Mitigation: Registry-Prüfung bleibt fail-closed; Dokumentation trennt DNS-Auflösung, Ingress-Freigabe und Tenant-Aktivierung.
- Eine lange Production-Hostregel ist fehleranfällig. Mitigation: Die bestätigte Liste wird deterministisch sortiert, auf Duplikate und Syntax geprüft und durch statische Compose-Tests abgesichert.

## Migration Plan

1. Compose-Regeln und zugehörige statische Validierung für Dev ändern und gezielt testen.
2. Dev ausrollen und Root-/Tenant-/Unknown-Host-Smokes prüfen.
3. Compose-Regeln für Staging ändern, gezielt testen und über `Promote` ausrollen.
4. Staging-Audit und HTTPS-/Login-Smokes für `de-studio-sandbox` prüfen.
5. Production-Regel aus der bestätigten Liste erzeugen, testen und über den geschützten Promote-Pfad ausrollen.
6. Nach jedem Rollout Zertifikats-SAN, Root-Host, freigegebene Tenant-Hosts und einen unbekannten Host verifizieren.

Rollback erfolgt je Umgebung durch Rückkehr zur vorherigen versionierten Compose-Regel und erneutes Promote desselben beziehungsweise vorherigen freigegebenen Image-Digests. Registry-Daten werden dabei nicht verändert.

## Open Questions

Keine für den Proposal-Scope. Änderungen an der bestätigten Production-Liste benötigen eine sichtbare Aktualisierung dieses Changes oder nach dessen Abschluss einen neuen regulären Konfigurations-Change.
