## Context

SVA Studio soll als gemeinsame Plattform unter `studio.smart-village.app` betrieben werden. Fachliche Instanzen werden ueber genau ein zusaetzliches DNS-Label links der Parent-Domain adressiert. Das heutige Repo besitzt dafuer bereits:

- einen kanonischen Auth-Host auf der Root-Domain
- Host-basierte `instanceId`-Ableitung
- fail-fast-Validierung fuer env-basierte Allowlists

Die grosse Ausbaustufe benoetigt jedoch ein Betriebsmodell, bei dem neue Instanzen ohne neues App-Deployment, ohne neues Runtime-Profil und ohne manuelles Editieren einer globalen Env-Liste angelegt werden koennen.

## Ziele

- Ein einziges App-Deployment bedient Root-Host und alle freigegebenen Instanz-Hosts.
- Die autoritative Quelle fuer gueltige Instanzen liegt in einer zentralen Registry, nicht in Env-Konfiguration.
- Neue Instanzen werden ueber einen kontrollierten Provisioning-Prozess erstellt und aktiviert.
- Die Loesung bleibt fail-closed, auditierbar, typisiert und fuer spaetere Teil-Auslagerungen einzelner Instanzen offen.
- Das Registry- und Provisioning-Modell funktioniert domain-unabhaengig: Self-Hoster koennen eine eigene Parent-Domain (z.B. `cms.meine-kommune.de`) betreiben, ohne Code-Aenderungen. `parentDomain` ist pro Instanz konfigurierbar; `studio.smart-village.app` ist lediglich die primaere Hosted-Variante.

## Nicht-Ziele

- Kein eigenes Frontend-Deployment oder eigener App-Build pro Instanz
- Keine sofortige Pflicht zu separaten Datenbanken oder separaten Stacks pro Instanz
- Kein Self-Service-Provisioning ohne Admin-Freigabe

## Lokale Ziel-Developer-Experience

Die grosse Variante darf den lokalen Entwicklungsfluss nicht unnoetig verlangsamen. Deshalb werden zwei lokale Betriebsarten unterschieden:

- einfacher Dev-Modus fuer taegliche Feature-Arbeit
- registry-naher Multi-Tenant-Modus fuer realistische Integrations- und E2E-Pruefung

### 1. Einfacher Dev-Modus

Der Standardpfad fuer lokale Entwicklung bleibt schnell und reproduzierbar:

- bestehende Profile wie `local-keycloak` und `local-builder` bleiben erhalten
- die Registry darf lokal mit Seed-Daten vorbereitet werden
- fuer den taeglichen Flow sollen 1 bis 2 bekannte Instanzen sofort verfuegbar sein
- falls fuer den Uebergang technisch noetig, darf ein kontrollierter Fallback-Pfad fuer lokale Profile bestehen bleiben

Ziel: Frontend-, Formular-, Routing- und Fachlogik koennen weiter ohne komplexe manuelle Tenant-Vorbereitung entwickelt werden.

### 2. Registry-naher Multi-Tenant-Modus

Fuer Integrationsnaehe braucht es lokal oder acceptance-nah einen Modus, der das Zielbild realistisch abbildet:

- Root-Host als kanonischer Auth-Host
- Tenant-Hosts mit echter Host-Aufloesung
- Registry-Lookup statt produktiver Env-Allowlist
- fail-closed fuer unbekannte oder inaktive Tenants
- Provisioning neuer Instanzen ohne App-Redeploy

Dieser Modus ist nicht der Pflichtpfad fuer jede lokale Session, aber der verbindliche Nachweis fuer das Zielbild.

### 3. Lokale Hostname-Strategie

Die lokale Entwicklung benoetigt eine verbindliche Hostname-Strategie fuer Root- und Tenant-Hosts. Das Zielbild ist:

- `studio.localhost` oder aequivalente lokale Parent-Domain als Root-Host
- `<instanceId>.studio.localhost` fuer lokale Tenant-Hosts

Die Betriebsdoku muss dafuer mindestens einen offiziell unterstuetzten Weg beschreiben, zum Beispiel:

- lokale Hosts-Datei
- lokaler Reverse-Proxy
- lokaler DNS-/Wildcard-Mechanismus

### 4. Seed- und Fixture-Modell

Der lokale Testvertrag benoetigt reproduzierbare Startdaten:

- mindestens eine aktive Seed-Instanz
- mindestens eine zweite aktive Instanz fuer Tenant-Wechsel- und Vergleichsfaelle
- mindestens ein negativer Testfall fuer unbekannte oder gesperrte Instanzen

Provisioning-CLI und Tests muessen dieselben fachlichen Validierungsregeln benutzen wie der produktive Pfad.

## Zielarchitektur

### 1. Zentrale Instanz-Registry

Die Registry liegt in Postgres und wird als fachliche Quelle fuer aktive Instanzen genutzt. Ein minimaler Datensatz enthaelt:

- `instanceId`
- `status`
- `primaryHostname`
- `displayName`
- `parentDomain`
- `themeKey`
- `featureFlags`
- `mainserverConfigRef` oder analoge Integrations-Referenzen
- Audit-Felder (`createdAt`, `createdBy`, `updatedAt`, `updatedBy`)

Die `instanceId` (Slug) ist der fachliche und technische Primaeranker der Instanz; Aenderungen sind nur ueber einen kontrollierten Rename-Prozess mit Migration zulaessig.

Optionale Felder fuer spaetere Evolutionsschritte:

- `authRealm` oder `authClientId`
- `dataResidencyClass`
- `operationsMode`
- `suspendReason`

### 2. Laufzeit-Aufloesung

Eingehende Requests werden weiterhin anhand des `Host`-Headers normalisiert. Die Ableitung erfolgt in zwei Schritten:

1. Syntaktische Host-Pruefung:
   - Host wird vor der Pruefung kanonisiert (lowercase, Port entfernt, optionalen trailing dot entfernen)
   - die Host-Information stammt aus einem vertrauenswuerdig normalisierten Ingress-Kontext
   - Root-Domain = kanonischer Auth-Host
   - genau ein DNS-Label links der Parent-Domain = Kandidat fuer `instanceId`
   - keine mehrstufigen Subdomains
   - kein Punycode / kein ungueltiges Label
2. Fachliche Registry-Pruefung:
   - Registry-Eintrag existiert
   - `status` erlaubt Traffic
   - Hostname passt zur Instanz

Unbekannte, inaktive oder gesperrte Instanzen werden nach aussen identisch abgelehnt.

### 3. Caching

Die Registry darf fuer den Laufzeitpfad gecacht werden, aber nicht als neue fuehrende Quelle. Zielbild:

- L1: prozesslokaler Kurzzeit-Cache
- optional L2: Redis fuer Registry-Read-Through
- Invalidation ueber explizite Mutationen oder konservative TTL
- Statuswechsel nach `suspended` oder `archived` invalidieren L1/L2 sofort; TTL ist nur Fallback

Die Konsistenzregel bleibt: Postgres ist fuehrend.

Verfuegbarkeits-Degradation: Wenn der Cache kalt ist und Postgres kurzzeitig nicht erreichbar, werden alle Tenant-Requests fail-closed abgelehnt. Das ist sicherheitstechnisch korrekt, stellt aber ein Verfuegbarkeitsrisiko gegenueber dem NFR-Ziel von >= 99,5 % Jahresverfuegbarkeit dar. Ob der L1-/L2-Cache einen kurzen DB-Ausfall ueberleben darf (Stale-Serve mit begrenzter TTL) oder ob fail-closed ohne Ausnahme gilt, ist eine bewusste Architekturentscheidung, die in der ADR und in arc42 §11 dokumentiert wird.

### 4. Auth- und Session-Modell

Der kanonische Auth-Host bleibt `studio.smart-village.app`.

- Interaktive OIDC-Flows laufen ausschliesslich ueber die Root-Domain.
- Sessions und Redirects werden nicht pro Instanz als eigene App-Base-URL modelliert.
- Fachseiten duerfen unter `<instanceId>.studio.smart-village.app` liegen.
- Nach erfolgreichem Login wird der Benutzer kontrolliert zur fachlichen Zielinstanz zurueckgefuehrt.
- Session-Cookies sind in Production mindestens `HttpOnly`, `Secure`, `SameSite` und konsistent auf die Parent-Domain gescoped.
- Mutierende Control-Plane-Endpunkte erzwingen CSRF-Schutz.

Damit bleibt das bestehende Prinzip aus ADR-020 erhalten, waehrend die Tenant-Freigabe von Env auf Registry umgestellt wird.

### 5. Provisioning-Steuerung

Neue Instanzen werden ueber eine Provisioning-Fassade angelegt. Das System braucht zwei kompatible Steuerungspfade:

- einen verpflichtenden nicht-interaktiven CLI-/Ops-Pfad fuer Automation, Seedings und Notfaelle
- einen Admin-Pfad in Studio als gleichwertigen Einstieg auf denselben fachlichen Vertrag

Beide Pfade schreiben in dieselbe Provisioning-Fassade.

Die Studio-Control-Plane-UI unterliegt denselben Barrierefreiheits- und Lokalisierungsanforderungen wie alle anderen Studio-Oberflaechen: WCAG 2.1 AA, vollstaendige Tastaturbedienbarkeit und UI-Texte in Deutsch und Englisch ueber `t('key')`.

### 6. Provisioning-Workflow

Provisioning ist ein zustandsbehafteter Job mit fachlichem Statusmodell:

- `requested`
- `validated`
- `provisioning`
- `active`
- `failed`
- `suspended`
- `archived`

Technische Teilaufgaben koennen umfassen:

- Registry-Eintrag anlegen
- Hostname reservieren
- Theme- und Feature-Defaults setzen
- optionale IAM-/Keycloak-Artefakte vorbereiten
- Integrations-Defaults anlegen
- Startdaten oder Basiskonfiguration schreiben
- Smoke-Checks ausfuehren

