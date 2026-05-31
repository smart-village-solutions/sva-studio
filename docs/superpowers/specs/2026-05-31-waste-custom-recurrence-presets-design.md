# Design: Benutzerdefinierte Abstandspresets für Waste-Touren

## Kontext

Das Waste-Management-Modul unterstützt für Touren derzeit feste Turnuswerte wie `weekly`, `biweekly`, `fourweekly`, `yearly`, `on-demand` und `custom`. Diese festen Defaults decken die häufigsten Fälle ab, erlauben aber keine instanzspezifischen zusätzlichen Abstände, die zentral gepflegt und von mehreren Touren wiederverwendet werden können.

Neu benötigt wird deshalb ein Settings-gesteuertes Preset-Modell: Im Waste-Management sollen pro Instanz benutzerdefinierte Abstände mit frei vergebenem Namen, optionaler Beschreibung und einer Tagesanzahl gepflegt werden können. Diese zusätzlichen Abstände erscheinen anschließend im Tour-Formular als auswählbare Turnusoptionen neben den festen Defaults.

Wichtig ist dabei:

- die bestehenden festen Turnusoptionen bleiben unverändert erhalten
- benutzerdefinierte Abstände werden zentral in den Waste-Einstellungen verwaltet
- Touren referenzieren diese Presets, statt eine freie Tageszahl lokal an der Tour zu speichern
- Änderungen an einem Preset wirken auf alle referenzierenden Touren
- beim Löschen eines verwendeten Presets muss serverseitig ein Fallback für betroffene Touren gewählt werden

## Ziele

- Waste-Management bietet pro Instanz einen Settings-Bereich für benutzerdefinierte Abstandspresets.
- Ein Preset besteht aus `Name`, optionaler `Beschreibung` und `Tage`.
- Die Tagesanzahl ist eine positive ganze Zahl größer `0`.
- Touren können weiterhin feste Default-Turnusse verwenden oder zusätzlich eines der benutzerdefinierten Presets auswählen.
- Benutzerdefinierte Presets erscheinen im Tour-Formular als zusätzliche Turnusoptionen.
- Änderungen an einem Preset übernehmen alle Touren automatisch, die dieses Preset referenzieren.
- Beim Löschen eines verwendeten Presets wird ein Fallback gewählt, damit keine Tour ungültig zurückbleibt.
- `customDates` bleiben auch bei Touren mit benutzerdefiniertem Abstand zusätzlich nutzbar.

## Nicht-Ziele

- Kein Ersatz oder Umbau der bestehenden festen Default-Turnusse.
- Keine freie Eingabe von Tagesabständen direkt an der Tour.
- Keine neue Regelengine für Wochen-, Monats- oder Wochentagsmuster.
- Keine Versionierung oder Historisierung von Abstandspresets in diesem Change.
- Keine automatische Migration bestehender Touren auf benutzerdefinierte Presets.

## Nutzerfluss

1. Ein Benutzer mit Settings-Recht öffnet den Settings-Bereich des Waste-Management-Plugins.
2. Im neuen Bereich für benutzerdefinierte Abstände legt er ein Preset mit Name, optionaler Beschreibung und Tagesanzahl an.
3. Das Preset wird serverseitig zur aktiven Instanz gespeichert.
4. Ein Benutzer öffnet anschließend den Tour-Create- oder Edit-Flow.
5. Im Turnus-Select erscheinen weiterhin die festen Default-Werte sowie zusätzlich die benutzerdefinierten Presets der Instanz.
6. Wählt der Benutzer ein Preset aus, speichert die Tour nicht die Tagesanzahl selbst, sondern nur die Referenz auf das Preset.
7. Die Terminberechnung löst diese Referenz zur Laufzeit auf und verwendet die im Preset hinterlegte Tagesanzahl zusammen mit `firstDate`, optional `endDate` und zusätzlichen `customDates`.
8. Wird ein Preset später bearbeitet, wirken die Änderungen auf alle referenzierenden Touren.
9. Wird ein verwendetes Preset gelöscht, fragt das System vor dem Löschen einen Fallback ab und stellt die betroffenen Touren serverseitig atomar auf diesen Fallback um.

## Fachmodell

