## ADDED Requirements

### Requirement: Content-Uploads verwenden einen provisorischen Asset-Lebenszyklus

Das System SHALL neu hochgeladene Medien aus einem Content-Speichervorgang bis zum bestätigten Content- und Referenzabschluss als tenant- und actor-gebundene provisorische Assets führen. Provisorische Assets SHALL technisch verarbeitet und kontrolliert ausgeliefert werden können, dürfen aber vor Aktivierung nicht Teil der regulären Medienbibliothek sein.

#### Scenario: Content-Save erzeugt ein provisorisches Asset

- **WHEN** eine lokale Content-Bilddatei innerhalb eines Speichervorgangs hochgeladen und serverseitig validiert wird
- **THEN** ordnet das System das Asset genau einer Content-Media-Save-Operation, Instanz und einem Actor zu
- **AND** bleibt das Asset aus Mediathek, Suche, Picker-Ergebnissen, Pagination und regulären Gesamtzahlen ausgeschlossen
- **AND** darf nur der gebundene Operationspfad Detail, Metadaten, Delivery, Aktivierung oder Abandon ausführen

#### Scenario: Content und Referenzen werden bestätigt abgeschlossen

- **WHEN** der Mainserver-Erfolg mit stabiler Ziel-ID bestätigt ist und der gewünschte Studio-Referenzsatz gespeichert werden kann
- **THEN** ersetzt das System die Referenzen und aktiviert alle verwendeten provisorischen Assets in einer Studio-Datenbanktransaktion
- **AND** entfernt es die provisorische Operationsbindung der aktivierten Assets
- **AND** erscheinen die Assets danach genau einmal regulär in der Medienbibliothek

#### Scenario: Content-Save wird sicher verworfen

- **WHEN** eine Save-Operation vor bestätigtem Mainserver-Erfolg eindeutig fehlschlägt oder kontrolliert abgebrochen wird
- **THEN** wechselt sie idempotent in den Abandon-/Cleanup-Pfad
- **AND** entfernt dieser ausschließlich die von der Operation neu erzeugten provisorischen Assets, Varianten, Upload-Sessions und Storage-Objekte
- **AND** korrigiert er die Storage-Usage ohne bestehende Bibliotheksassets oder Referenzen zu verändern

#### Scenario: Bibliotheksupload wird bewusst gestartet

- **WHEN** ein Benutzer eine Datei im eigenständigen Medienbereich `/admin/media` hochlädt
- **THEN** verwendet das System weiterhin den unmittelbaren Bibliotheks-Asset-Lebenszyklus
- **AND** behandelt es diesen Upload nicht als provisorischen Content-Entwurf
- **AND** verändert ein Abbruch in einem späteren Content-Picker das bereits bewusst angelegte Bibliotheksasset nicht

### Requirement: Content-Media-Save-Operationen sind idempotent und wiederherstellbar

Das System SHALL den Übergang lokaler Content-Dateien zu aktiven Medienassets über einen persistenten, monotonen und idempotenten Operationsvertrag koordinieren.

#### Scenario: Ein Upload- oder Commit-Request wird wiederholt

- **WHEN** ein Client denselben Schritt mit derselben Operations- und Draft-ID nach Timeout oder verlorener Antwort wiederholt
- **THEN** liefert oder erreicht das System denselben fachlichen Zustand
- **AND** erzeugt es weder ein zweites Asset noch doppelte Referenzen oder eine doppelte Quota-Buchung

#### Scenario: Referenzabschluss wird nach Mainserver-Erfolg wiederholt

- **WHEN** eine Operation bereits `content_saved` mit Zieltyp und Ziel-ID erreicht hat, aber noch nicht committed ist
- **THEN** kann das System Reference-Replace und Asset-Aktivierung ohne erneuten Mainserver-Write wiederholen
- **AND** bleibt der vollständige gewünschte Referenzsatz dauerhaft an der Operation verfügbar

#### Scenario: Veraltete Operation ist sicher bereinigbar

- **WHEN** eine abgelaufene Operation nachweislich keinen bestätigten oder unklaren Mainserver-Erfolg besitzt
- **THEN** darf ein lease-basierter Recovery-Lauf sie exklusiv zur Bereinigung übernehmen
- **AND** verarbeitet er konkurrierende Instanzen ohne doppelte Mutation
- **AND** hinterlässt ein partieller Cleanup-Fehler einen wiederholbaren nichtterminalen Zustand

#### Scenario: Operation besitzt einen unklaren oder bestätigten Content-Ausgang

- **WHEN** eine Operation `content_saved`, `outcome_unknown` oder `reconciliation_required` ist
- **THEN** darf ein generischer Ablaufzeit-Cleanup ihre Assets nicht löschen
- **AND** benötigt sie Commit oder evidenzbasierte Reconciliation
- **AND** bleibt sie für Diagnose und Wiederaufnahme anhand sicherer IDs korrelierbar

### Requirement: Provisorischer Cleanup ist keine Benutzerlöschung

Das System SHALL das Verwerfen operationsgebundener provisorischer Assets als interne Kompensation der autorisierten Content-Save-Operation behandeln und von der Löschung aktiver Bibliotheksassets trennen.

#### Scenario: Redakteur besitzt keine Medien-Löschberechtigung

- **WHEN** ein Redakteur Content und neue Medien mit den erforderlichen Content-Rechten sowie `media.create` und `media.reference.manage` speichern darf, aber kein `media.delete` besitzt
- **THEN** darf der Host eindeutig fehlgeschlagene provisorische Assets dieser Operation trotzdem bereinigen
- **AND** darf der Redakteur dadurch keine aktiven oder fremden Assets löschen

#### Scenario: Fremder Actor oder Tenant greift auf Operation zu

- **WHEN** ein Benutzer eine provisorische Operation eines anderen Actors oder einer anderen Instanz laden, committen oder verwerfen möchte
- **THEN** lehnt der Server den Zugriff fail-closed ab
- **AND** offenbart die Antwort keine Storage-Details, signierten URLs oder fremden Dateimetadaten

#### Scenario: Provisorischer Lebenszyklus wird auditiert

- **WHEN** eine Content-Media-Save-Operation gestartet, hochgeladen, committed, verworfen oder reconciliation-pflichtig wird
- **THEN** schreibt das System einen korrelierbaren Audit-/Observability-Eintrag mit Operation, sicherem Zustand und redigiertem Fehlercode
- **AND** protokolliert es keine Binärdaten, lokalen Dateipfade, Blob-/Data-/Object-URLs, signierten Upload-URLs oder Mainserver-Payloads
