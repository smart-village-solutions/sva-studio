## ADDED Requirements

### Requirement: Lokale Content-Bilder bleiben bis zum Speichern ein Browser-Entwurf

Das System MUST eine im Content-Editor lokal ausgewählte Bilddatei bis zum ausgelösten Content-Speichern ausschließlich als transienten Browser-Entwurf behandeln. Der Entwurf MUST Vorschau und contentbezogene Metadaten ermöglichen, darf aber weder ein `MediaAsset`, eine `MediaReference` noch einen persistierbaren Medienwert erzeugen.

#### Scenario: Lokale Datei wird als Vorschau ausgewählt

- **WENN** ein berechtigter Redakteur in einem unterstützten Content-Editor eine gültige lokale Bilddatei auswählt
- **DANN** zeigt der gemeinsame Bildblock unmittelbar eine lokale Vorschau
- **UND** hält er Datei, Vorschau und noch nicht gespeicherte Metadaten ausschließlich im Browser-Entwurf
- **UND** ruft die Auswahl keinen Media-Upload-, Asset-Create- oder Reference-Endpunkt auf
- **UND** kennzeichnet die Oberfläche das Bild barrierefrei als noch nicht gespeichert

#### Scenario: Lokale Auswahl wird vor dem Speichern verworfen

- **WENN** der Redakteur die lokale Bildverwendung entfernt, den Dialog abbricht oder die Seite ohne Speichern verlässt
- **DANN** gibt das System die lokale Vorschau und Dateireferenz frei
- **UND** entsteht weder ein Medienobjekt in der Mediathek noch eine Content-Verwendung oder `MediaReference`

#### Scenario: Content-Validierung schlägt vor dem Upload fehl

- **WENN** ein Content mit lokaler Bildverwendung die clientseitige Formularvalidierung nicht besteht
- **DANN** startet das System keinen Upload und keine Content-Media-Save-Operation
- **UND** bleibt der lokale Entwurf für die Korrektur erhalten

#### Scenario: Bereits vorhandenes Bibliotheksasset wird ausgewählt

- **WENN** der Redakteur statt einer lokalen Datei ein bestehendes Asset aus der Mediathek auswählt
- **DANN** übernimmt der Editor weiterhin nur dessen Referenz und persistierbaren Content-Snapshot in den Formularentwurf
- **UND** lädt er die Datei nicht erneut hoch
- **UND** wird die Referenz erst mit dem Content-Speichern übernommen

### Requirement: Content-Speicherung löst lokale Medien kontrolliert auf

Das System MUST lokale Bildentwürfe erst innerhalb eines gemeinsamen Content-Speichervorgangs hochladen, in persistierbare Verwendungen auflösen und mit dem gespeicherten Content verknüpfen. Der Speichervorgang MUST bestätigte Mainserver- und Studio-Zustände unterscheiden und wiederholbar behandeln.

#### Scenario: Content mit lokalen Bildern wird vollständig gespeichert

- **WENN** ein gültiger Content-Entwurf mit einer oder mehreren lokalen Bilddateien gespeichert wird
- **DANN** lädt das System die Dateien als provisorische Assets hoch
- **UND** baut es den Mainserver-Payload erst aus den erfolgreich aufgelösten dauerhaften Asset-URLs
- **UND** speichert es den Mainserver-Content
- **UND** ersetzt es anschließend den vollständigen Studio-Referenzsatz und aktiviert die verwendeten neuen Assets
- **UND** meldet es erst danach einen vollständigen Speichererfolg

#### Scenario: Content-Speicherung schlägt eindeutig fehl

- **WENN** Uploads erfolgreich waren, der Mainserver die Content-Speicherung aber eindeutig ablehnt
- **DANN** bleibt kein neues Asset in Mediathek, Suche oder Picker sichtbar
- **UND** verwirft das System die provisorischen Assets über den idempotenten Operations-Cleanup
- **UND** bleibt der lokale Browser-Entwurf für einen erneuten Speicherversuch erhalten

#### Scenario: Mainserver-Erfolg und Referenzabschluss laufen auseinander

- **WENN** der Mainserver-Content bestätigt gespeichert wurde, aber Reference-Replace oder Asset-Aktivierung fehlschlägt
- **DANN** löscht das System die provisorischen Assets nicht
- **UND** hält es Ziel-ID, gewünschten Referenzsatz und Operationszustand für eine idempotente Wiederholung fest
- **UND** zeigt die Oberfläche einen unterscheidbaren Teilfehler
- **UND** wiederholt ein Retry den Mainserver-Write nicht

#### Scenario: Ergebnis der Content-Speicherung ist technisch unklar

- **WENN** das System nicht sicher feststellen kann, ob die Mainserver-Mutation erfolgreich war
- **DANN** behauptet es weder vollständigen Erfolg noch sicheren Fehlschlag
- **UND** löscht es die verborgenen provisorischen Assets nicht automatisch
- **UND** markiert es die Operation als reconciliation-pflichtig
- **UND** bietet es eine sichere Statusprüfung oder Wiederaufnahme an

### Requirement: Alle bildfähigen Content-Editoren teilen denselben Medien-Speicherlebenszyklus

Das System MUST News, Events, POI, Generic Items, Projects und Cockpit Cards über denselben lokalen Draft-, Upload-, Commit-, Abandon- und Recovery-Vertrag anbinden. Plugins dürfen keinen abweichenden eigenen Uploadzeitpunkt oder Cleanup-Lebenszyklus einführen.

#### Scenario: Unterstützte Plugins verwenden den gemeinsamen Ablauf

- **WENN** ein unterstützter Content-Typ lokale Bilder auswählt oder speichert
- **DANN** verwendet sein Editor den gemeinsamen Overlay- und Save-Orchestrator
- **UND** beschränkt sich der Plugin-Adapter auf fachliche Validierung, Mainserver-Mapping und Zusatzfelder
- **UND** bleiben Reihenfolge, unbekannte Fachfelder und bestehende URL-/Metadaten-Snapshots beim Roundtrip erhalten

#### Scenario: Content-Save zeigt phasengenaues Feedback

- **WENN** ein Speichervorgang lokale Bilder verarbeitet
- **DANN** unterscheidet die Oberfläche Upload, Content-Speicherung, Medienverknüpfung, Cleanup und unklaren Ausgang textuell
- **UND** verhindert sie konkurrierendes Speichern, Entfernen oder Umsortieren während der laufenden Operation
- **UND** bleiben Fokusführung und Statusmeldungen barrierefrei nachvollziehbar
