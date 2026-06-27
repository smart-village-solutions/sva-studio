## MODIFIED Requirements

### Requirement: Erstellungs- und Bearbeitungsansicht für Inhalte

Das System MUST eine Erstellungs- und eine Bearbeitungsansicht für Inhalte bereitstellen.

#### Scenario: Inhalt anlegen

- **WENN** ein berechtigter Benutzer einen neuen Inhalt anlegt
- **DANN** kann er mindestens Inhaltstyp, Titel, Veröffentlichungsdatum, Payload und Status erfassen
- **UND** das System setzt Erstellungsdatum, Änderungsdatum und Autor systemseitig
- **UND** der gespeicherte Inhalt ist nach erfolgreichem Speichern in der Inhaltsliste sichtbar

#### Scenario: Inhalt bearbeiten

- **WENN** ein berechtigter Benutzer einen bestehenden Inhalt bearbeitet
- **DANN** kann er Titel, Veröffentlichungsdatum, Payload und Status gemäß seiner Berechtigungen ändern
- **UND** das Änderungsdatum wird nach erfolgreichem Speichern aktualisiert
- **UND** die Bearbeitungsansicht zeigt die aktuellen Metadaten des Inhalts an

#### Scenario: Typspezifische Erweiterungsfelder werden eingeblendet

- **WENN** ein Inhalt einen registrierten `contentType` mit SDK-Erweiterung besitzt
- **DANN** rendert die Erstellungs- oder Bearbeitungsansicht zusätzlich die zugehörigen typspezifischen UI-Bereiche
- **UND** die Core-Felder bleiben weiterhin sichtbar und konsistent bedienbar

#### Scenario: POI verwendet einen redaktionsorientierten Voll-Editor

- **WENN** ein berechtigter Benutzer einen Inhalt vom Typ `poi.point-of-interest` erstellt oder bearbeitet
- **DANN** rendert das System keinen reduzierten Sammel-Tab für alle Zusatzdaten
- **SONDERN** einen aufgabenorientierten Voll-Editor mit den Bereichen `Basis`, `Ort`, `Beschreibung`, `Kontakt`, `Öffnungszeiten`, `Links`, `Betreiber`, `Preise`, `Medien & Dateien`, `Erweiterte Daten` und `Historie`
- **UND** der Editor unterstützt sowohl Erstpflege als auch spätere gezielte Nachpflege

## ADDED Requirements

### Requirement: POI-Redaktionsflow trennt Kernpflege und Zusatzdaten

Das System MUST die POI-Pflege so strukturieren, dass Redakteure einen minimalen, fachlich sinnvollen POI zuerst anlegen und ihn danach ohne technische Reibung schrittweise anreichern können.

#### Scenario: Erstnutzer legt einen neuen POI an

- **WENN** ein Redakteur einen neuen POI erstellt
- **DANN** beginnt der Flow mit den Kernbereichen `Basis` und `Ort`
- **UND** der Redakteur muss keine seltenen Spezialfelder aus `Erweiterte Daten` vor dem ersten Speichern ausfüllen
- **UND** das System kann nach der ersten Speicherung auf den nächsten sinnvollen Bereich hinweisen

#### Scenario: Wiederkehrer pflegt einen bestehenden POI nach

- **WENN** ein Redakteur einen bestehenden POI gezielt aktualisieren will
- **DANN** kann er direkt in den relevanten Bereich wie `Öffnungszeiten`, `Links` oder `Preise` springen
- **UND** der Editor zwingt ihn nicht durch einen linearen Assistentenpfad

### Requirement: POI-Ortsdaten nutzen Adresse, Geo-Koordinaten und Karte

Das System MUST für POI-Ortsdaten eine strukturierte Adresspflege mit Geo-Koordinaten und Kartenunterstützung bereitstellen.

#### Scenario: POI-Ort wird visuell verortet

- **WENN** ein Redakteur den Bereich `Ort` bearbeitet
- **DANN** kann er Straße, PLZ, Ort und einen adressbezogenen Zusatz pflegen
- **UND** er sieht eine Karte mit dem Stil `https://tileserver-gl.smart-village.app/styles/osm-bright/`
- **UND** Geo-Koordinaten sind sichtbar und editierbar

#### Scenario: Koordinaten werden über Karteninteraktion gepflegt

