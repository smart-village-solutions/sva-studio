# plugin-actions Specification

## Purpose
Diese Spezifikation beschreibt den kanonischen Vertrag für vollständig qualifizierte Plugin-Action-IDs, Namespace-Isolation zwischen Core und Plugins sowie die deterministische Behandlung von Aliasen, Kollisionen, IAM-Prüfungen und Auditierung.
## Requirements
### Requirement: Namespaced Plugin-Action-IDs
Das System MUST Plugin-Aktionen ausschließlich mit vollständig qualifizierten Action-IDs im Format `<namespace>.<actionName>` akzeptieren.

#### Scenario: Plugin registriert gültige Action-ID
- **WHEN** ein Plugin mit Namespace `news` die Action `news.publish` registriert
- **THEN** wird die Registrierung angenommen
- **AND** die Action-ID ist eindeutig in der globalen Registry auflösbar

#### Scenario: Plugin registriert Action ohne Namespace
- **WHEN** ein Plugin die Action `publish` ohne Namespace registriert
- **THEN** wird die Registrierung mit einem Validierungsfehler abgewiesen

### Requirement: Gemeinsames Namensmodell für Core und Plugins
Das System MUST für autorisierbare Actions ein gemeinsames Namensmodell verwenden, bei dem sowohl Core- als auch Plugin-Actions vollständig qualifiziert sind und sich nur durch reservierte bzw. plugin-eigene Namespaces unterscheiden.

#### Scenario: Core-Namespace ist reserviert
- **WHEN** eine Core-Action wie `content.read` oder `iam.users.manage` definiert wird
- **THEN** verwendet sie ebenfalls das Format `<namespace>.<action>`
- **AND** ihr Namespace gilt als reservierter Core-Namespace

#### Scenario: Plugin-Namespace bleibt plugin-eigen
- **WHEN** ein Plugin mit Namespace `news` eine Action wie `news.create` definiert
- **THEN** verwendet sie ebenfalls das Format `<namespace>.<actionName>`
- **AND** ihr Namespace gilt als plugin-eigener Namespace und nicht als Core-Namespace

### Requirement: Namespace-Isolation bei Action-Ownership
Das System MUST sicherstellen, dass Plugins nur Aktionen im eigenen Namespace registrieren und ohne expliziten Core-Bridge-Contract keine fremden Namespaces ausführen.

#### Scenario: Plugin nutzt fremden Namespace
- **WHEN** ein Plugin mit Namespace `news` versucht `events.publish` zu registrieren
- **THEN** wird die Registrierung abgewiesen
- **AND** der Validierungsfehler enthält den deterministischen Fehlercode `plugin_action_namespace_mismatch:<expectedNamespace>:<receivedNamespace>:<actionId>`

#### Scenario: Cross-Namespace-Ausführung ohne Freigabe
- **WHEN** ein Plugin eine Action aus einem fremden Namespace ausführt
- **THEN** verweigert das System die Ausführung
- **AND** es wird ein Audit-Event mit Ergebnis `denied` geschrieben

#### Scenario: Plugin darf keinen reservierten Core-Namespace registrieren
- **WHEN** ein Plugin versucht eine Action in einem reservierten Core-Namespace wie `content.publish` oder `iam.users.manage` zu registrieren
- **THEN** wird die Registrierung abgewiesen
- **AND** der Namespace bleibt ausschließlich dem Core oder einem expliziten Bridge-Contract vorbehalten

### Requirement: Fail-Fast bei Action-Kollisionen
Das System MUST Action-Kollisionen während der Registry-Initialisierung deterministisch erkennen und den Startvorgang fail-fast abbrechen.

#### Scenario: Doppelte Action-ID
- **WHEN** zwei Plugins dieselbe Action-ID `events.publish` registrieren
- **THEN** bricht die Registry-Initialisierung mit einer eindeutigen Kollisionsermeldung ab
- **AND** es wird keine teilweise inkonsistente Registry veröffentlicht

### Requirement: Legacy-Aliase bleiben explizit und deprecationsfähig
Das System MUST Legacy-Kurzformen für Plugin-Actions nur als explizit deklarierte Alias-Einträge unterstützen, auf die kanonische fully-qualified Action-ID auflösen und bei Nutzung als veraltet markieren.

#### Scenario: Expliziter Legacy-Alias wird auf kanonische Action-ID aufgelöst
- **WHEN** ein Plugin für `news.create` zusätzlich den Legacy-Alias `create` deklariert
- **THEN** kann die Registry `create` auf die kanonische Action-ID `news.create` auflösen
- **AND** der Registry-Eintrag markiert `create` als deprecated Alias und `news.create` als kanonische Action-ID

