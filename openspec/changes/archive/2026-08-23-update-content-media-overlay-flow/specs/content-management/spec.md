## MODIFIED Requirements

### Requirement: Inhalt ist ein erweiterbares Core-Element

Das System MUST `Inhalt` als kanonisches Core-Element modellieren, das über definierte SDK-Erweiterungspunkte für spezielle Datentypen erweitert werden kann, referenzbasierte Mediennutzung unterstützt und IAM-Ownership getrennt von Ersteller, Bearbeiter und sichtbarem Autor hält.

#### Scenario: Core-Inhalt wird mit Basiskern angelegt

- **WENN** ein Inhalt gespeichert oder geladen wird
- **DANN** enthält er mindestens `contentType`, Titel, Veröffentlichungsdatum, Erstellungsdatum, Änderungsdatum, Autor, Payload, Status, Historie, `ownerUserId` und `ownerOrganizationId`
- **UND** diese Core-Felder bleiben unabhängig vom konkreten Inhaltstyp verfügbar
- **UND** `ownerUserId` und `ownerOrganizationId` steuern IAM-Zugriff, nicht sichtbare Autorenanzeige

#### Scenario: SDK erweitert einen speziellen Inhaltstyp

- **WENN** für einen registrierten `contentType` eine SDK-Erweiterung vorhanden ist
- **DANN** kann diese zusätzliche Validierung, UI-Bereiche, Tabelleninformationen oder Aktionen bereitstellen
- **UND** der Core-Vertrag des Inhalts bleibt unverändert gültig

#### Scenario: Plugin überschreibt den Core-Vertrag nicht

- **WENN** ein Plugin oder SDK-Modul einen speziellen Inhaltstyp registriert
- **DANN** darf es die Bedeutung oder Pflichtigkeit der Core-Felder nicht brechen
- **UND** Statusmodell, Historie und Core-Metadaten bleiben systemweit konsistent

#### Scenario: Inhalte binden Bibliotheksmedien referenzbasiert an

- **WENN** ein Inhalt ein Asset aus der zentralen Medienbibliothek verwendet
- **DANN** speichert Studio eine `MediaReference` mit Asset, fachlicher Rolle, Ziel und Reihenfolge
- **UND** der Plugin-Vertrag erhält keine MinIO-Bucket-Namen, Object-Keys oder presigned URLs
- **UND** ein externer Mainserver-Vertrag darf parallel einen kompatiblen URL-/Metadaten-Snapshot erhalten

#### Scenario: Plugin nutzt hostseitigen Media-Picker

- **WENN** ein Plugin ein Bibliotheksmedium für einen Inhalt oder ein Fachobjekt auswählen lässt
- **DANN** verwendet es den hostseitigen Media-Picker oder dessen SDK-Vertrag
- **UND** das Plugin deklariert erlaubte Medienrollen und Medientypen
- **UND** es erhält keine direkte Storage-Schnittstelle

#### Scenario: Mainserver benötigt weiterhin URL-basierte Medienfelder

- **WENN** die externe Mainserver-GraphQL-API ein Bild über `imageUrl`, `sourceUrl`, `mediaContents` oder ein analoges URL-basiertes Feld erwartet
- **DANN** persistiert der Plugin-Adapter einen kontrollierten Snapshot aus dauerhafter Auslieferungs-URL und unterstützten contentbezogenen Metadaten
- **UND** speichert Studio für eine Bibliotheksverwendung parallel die zugehörige `MediaReference`
- **UND** eine kurzlebige, presigned oder anderweitig nicht dauerhaft geeignete URL wird nicht als Content-Snapshot gespeichert

#### Scenario: Manuelle URL bleibt als eigenständige Mainserver-Verwendung verfügbar

- **WENN** ein Redakteur ein Bild ausschließlich über eine manuelle URL anlegt
- **DANN** speichert der Plugin-Adapter diese URL im bestehenden Mainserver-Fachvertrag
- **UND** erzeugt Studio dafür weder ein `MediaAsset` noch eine `MediaReference`
- **UND** stellt die Oberfläche die manuelle Verwendung nicht als Bibliotheksverknüpfung dar

## ADDED Requirements

### Requirement: Bildfähige Inhaltseditoren verwenden einen gemeinsamen Bildblock

Das System MUST News, Events, POI, Generic Items, Projects und Cockpit Cards über einen gemeinsamen hostseitigen Kernbildblock bearbeiten, während fachliche Pflichtigkeit, Zusatzfelder und Persistenzmapping beim jeweiligen Plugin verbleiben.

#### Scenario: Editor zeigt gemeinsame Kerninteraktion