### Neues Modell: Benutzerdefiniertes Abstandspreset

Ein benutzerdefiniertes Abstandspreset ist ein instanzbezogener Datensatz für wiederverwendbare Tour-Abstände. Jedes Preset enthält mindestens:

- `id`
- `instanceId`
- `name`
- optionale `description`
- `intervalDays`
- `createdAt`
- `updatedAt`

Fachregeln:

- `intervalDays` ist eine positive ganze Zahl größer `0`
- `name` ist innerhalb einer Instanz eindeutig
- die Tagesanzahl ist der wirksame fachliche Abstand der zugeordneten Touren

### Tourenmodell

Die bestehenden Default-Turnusse bleiben im Feld `recurrence` erhalten. Zusätzlich erhält die Tour eine optionale Referenz auf ein benutzerdefiniertes Preset:

- `customRecurrenceId?: string`

Die Semantik ist exklusiv:

- entweder verwendet eine Tour einen festen Default-Turnus über `recurrence`
- oder sie verwendet ein benutzerdefiniertes Preset über `customRecurrenceId`
- ist `customRecurrenceId` gesetzt, wird `recurrence` als `null` gespeichert
- der bestehende Wert `custom` behält seine bisherige Bedeutung als Modus für reine individuelle Termine ohne Preset-Referenz

`firstDate`, `endDate` und `customDates` bleiben an der Tour. Damit bleibt der zeitliche Rahmen weiterhin tourbezogen, während nur die Abstandsdefinition zentralisiert wird.

### Terminsemantik

Für Touren mit benutzerdefiniertem Preset gilt:

- `firstDate` ist der Startpunkt der Serie
- `endDate` begrenzt die Serie optional nach hinten
- `intervalDays` aus dem referenzierten Preset bestimmt die Schrittweite
- `customDates` werden zusätzlich zur berechneten Serie berücksichtigt

Damit bleibt das bestehende Modell konsistent: Die Tour hält ihren zeitlichen Verlauf, das Preset definiert den wiederverwendbaren Abstand.

## Settings-Design

Die bestehende Waste-Settings-Oberfläche ist heute auf Datenquellenkonfiguration fokussiert. Sie wird um einen zusätzlichen fachlichen Abschnitt für benutzerdefinierte Abstände erweitert.

Der neue Abschnitt enthält:

- Liste vorhandener Presets
- Aktion zum Anlegen
- Aktion zum Bearbeiten
- Aktion zum Löschen

Die Pflege bleibt an denselben instanzbezogenen Settings-Vertrag gebunden wie die übrigen Waste-Einstellungen. Dadurch ist fachlich klar, dass benutzerdefinierte Abstände kein globales Systeminventar, sondern Teil der Instanzkonfiguration des Waste-Managements sind.

## UI-Design

### Settings-Bereich

Im Settings-Tab entsteht eine neue Subsektion `Eigene Abstände`. Dort werden alle Presets der Instanz tabellarisch oder listenartig mit folgenden Informationen gezeigt:

- Name
- Beschreibung
- Tagesanzahl
- Aktionen `Bearbeiten` und `Löschen`

Für Create und Edit genügt im ersten Schritt ein kompakter Formular-Dialog mit:

- Pflichtfeld `Name`
- optionalem Feld `Beschreibung`
- Pflichtfeld `Abstand in Tagen`

### Tour-Formular

Das bisherige Turnus-Select bleibt der zentrale Einstiegspunkt. Die festen Default-Optionen bleiben in ihrer bisherigen Form sichtbar. Zusätzlich werden die benutzerdefinierten Presets der Instanz als gesonderte Optionsgruppe dargestellt.

Empfohlenes Verhalten:

- feste Defaults stehen zuerst
- benutzerdefinierte Presets stehen in einer klar getrennten Gruppe darunter
- die Anzeige nutzt den Preset-Namen, nicht die rohe Tagesanzahl

Wählt der Benutzer ein benutzerdefiniertes Preset, gelten im Formular dieselben ergänzenden Datumsfelder wie bei anderen serienbasierten Touren:

- `Erster Termin`
- optional `Letzter Termin`
- `Individuelle Termine`

