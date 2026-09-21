## ADDED Requirements

### Requirement: Kategorienmanagement verwendet schema-gestützte Mainserver-Adapter

Die Mainserver-Integration MUST getrennte typisierte GraphQL-Dokumente und Runtime-Parser für den bestehenden Active-only-Kategorienread, den Management-Read mit `includeInactive: true`, `saveCategory` und `deleteCategory` bereitstellen. Der Management-Vertrag MUST das vollständige Kategorie-, Save-, Delete-, Usage- und Fehlermodell aus dem verifizierten Schema-Snapshot abbilden.

Plugins dürfen den Mainserver weder direkt aufrufen noch rohe GraphQL-Payloads als Kategorienmodell verwenden.

#### Scenario: Management-Kategorien werden geladen

- **WHEN** die Host-Fassade die Management-Sicht anfordert
- **THEN** verwendet sie eine schema-gestützte Query mit `includeInactive: true`
- **AND** validiert sie IDs, Aktivstatus, Hierarchie, optionale Felder, Datentypen und Zeitstempel zur Laufzeit
- **AND** gibt sie ausschließlich das normalisierte typisierte Management-Modell zurück

#### Scenario: Kategorie wird gespeichert

- **WHEN** die Host-Fassade einen validierten Create- oder Update-Input erhält
- **THEN** delegiert sie an das schema-gestützte `saveCategory`-Dokument
- **AND** bewahrt sie Kategorie, `affectedDescendantIds` und strukturierte Fehler ohne verlustbehaftete Umformung

#### Scenario: Kategorie wird gelöscht

- **WHEN** die Host-Fassade einen validierten Delete für eine Kategorie-ID erhält
- **THEN** delegiert sie ausschließlich an das schema-gestützte `deleteCategory`-Dokument
- **AND** bewahrt sie `deletedCategoryId`, alle Usage-Zahlen und strukturierte Fehler

#### Scenario: Mainserver-Antwort verletzt den Snapshot-Vertrag

- **WHEN** eine Management-Query oder Mutation erforderliche Felder in ungültiger Form liefert
- **THEN** verwirft der Runtime-Parser die Antwort mit `category_management_invalid_response`
- **AND** behauptet die Integration keinen fachlichen Erfolg
- **AND** protokolliert sie keine vollständige GraphQL-Antwort oder Kategorie-PII

#### Scenario: Management-Antwort enthält einen ungültigen Datentyp-Identifier

- **WHEN** eine Management-Query oder Mutation einen Datentyp-Identifier außerhalb des bestätigten 1-bis-128-Zeichen-Vertrags liefert
- **THEN** verwirft der Runtime-Parser die gesamte Antwort mit `category_management_invalid_response`
- **AND** übernimmt das Studio den ungültigen Wert nicht in einen editierbaren Kategorie-Draft

### Requirement: Die Kategorienroute trennt Auswahl-, Management- und Mutationsoperationen

Die Mainserver-Integration MUST den bestehenden parameterlosen Active-only-Read kompatibel erhalten und eine explizite Management-Sicht bereitstellen. Create, Update und Delete MUST getrennte HTTP-Operationen mit strikt validierten Pfad- und Body-Verträgen verwenden.

Die Route MUST jede Operation unmittelbar vor dem Upstream-Aufruf mit der passenden fully-qualified Action autorisieren und die effektiven Credentials aus dem aktiven Organisations- beziehungsweise Benutzerkontext auflösen.

Create MUST den vorhandenen Host-Idempotenzvertrag verwenden. Derselbe `Idempotency-Key` mit demselben validierten Payload MUST ein gespeichertes terminales Ergebnis zurückgeben, ohne `saveCategory` erneut auszuführen. Eine nichtterminale Reservation MUST einen automatischen zweiten Upstream-Aufruf blockieren und einen Management-Re-Read verlangen. Derselbe Schlüssel mit abweichendem Payload oder eine nicht verfügbare Idempotenz-Persistenz MUST vor dem Upstream-Aufruf fail-closed abgewiesen werden.

#### Scenario: Bestehender Auswahlconsumer ruft Kategorien ab

- **WHEN** ein Consumer `GET /api/v1/mainserver/categories` ohne Management-View aufruft
- **THEN** verwendet die Fassade weiterhin die Active-only-Query
- **AND** bleibt das bestehende Antwortmodell für Auswahlconsumer kompatibel

#### Scenario: Kategorienplugin ruft die Management-Sicht ab

- **WHEN** das Kategorienplugin die explizite Management-View mit `categories.read` aufruft
- **THEN** verwendet die Fassade die Management-Query mit inaktiven Kategorien
- **AND** verwechselt oder vermischt sie den Response nicht mit dem Auswahlcache beziehungsweise Auswahlmodell

#### Scenario: Create, Update oder Delete wird autorisiert

- **WHEN** ein Benutzer eine Kategorienmutation anfordert
- **THEN** prüft der Server je nach Operation exakt `categories.create`, `categories.update` oder `categories.delete`
- **AND** löst er erst danach die effektiven Mainserver-Credentials auf und ruft den Upstream auf

#### Scenario: Request enthält eine manipulierte ID