#### Scenario: Legacy-Alias bleibt unqualifizierte Kurzform
- **WHEN** ein Plugin einen Alias mit Namespace wie `events.publish` oder `content.read` deklarieren will
- **THEN** wird die Registrierung mit einem Alias-Validierungsfehler abgewiesen
- **AND** nur unqualifizierte Legacy-Kurzformen ohne Punkt sind zulässig

#### Scenario: Impliziter Legacy-Alias ohne Deklaration ist unzulässig
- **WHEN** eine unqualifizierte Kurzform wie `create` nicht explizit als Alias registriert wurde
- **THEN** darf das System daraus keine implizite Zuordnung zu einer Plugin-Action ableiten

#### Scenario: Legacy-Alias kollidiert mit bestehender Action-ID oder anderem Alias
- **WHEN** ein deklarierter Legacy-Alias bereits als kanonische Action-ID oder Alias eines anderen Eintrags existiert
- **THEN** wird die Registry-Initialisierung deterministisch mit einem Kollisionsfehler abgebrochen

### Requirement: Namespace-sichere IAM-Prüfung
Das System MUST Autorisierungsentscheidungen gegen vollständig qualifizierte Action-IDs inklusive Namespace treffen.

#### Scenario: Berechtigung nur für eigenes Namespace
- **GIVEN** ein Benutzer hat eine Berechtigung für `events.publish`
- **WHEN** derselbe Benutzer `news.publish` ausführt
- **THEN** wird die Aktion als `forbidden` abgewiesen

### Requirement: Auditierbare Plugin-Actions
Das System MUST für Registrierung und Ausführung von Plugin-Aktionen Audit-Ereignisse mit Namespace-Kontext erzeugen.

#### Scenario: Erfolgreiche Action-Ausführung
- **WHEN** eine Plugin-Action erfolgreich ausgeführt wird
- **THEN** enthält das Audit-Event mindestens `actionId`, `actionNamespace`, `actionOwner`, `result`, `requestId`, `traceId`

### Requirement: Events And POI Plugin Actions Are Fully Qualified

Events and POI plugins SHALL declare all authorizable actions with fully-qualified action IDs in their own namespaces.

Events action IDs SHALL use the `events.` namespace. POI action IDs SHALL use the `poi.` namespace. Short action IDs SHALL only be accepted as documented legacy aliases where explicitly declared.

#### Scenario: Events action IDs are namespaced

- **WHEN** the Events plugin registers create, edit, update, or delete actions
- **THEN** the action IDs are `events.create`, `events.edit`, `events.update`, and `events.delete`
- **AND** each action declares an explicit required host action such as `content.read`, `content.create`, `content.updatePayload`, or `content.delete`

#### Scenario: POI action IDs are namespaced

- **WHEN** the POI plugin registers create, edit, update, or delete actions
- **THEN** the action IDs are `poi.create`, `poi.edit`, `poi.update`, and `poi.delete`
- **AND** each action declares an explicit required host action such as `content.read`, `content.create`, `content.updatePayload`, or `content.delete`

#### Scenario: Plugin attempts to use another namespace

- **GIVEN** the Events plugin attempts to register `poi.update`
- **WHEN** plugin action guardrails validate the definition
- **THEN** the action is rejected because it is outside the Events namespace

### Requirement: News Full-model Operations Use Existing Qualified Actions

The expanded News model SHALL continue to use fully-qualified News plugin actions for UI affordances and authorization metadata.

The existing News actions SHALL cover full-model create, edit, update, and delete flows unless a distinct operation has a separate user-visible permission requirement.

#### Scenario: User edits full News fields

- **GIVEN** the News editor exposes the full Mainserver News model
- **WHEN** a user edits fields such as categories, address, source URL, content blocks, or metadata
- **THEN** the UI uses the existing fully-qualified News edit/update action metadata
- **AND** authorization still maps to the corresponding local content primitive checks in the host facade

### Requirement: Push Notification Is Explicitly Authorized If Exposed

Wenn der News-Editor `pushNotification` als auswählbare Operation anbietet, MUST das System den Versand über die vollständig qualifizierte Permission `news.pushNotification` explizit und zusätzlich zur zugrunde liegenden Create- oder Update-Aktion autorisieren. Weder `news.create`, `news.update` noch `content.publish` dürfen den Push-Versand implizit erlauben.

#### Scenario: Berechtigter Benutzer löst Push während News-Create aus

- **WENN** ein Benutzer mit `news.create` und `news.pushNotification` eine neue Nachricht mit aktivierter Push-Option speichert
- **DANN** machen UI-Action-Metadaten und Host-Autorisierung die zusätzliche Operation `news.pushNotification` explizit
- **UND** darf der Server den Push erst nach erfolgreicher Prüfung beider Permissions an den Mainserver weitergeben

