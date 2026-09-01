# Studio–SSF-Vertrag für Runtime-Konfiguration V1

Englische Übersetzung: [Studio–SSF Runtime Configuration Contract V1](./ssf-studio-runtime-configuration-contract-v1.en.md)

## Status und Zweck

Dieses Dokument beschreibt den fachlich freigegebenen Entwurf für den ersten
Datenaustausch zwischen SVA Studio und Smart Speech Flow (SSF). Es dient als
gemeinsame Integrationsgrundlage für beide Anwendungen. Vor einer Umsetzung
müssen die bestehenden OpenSpec-Changes mit diesem vereinfachten Vertrag
abgeglichen und normativ angepasst werden.

Die zugehörigen Zielgrenzen sind in den arc42-Abschnitten 3 bis 8 verankert.
Eine ältere, parallel entwickelte SSF-Control-Plane-Ausarbeitung sah noch einen
zweistufigen Authentifizierungsvertrag vor; vor der Umsetzung muss sie an den
hier beschriebenen einfachen Service-Token-Vertrag angeglichen werden.

V1 umfasst:

- die Zuordnung von Studio-Instanz und SSF-Mandant,
- die für SSF relevanten Keycloak-Claims administrativer Benutzer,
- den internen Abruf der effektiven Runtime-Konfiguration,
- Branding, Sprachen und mandantenabhängige Erklärtexte,
- die Steuerung der Speicherung und Verarbeitung von Gesprächsinhalten.

Auswertungen, Gesprächsdaten, ClickHouse, Supportzugriffe und eine
SSF-seitige Mandantenverwaltung sind nicht Bestandteil von V1.

## System- und Datenverantwortung

Eine Studio-Installation läuft gemeinsam mit genau einer SSF-Installation.
Eine Studio-Instanz entspricht genau einem SSF-Mandanten. SSF ist bewusst von
dieser Studio-Installation abhängig und führt keinen eigenen Mandantenbestand.

| Verantwortlicher Baustein | Führende Daten und Aufgaben                                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Studio Core               | kanonische `instanceId`, Mandantenname, Zeitzone, Keycloak-Provisionierung, Benutzer, IAM, Medienverwaltung, Plugin-Aktivierung, Readiness und Audit |
| SSF-Plugin im Studio      | serverweite und tenantbezogene SSF-Konfiguration, Richtlinien, Texte, Sprachen und Auflösung der effektiven Runtime-Konfiguration                    |
| SSF                       | Anmeldung und Sessions, Gäste, Gesprächsablauf sowie später Laufzeit-, Session- und Gesprächsdaten                                                   |
| SSF-Keycloak              | authentifizierte Benutzeridentitäten und signierte Claims für Mandant, Rollen und Permissions                                                        |

Studio und SSF verwenden keine gemeinsame Fachdatenbank und greifen nicht
direkt auf die Persistenz des jeweils anderen Systems zu. SSF hält keinen
persistenten Cache der Studio-Konfiguration vor.

## Rollen und Identitäten

Das SSF-Fachmodell verwendet folgende Bezeichnungen:

| Technischer Wert | Deutsche Bezeichnung | Geltungsbereich                             |
| ---------------- | -------------------- | ------------------------------------------- |
| `system_admin`   | Systemadmin          | gesamte SSF-Installation                    |
| `tenant_admin`   | Mandantenadmin       | genau ein Mandant                           |
| `user`           | Benutzer             | operative Nutzung innerhalb eines Mandanten |
| `guest`          | Gast                 | eine konkrete SSF-Session                   |

Die bisherigen Werte `admin` und `customer` werden während einer
Übergangsphase als Aliase für `user` und `guest` akzeptiert. Neu ausgestellte
beziehungsweise materialisierte Rollen verwenden nur die neuen Werte.

Systemadmins werden im Root-Kontext des Studios verwaltet und erscheinen nicht
in Tenant-Tokens. Ein Mandantenadmin erhält nicht automatisch operative
Gesprächsrechte. Soll dieselbe Person SSF operativ nutzen, erhält sie zusätzlich
die Rolle `user` und die zugehörigen `ssf.*`-Permissions.

Gäste bleiben vollständig im bestehenden SSF-Sessionmodell. Sie erhalten kein
Studio- und kein reguläres Keycloak-Konto. Gast-Token, Session-IDs und
Gesprächsdaten werden nicht an Studio übertragen.

## Keycloak-Vertrag für Tenant-Benutzer

