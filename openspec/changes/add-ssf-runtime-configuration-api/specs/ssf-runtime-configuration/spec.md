## ADDED Requirements

### Requirement: SSF erhält eine feste effektive Runtime-Konfiguration V1

Das System SHALL über
`GET /internal/plugins/ssf/v1/runtime-configuration` ausschließlich das feste
V1-Schema aus dem maßgeblichen Studio–SSF-Vertrag liefern. Die Antwort MUST
auf den hostgebundenen Tenant begrenzt sein und Vertrags-, Konfigurations- und
Autorisierungsrevision enthalten.

#### Scenario: Bereiter Tenant erhält die vollständige V1-Antwort

- **GIVEN** Service-Identität, Tenant, Plugin-Aktivierung, Readiness und `authorizationRevision` sind gültig
- **WHEN** SSF die Runtime-Konfiguration abruft
- **THEN** enthält die Antwort ausschließlich `contractVersion`, `configurationRevision`, `authorizationRevision`, Tenantprofil, Branding, Lokalisierung und Gesprächsspeichermodus
- **AND** entsprechen Typen, Nullwerte, Formate und Größen dem veröffentlichten OpenAPI-Schema
- **AND** enthält sie keine Secrets, Studio-IAM-Interna oder Fremdtenantdaten

#### Scenario: Unbekanntes Pflichtfeld oder ungültiger gespeicherter Wert verhindert die Antwort

- **GIVEN** gespeicherte oder aufgelöste Daten verletzen das feste V1-Schema oder seine Größenlimits
- **WHEN** der Endpoint die Antwort erzeugt
- **THEN** schlägt der Abruf fail-closed mit `runtime_configuration_unavailable` fehl
- **AND** kürzt, verwirft oder ersetzt er den fehlerhaften Wert nicht still

### Requirement: Effektive Werte folgen genau der freigegebenen Priorität

Das System MUST jedes übersteuerbare Feld und jeden lokalisierten Text in der
Reihenfolge Tenant-Override, serverweite Anpassung und versionierter
Produktdefault auflösen. Policies MUST erst danach die Wirksamkeit von
Tenant-Branding und Gesprächsspeicherung begrenzen.

#### Scenario: Tenantwert überschreibt Serverwert und Produktdefault

- **GIVEN** für denselben Text existieren Produktdefault, serverweiter Wert und Tenant-Override
- **WHEN** die effektive Konfiguration aufgelöst wird
- **THEN** liefert das System den Tenant-Override
- **AND** enthält die Runtime-Antwort keine Herkunftsmetadaten

#### Scenario: Unwirksames Branding bleibt gespeichert aber unsichtbar

- **GIVEN** ein Tenant besitzt gespeichertes eigenes Branding
- **AND** `customBrandingAllowed` ist für diesen Tenant deaktiviert
- **WHEN** die effektive Konfiguration aufgelöst wird
- **THEN** verwendet sie das nächste zulässige Branding aus Serverwert oder Produktdefault
- **AND** löscht sie die gespeicherte Tenantauswahl nicht

#### Scenario: Verbotene Gesprächsspeicherung deaktiviert Frage und Verarbeitung

- **GIVEN** der gewünschte Tenantmodus ist `ask`
- **AND** `conversationContentStorageAllowed` ist deaktiviert
- **WHEN** die effektive Konfiguration aufgelöst wird
- **THEN** ist `conversationContentStorage.mode` gleich `disabled`
- **AND** ist `conversationContentStorageQuestionHtml` in jeder aktiven Locale `null`

### Requirement: Spracheinstellungen bleiben tenantbezogen und gültig

Das System SHALL für neue beziehungsweise nicht angepasste Tenants alle
installationsweit verfügbaren Produktsprachen aktivieren. Tenant-Overrides
dürfen Sprachen deaktivieren und erneut aktivieren, müssen aber mindestens eine
aktive Sprache und eine darin enthaltene Standardsprache erhalten.

#### Scenario: Tenant ohne Sprach-Overrides erhält alle verfügbaren Sprachen

- **GIVEN** ein Tenant besitzt keine Locale-Overrides
- **WHEN** seine Runtime-Konfiguration aufgelöst wird
- **THEN** enthält sie alle installationsweit verfügbaren Produktsprachen
- **AND** verwendet sie die wirksame Standardsprache

#### Scenario: Ungültige Standardsprache wird nicht ausgeliefert

- **GIVEN** die gespeicherte Standardsprache ist installationsweit oder tenantbezogen nicht aktiv
- **WHEN** die Runtime-Konfiguration aufgelöst wird
- **THEN** schlägt der Abruf fail-closed als ungültige Konfiguration fehl
- **AND** erfindet keine andere Standardsprache

### Requirement: HTML bleibt flexibel und entfernt unmittelbar ausführbare Inhalte

Das System SHALL lokalisierte HTML-Texte serverseitig bereinigen. Es SHALL
semantische Inhalte und externe HTTP-/HTTPS-Bilder zulassen, aber Skripte,
Event-Handler und gefährliche URL-Protokolle entfernen. Eine Domain-Allowlist
oder ein verpflichtender Medienproxy ist nicht Teil von V1.

