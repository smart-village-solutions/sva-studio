## Context

Das Studio besitzt mit `@sva/plugin-categories` bereits einen fachlichen UI-Eigentümer für `/categories`. Die Seite lädt über `GET /api/v1/mainserver/categories` eine flache Active-only-Liste aus der hostgeführten Mainserver-Fassade. Create-, Update- und Delete-Permissions existieren bereits, die Oberfläche stellt ihre Aktionen jedoch deaktiviert dar und die Serverroute akzeptiert nur `GET`.

Der neue Mainserver-Vertrag ergänzt eine Management-Sicht mit inaktiven Kategorien, die Mutationen `saveCategory` und `deleteCategory`, strukturierte Fehler, Statuskaskaden sowie Safe-Delete-Usage. Das Studio darf diesen Vertrag nicht direkt aus dem Browser ansprechen: Credential-Auflösung, lokale IAM-Prüfung, Request-Validierung, GraphQL-Vertrag und PII-arme Observability bleiben hostseitig.

## Goals

- Die bestehende Kategorienseite als vollständige, verständliche und barrierefreie Verwaltung nutzbar machen.
- Active-only-Content-Auswahlen strikt von der Active-and-inactive-Management-Sicht trennen.
- Create, Update und Delete jeweils an die vorhandene fully-qualified Action binden.
- Den Mainserver-Vertrag typsicher und ohne verlustbehaftete Zwischenmodelle abbilden.
- Hierarchie-, Status-, Datentyp- und Safe-Delete-Regeln in UI, Host-Validierung und Tests konsistent machen.
- Unbekannte gespeicherte Datentypen und strukturierte Mainserver-Fehler verlustfrei behandeln.

## Non-Goals

- Keine generische Taxonomieverwaltung für andere Domänen.
- Kein Ersatz des bestehenden Plugin- oder Content-Type-Registry-Vertrags.
- Keine neue lokale Persistenz, Mutation-Journale oder Reconciliation-Infrastruktur.
- Keine Erweiterung des Mainserver-Vertrags über den Stand aus `SVA-1753` hinaus.
- Keine parallele Baumkomponente, wenn die vorhandene Tabelle mit verständlicher Hierarchiedarstellung und Parent-Auswahl ausreicht.

## Decisions

### Das bestehende Kategorienplugin und die bestehende Host-Fassade bleiben zuständig

`@sva/plugin-categories` besitzt Darstellung, Formzustand und lokalisierte Interaktion. `@sva/sva-mainserver/server` besitzt GraphQL-Dokumente, Runtime-Validierung, Credential-Auflösung und Upstream-Fehlerabbildung. Die App behält ausschließlich dünne Routing- und Server-Adapter.

Es entsteht kein neues Package, kein generischer CRUD-Provider und kein direkter GraphQL-Zugriff aus dem Plugin.

### Auswahl- und Management-Reads bleiben getrennt

Der bestehende parameterlose `GET /api/v1/mainserver/categories` bleibt kompatibel und fragt weiterhin nur aktive Kategorien für Content-Auswahlen ab. Die Kategorienverwaltung fordert eine explizite Management-Sicht an, beispielsweise über `GET /api/v1/mainserver/categories?view=management`. Nur diese Sicht verwendet upstream `categories(includeInactive: true)` und liefert das vollständige Management-Modell.

Der Server akzeptiert ausschließlich die dokumentierten View-Werte. Die Management-Sicht benötigt lokal `categories.read` und verwendbare Mainserver-Management-Credentials. Ein fehlender Management-Vertrag oder eine fehlende Upstream-Rolle fällt mit einem deterministischen Fehler aus; die Route darf nicht auf die Active-only-Liste zurückfallen und dadurch inaktive Einträge verschweigen.

### Create und Update verwenden getrennte HTTP-Operationen bei gemeinsamem Upstream-Vertrag

Die Host-Fassade verwendet:

- `POST /api/v1/mainserver/categories` für Create mit `categories.create`,
- `PUT /api/v1/mainserver/categories/:id` für vollständiges Update mit `categories.update`,
- `DELETE /api/v1/mainserver/categories/:id` für Safe-Delete mit `categories.delete`.

Create akzeptiert keine Client-ID. Update übernimmt die kanonische ID ausschließlich aus dem Pfad und lehnt eine widersprüchliche Body-ID ab. Beide Save-Operationen validieren das vollständige Formularmodell und delegieren an `saveCategory`. Delete delegiert an `deleteCategory`. Die konkrete App-Anbindung bleibt ein dünner Adapter zum Package-Dispatcher.

Für Create erzeugt der Client pro fachlichem Anlegeversuch einen `Idempotency-Key` und behält ihn bis zu einem terminalen Ergebnis bei. Die Host-Route verwendet vor dem Upstream-Aufruf den vorhandenen Idempotenz-Reservierungs- und Replay-Pfad. Ein terminal gespeichertes Ergebnis wird bei einem Retry mit demselben Schlüssel und Payload replayed. Ist die Reservation nach einem möglichen Upstream-Aufruf nichtterminal, erfolgt kein automatischer zweiter `saveCategory`-Aufruf; die UI lädt zuerst die Management-Sicht neu und behauptet bis dahin keinen Ausgang. Dafür entstehen weder eine neue Tabelle noch ein kategoriespezifisches Mutation-Journal. Update und Delete konvergieren ebenfalls über den Management-Re-Read.

### Das Management-Modell bleibt vollständig und schema-gestützt

Die Management-Abfrage enthält mindestens:

- `id`, `name`, `active`,
- `parent { id name }`,
- `position`, `iconName`, `contact { email }`,
- `dataTypes`, `createdAt`, `updatedAt`.

Der Save-Input enthält `name`, `active`, `parentId`, `position`, `iconName`, `email` und das erforderliche Array `dataTypes`; die Upstream-ID wird bei Update serverseitig aus dem Pfad ergänzt. Leere optionale Formularwerte werden explizit als Löschen des Werts modelliert und nicht durch Weglassen in einen unbeabsichtigten Preserve-Zustand verwandelt.

Client und Host validieren mindestens einen nicht leeren getrimmten Namen, eine ganzzahlige Position ab `0`, genau eine syntaktisch gültige optionale E-Mail-Adresse sowie getrimmte und gegen die bestätigten Vertragsgrenzen geprüfte Icon- und Datentyp-Identifier. Neue Kategorien starten im Formular aktiv. Gleiche Positionen innerhalb einer Hierarchieebene bleiben zulässig; die Management-Sicht löst sie wie der Mainserver stabil nach Position, Name und ID auf, statt eine nicht vorhandene Eindeutigkeit zu behaupten.

Die Rückgaben von `saveCategory` bewahren `category`, `affectedDescendantIds` und `errors`. Die Rückgaben von `deleteCategory` bewahren `deletedCategoryId`, alle Usage-Zahlen und `errors`. Ein HTTP-2xx bedeutet nicht automatisch fachlichen Mutationserfolg: nicht leere Upstream-Fehler werden als deterministischer fachlicher Fehler an das Plugin weitergegeben.

### Hierarchieänderungen werden vorab verständlich und serverseitig verbindlich geprüft

Die Parent-Auswahl bietet nur Kategorien desselben Management-Snapshots an und blendet die aktuelle Kategorie sowie ihre bekannten Nachfahren aus. `parentId: null` verschiebt eine Kategorie an die Wurzel. Die Clientprüfung verbessert die Bedienung, ersetzt aber niemals die atomare und mandantengebundene Mainserver-Prüfung.

