## ADDED Requirements
### Requirement: The system SHALL update Mainserver-backed content list projections incrementally after successful single-record mutations
Das System SHALL die fuehrende serverseitige Listenquelle fuer Mainserver-gestuetzte Inhaltstypen nach erfolgreichen Studio-initiierten Einzelmutationen gezielt fuer den betroffenen Datensatz aktualisieren und keinen typweiten Vollrefresh als Standardpfad verwenden.

#### Scenario: Create aktualisiert nur den neuen Datensatz in der Inhaltsliste
- **WENN** ein berechtigter Benutzer einen neuen News-, Event- oder POI-Datensatz erfolgreich ueber Studio im Mainserver anlegt
- **DANN** aktualisiert das System die fuehrende Listenquelle gezielt fuer genau diesen Datensatz
- **UND** der restliche Projektionsbestand desselben Inhaltstyps bleibt unveraendert
- **UND** der neue Datensatz erscheint ohne erzwungenen Vollrefresh des gesamten Inhaltstyps in der Inhaltsliste

#### Scenario: Update aktualisiert nur den geaenderten Datensatz in der Inhaltsliste
- **WENN** ein berechtigter Benutzer einen bestehenden News-, Event- oder POI-Datensatz erfolgreich ueber Studio aendert
- **DANN** aktualisiert das System die fuehrende Listenquelle gezielt fuer genau diesen Datensatz
- **UND** die Listenansicht zeigt die geaenderten Metadaten, ohne alle Datensaetze dieses Typs neu aufzubauen

#### Scenario: Delete entfernt nur den betroffenen Datensatz aus der Inhaltsliste
- **WENN** ein berechtigter Benutzer einen bestehenden News-, Event- oder POI-Datensatz erfolgreich ueber Studio loescht
- **DANN** entfernt das System gezielt genau diesen Datensatz aus der fuehrenden Listenquelle
- **UND** der Loeschvorgang startet keinen typweiten Neuaufbau aller Datensaetze desselben Inhaltstyps

### Requirement: The system SHALL retain periodic full refresh only as reconciliation path for Mainserver-backed content lists
Das System SHALL den periodischen Vollabgleich fuer Mainserver-gestuetzte Inhaltstypen als Reconciliation-Pfad fuer externe Aenderungen, Drift und Fehlerfaelle behalten, aber nicht als Standardreaktion auf jede erfolgreiche Einzelmutation verwenden.

#### Scenario: Externe Mainserver-Aenderung wird weiter ueber Reconciliation sichtbar
- **WENN** ein News-, Event- oder POI-Datensatz ausserhalb von Studio direkt im Mainserver geaendert, angelegt oder geloescht wird
- **DANN** darf das System diese Aenderung weiterhin ueber den periodischen Vollabgleich in die fuehrende Listenquelle uebernehmen
- **UND** der gezielte Mutationspfad muss dafuer nicht alle externen Aenderungen selbst abdecken

#### Scenario: Gezielte Nachsynchronisation scheitert nach erfolgreicher Mutation
- **WENN** eine Studio-Mutation im Mainserver erfolgreich war, aber die gezielte Projektionsaktualisierung den Datensatz nicht deterministisch nachladen oder entfernen kann
- **DANN** bleibt die Mutation fachlich erfolgreich
- **UND** das System protokolliert den Fehler deterministisch
- **UND** der periodische Vollabgleich bleibt fuer die spaetere Reconciliation zustaendig

### Requirement: The system SHALL keep Mainserver-backed list snapshots account-isolated and stale-readable
Das System SHALL die fuehrende Listenquelle fuer Mainserver-gestuetzte Inhaltstypen pro Account und effektivem Scope isoliert persistieren und bei Listenanfragen immer einen vorhandenen Snapshot ausliefern koennen, auch wenn dieser veraltet ist.

#### Scenario: Zwei Accounts derselben Organisation teilen keinen Snapshot
- **WENN** zwei Benutzer derselben Instanz und derselben Organisation unterschiedliche `actorAccountId`-Kontexte haben
- **DANN** teilen sie keine Mainserver-Projektionszeilen oder Sync-Zustaende derselben Inhaltsliste
- **UND** ein bereits geladener Snapshot des einen Accounts wird nicht als Fuehrungsquelle fuer den anderen Account wiederverwendet

#### Scenario: Persistenz-Scope verwendet den account- und organisationsgebundenen Vertrag
- **WENN** das System eine Mainserver-Projektion liest, schreibt, dedupliziert oder loescht
- **DANN** verwendet es konsistent einen Scope-Vertrag aus `instanceId`, `actorAccountId`, `activeOrganizationId` und `contentType`
- **UND** es verwendet fuer diese Operationen keinen `keycloakSubject`-Fallback als persistenten Scope-Ersatz

#### Scenario: Tabelle zeigt veralteten Snapshot waehrend Hintergrund-Refresh
- **WENN** fuer einen Account bereits eine persistierte Mainserver-Projektion existiert
- **UND** im Hintergrund ein Refresh neuerer Daten laeuft oder fehlschlaegt
- **DANN** liefert die Inhaltsliste weiterhin den vorhandenen Snapshot aus
- **UND** die Tabelle bleibt nutzbar, statt auf die Vollstaendigkeit des Refreshs zu warten

### Requirement: The system SHALL refresh newest Mainserver list pages first after login or session activation
Das System SHALL fuer sichtbare Mainserver-Inhaltstypen nach Login oder relevantem Session-Aufbau zuerst die jeweils neuesten Datensaetze in die persistierte Listenquelle laden und erst danach aeltere Daten nachziehen.

#### Scenario: Erste Seiten aller sichtbaren Typen werden zuerst geladen
- **WENN** ein berechtigter Benutzer eine Session mit sichtbaren Mainserver-Inhaltstypen aufbaut
- **DANN** startet das System einen Hintergrund-Refresh fuer alle sichtbaren Mainserver-Typen
- **UND** es laedt fuer jeden Typ zuerst die erste Seite mit den neuesten Datensaetzen
- **UND** es arbeitet im initialen Rollout konservativ sequentiell, um die Last auf Studio und Mainserver zu begrenzen
- **UND** es wartet nicht auf den Vollimport aller aelteren Seiten, bevor erste Ergebnisse in der Liste verfuegbar sind

#### Scenario: Aeltere Seiten folgen erst nach dem ersten Seitenblock
- **WENN** fuer alle sichtbaren Mainserver-Typen die erste Seite erfolgreich geschrieben oder zumindest versucht wurde
- **DANN** darf das System aeltere Seiten derselben Typen progressiv nachladen
- **UND** die Inhaltsliste bleibt waehrenddessen auf dem bereits verfuegbaren Snapshot lesbar

#### Scenario: Hintergrund-Refresh laeuft auch ohne spaeteren Listenaufruf weiter
- **WENN** der Login-nahe Refresh bereits gestartet wurde
- **UND** der Benutzer die Inhaltsliste in dieser Session zunaechst nicht oeffnet
- **DANN** darf der Refresh trotzdem weiterlaufen
- **UND** er setzt sich seitenweise fort, bis das Ende des verfuegbaren Upstream-Bestands erreicht ist