#### Scenario: Erlaubtes HTML mit externem Bild bleibt nutzbar

- **GIVEN** ein administrativer Text enthält semantische Struktur und ein externes HTTP- oder HTTPS-Bild
- **WHEN** der Text gespeichert beziehungsweise für die Runtime aufgelöst wird
- **THEN** bleiben die zulässigen Elemente und Bildreferenz erhalten
- **AND** bleibt der verantwortliche Mandant für Zulässigkeit und Benutzerinformation zuständig

#### Scenario: Ausführbarer Inhalt wird entfernt

- **GIVEN** ein HTML-Text enthält Skripte, Event-Handler oder ein gefährliches URL-Protokoll
- **WHEN** der Server den Text bereinigt
- **THEN** enthält das persistierte beziehungsweise ausgelieferte HTML diese ausführbaren Bestandteile nicht
- **AND** wird kein unbereinigter Parallelpfad angeboten

### Requirement: Konfigurationsrevision bildet nur die effektive Antwort ab

Das System MUST `configurationRevision` als SHA-256-Fingerprint der per
RFC 8785 kanonisierten effektiven V1-Konfiguration ohne beide Revisionsfelder
berechnen. Die Berechnung MUST unabhängig von Datenbankzeilenfolge und
JSON-Schlüsselreihenfolge sein.

#### Scenario: Wirksame Änderung erzeugt eine neue Revision

- **GIVEN** ein wirksamer Tenant-, Server- oder Produktwert ändert sich
- **WHEN** die effektive Konfiguration erneut aufgelöst wird
- **THEN** besitzt sie eine andere `configurationRevision`

#### Scenario: Unwirksamer gespeicherter Override behält die Revision

- **GIVEN** ein gespeicherter Override wird durch eine Policy oder einen höher priorisierten Wert verdeckt
- **WHEN** nur dieser unwirksame Wert geändert wird
- **THEN** bleiben effektive Runtime-Antwort und `configurationRevision` unverändert

### Requirement: Runtime-Reads sind unmittelbar und besitzen keinen fachlichen Cache

Das System SHALL bei jedem Abruf den aktuellen konsistenten Datenbankstand
auflösen. Weder Studio noch SSF MUST für V1 eine persistente oder fachlich
veraltbare Kopie der Runtime-Konfiguration betreiben.

#### Scenario: Gespeicherte Änderung ist beim nächsten Abruf sichtbar

- **GIVEN** ein wirksamer Konfigurationswert wurde erfolgreich committed
- **WHEN** SSF danach die Runtime-Konfiguration erneut abruft
- **THEN** enthält die Antwort den neuen Wert und die neue Revision
- **AND** ist kein Publish- oder Cache-Invalidierungsschritt erforderlich

#### Scenario: Studio oder Plugin-Datenbank ist nicht erreichbar

- **GIVEN** Studio oder die SSF-Plugin-Datenbank ist für den Abruf nicht verfügbar
- **WHEN** SSF die Konfiguration anfordert
- **THEN** darf der Vorgang mit `runtime_configuration_unavailable` fehlschlagen
- **AND** liefert SSF keine persistierte alte Studio-Konfiguration als Fallback aus

### Requirement: Nicht bereite Autorisierung blockiert die Runtime-Konfiguration

Das System MUST die Runtime-Konfiguration zurückhalten, solange keine
verifizierte tenantweite SSF-IAM-Projektionsrevision verfügbar ist. Eine
gewünschte Permission-Menge, Permission-Cache-Revision oder Testkonstante darf
im Produktivprofil nicht als erfolgreiche Projektion ausgegeben werden.

#### Scenario: Projektionsrevision fehlt

- **GIVEN** Tenant und Konfigurationsdaten sind vorhanden
- **AND** der Host besitzt keine verifizierte `authorizationRevision`
- **WHEN** SSF die Runtime-Konfiguration abruft
- **THEN** antwortet der Host mit `409 ssf_tenant_not_ready`
- **AND** ruft er den Plugin-Handler nicht auf

#### Scenario: Verifizierte Revision wird unverändert ausgeliefert

- **GIVEN** der Host besitzt eine verifizierte tenantweite `authorizationRevision`
- **WHEN** der Konfigurationsabruf erfolgreich ist
- **THEN** enthält die Antwort exakt diese Revision
- **AND** bezieht `configurationRevision` sie nicht in ihren Inhaltsfingerabdruck ein

### Requirement: SSF-Laufzeitdaten bleiben außerhalb des Konfigurationsvertrags

Das System MUST Gesprächsinhalte, Einwilligungen, Sessions, ClickHouse-Daten,
Kosten und Auswertungen außerhalb der SSF-Plugin-Konfigurationsdatenbank und
dieses Endpoints halten.

#### Scenario: Konfigurationsabruf verwendet keine SSF-Laufzeitdatenbank

- **WHEN** die effektive Runtime-Konfiguration gelesen wird
- **THEN** öffnet Studio keine Verbindung zu ClickHouse oder einer SSF-Session-Datenbank
- **AND** liest oder persistiert es keine Gesprächsinhalte oder Einwilligungsdatensätze
