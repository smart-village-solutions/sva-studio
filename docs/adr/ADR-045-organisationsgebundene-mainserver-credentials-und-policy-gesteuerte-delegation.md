# ADR-045: Organisationsgebundene Mainserver-Credentials und policy-gesteuerte Delegation

**Status:** Accepted
**Entscheidungsdatum:** 2026-06-02
**Entschieden durch:** IAM/Integrations-Team
**GitHub Issue:** TBD
**GitHub PR:** #503

---

## Kontext

Die bisherige Mainserver-Integration folgt [ADR-021](./ADR-021-per-user-sva-mainserver-delegation.md): Endpunktkonfiguration ist instanzgebunden, Credentials werden pro Benutzer aus Keycloak gelesen, und Downstream-Aufrufe bleiben strikt serverseitig. Für Organisationen mit gemeinsam verantworteten Inhalten reicht dieses Modell fachlich nicht aus, weil `contentAuthorPolicy` bereits organisationsbezogene Ownership-Regeln kennt, der Mainserver-Zugang aber weiterhin nur personenbezogen modelliert war.

Mit dem neuen Organisationsmodell existieren zusätzlich:

- ein aktiver Organisationskontext in der Session (`activeOrganizationId`)
- organisationsgebundene Mainserver-Credentials in der Studio-Datenbank
- die bestehende Policy `contentAuthorPolicy` mit den Werten `org_only` und `org_or_personal`

Die Architektur braucht deshalb einen klaren Entscheid, welche Credential-Quelle im Laufzeitpfad führend ist und wie Fallbacks, Caching und Fehlerfälle aussehen.

## Entscheidung

Studio erweitert die bestehende per-User-Delegation um einen organisationsgebundenen Credential-Pfad. Maßgeblich ist weiterhin die serverseitige Mainserver-Integration; neu ist die policy-gesteuerte Auswahl der Credential-Quelle.

### 1. Credential-Quellen und Ownership

- Instanzbezogene Mainserver-Endpunkte bleiben in der Studio-Datenbank konfiguriert.
- Organisationsgebundene Mainserver-Credentials werden in einem dedizierten IAM-Speicher in Postgres gehalten.
- Persönliche Benutzer-Credentials bleiben in Keycloak bestehen und werden nicht in Session, Redis oder Postgres gespiegelt.

### 2. Führender Auflösungskontext

- Für organisationsgebundene Credentials ist ausschließlich `activeOrganizationId` aus der Session maßgeblich.
- Es gibt keine Suche über weitere Mitgliedsorganisationen und keinen impliziten Best-Match-Fallback.
- Ohne aktiven Organisationskontext findet kein organisationsbezogener Credential-Lookup statt.

### 3. Policy-gesteuerte Auswahl

- `org_only`: Nur organisationsgebundene Credentials sind zulässig.
- `org_or_personal`: Organisationsgebundene Credentials sind die Primärquelle; persönliche Benutzer-Credentials bleiben Fallback.
- Fehlen bei `org_only` die Organisations-Credentials, bricht der Mainserver-Aufruf mit einem deterministischen Fehler ab.

### 4. Read- und Write-Grenzen

- Die Organisationsverwaltung pflegt `mainserverApplicationId` und ein write-only Secret serverseitig.
- Read-Modelle und Browser-Verträge enthalten nie Secret-Klartexte oder Ciphertexts.
- Sichtbar ist nur ein read-safe Zustand wie `mainserverApplicationSecretSet`.

### 5. Caching und Isolation

- Credential- und Token-Caches müssen den aktiven Organisationskontext berücksichtigen.
- Ein Token-Cache-Schlüssel darf daher nicht nur `instanceId` und Benutzerbezug enthalten, sondern auch den organisationsbezogenen Credential-Kontext.
- Tokens oder Credential-Projektionen aus verschiedenen Organisationskontexten dürfen nicht wiederverwendet werden.

## Begründung