- **WENN** ein Redakteur Bilder in einem unterstützten Inhaltseditor bearbeitet
- **DANN** stellt der Bildblock Bildliste, Vorschau, unterstützte contentbezogene Metadaten, Validierungsanzeige, Entfernen und Umsortieren bereit
- **UND** bietet er abhängig von den Berechtigungen `Aus Mediathek auswählen`, `Bild hochladen` und `Bild-URL manuell eingeben`
- **UND** entscheidet das Plugin weiterhin über Pflichtfelder, Maximalanzahl, Duplikate und Zusatzfelder

#### Scenario: Manuelle Bild-URL wird im gemeinsamen Block angelegt

- **WENN** ein berechtigter Redakteur `Bild-URL manuell eingeben` auswählt
- **DANN** fügt der Bildblock eine Verwendung mit stabiler UI-Identität, aber ohne `assetId` hinzu
- **UND** setzt den Fokus auf deren URL-Feld
- **UND** aktualisiert eine eingegebene URL die Vorschau, ohne das Bild in die Medienbibliothek zu importieren

#### Scenario: Bildverwendung wird barrierefrei umsortiert

- **WENN** ein Redakteur eine Bildverwendung nach oben oder unten verschiebt
- **DANN** bleibt der Fokus nachvollziehbar bei derselben Verwendung
- **UND** meldet die Oberfläche die neue Position und Gesamtzahl textuell
- **UND** sind am Listenanfang und Listenende nicht mögliche Verschiebeaktionen deaktiviert

#### Scenario: Plugin-Adapter erhält fachliche Daten

- **WENN** der gemeinsame Bildblock ein Plugin-Formular liest, verändert oder neu ordnet
- **DANN** bildet ein typsicherer Plugin-Adapter den neutralen Verwendungsvertrag auf das bestehende Fachmodell ab
- **UND** bleiben nicht im gemeinsamen Kern bearbeitete und unbekannte fachliche Felder beim Roundtrip erhalten
- **UND** normalisiert der Adapter fachliche Reihenfolgen wie Project-`position` deterministisch

### Requirement: Asset-Metadaten und contentbezogene Medienmetadaten bleiben getrennt

Das System MUST globale Metadaten eines `MediaAsset` von den Metadaten seiner konkreten Content-Verwendung trennen.

#### Scenario: Asset wird erstmals in einen Content übernommen

- **WENN** ein Redakteur ein Bibliotheks- oder Upload-Asset nach dem Review mit `Medium übernehmen` bestätigt
- **DANN** kopiert der Plugin-Adapter die unterstützten aktuellen Asset-Metadaten als Startwerte in den Content-Snapshot
- **UND** speichert die Verwendung die `assetId` für die parallele Studio-Referenz
- **UND** bleiben Asset-Metadaten und Content-Snapshot danach unabhängig bearbeitbar

#### Scenario: Asset-Metadaten ändern sich nach der Verknüpfung

- **WENN** globale Metadaten eines bereits verwendeten Assets später geändert werden
- **DANN** verändert das System bestehende Content-Snapshots nicht automatisch
- **UND** erhalten neue Verknüpfungen die dann aktuellen Asset-Metadaten als Startwerte

#### Scenario: Redakteur aktualisiert ausgewählte Felder aus der Mediathek

- **WENN** ein Redakteur für eine Asset-basierte Verwendung `Metadaten aus Mediathek aktualisieren` öffnet
- **DANN** zeigt das System je unterstütztem Feld Asset- und Content-Wert nebeneinander
- **UND** kann der Redakteur die zu übernehmenden Felder einzeln auswählen
- **UND** bleiben lokale Abweichungen standardmäßig abgewählt, sofern ihre Herkunft nicht sicher als unveränderter Startwert nachweisbar ist
- **UND** wird eine ausgewählte persistierbare Asset-Auslieferungs-URL ebenfalls in den Content-Snapshot übernommen
- **UND** verändert die Aktion das globale Asset nicht

### Requirement: Mainserver-Snapshot und Studio-Medienreferenzen werden kontrolliert koordiniert

Das System MUST die externe Mainserver-Persistenz und die Studio-Referenzpersistenz in einer festen, wiederholbaren Reihenfolge koordinieren.

#### Scenario: Content und Referenzen werden erfolgreich gespeichert

- **WENN** ein Content mit Asset-basierten Bildverwendungen gespeichert wird
- **DANN** speichert das System zuerst den Mainserver-Content einschließlich URL-/Metadaten-Snapshots
- **UND** ersetzt es nach Erhalt der stabilen Ziel-ID die Studio-`MediaReference`s für dieses Ziel idempotent
- **UND** zeigt es den gesamten Speichervorgang erst nach beiden erfolgreichen Schritten als vollständig erfolgreich an

