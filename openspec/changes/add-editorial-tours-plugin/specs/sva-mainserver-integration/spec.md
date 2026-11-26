## ADDED Requirements

### Requirement: Typisierte Tourenadapter nutzen den bestehenden Mainserver-Pfad

Das System SHALL Liste und Detail über getrennte typisierte serverseitige GraphQL-Dokumente an `tours` und `tour` anbinden. Die fachliche Pagination SHALL erst nach Begrenzung auf den gemeinsamen autorisierten Umfang erfolgen. Liste und Detail SHALL im aktiven persönlichen oder organisatorischen Kontext durch denselben Studio-Zugriffsvertrag geschützt sein. Der Toureneditor SHALL neue Entwürfe im aktiven Kontext der Tourenliste anlegen. Schreibaktionen SHALL den bestehenden Mainserver-Hostpfad mit effektiven Credentials, Principal, DataProvider, Idempotenz und Reconciliation verwenden. Veröffentlichung und Entfernen für `Tour` SHALL erst nach bestätigter Mainserver-Semantik verfügbar sein.

#### Scenario: Liste und Detail haben getrennte Datengrenzen

- **WHEN** der berechtigte Host die Tourenliste lädt
- **THEN** fordert der Adapter nur die für die Liste erforderlichen Felder an
- **AND** vollständige Routengeometrie, Stationsdaten und Payload werden nur über die berechtigte Detailabfrage gelesen

#### Scenario: Globaler Listentreffer ohne lesbares Detail wird ausgeschlossen

- **GIVEN** der Mainserver ergänzt einen Treffer, dessen Detail im aktiven Kontext nicht lesbar ist
- **WHEN** der Host die Studio-Tourenliste ermittelt
- **THEN** trägt der Treffer weder zu den angezeigten Zeilen noch zur weiteren Pagination bei

### Requirement: Neue Touren werden atomar als unveröffentlichte Entwürfe angelegt

Create SHALL ausschließlich eine neue Tour erzeugen und unter jedem eingesetzten Schreibprincipal im ersten persistierten Zustand `visible=false` haben. Folgefehler SHALL den unveröffentlichten Zustand nicht gefährden. Update SHALL auf eine vorhandene, im wirksamen Kontext berechtigte Tour beschränkt bleiben.

#### Scenario: Entwurf bleibt bei einem Folgefehler unveröffentlicht

- **WHEN** der Mainserver eine neue Tour erfolgreich persistiert und ein nachgelagerter Studio-Schritt scheitert
- **THEN** war die Tour seit der ersten Persistierung unveröffentlicht
- **AND** Studio sendet `visible: false` direkt in `createTour` und bestätigt die Sichtbarkeit über einen Leseaufruf

#### Scenario: Create und Update fallen nicht auf die jeweils andere Operation zurück

- **WHEN** der Host einen Identitätskonflikt beim Create oder ein Update mit fehlender oder fremder ID feststellt
- **THEN** verändert der Create keinen Bestandsdatensatz und der Update legt keinen Datensatz an

### Requirement: Ortsentwürfe verwenden die atomare Mainserver-Neuanlage

Wenn Studio einen Ort ausdrücklich als Entwurf speichert, SHALL `createPointOfInterest` `visible: false` erhalten. Bei einer mitgesendeten externen ID SHALL Studio vor dem Schreiben zusätzlich `poi.update` und `content.changeStatus` für den gewählten Principal prüfen, da der Mainserver einen passenden Ort aktualisieren kann. Studio SHALL die gespeicherte Sichtbarkeit durch eine Detailabfrage prüfen. Der Entwurfspfad SHALL genau eine Mainserver-Schreibmutation ausführen. Bei ausdrücklich sichtbaren Ortsanlagen mit externer ID SHALL Studio vor dem Schreiben zusätzlich `poi.update` und `content.publish` prüfen. Tourenentwürfe und Ortsanlagen ohne externe ID mit ausdrücklicher Sichtbarkeit SHALL über `forceCreate` einen neuen Datensatz anlegen.

#### Scenario: Abweichende Sichtbarkeit löst keine weitere Mutation aus

- **GIVEN** eine Ortsneuanlage hat eine Mainserver-ID geliefert
- **WHEN** Studio die unveröffentlichte Sichtbarkeit durch erneutes Lesen nicht bestätigen kann
- **THEN** meldet Studio den Teilerfolg mit der Mainserver-ID und vermerkt den Bedarf zur Abstimmung
- **AND** Studio sendet weder eine weitere Neuanlage noch einen nachträglichen Sichtbarkeitswechsel

### Requirement: Tourenmutationen erhalten Bestandsdaten nachweisbar

Der Host SHALL bei einer Bestandsänderung den aktuellen Datensatz serverseitig lesen, die Feldmatrix anwenden und alle unbeteiligten, von der Mutation berührten Werte erhalten. Stopp-Identität, Reihenfolge, Medien, unbekannter Payload, POI-Verweise und DataProvider SHALL unverändert bleiben, sofern die Aktion den jeweiligen Wert nicht ausdrücklich ändert. Kann der Host die relevanten Werte nicht verlustfrei in den bestätigten Schreibvertrag überführen, SHALL er die Änderung vor dem Provider-Aufruf kontrolliert abbrechen.

#### Scenario: Isolierte Änderung erhält übrige Stationsdaten

- **GIVEN** eine bestehende Tour mit mehreren Stationen, Medien und einem POI-Verweis
- **WHEN** eine berechtigte Redaktion genau eine Station ändert und die Tour erneut lädt
- **THEN** ist die gezielte Änderung sichtbar und alle übrigen Stations-IDs, ihre Reihenfolge und die übrigen Daten entsprechen dem Ausgangszustand

#### Scenario: Nicht verlustfrei schreibbarer Bestand bleibt lesbar

- **GIVEN** der Schreibvertrag kann ein relevantes Bestandsfeld nicht sicher erhalten
- **WHEN** ein Update versucht wird
- **THEN** erhält die Redaktion eine deterministische, übersetzte Meldung und der Provider wird nicht mutiert

#### Scenario: Lifecycle-Aktionen werden anhand ihrer tatsächlichen Wirkung bestätigt

- **WHEN** der Mainserver einen Sichtbarkeitswechsel oder eine bestätigte Löschaktion meldet
- **THEN** prüft Studio den neuen Sichtbarkeitswert oder die bestätigte Entfernung des Datensatzes entsprechend der Operation

#### Scenario: Inhabertransfer ändert nur die beabsichtigte Inhaberschaft

- **WHEN** die Redaktion einen bestätigten Inhabertransfer ausführt
- **THEN** prüft der Host das Ziel über die bestehende Aktion
- **AND** der Transfer erhält unbeteiligte Bestandsdaten