1. Das Modell nutzt den bereits vorhandenen Organisationskontext statt eines zweiten, konkurrierenden Auswahlpfads.
2. `contentAuthorPolicy` bleibt die fachlich führende Regel für organisationsgebundene Mainserver-Nutzung.
3. Gemeinsame Organisations-Credentials reduzieren operativen Pflegeaufwand, ohne Browser oder Sessions mit Secrets anzureichern.
4. Der getrennte Speicher wahrt die bestehende Boundary: Keycloak bleibt Identity- und Benutzer-Owner, Postgres bleibt Owner für Studio-verwaltete organisationsbezogene Integrationsdaten.
5. Die explizite Cache-Isolation verhindert Cross-Context-Leaks bei Mehrfachmitgliedschaften.

## Alternativen

### Alternative A: Ausschließlich per-User-Credentials beibehalten

**Vorteile:**

- kein neuer Persistenzpfad
- kein zusätzlicher Resolver

**Nachteile:**

- gemeinsame Organisationsverantwortung bleibt technisch unmodelliert
- `contentAuthorPolicy` und Credential-Auflösung würden auseinanderlaufen
- hoher Pflegeaufwand für Organisationen mit gemeinsamem Mainserver-Zugang

**Warum verworfen:**

Reicht fachlich nicht aus und erzeugt vermeidbare Inkonsistenz zwischen Organisationsmodell und Integrationsverhalten.

### Alternative B: Zentrale Instanz-Credentials statt Organisations-Credentials

**Vorteile:**

- einfaches Laufzeitmodell
- weniger Auflösungslogik

**Nachteile:**

- zu grober Scope
- keine Abbildung aktiver Organisationskontexte
- kollidiert mit `org_only` und `org_or_personal`

**Warum verworfen:**

Verliert die fachlich relevante Organisationsgrenze.

### Alternative C: Organisations-Credentials direkt in `iam.organizations.metadata`

**Vorteile:**

- kein neues Tabellenmodell

**Nachteile:**

- schwächere Trennung für Secret-Handling
- höheres Risiko, sensible Daten in generische Read-Modelle oder Debug-Ausgaben einzuschleusen
- schlechtere Audit- und Verschlüsselungsgrenzen

**Warum verworfen:**

Ein dedizierter Credential-Speicher ist sicherer und architektonisch klarer.

## Konsequenzen

### Positive Konsequenzen

- Organisationskontext, Policy und Mainserver-Delegation sind konsistent modelliert.
- Gemeinsame Mainserver-Zugänge können zentral gepflegt werden.
- Browser- und Read-Model-Grenzen bleiben intakt.
- Der per-User-Pfad bleibt als kontrollierter Fallback verfügbar.

### Negative Konsequenzen

- zusätzlicher Persistenz- und Resolver-Pfad im IAM-/Mainserver-Umfeld
- höhere Anforderungen an Cache-Key-Disziplin
- mehr Dokumentations- und Testpflichten über IAM, Auth-Runtime und Mainserver-Integration hinweg

## Verwandte ADRs

- [ADR-009](./ADR-009-keycloak-als-zentraler-identity-provider.md): Keycloak als zentraler Identity Provider
- [ADR-011](./ADR-011-instanceid-kanonischer-mandanten-scope.md): `instanceId` als kanonischer Mandanten-Scope
- [ADR-021](./ADR-021-per-user-sva-mainserver-delegation.md): Per-User-SVA-Mainserver-Delegation
- [ADR-036](./ADR-036-kanonischer-iam-projektions-und-reconcile-vertrag.md): Kanonischer IAM-Projektions- und Reconcile-Vertrag

## Gültigkeitsdauer

Diese ADR gilt, bis das Mainserver-Integrationsmodell erneut grundlegend geändert wird, zum Beispiel durch einen vollständig anderen Credential-Owner oder einen abweichenden organisationsbezogenen Delegationspfad.