- **WENN** ein Redakteur den Kartenmarker verschiebt oder einen Kartenpunkt setzt
- **DANN** synchronisiert das System die zugehörigen `latitude`- und `longitude`-Werte in den Formularfeldern
- **UND** textuelle Koordinaten-Änderungen bleiben ebenfalls möglich

#### Scenario: Adresssuche erzeugt POI-Ortsdaten

- **WENN** ein Redakteur im Bereich `Ort` eine Adresse oder einen Ort sucht
- **DANN** zeigt das System passende Vorschläge an
- **UND** die Auswahl eines Vorschlags kann Adressfelder, Kartenposition und Geo-Koordinaten des POI befüllen

#### Scenario: Eingegebene Adresse wird geokodiert

- **WENN** ein Redakteur Straße, PLZ und Ort manuell eingibt
- **UND** eine Geokodierung auslösen möchte
- **DANN** kann das System daraus einen Geo-Treffer bestimmen
- **UND** Marker und Koordinaten werden aus dem Treffer aktualisiert
- **UND** die Adresse bleibt für den Redakteur weiter prüf- und korrigierbar

#### Scenario: Ortsdaten bleiben ohne direkte Kartenbedienung pflegbar

- **WENN** ein Redakteur die Karteninteraktion nicht nutzen kann oder nicht nutzen möchte
- **DANN** kann er Ortsdaten über Adresssuche, manuelle Adresspflege und Koordinatenfelder vollständig bearbeiten
- **UND** Kartenprobleme blockieren die restliche POI-Bearbeitung nicht

### Requirement: POI-Mehrfachdaten werden als wiederholbare Listen gepflegt

Das System MUST wiederholbare POI-Daten als strukturierte Listen-Editoren statt als Einzelfelder behandeln.

#### Scenario: Mehrere Öffnungszeiten werden gepflegt

- **WENN** ein Redakteur mehrere Öffnungszeiten für einen POI hinterlegt
- **DANN** kann er mehrere strukturierte Einträge mit Wochentag, Zeitfenster, Beschreibung und Offen-Status anlegen
- **UND** das System beschränkt die UI nicht auf den ersten Eintrag

#### Scenario: Mehrere Links, Preise oder Dateien werden gepflegt

- **WENN** ein Redakteur mehrere Links, Preise oder Dateien erfassen muss
- **DANN** bietet das System für jeden dieser Bereiche einen konsistenten Listen-Editor mit `Hinzufügen` und `Entfernen`
- **UND** jeder Eintrag bleibt in seiner eigenen fachlichen Struktur editierbar

### Requirement: Betreiber und allgemeiner POI-Kontakt bleiben getrennt

Das System MUST den allgemeinen POI-Kontakt und den Betreiber als getrennte Redaktionskonzepte behandeln.

#### Scenario: Betreiber weicht vom allgemeinen Kontakt ab

- **WENN** ein POI einen institutionellen Betreiber hat, der nicht identisch mit dem allgemeinen Kontakt ist
- **DANN** kann der Redakteur im Bereich `Betreiber` einen eigenen Namen, Kontakt und eine eigene Adresse pflegen
- **UND** der allgemeine Kontakt im Bereich `Kontakt` bleibt davon unabhängig

#### Scenario: Betreiberdaten sind nicht erforderlich

- **WENN** ein POI keinen abweichenden Betreiber benötigt
- **DANN** bleibt der Bereich `Betreiber` optional
- **UND** das System verlangt keine redundanten Doppeleingaben

### Requirement: Erweiterte POI-Daten bleiben aus dem Hauptflow herausgezogen

Das System MUST technische oder selten genutzte POI-Zusatzdaten aus dem Standard-Redaktionsflow herausziehen.

#### Scenario: Payload bleibt ein Spezialbereich

- **WENN** ein Redakteur einen POI im Standardfall bearbeitet
- **DANN** muss er nicht mit `payload` oder anderen fortgeschrittenen Zusatzfeldern beginnen
- **UND** diese Felder erscheinen gesammelt unter `Erweiterte Daten`

#### Scenario: Erweiterte Zusatzfelder bleiben verfügbar

- **WENN** ein fortgeschrittener Redakteur Zertifikate, Accessibility-Daten oder technische Zusatzinformationen pflegen muss
- **DANN** sind diese Felder weiterhin erreichbar
- **UND** sie verdrängen nicht die Kernpflege von Name, Ort, Kontakt und Öffnungszeiten