Ändert sich der Aktivstatus einer Kategorie mit Nachfahren, zeigt die UI vor dem Speichern die Kaskadenwirkung und die Zahl der im aktuellen Snapshot erkannten Nachfahren. Nach Erfolg verwendet sie `affectedDescendantIds` als maßgeblichen Upstream-Nachweis, aktualisiert die Liste und meldet die tatsächlich betroffene Anzahl. Abweichungen zum vorherigen Snapshot werden nicht als lokaler Erfolg erfunden.

### Datentypen verwenden den bestehenden Registry-Snapshot und erhalten unbekannte Werte

Auswählbare generische Studio-Datentypen stammen aus `studioBuildTimeRegistry.mainserverGenericTypeRegistry`. Der bestehende App-Routenadapter projiziert deren Mainserver-Identifier und die zugehörigen lokalisierten Content-Type-Bezeichnungen in ein kleines `{ value, label }`-Optionsmodell und übergibt es als Property an `CategoriesPage`. `plugin-categories` importiert dafür weder App-Module noch Host-Registries.

Bestätigte Legacy-Mainserver-Typen wie `event_record`, `news_item`, `point_of_interest`, `tour` und bestehende `generic_item_*`-Typen ergänzt das Plugin über eine kleine statische, übersetzte Kompatibilitätszuordnung. Die Zusammenführung ist reine paketinterne Fachlogik; es entsteht keine zweite dynamische Registry und kein neuer SDK-Beitragstyp.

Das Formular bietet keine freie Texteingabe. Bereits gespeicherte Werte, die im aktuellen Optionskatalog fehlen, erscheinen als nicht mehr auswählbare, aber entfernbare Werte. Sie bleiben Bestandteil des Save-Inputs, bis der Benutzer sie ausdrücklich entfernt. Dadurch führt ein Plugin-, Registry- oder Versionsunterschied nicht zu stillem Datenverlust.

### Safe-Delete bleibt eine einzelne bestätigte, nicht destruktiv ausweitende Aktion

Vor dem Delete bestätigt der Benutzer die konkrete Kategorie. Der Mainserver entscheidet danach verbindlich, ob Referenzen oder Kinder das Löschen blockieren. Bei `CATEGORY_IN_USE` zeigt das Studio die gelieferten Counts für Kinder, Resource-Zuordnungen, External Services, Data-Resource-Settings und Notification-Konfigurationen an.

Das Studio bietet in diesem Change weder rekursives Löschen noch automatische Verschiebung, Reassign oder Umkategorisierung an. Ein erfolgreicher Delete wird erst bei vorhandener `deletedCategoryId` und leerer Fehlerliste behauptet.

### Sichtbarkeit und Ausführung verwenden dieselben Actions

Die UI zeigt Create, Edit und Delete nur bei der jeweils wirksamen Action. Der Server prüft dieselbe Action unmittelbar vor jedem Upstream-Aufruf erneut. Ein ausgeblendeter Button gilt nicht als Sicherheitsgrenze. `categories.read` autorisiert keine Mutation; Create, Update und Delete sind nicht gegenseitig austauschbar.

Vorhandene hostgeführte Action-Audit- und Observability-Pfade werden wiederverwendet. Logs enthalten Action, Operation, Instanz, Request-/Trace-Korrelation und PII-arme Fehlercodes, aber keine E-Mail-Adressen, Kategorieinhalte, Credentials oder vollständigen GraphQL-Responses.

### Die UI erweitert die vorhandene Seite statt einen parallelen Editor einzuführen

Die Management-Tabelle zeigt mindestens Name, Status, Parent, Position und Datentypen. Create, Edit und „Neue Unterkategorie“ öffnen denselben formularbasierten Dialog beziehungsweise Sheet-Vertrag; „Neue Unterkategorie“ setzt den Parent vor. Delete verwendet einen getrennten Bestätigungsdialog.