Es erscheint kein zusätzliches Eingabefeld für Tagesanzahl an der Tour selbst.

### Löschen mit Fallback

Wenn ein Preset von keiner Tour verwendet wird, kann es direkt gelöscht werden.

Wenn ein Preset noch referenziert wird, öffnet sich ein Löschdialog mit verpflichtender Fallback-Auswahl. Als Fallback sind zulässig:

- ein anderes benutzerdefiniertes Preset der Instanz
- ein fester Default-Turnus

Der Dialog muss sichtbar machen, dass die Änderung auf alle betroffenen Touren angewendet wird.

## API- und Vertragsdesign

### Settings-Vertrag

Der bestehende Waste-Settings-Vertrag wird um die Liste benutzerdefinierter Abstandspresets erweitert. Die Instanzantwort enthält damit künftig neben der Datenquellenkonfiguration auch die fachlichen Zusatzturnusse.

Die Save-Operation für Waste-Settings muss daher zusätzlich CRUD-Operationen für Presets abbilden. Dabei bleibt wichtig:

- die Settings bleiben host-geführt
- der Browser spricht weiter nur die bestehende Waste-Settings-Fassade an
- die Instanzgrenze bleibt serverseitig führend

### Tour-Vertrag

Die Tour-Create- und Tour-Update-Inputs erhalten zusätzlich:

- `customRecurrenceId?: string`

Regeln:

- ist `customRecurrenceId` gesetzt, wird `recurrence` als `null` gespeichert
- ist `customRecurrenceId` nicht gesetzt, gilt das bestehende Verhalten über `recurrence`
- `custom` bleibt exklusiv der bestehende Modus für individuelle Termine ohne Preset-Auflösung

Für Reads muss der Server genügend Informationen liefern, damit UI und Jahreskalender die Auswahl auflösen können. Die Terminberechnung darf sich dabei nicht auf reine UI-Konventionen verlassen, sondern muss das referenzierte Preset server- oder domänenlogisch sauber interpretieren.

## Server-Design

### Preset-Persistenz

Die benutzerdefinierten Abstände werden als eigenständige instanzbezogene Persistenz geführt. Sie gehören fachlich nicht in die Tourtabelle selbst, weil sie mehrfach verwendet und zentral geändert werden sollen.

### Terminauflösung

Die Kalender- und Terminlogik erhält eine zusätzliche Auflösungsstufe:

1. Prüfen, ob die Tour ein benutzerdefiniertes Preset referenziert.
2. Falls ja, `intervalDays` aus dem Preset laden.
3. Serie ab `firstDate` in Schritten von `intervalDays` bis `endDate` oder Fensterende berechnen.
4. `customDates` ergänzend hinzufügen.
5. Vorhandene tourbezogene und globale Datumsverschiebungen wie bisher anwenden.

### Bearbeiten eines Presets

Wird ein Preset bearbeitet, ist keine Tourmigration erforderlich. Alle referenzierenden Touren übernehmen die neue Tagesanzahl implizit, weil sie weiterhin dieselbe Preset-ID referenzieren. Genau dieses Verhalten ist fachlich gewünscht und muss nicht gesondert bestätigt werden.

### Löschen eines Presets

Das Löschen eines referenzierten Presets muss serverseitig als Gesamtoperation behandelt werden:

1. referenzierende Touren ermitteln
2. Fallback validieren
3. alle betroffenen Touren atomar auf den Fallback umstellen
4. Preset löschen

Es darf keinen Zwischenzustand geben, in dem Touren auf ein nicht mehr vorhandenes Preset zeigen.

## Validierung und Konsistenz

### Preset-Validierung

- `name` ist Pflicht
- `name` ist innerhalb der Instanz eindeutig
- `intervalDays` ist Pflicht
- `intervalDays` muss eine ganze Zahl größer `0` sein

### Tour-Validierung

- eine Tour darf nicht gleichzeitig `customRecurrenceId` und einen festen `recurrence`-Wert tragen
- nutzt eine Tour ein benutzerdefiniertes Preset, muss `firstDate` vorhanden sein
- `endDate` bleibt optional
- `customDates` bleiben zusätzlich zulässig

### Konsistenzregel