Die kanonische Studio-`instanceId` ist der gemeinsame technische
Mandantenschlüssel. Sie wird bei der Realm- und Client-Provisionierung als
signierter Claim materialisiert.

Ein Tenant-Token für SSF enthält neben den üblichen OIDC-Claims mindestens:

```json
{
  "sub": "keycloak-user-id",
  "studio_instance_id": "01J...",
  "ssf_roles": ["tenant_admin"],
  "ssf_permissions": ["ssf.sessions.read"],
  "preferred_username": "erika",
  "name": "Erika Muster",
  "locale": "de-DE"
}
```

`ssf_permissions` ist die verbindliche Grundlage der serverseitigen
Autorisierung in SSF. `ssf_roles` dient der fachlichen Einordnung, Navigation
und Auditierung. Eine E-Mail-Adresse ist nicht Teil des SSF-Tokenvertrags.

SSF-Access-Token haben standardmäßig eine Laufzeit von fünf Minuten und dürfen
höchstens zehn Minuten gültig sein. Bei Deaktivierung oder einer kritischen
Rollenänderung widerruft Studio zusätzlich die Keycloak-Sessions. Langlebige
WebSocket-Verbindungen müssen spätestens beim Ablauf des Tokens erneut
authentifiziert oder beendet werden.

## Laufzeitfluss

```text
Studio provisioniert Instanz, Realm, Benutzer und SSF-Plugin-Daten
  -> Benutzer meldet sich über Keycloak an oder Gast nutzt eine SSF-Session
  -> SSF leitet die kanonische studio_instance_id aus dem validierten Kontext ab
  -> SSF ruft mit seiner technischen Service-Identität die Studio-API auf
  -> Studio prüft Service-Token, Mandant, Aktivierung und Readiness
  -> SSF-Plugin ermittelt die effektive Konfiguration
  -> SSF rendert die Konfiguration für den aktuellen Vorgang
```

SSF speichert die Antwort nicht persistent. Ist Studio oder das SSF-Plugin
nicht erreichbar, darf der betroffene SSF-Vorgang technisch fehlschlagen. Eine
zusätzliche Synchronisations- oder Cache-Persistenz ist nicht vorgesehen.

## Interner Runtime-Endpunkt

### Request

```http
GET /internal/plugins/ssf/v1/runtime-configuration
Authorization: Bearer <keycloak-service-token>
X-Studio-Instance-Id: <instance-id-aus-validiertem-SSF-Kontext>
X-Correlation-Id: <correlation-id>
```

Der Endpoint ist ausschließlich im internen Netz erreichbar. Das
installationsweite SSF-Service-Token muss die vorgesehene Audience und die
Permission `ssf.runtime-configuration.read` besitzen. Studio vertraut der
Tenant-Angabe nur als Aussage des authentifizierten SSF-Backends; eine direkte
Browseranfrage ist nicht zulässig.

Für diesen lesenden, idempotenten Vertrag gibt es keine zusätzliche
Tenant-Assertion, keinen zweiten Signaturschlüssel und keinen Replay-Speicher.

### Erfolgreiche Response

```json
{
  "contractVersion": "1.0",
  "configurationRevision": "sha256:...",
  "tenant": {
    "id": "01J...",
    "displayName": "Beispielkommune",
    "timeZone": "Europe/Berlin"
  },
  "branding": {
    "logo": {
      "url": "https://example.org/logo.png",
      "alternativeText": "Logo der Beispielkommune"
    },
    "icon": {
      "url": "https://example.org/icon.png",
      "alternativeText": "Icon der Beispielkommune"
    }
  },
  "localization": {
    "defaultLocale": "de-DE",
    "locales": [
      {
        "locale": "de-DE",
        "authenticatedHomeExplanationHtml": "<p>...</p>",
        "guestExplanationHtml": "<p>...</p>",
        "conversationContentStorageQuestionHtml": "<p>...</p>"
      }
    ]
  },
  "conversationContentStorage": {
    "mode": "ask"
  }
}
```

`branding.logo` und `branding.icon` können jeweils `null` sein. Bei
`conversationContentStorage.mode = "disabled"` ist
`conversationContentStorageQuestionHtml` für jede Sprache `null`.

`configurationRevision` ist ein undurchsichtiger Inhaltsfingerabdruck der
kanonisch serialisierten effektiven V1-Konfiguration ohne das Revisionsfeld
selbst. Änderungen an einem wirksamen Tenant-Override, einem wirksamen
serverweiten Wert oder einem ausgelieferten Produktdefault ändern die Revision
automatisch. Eine Änderung an einem durch eine Policy unwirksamen gespeicherten
Override verändert die Runtime-Antwort und damit die Revision nicht.