- **WHEN** ein Create-Body eine ID enthält oder eine Update-Body-ID von der Pfad-ID abweicht
- **THEN** lehnt die Route den Request vor dem GraphQL-Aufruf als `category_management_invalid_request` ab
- **AND** bleibt die Pfad-ID die einzige kanonische Update-Identität

#### Scenario: Create wird mit demselben Idempotenzschlüssel wiederholt

- **WHEN** ein bereits terminal verarbeitetes Create mit demselben `Idempotency-Key` und Payload erneut eintrifft
- **THEN** liefert die Route das gespeicherte terminale Ergebnis zurück
- **AND** ruft sie `saveCategory` nicht erneut auf

#### Scenario: Idempotenz kann vor Create nicht sichergestellt werden

- **WHEN** der Schlüssel fehlt, mit anderem Payload wiederverwendet wird oder die vorhandene Idempotenz-Persistenz nicht verfügbar ist
- **THEN** weist die Route Create vor dem Upstream-Aufruf mit dem bestehenden stabilen Idempotenzfehler ab
- **AND** führt sie keine Mainserver-Mutation aus

#### Scenario: Create-Reservation besitzt noch kein terminales Ergebnis

- **WHEN** ein Retry mit demselben Schlüssel auf eine nichtterminale Reservation trifft
- **THEN** ruft die Route `saveCategory` nicht erneut auf
- **AND** fordert sie einen Management-Re-Read vor einer neuen Create-Entscheidung

### Requirement: Kategorienmanagement ist eine Baseline-Capability

Die Mainserver-Integration MUST `categories.read`, `categories.create`, `categories.update` und `categories.delete` als von allen unterstützten Mainservern bereitgestellten Basisvertrag behandeln. Sie darf diese Operationen nicht von einer zusätzlichen Laufzeitkonfiguration abhängig machen. Lokale Autorisierung, verwendbare Management-Credentials und die Validierung der Upstream-Antwort bleiben davon unberührt fail-closed.

#### Scenario: Keine zusätzliche Capability-Konfiguration ist gesetzt

- **WHEN** keine Kategorien-Capability über `SVA_MAINSERVER_CONFIRMED_CAPABILITIES` konfiguriert ist
- **THEN** enthält die effektive Capability-Liste alle vier `categories.*`-Actions
- **AND** erreicht eine lokal autorisierte Management-Operation den typisierten Mainserver-Adapter
- **AND** fällt ein ungültiger Upstream-Vertrag als `category_management_invalid_response` aus, ohne auf den Active-only-Auswahlread zurückzufallen

#### Scenario: Effektive Credentials besitzen keine Management-Rolle

- **WHEN** der Mainserver einen Management-Read oder eine Mutation aufgrund der effektiven Upstream-Rolle ablehnt
- **THEN** liefert die Fassade einen vom lokalen IAM-Denial unterscheidbaren Readiness-/Forbidden-Fehler
- **AND** versucht sie keine andere Credential-Quelle außerhalb der bestehenden Kontextpolicy

#### Scenario: Fremde Municipality-ID wird angefordert

- **WHEN** eine Kategorie- oder Parent-ID nicht zum durch die effektiven Credentials gebundenen Municipality-Kontext gehört
- **THEN** schlägt die Operation fail-closed fehl
- **AND** enthält die Antwort weder fremde Kategorienamen noch fremde Usage-Zahlen

### Requirement: Kategorienmutationsergebnisse bleiben fachlich eindeutig

Die Mainserver-Integration MUST HTTP-/Transporterfolg, GraphQL-Ausführung und fachlichen Mutationserfolg getrennt bewerten. Ein Save ist nur bei vorhandener Kategorie und leerer Fehlerliste erfolgreich. Ein Delete ist nur bei vorhandener `deletedCategoryId` und leerer Fehlerliste erfolgreich.

Bestätigte Upstream-Erfolge dürfen durch einen nachfolgenden lokalen Reload-Fehler nicht in einen behaupteten Upstream-Fehler oder Rollback umgedeutet werden.

#### Scenario: HTTP 200 enthält Save-Fehler

- **WHEN** der Mainserver HTTP 200 mit leerer Kategorie und nicht leerer Save-Fehlerliste liefert
- **THEN** meldet die Integration einen fachlichen Save-Fehler
- **AND** bewahrt sie Code und sicheren Feldbezug für die Plugin-UI

#### Scenario: HTTP 200 enthält Delete-Blockade

- **WHEN** der Mainserver HTTP 200 mit leerer `deletedCategoryId`, Usage und `CATEGORY_IN_USE` liefert
- **THEN** meldet die Integration keinen Delete-Erfolg
- **AND** gibt sie die validierten Usage-Zahlen an die Plugin-UI weiter

#### Scenario: Reload schlägt nach bestätigter Mutation fehl

- **WHEN** die Mutation eindeutig erfolgreich war, der anschließende Management-Read aber fehlschlägt
- **THEN** bleibt der bestätigte Mutationserfolg fachlich bestehen
- **AND** kennzeichnet die UI den Aktualisierungsfehler getrennt
- **AND** kann der Management-Read ohne Wiederholung der Mutation erneut ausgeführt werden