#### Scenario: Berechtigter Benutzer löst Push während News-Update aus

- **WENN** ein Benutzer mit `news.update` im passenden Datensatz-Scope und `news.pushNotification` eine bestehende Nachricht mit aktivierter Push-Option speichert
- **DANN** prüft der Server sowohl die Update-Berechtigung für den konkreten Datensatz als auch das Push-Recht
- **UND** startet er ohne beide erfolgreichen Entscheidungen keinen Mainserver-Aufruf

#### Scenario: Basisrecht ohne Push-Recht reicht nicht aus

- **WENN** ein Benutzer die passende `news.create`- oder `news.update`-Permission, aber kein `news.pushNotification` besitzt
- **UND** ein Client dennoch `pushNotification = true` sendet
- **DANN** lehnt der Server die gesamte Mutation vor dem Mainserver-Aufruf fail-closed ab
- **UND** nennt der strukturierte Denial `news.pushNotification` als fehlende Permission

#### Scenario: Publish-Recht ersetzt das Push-Recht nicht

- **WENN** ein Benutzer `content.publish`, aber kein `news.pushNotification` besitzt
- **UND** derselbe Speichervorgang eine Veröffentlichung und einen Push auslösen würde
- **DANN** erlaubt das Publish-Recht ausschließlich den passenden Veröffentlichungsübergang
- **UND** bleibt die Mutation wegen des fehlenden Push-Rechts abgelehnt

#### Scenario: Push-Recht ersetzt notwendige Publish-Berechtigung nicht

- **WENN** ein Benutzer `news.pushNotification`, aber kein für den angeforderten Übergang notwendiges `content.publish` besitzt
- **UND** derselbe Speichervorgang die Nachricht erstmals veröffentlichen und einen Push senden würde
- **DANN** bleibt der Veröffentlichungsübergang serverseitig verweigert
- **UND** erlaubt das Push-Recht weder Veröffentlichung noch eine Umgehung der Lifecycle-Autorisierung

#### Scenario: Bestehende Custom-Rollen erhalten keinen impliziten Push-Grant

- **WENN** `news.pushNotification` im Tenant materialisiert oder abgeglichen wird
- **DANN** bleiben bestehende Grants benutzerdefinierter Rollen unverändert
- **UND** wird die Permission nur durch bewusste Rollenpflege oder den bestehenden verwalteten Vollzugriffsvertrag von `system_admin` wirksam

### Requirement: Autorisierbare Plugin-Beiträge deklarieren ihren Access-Bezug vollständig

Das System MUST für autorisierbare Plugin-Aktionen, Navigationseinträge, Routen sowie Admin-Resource-Aktionen einen expliziten Access-Bezug verlangen. Permission- und Action-Referenzen MUST vollständig qualifiziert, im kanonischen Katalog bekannt und mit dem Plugin- und Module-IAM-Vertrag konsistent sein. Modulgebundene Beiträge MUST zusätzlich ihr kanonisches `moduleId` referenzieren; eine Permission ersetzt keine Modulzuweisung.

#### Scenario: Vollständiger Plugin-Beitrag wird registriert

- **WENN** ein Plugin eine Route, Navigation und Create-, Update- oder Delete-Aktion registriert
- **DANN** referenziert jeder autorisierbare Beitrag eine explizit deklarierte vollständig qualifizierte Action beziehungsweise Access-Anforderung
- **UND** validiert der Host die Referenzen gegen Plugin-Permissions, Module-IAM, `moduleId` und den kanonischen Permission-Katalog
- **UND** veröffentlicht er erst danach einen konsistenten Registry-Snapshot

#### Scenario: Autorisierbarer Beitrag besitzt keinen Access-Bezug

- **WENN** ein Plugin nach Abschluss der Migrationsphase eine autorisierbare Route, Navigation oder UI-Aktion ohne expliziten Access-Bezug registriert
- **DANN** weist die Registry den Beitrag fail-fast mit einem deterministischen Diagnosecode ab
- **UND** veröffentlicht sie keinen partiell geschützten Plugin-Snapshot

#### Scenario: Permission-Verträge driften auseinander

- **WENN** `plugin.permissions`, `plugin.moduleIam.permissionIds`, Action-Referenzen oder Admin-Resource-Permissions unbekannte beziehungsweise voneinander abweichende Permission-Mengen enthalten
- **DANN** meldet die gemeinsame Cross-Validation den konkreten Namespace und die abweichenden IDs
- **UND** wird die Abweichung nach der Migrationsphase zum Build- oder Registry-Fehler