## Auflösung der effektiven Konfiguration

Für jedes einzelne Feld und jede einzelne Sprache gilt:

```text
Tenant-Anpassung
  ?? serverweite Anpassung
  ?? mit dem Softwarestand ausgelieferter SSF-Produktdefault
```

Produktdefaults werden versioniert mit SSF beziehungsweise dem SSF-Plugin
ausgeliefert und nicht pro Mandant in die Datenbank kopiert. Die Runtime-API
liefert ausschließlich das vollständig aufgelöste Ergebnis. SSF kennt weder
die Herkunft eines Werts noch administrative Policy-Felder.

`tenant.displayName` und `tenant.timeZone` stammen aus dem generischen
Studio-Instanzprofil. Das allgemeine Tenant-Branding aus der Studio-
Medienverwaltung wird wiederverwendet, sofern die SSF-Policy dies erlaubt.

## Sprachen und Texte

Neue Mandanten aktivieren zunächst alle installationsweit verfügbaren
Sprachen. Ein Mandantenadmin kann Sprachen deaktivieren und wieder aktivieren.
Mindestens eine Sprache bleibt aktiv, und `defaultLocale` muss in
`localization.locales` enthalten sein. Beim Deaktivieren einer Sprache bleiben
vorhandene Overrides gespeichert.

Für jede aktive Sprache liefert V1 genau diese Felder:

- `authenticatedHomeExplanationHtml`: Erklärtext nach der Anmeldung,
- `guestExplanationHtml`: Erklärtext für Gäste,
- `conversationContentStorageQuestionHtml`: Frage zur Speicherung und
  Verarbeitung von Gesprächsinhalten oder `null` bei deaktivierter Speicherung.

Mandanten überschreiben jeden Text einzeln und pro Sprache. Nicht
überschriebene Felder folgen weiterhin dem jeweiligen serverweiten Wert oder
Produktdefault.

Die HTML-Felder dürfen auch externe Bilder und weitere semantische HTML-
Elemente enthalten. Der Editor kann seinen anfänglichen Gestaltungsumfang
einschränken, der API-Vertrag definiert jedoch keine starre kleine Tag-Liste.
Studio entfernt unmittelbar aktive beziehungsweise ausführbare Inhalte wie
Skripte, Event-Handler und gefährliche URL-Protokolle. Externe Bilder benötigen
keine Domain-Allowlist und keinen verpflichtenden Proxy; ihre Verwendung liegt
in der Verantwortung des administrierenden Benutzers. Vor der Veröffentlichung
muss der verantwortliche Mandant die Zulässigkeit der externen Einbindung und
die erforderliche Information der betroffenen Benutzer und Gäste sicherstellen.

## Branding- und Speicher-Policies

Systemadmins verwalten pro Mandant:

- `customBrandingAllowed`,
- `conversationContentStorageAllowed`.

Mandantenadmins dürfen Logo und Icon nur bei aktiviertem
`customBrandingAllowed` anpassen. Entzieht ein Systemadmin die Erlaubnis, bleibt
die Auswahl gespeichert, wird aber nicht mehr wirksam.

Mandantenadmins wählen für Gesprächsinhalte den gewünschten Modus:

- `ask`: SSF zeigt die lokalisierte Frage; Speicherung und Verarbeitung sind
  nur nach Zustimmung zulässig.
- `disabled`: SSF stellt keine Frage und darf Gesprächsinhalte weder speichern
  noch nachträglich verarbeiten.

Ist `conversationContentStorageAllowed` ausgeschaltet, ist der effektive Modus
immer `disabled`. Die abweichende Tenant-Auswahl bleibt gespeichert, aber
wirkungslos.

## Schreibrechte im Studio

| Akteur             | Zulässige Änderungen                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Systemadmin        | serverweite SSF-Werte, mandantenspezifische Branding- und Speicher-Policies                                        |
| Mandantenadmin     | aktive Sprachen, Standardsprache, einzelne Text-Overrides, gewünschter Speichermodus und erlaubtes Tenant-Branding |
| Benutzer und Gäste | keine Konfigurationsänderungen                                                                                     |