Der Workflow muss idempotent sein, damit Wiederholungen nach Teilfehlern moeglich bleiben.

## Migrationsstrategie

### Phase A: Dual-Read / vorbereitende Infrastruktur

- Registry-Tabelle und Read-Modelle einfuehren
- bestehende Env-Allowlist in die Registry spiegeln
- Runtime-Path so erweitern, dass Registry bevorzugt und Env-Allowlist nur als kontrollierter Fallback dient

### Phase B: Registry als fuehrende Quelle

- neue Instanzen nur noch ueber Registry-Provisioning
- Betriebsdoku und Acceptance-Runbooks auf Registry-Modell umstellen
- `acceptance-hb` von instanzspezifischer Basiskonfiguration auf plattformweite Root-Konfiguration umstellen

### Phase C: Env-Allowlist abbauen

- Env-Allowlist nur noch fuer lokale Entwicklungsprofile oder Debug-Pfade
- produktive Profile nicht mehr tenantweise ueber Env verwalten

## Teststrategie

### Unit-Tests

- Host-Normalisierung und syntaktische Tenant-Ableitung
- Registry-Lookup und Statuspruefung
- fail-closed-Verhalten fuer unbekannt, suspendiert und archiviert
- Provisioning-Validierung und Statusuebergaenge

### Integrationstests

- Runtime-Request gegen Root-Host und Tenant-Host
- Auth-/Session-Pfade mit Rueckkehr in den Tenant-Kontext
- Registry-Cache inklusive Invalidation oder TTL-basiertem Neuaufbau
- Provisioning-Lauf mit persistiertem Registry-Eintrag

### E2E-Tests

- Login ueber Root-Host, Navigation im Tenant-Kontext
- Aufruf eines bekannten Tenant-Hosts
- identische Ablehnung eines unbekannten Tenant-Hosts
- Neuanlage einer Instanz ueber Control Plane oder CLI mit anschliessender Erreichbarkeit ohne Redeploy

### Operative Testrennung

Der Change verlangt bewusst zwei Testrouten:

- schnelle lokale Standardtests fuer taegliche Entwicklung
- realistische Multi-Tenant-Tests fuer Integrations- und Release-Sicherheit

Damit bleibt der taegliche Dev-Flow schnell, waehrend das Zielbild trotzdem verbindlich pruefbar wird.

## Sicherheit und Betriebsaspekte

- Unknown-Tenant-Enumeration bleibt unterbunden: gleiche Ablehnung fuer "nicht vorhanden", "gesperrt", "ungueltig".
- Tenant-Anlage ist nur fuer berechtigte Operatoren/Admins zulaessig.
- Jede Anlage, Aktivierung, Suspendierung und Archivierung wird auditiert.
- Tenant-fremde Lese- und Schreibpfade werden fail-closed abgelehnt.
- Provisioning speichert keine Secrets im Klartext in allgemeinen Runtime-Configs; Secrets kommen aus Secret-Manager/KMS.
- Audit-Ereignisse enthalten mindestens Akteur-Kontext, `instanceId`, Vorgang, Ergebnis und Zeitbezug und werden append-only persistiert. Akteur-Referenzen werden als pseudonymisierte UUID gespeichert, nicht als Klarname. Fuer Audit-Daten gilt eine definierte Aufbewahrungsfrist; nach Ablauf werden personenbeziehbare Felder anonymisiert, um dem Recht auf Loeschung (Art. 17 DSGVO) bei gleichzeitiger Append-Only-Persistenz zu genuegen.
- Der Host-Aufloesungspfad wird durch angemessenes Rate-Limiting geschuetzt, damit identische Ablehnungen fuer unbekannte Hosts nicht als Brute-Force-Oracle fuer Tenant-Enumeration missbraucht werden koennen. Rate-Limiting kann auf Ingress-/WAF-Ebene oder anwendungsseitig erfolgen.
- DNS- und TLS-Voraussetzungen (`studio.smart-village.app` plus Wildcard) sind Teil des Betriebsvertrags. Fuer Self-Hoster mit eigener Parent-Domain gelten dieselben DNS- und TLS-Anforderungen analog.

## Betroffene arc42-Abschnitte

- 04: strategische Entscheidung "Registry statt Env-Allowlist"
- 05: neue Bausteine fuer Registry, Provisioning-Fassade und Control Plane
- 06: Request-Flow fuer Host-Aufloesung und Provisioning
- 07: Single-Deployment-Topologie mit Wildcard-DNS/TLS
- 08: Security-, Cache- und Audit-Konzept
- 09: ADR-Fortschreibung oder neue ADR fuer Registry-/Provisioning-Modell
- 10: Qualitaetsziele fuer Onboarding-Zeit, Ausfallsicherheit und Fail-Closed-Verhalten
- 11: Risiken bei Cache-Konsistenz, Provisioning-Teilfehlern, Verfuegbarkeits-Degradation bei DB-Ausfall mit kaltem Cache und spaeterer Mandantenisolation