#### Scenario: Permission existiert, Modul ist aber nicht zugewiesen

- **WENN** eine Plugin-Action im aktuellen Tenant-Permission-Snapshot vorkommt
- **UND** das deklarierte Plugin-Modul der Instanz nicht zugewiesen ist
- **DANN** löst der Host die Action als nicht erlaubt auf
- **UND** darf das Plugin die fehlende Modulzuweisung weder über einen lokalen Default noch über die Permission umgehen

### Requirement: Plugin-UI konsumiert hostaufgelöste Action-Entscheidungen

Das System SHALL Plugin-Oberflächen mit hostaufgelösten, scope- und modulgebundenen Entscheidungen für ihre deklarierten Actions versorgen. Plugins dürfen eine UI-Freigabe nicht aus Rollenbezeichnungen, Dev-Auth-Verfügbarkeit, einer unscoped Action-Liste oder einer bloßen Build-time-Registrierung ableiten.

#### Scenario: Standard-Content-Detailseite wird read-only gerendert

- **WENN** ein Benutzer die `<plugin>.read`-Permission, aber nicht `<plugin>.update` oder `<plugin>.delete` besitzt
- **DANN** kann der Host die Plugin-Detailseite lesbar materialisieren
- **UND** übergibt er `update` und `delete` als nicht erlaubt
- **UND** rendert der Plugin-Editor weder ausführbare Save- noch Delete-Controls

#### Scenario: Standard-Content-Erstellung benötigt Create-Permission

- **WENN** eine Standard-Content-Erstellungsfläche materialisiert wird
- **DANN** stammt ihre Create-Capability aus der hostaufgelösten `<plugin>.create`-Entscheidung im aktuellen Scope
- **UND** kann das Plugin die Erstellungsaktion nicht über einen lokalen Default auf `true` setzen

#### Scenario: Plugin erhält eine Ressourcen-Capability

- **WENN** eine Plugin-Aktion eine datensatzbezogene Capability benötigt
- **DANN** erhält das Plugin ausschließlich die bereits hostaufgelöste Entscheidung aus dem fachlich führenden Serververtrag
- **UND** rekonstruiert es keine Ownership- oder ABAC-Regel aus Listen-, Projection- oder Sessiondaten

#### Scenario: Plugin verwendet eine technische Rolle als fachlichen Ersatz

- **WENN** ein Plugin eine tenantlokale Mutation allein wegen einer Rollenbezeichnung wie `system_admin` freigeben würde
- **DANN** gilt dies als Vertragsverletzung
- **UND** muss die UI stattdessen die vollständig qualifizierte Action-Entscheidung verwenden
- **UND** bleiben ausdrückliche Plattform-Sonderrollen auf ihren dokumentierten Plattform-Scope begrenzt

### Requirement: Deterministische phasenweise Plugin-Registry-Validierung

Das System MUST Plugin-Access-Anforderungen und Plugin-Actions vor Veröffentlichung eines Registry-Snapshots fail-closed, phasenweise und mit stabilen Fehlercodes sowie stabiler Fehlerpriorität validieren. Eine interne Modularisierung MUST die bestehende öffentliche Plugin-API und die beobachtbare Validierungssemantik erhalten.

#### Scenario: Verknüpfte Access-Anforderungen sind mengengleich

- **WHEN** Action und Route dieselben Tenant-Actions in unterschiedlicher Reihenfolge oder mit Duplikaten deklarieren
- **THEN** behandelt der Registry-Validator die Action-Werte als dieselbe Menge
- **AND** Action-Modus, Modul, Ressourcen-Kontext und alle Capability-Felder bleiben Teil des exakten Vergleichs

#### Scenario: Capability-Feld weicht ab

- **WHEN** sich verknüpfte Access-Anforderungen in `action`, `allowed`, `instanceId`, `organizationId`, `resourceType` oder `resourceId` unterscheiden
- **THEN** wird der Registry-Snapshot mit dem bestehenden Access-Mismatch-Fehler abgewiesen

#### Scenario: Mehrere Action-Fehler liegen gleichzeitig vor

- **WHEN** ein Action-Beitrag gleichzeitig mehrere ungültige Eigenschaften besitzt
- **THEN** meldet die Registry weiterhin den nach der bestehenden Prüfungsreihenfolge priorisierten Fehlercode
- **AND** es wird keine teilweise Registry veröffentlicht

#### Scenario: Öffentliche Registry-Fassade bleibt stabil

- **WHEN** der Host `createPluginActionRegistry` oder `createPluginRegistry` verwendet
- **THEN** bleiben Signaturen, Registry-Einträge, Legacy-Alias-Auflösung und Fehlercodes unverändert

