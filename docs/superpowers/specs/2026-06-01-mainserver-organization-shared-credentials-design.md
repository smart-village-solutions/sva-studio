# Mainserver-Credentials auf Organisationsebene

## Ziel

Der SVA-Mainserver soll weiterhin pro Instanz über den konfigurierten Endpunkt angesprochen werden, aber Key und Secret sollen künftig optional an der aktiven Organisation statt nur am Benutzer hängen können. Benutzer einer Organisation teilen sich damit bei Bedarf denselben Mainserver-Zugang, ohne persönliche Credentials pflegen zu müssen.

Die bestehende `contentAuthorPolicy` bleibt die fachliche Steuerung:

- `org_only`: Inhalte und Mainserver-Zugang sind an die aktive Organisation gebunden
- `org_or_personal`: die aktive Organisation ist primäre Quelle; persönliche Benutzer-Credentials bleiben nur Fallback

## Ist-Zustand

- die Mainserver-Endpunkte sind bereits instanzgebunden über `iam.instance_integrations`
- per-User-Credentials werden heute serverseitig aus Keycloak-Attributen gelesen
- die Mainserver-Laufzeit und mehrere Specs/Architekturtexte gehen aktuell davon aus, dass Benutzer-Credentials das Primärmodell sind
- der aktive Organisationskontext existiert bereits in Session und IAM-Flows und wird für fachliche Entscheidungen genutzt

## Zielbild

### Fachregel

Die vorhandene `contentAuthorPolicy` steuert künftig nicht nur die Autorenschaft von Inhalten, sondern auch die Auswahl der Mainserver-Credentials für den aktiven Organisationskontext.

- Bei `org_only` sind ausschließlich Organisations-Credentials zulässig.
- Bei `org_or_personal` werden zuerst Organisations-Credentials der aktiven Organisation verwendet.
- Nur wenn bei `org_or_personal` Key oder Secret auf Organisationsebene fehlen, wird auf persönliche Benutzer-Credentials zurückgefallen.

### Auflösungskontext

Der aktive Organisationskontext aus der Session ist die einzige Quelle für organisationsgebundene Credential-Auflösung.

- keine Suche über andere Mitgliedsorganisationen
- kein implizites "best match"
- kein Fallback auf andere Organisationen derselben Instanz

Damit bleibt das Verhalten für Mehrfachmitgliedschaften deterministisch und konsistent mit dem bestehenden IAM-Organisationsmodell.

## Architektur

### Credential-Ownership

- Mainserver-Endpunkte bleiben instanzgebunden
- Mainserver-Key und -Secret können zusätzlich organisationsgebunden in der Studio-Datenbank liegen
- Benutzer-Credentials in Keycloak bleiben für Bestandsfälle und als Fallback-Pfad erhalten

Die Verantwortung ist damit getrennt:

- Identity-nahe persönliche Credentials bleiben in Keycloak
- geteilte organisationsbezogene Credentials liegen serverseitig kontrolliert in der Studio-Datenbank
- die Mainserver-Integration entscheidet zur Laufzeit anhand von Policy und aktivem Organisationskontext

### Persistenzmodell

Organisations-Credentials sollen nicht in `iam.organizations.metadata` gespeichert werden. Stattdessen wird ein eigener serverseitiger Speicher eingeführt, zum Beispiel als dedizierte Tabelle.

Empfohlene Mindestfelder:

- `instance_id`
- `organization_id`
- `mainserver_application_id`
- `mainserver_application_secret_ciphertext`
- `created_at`
- `updated_at`
- optional Audit-Felder wie `updated_by_account_id`

Warum eigener Speicher:

- sensible Daten dürfen nicht in generischen Organisations-Responses mitlaufen
- `metadata` ist fachlich offen und heute nicht als Secret-Speicher gedacht
- Zugriffsrechte, Logging-Redaction und Tests lassen sich in einem klaren Credential-Modell gezielter absichern

### Verschlüsselung und Redaction

- das Secret wird ausschließlich verschlüsselt gespeichert
- die bestehende IAM-Strategie für geschützte Felder, Ciphertext-Handling und AAD soll wiederverwendet werden
- Klartext-Secrets werden nie in Browser-Responses, generischen Organisation-Read-Models oder Logs ausgegeben
- API/Read-Model liefert nur:
  - `mainserverApplicationId`
  - `mainserverApplicationSecretSet: boolean`

## Laufzeitmodell

### Resolver-Verhalten

Die heutige direkte per-User-Auflösung wird in einen übergeordneten Credential-Resolver überführt, der zwei Quellen kennt:

1. Organisations-Credentials aus der Studio-Datenbank für `instanceId + activeOrganizationId`
2. Benutzer-Credentials aus Keycloak für `instanceId + keycloakSubject`

Die Regel ist strikt:

- ohne aktiven Organisationskontext kein organisationsbezogener Lookup
- `org_only`: nur Organisations-Credentials sind zulässig
- `org_or_personal`: zuerst Organisation, dann Benutzer-Fallback

### Fehlerverhalten

- `org_only` und fehlende Organisations-Credentials führen zu einem deterministischen Fehler, z. B. `organization_mainserver_credentials_missing`
- `org_or_personal` und fehlende Organisations-Credentials führen zum Benutzer-Fallback
- fehlen auch Benutzer-Credentials, bleibt es bei `missing_credentials`
- es gibt keinen stillen Fallback von `org_only` auf Benutzer-Credentials

### Caching

Credential- und Token-Caches müssen den aktiven Organisationskontext im Cache-Key berücksichtigen.

Mindestens relevant:

- `instanceId`
- `keycloakSubject`
- `activeOrganizationId`
- effektive Credential-Quelle oder Credential-Signatur

Dadurch wird verhindert, dass Tokens oder Credentials aus einem anderen Organisationskontext wiederverwendet werden.

## Admin- und UI-Fluss

Die Pflege organisationsgebundener Mainserver-Credentials gehört in die Organisationsverwaltung, nicht in die Benutzerverwaltung.

### Organisations-Detailseite

Die bestehende Organisations-Detailseite wird um Mainserver-Credential-Felder erweitert:

- `Mainserver Application-ID`
- `Mainserver Application-Secret` als write-only Feld
- Statusanzeige, ob ein Secret hinterlegt ist

Dabei gilt:

- kein Klartext-Secret im Read-Model
- Secret-Feld wird nie vorbefüllt
- persönliche Benutzer-Credentials können im bestehenden Benutzer-Flow unverändert weiter gepflegt werden

### Listenansichten

Organisationslisten brauchen initial keinen Klartext und keinen komplexen Credential-Status. Falls später ein Konfigurationsindikator sinnvoll ist, sollte er sich auf einen einfachen booleschen Zustand beschränken.

## OpenSpec- und Architekturauswirkungen

Der Change ist architektur- und sicherheitsrelevant und braucht daher einen OpenSpec-Change vor der Implementierung.

Mindestens betroffene Capabilities:

- `iam-core`
- `iam-organizations`
- `account-ui`
- `sva-mainserver-integration`

Betroffene Architekturabschnitte sind voraussichtlich:

- `docs/architecture/03-context-and-scope.md`
- `docs/architecture/05-building-block-view.md`
- `docs/architecture/06-runtime-view.md`
- `docs/architecture/08-cross-cutting-concepts.md`
- `docs/architecture/12-glossary.md`

Zusätzlich muss die bestehende ADR zur per-User-Mainserver-Delegation angepasst oder durch eine neue ADR ergänzt werden, weil per-User-Credentials nicht mehr in jedem Fall das Primärmodell sind.

## Tests und Verifikation

### Unit-Tests

- Resolver für `org_only` mit vorhandenen Organisations-Credentials
- Resolver für `org_only` mit fehlendem Key oder Secret
- Resolver für `org_or_personal` mit erfolgreicher Organisations-Auflösung
- Resolver für `org_or_personal` mit Fallback auf Benutzer-Credentials
- Resolver ohne aktiven Organisationskontext
- Resolver bei doppelt fehlenden Credentials

### Daten- und Handler-Tests

- Repository-Tests für organisationsgebundenen Credential-Speicher
- Tests für Verschlüsselung, Redaction und write-only-Secret-Verhalten
- API-/Handler-Tests für Organisations-Detail lesen und aktualisieren

### Integrationsnahe Tests

- Mainserver-Service respektiert aktiven Organisationskontext im Credential- und Token-Cache
- Fehlercodes bleiben deterministisch und unterscheiden Organisations- von Benutzerproblemen
- bestehende Browser-/Server-Sicherheitsgrenzen bleiben unverändert

## Scope und Nicht-Ziele

Dieser Change führt bewusst nicht ein:

- keine Migration bestehender Benutzer-Credentials auf Organisationen
- keine neue UI-Auswahl pro Request oder pro Inhaltsoperation
- keine Aufweichung der instanzgebundenen Mainserver-Endpunktkonfiguration
- keine direkte Browser-Nutzung von Mainserver-Credentials oder Tokens

## Empfehlung

Die vorhandene `contentAuthorPolicy` soll fachlich wiederverwendet, aber technisch nicht überladen werden. Die saubere Form dafür ist:

- keine neue sichtbare Policy im UI
- eigener organisationsgebundener Credential-Speicher
- eigener Credential-Resolver mit expliziter Policy-Logik
- klare Fehlercodes und Cache-Isolation pro aktivem Organisationskontext

Damit bleibt die Oberfläche schlank, das Laufzeitverhalten nachvollziehbar und die bestehende per-User-Architektur wird kontrolliert zu einem organisationsfähigen Modell erweitert.