#### Scenario: Referenzsynchronisation schlägt nach Mainserver-Erfolg fehl

- **WENN** der Mainserver-Content erfolgreich gespeichert wurde, aber das Ersetzen der Studio-Referenzen fehlschlägt
- **DANN** führt das System keinen vermeintlichen Cross-System-Rollback aus
- **UND** zeigt es einen unterscheidbaren Teilfehler statt eines vollständigen Erfolgs an
- **UND** bietet es eine idempotente Wiederholung der Referenzsynchronisation ohne erneutes Mainserver-Schreiben an

#### Scenario: Geladener Content und Studio-Referenzen weichen ab

- **WENN** Mainserver-Snapshots und Studio-Referenzen beim Laden nicht konsistent zusammengeführt werden können
- **DANN** bleiben die Mainserver-Daten die sichtbaren Content-Werte
- **UND** zeigt das System fehlende, zusätzliche oder nicht auflösbare Referenzen als Synchronisationszustand an
- **UND** erfindet, ersetzt oder löscht es keine Referenzen stillschweigend

#### Scenario: Bildverwendung wird entfernt

- **WENN** eine Asset-basierte Bildverwendung aus dem Content entfernt und erfolgreich gespeichert wird
- **DANN** fehlt ihre Referenz im anschließenden Replace-Vertrag
- **UND** bleibt das `MediaAsset` selbst in der Medienbibliothek bestehen

### Requirement: Medienaktionen im Content-Editor folgen abgestuften Berechtigungen

Das System MUST Content- und Medienberechtigungen für jede Bildaktion getrennt prüfen und client- sowie serverseitig konsistent durchsetzen.

#### Scenario: Redakteur verwendet eine manuelle URL

- **WENN** ein Redakteur die fachliche Content-Create- oder Content-Update-Berechtigung besitzt
- **DANN** darf er eine manuelle Bild-URL bearbeiten
- **UND** benötigt er dafür keine Medienbibliotheksberechtigung

#### Scenario: Redakteur wählt oder lädt ein Asset

- **WENN** ein Redakteur ein Bibliotheksasset auswählen möchte
- **DANN** benötigt er zusätzlich `media.read` und `media.reference.manage`
- **UND** benötigt er für einen Upload zusätzlich `media.create`

#### Scenario: Redakteur darf globale Metadaten nicht ändern

- **WENN** ein Redakteur den Media-Review ohne `media.update` öffnet
- **DANN** zeigt das System die Asset-Metadaten schreibgeschützt
- **UND** bleibt `Medium übernehmen` bei ansonsten ausreichenden Berechtigungen verfügbar
- **UND** darf er contentbezogene Overrides anschließend mit seiner fachlichen Content-Berechtigung bearbeiten

#### Scenario: Berechtigung läuft während des Flows ab

- **WENN** eine erforderliche Medienberechtigung vor Abschluss des Overlay- oder Referenzschritts nicht mehr wirksam ist
- **DANN** lehnt der Server die Aktion fail-closed ab
- **UND** bleibt das offene Content-Formular durch den fehlgeschlagenen Overlay-Abschluss unverändert
- **UND** zeigt die Oberfläche einen unterscheidbaren Berechtigungsfehler

#### Scenario: Geschütztes Asset besitzt keine geeignete dauerhafte Auslieferung

- **WENN** ein Asset nur über eine kurzlebige oder für den Mainserver-Vertrag ungeeignete URL ausgeliefert werden kann
- **DANN** darf der Content-Editor diese URL nicht persistieren
- **UND** erklärt die Oberfläche, warum das Asset in diesem Zielkontext nicht übernommen werden kann

### Requirement: Upload-Abbruch trennt Asset-Erzeugung und Content-Zuordnung

Das System MUST einen abgeschlossenen Asset-Upload von seiner späteren Content-Zuordnung unterscheiden.

#### Scenario: Overlay wird vor abgeschlossenem Upload abgebrochen

- **WENN** ein Benutzer den Overlay-Flow vor erfolgreichem Upload-Abschluss abbricht
- **DANN** entsteht keine Content-Verwendung und keine `MediaReference`

#### Scenario: Overlay wird nach abgeschlossenem Upload abgebrochen

- **WENN** der Upload bereits ein `MediaAsset` erzeugt hat, der Benutzer aber vor `Medium übernehmen` abbricht
- **DANN** bleibt das eigenständige Asset in der Medienbibliothek bestehen
- **UND** entsteht weder ein neuer Eintrag im Content-Formular noch eine `MediaReference`