Alle Texte liegen in den Plugin-Übersetzungen für Deutsch und Englisch. Formularfelder besitzen Labels, Beschreibungen und feldbezogene Fehler. Dialoge führen Fokus korrekt, sind per Tastatur bedienbar und verwenden vorhandene shadcn/ui- beziehungsweise Studio-Komponenten. Erfolg, Mutation läuft, Validierungsfehler, Berechtigungsfehler, Vertragsfehler und unbekannter Ausgang bleiben unterscheidbar.

## Error Contract

Die Studio-Fassade erhält stabile, pluginfähige Fehlercodes mindestens für:

- `category_management_contract_unavailable`,
- `category_management_credentials_missing`,
- `category_management_forbidden`,
- `category_management_invalid_request`,
- `category_management_invalid_response`,
- `category_not_found`,
- `category_invalid_parent`,
- `category_invalid_data_type`,
- `category_in_use`,
- `category_save_failed`,
- `category_delete_failed`.

Feldbezüge aus dem Mainserver werden auf die kanonischen Studio-Feldnamen abgebildet. Unbekannte Upstream-Codes bleiben diagnostisch erhalten, werden aber als sichere allgemeine Mutationfehlermeldung dargestellt und legen keine fremden Objektdaten offen.

## Risks and Mitigations

- Inaktive Kategorien gelangen in Content-Auswahlen → separate explizite Management-Sicht und Regressionstests aller bestehenden parameterlosen Consumer.
- Fremde Kategorie-IDs werden gelesen oder verändert → lokale Action-Prüfung, organisationsgebundene Credential-Auflösung und fail-closed Mainserver-Municipality-Scoping.
- Unbekannte Datentypen gehen beim Speichern verloren → vollständiger Initialzustand, sichtbare unavailable-Werte und explizite Remove-Semantik.
- Parent-Wechsel erzeugt Zyklen oder Teilzustände → Clientfilter als UX-Hilfe, Mainserver als atomare verbindliche Prüfung und Re-Read nach Erfolg.
- UI behauptet Erfolg trotz GraphQL-Payloadfehler → fachlicher Erfolg erfordert leere Fehlerliste und erwartete Resultat-ID.
- Mainserver-Code ist vorhanden, aber noch nicht in der Zielumgebung verfügbar → Schema-/Capability-Preflight blockiert Aktivierung und Rollout.
- Mainserver-Credentials besitzen keine Management-Rolle → expliziter Readiness-Nachweis und verständlicher, vom lokalen IAM-Denial getrennter Fehler.
- Create-Antwort geht nach möglichem Upstream-Erfolg verloren → vorhandene Host-Idempotenz replayed terminale Ergebnisse; eine nichtterminale Reservation blockiert den automatischen zweiten Upstream-Aufruf bis zum Management-Re-Read.

## Migration Plan

1. Den bereitgestellten Mainserver-Vertrag in Dev gegen Schema und negative Municipality-Grenzen verifizieren und den Studio-Schema-Snapshot aktualisieren.
2. Typisierte Management-Query, Save-/Delete-Dokumente, Runtime-Parser und Serviceoperationen ergänzen.
3. Die bestehende Kategorienroute um Management-Read, Create, Update und Delete mit actionspezifischer Autorisierung erweitern.
4. Plugin-API, vollständiges Modell und vorhandene Kategorienseite um Formulare, Registry-Datentypen, Kaskadenfeedback und Safe-Delete erweitern.
5. Kompatibilitäts-, Contract-, Permission-, Unit-, Accessibility- und E2E-Nachweise ausführen.
6. Den Studio-Change erst nach positivem Mainserver-Readiness-Nachweis über den kanonischen geschützten Rolloutpfad promoten.

Rollback entfernt beziehungsweise deaktiviert ausschließlich die neuen Studio-Management-Operationen. Der bestehende Active-only-Read-Pfad bleibt während der gesamten Migration kompatibel.

## Open Questions

Keine offenen Produktentscheidungen für V1. Reassign, Bulk-Operationen, rekursives Löschen und generische Taxonomieverwaltung benötigen eigene Changes.