Im Zielbild darf keine Tour auf ein nicht mehr vorhandenes Preset referenzieren. Deshalb sind Preset-Löschung und Fallback-Umschaltung strikt serverseitig zu kapseln.

## Fehlerverhalten

### Typische Fehlerfälle

- Preset-Name innerhalb der Instanz bereits vergeben
- `intervalDays` ist leer, `0`, negativ oder keine ganze Zahl
- referenziertes Preset existiert nicht oder gehört nicht zur aktiven Instanz
- Löschversuch eines verwendeten Presets ohne gültigen Fallback
- Fallback verweist auf dasselbe Preset, das gelöscht werden soll

### UX-Grundsätze

- Fehler werden benutzerführend und feldnah zurückgemeldet
- keine Tour wird stillschweigend auf einen impliziten Fallback gesetzt
- kein Löschpfad ohne explizite Bestätigung und Fallback-Auswahl bei bestehenden Referenzen

## Migration

Die Änderung ist additiv:

- bestehende Waste-Settings bleiben gültig
- bestehende Touren bleiben unverändert gültig
- bestehende Default-Turnusse behalten exakt ihre bisherige Semantik

Es ist keine Fachmigration bestehender Touren erforderlich. Nur neue Presets und Touren mit Preset-Referenzen nutzen das erweiterte Modell.

## Übersetzungen und UX-Kopie

Benötigt werden neue Übersetzungsschlüssel mindestens für:

- Settings-Sektion `Eigene Abstände`
- Create-/Edit-Dialog für Presets
- Feldlabels `Name`, `Beschreibung`, `Abstand in Tagen`
- gruppierte Turnusoptionen im Tour-Formular
- Löschdialog mit Fallback-Auswahl
- Erfolgs- und Fehlermeldungen für Preset-CRUD und Fallback-Umschaltung

Alle UI-Texte folgen den bestehenden i18n-Regeln. Hardcodierte Strings in der UI sind ausgeschlossen.

## Tests

### Domänen- und Mapping-Tests

- Preset-Validierung akzeptiert nur positive ganze Tageswerte
- Instanzweite Namenseindeutigkeit wird durchgesetzt
- Touren mit `customRecurrenceId` werden korrekt in Formular- und API-Modelle gemappt
- feste Default-Turnusse bleiben unverändert funktionsfähig

### Server- und Repository-Tests

- Presets können instanzbezogen angelegt, gelesen, bearbeitet und gelöscht werden
- Tour-Reads lösen benutzerdefinierte Presets korrekt auf
- Kalender- und Terminberechnung berücksichtigt `intervalDays` aus dem Preset
- Löschen eines referenzierten Presets führt nur mit gültigem Fallback zum Erfolg
- Fallback-Umschaltung und Preset-Löschung laufen atomar

### Plugin- und UI-Tests

- Settings-Tab zeigt die neue Preset-Sektion
- Preset-Create und Preset-Edit validieren Name und Tagesanzahl korrekt
- Turnus-Select im Tour-Formular zeigt feste Defaults und benutzerdefinierte Optionen getrennt an
- Auswahl eines Presets aktiviert das erwartete Formularverhalten für Datumsserie plus `customDates`
- Löschdialog fordert bei verwendeten Presets eine Fallback-Auswahl an

### E2E-Tests

- Preset anlegen und in einer Tour verwenden
- Preset bearbeiten und geänderte Terminserie in Tour/Jahreskalender beobachten
- Verwendetes Preset löschen und betroffene Touren serverseitig auf Fallback umstellen

## Architektur und Schnittgrenzen

Die Umsetzung sollte in klar getrennte Bausteine zerlegt werden:

1. Erweiterung des instanzbezogenen Waste-Settings-Vertrags um Presets
2. Persistenz- und Validierungslogik für benutzerdefinierte Abstandspresets
3. Erweiterung des Tour-Vertrags um Preset-Referenzen
4. Erweiterung der Terminberechnung zur Preset-Auflösung
5. Settings- und Tour-UI für Pflege, Auswahl und Fallback-Löschung

Diese Trennung ist wichtig, damit Preset-Verwaltung, Tour-Konfiguration und Terminberechnung unabhängig verständlich und testbar bleiben.