Systemadmins dürfen effektive Tenant-Konfigurationen und die Herkunft der
Werte einsehen, aber tenant-eigene Overrides im Normalbetrieb nicht verändern.
Ein späterer Supportzugriff benötigt einen getrennten, zeitlich begrenzten und
auditierten Vertrag.

## Änderungswirkung

Eine erfolgreich gespeicherte Änderung ist unmittelbar aktiv. Es gibt keinen
Entwurfs- oder Veröffentlichungszustand.

- Normale Text-, Sprach- und Brandingänderungen erscheinen beim nächsten
  Seitenabruf beziehungsweise beim Start einer neuen Session.
- Eine bereits laufende Session behält ihre geladene Darstellung.
- Sperrungen, Plugin-Deaktivierung und ein effektives Verbot der
  Gesprächsspeicherung werden bei nachfolgenden geschützten Vorgängen
  berücksichtigt.

## Fehlervertrag

Fehler verwenden eine stabile maschinenlesbare Struktur:

```json
{
  "contractVersion": "1.0",
  "error": {
    "code": "tenant_suspended",
    "message": "Runtime configuration is unavailable.",
    "retryable": false,
    "correlationId": "01J..."
  }
}
```

| HTTP-Status | Beispiele für Fehlercodes                                         |
| ----------- | ----------------------------------------------------------------- |
| `401`       | `service_authentication_invalid`                                  |
| `403`       | `service_action_forbidden`                                        |
| `404`       | `tenant_not_found`                                                |
| `409`       | `tenant_suspended`, `ssf_plugin_inactive`, `ssf_tenant_not_ready` |
| `503`       | `runtime_configuration_unavailable`                               |

Antworten geben keine Tokens, Secrets, internen Datenbankdetails oder fremden
Tenantdaten preis.

## Audit und Monitoring

Änderungen an serverweiten Werten, Tenant-Policies und Tenant-Overrides sowie
abgelehnte Sicherheitszugriffe werden dauerhaft auditiert. Das Audit enthält
Akteur, Zeitpunkt, Scope, Aktion, betroffene Feldnamen, alte und neue Revision
sowie das Ergebnis. Vollständige HTML-Inhalte, Tokens und Secrets werden nicht
kopiert.

Erfolgreiche Runtime-Abrufe erzeugen technische Metriken und strukturierte
Logs, aber kein dauerhaftes Audit-Ereignis pro Abruf. `X-Correlation-Id`
verknüpft Diagnoseinformationen zwischen SSF und Studio.

## Versionierung

Die Hauptversion steht im API-Pfad und die genaue Schemafassung zusätzlich in
`contractVersion`. Innerhalb von V1 dürfen optionale, abwärtskompatible Felder
ergänzt werden. SSF ignoriert unbekannte Felder und validiert bekannte Felder
streng. Neue Pflichtfelder, entfernte Felder oder geänderte Semantik benötigen
eine neue Hauptversion.

Studio und SSF müssen während einer Umstellung mindestens eine gemeinsame
Hauptversion unterstützen. `configurationRevision` versioniert den Inhalt und
ist unabhängig von `contractVersion`.

## Ausdrücklich nicht ausgetauschte Daten

- keine Studio-Benutzerlisten an SSF,
- keine E-Mail-Adressen im SSF-Token,
- keine Gast-Token oder Customer-Session-Token an Studio,
- keine Passwörter, Client-Secrets oder Studio-IAM-Interna,
- keine Gesprächsinhalte, Einwilligungsdatensätze oder Session-Verläufe,
- keine ClickHouse-, Nutzungs-, Kosten- oder Reportingdaten,
- keine direkte Datenbankverbindung zwischen Studio und SSF.

## Vor der Implementierungsplanung noch zu konkretisieren

Die fachlichen Entscheidungen sind getroffen. Für die normative OpenSpec- und
Implementierungsplanung bleiben folgende technische Konkretisierungen:

- vollständiger initialer Katalog der `ssf.*`-Permissions,
- konkrete Keycloak-Client-ID und Audience,
- kanonisches Serialisierungs- und Hashverfahren für
  `configurationRevision`,
- konkrete HTML-Sanitizer-Bibliothek und minimale Gefahrenregeln,
- OpenAPI-Schema einschließlich Formaten und maximalen Feldgrößen,
- Übergangs- und Entfernungskriterien für `admin` und `customer`,
- Abgleich des vereinfachten Service-Token-Vertrags mit der parallel
  entwickelten Runtime-OpenSpec-Ausarbeitung, sobald diese auf dem gemeinsamen
  Branch verfügbar ist.
