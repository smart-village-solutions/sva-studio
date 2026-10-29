## ADDED Requirements

### Requirement: Eigenständiges Gutschein-Plugin

Das Studio SHALL das optional aktivierbare Plugin `vouchers` mit dem Inhaltstyp `vouchers.voucher` über die bestehenden hostgeführten Content-, Routing-, UI-, Berechtigungs- und Historienverträge bereitstellen. Gutscheine SHALL eigenständig erstellt und bearbeitet werden; der Ort-Editor SHALL lediglich auf zugeordnete Gutscheine verweisen.

#### Scenario: Redaktion findet und bearbeitet Gutscheine eigenständig

- **GIVEN** das Plugin ist aktiv und der Benutzer besitzt passende Rechte
- **WHEN** er die Gutscheinverwaltung öffnet
- **THEN** kann er Gutscheine nach Titel suchen und nach Ort, Kategorie und Sichtbarkeit filtern
- **AND** führen Erstellung und Bearbeitung in einen eigenständigen Gutschein-Editor ohne verschachtelten Ort-Editor
- **AND** werden nur für ihn zulässige Inhalte und Actions angeboten

#### Scenario: Plugin ist deaktiviert

- **WHEN** das Plugin im Mandanten deaktiviert ist
- **THEN** stehen seine redaktionellen Routen und Aktionen nicht zur Verfügung
- **AND** bleiben bereits gespeicherte Gutscheine erhalten
- **AND** dürfen POI-Schreibaktionen den notwendigen Gutschein-Erhaltungsschutz nicht umgehen

### Requirement: Gutscheinformular mit genau einem Ort

Das Gutscheinformular SHALL Titel, Teaser, Beschreibung, Kategorie, Bilder, Rabattart, Kontingent, Rhythmus, Gültigkeit und Sichtbarkeit fachlich verständlich abbilden. Es MUST aktuell genau einen berechtigten Ort verwenden. Das fachliche Zuordnungsmodell SHALL eine Ortsliste mit derzeit exakt einem Eintrag verwenden; eine echte Mehrfachzuordnung SHALL weder angeboten noch zusätzlich gespeichert werden.

#### Scenario: Neuer Gutschein für bestehenden Ort

- **WHEN** ein berechtigter Benutzer einen Gutschein erstellt
- **THEN** wählt er genau einen vorhandenen zulässigen Ort und erfasst einen Titel und ein positives Gesamtmaximum
- **AND** validiert Studio die gewählte Rabattart, optionale positive Personengrenze, den Rhythmus und widerspruchsfreie Gültigkeitsgrenzen client- und serverseitig
- **AND** können neue Orte über den vorhandenen POI-Erstellungsweg angelegt und anschließend ausgewählt werden

#### Scenario: Mehrfachzuordnung oder Ortswechsel wird angefordert

- **WHEN** eine Eingabe mehrere Orte enthält oder den Ort eines vorhandenen Gutscheins wechseln will
- **THEN** lehnt Studio die Änderung vor dem Mainserver-Write verständlich ab
- **AND** legt es keine Duplikate oder Schattenzuordnungen an

#### Scenario: Formular bleibt zugänglich und verständlich

- **WHEN** der Benutzer ungültige Angaben absendet oder das Formular mit der Tastatur bedient
- **THEN** sind Labels, Hilfen, Bestätigung und Fehler über Übersetzungsschlüssel in de/en verfügbar
- **AND** sind betroffene Felder erreichbar und Fehler fokussierbar nach WCAG 2.1 AA
- **AND** heißen die sichtbaren redaktionellen Hauptfelder gemäß bestehendem Studio-Vertrag „Überschrift“ und „Einleitung“, während die technischen `title`-/`teaser`-Felder unverändert bleiben

### Requirement: Gutschein-Erstellung als verständlicher Onepager

Die Neuanlage SHALL genau ein durchgehendes Formular in der Reihenfolge Grunddaten, Einlöseort, Vorteil, Kontingent, Gültigkeit, Sichtbarkeit und Speichern verwenden. Die Abschnitte SHALL ohne Wizard oder innere Editor-Tabs erreichbar sein. Studio SHALL Mengenregeln, Gültigkeit und öffentliche Wirkung in Alltagssprache erklären und vor dem Absenden zusammenfassen.

#### Scenario: Ort bestimmt früh die Speicherwirkung

- **WHEN** ein Benutzer einen Ort für einen neuen Gutschein auswählt
- **THEN** zeigt Studio Name und unterscheidbare Adresse sowie den berechtigten vorhandenen Gutscheinbestand mit Reset-Hinweis
- **AND** bleiben bei einem Wechsel während der Neuanlage andere Formularwerte erhalten
- **AND** wird jede Bestätigung für den vorherigen Ort ungültig

#### Scenario: Eine Rabattart liefert eindeutige Eingaben

- **WHEN** der Benutzer Prozent, festen Rabattbetrag oder reduzierten Preis auswählt
- **THEN** werden nur zu dieser Variante passende Felder angeboten und gesendet
- **AND** dürfen lokal für einen Rückwechsel erhaltene Werte anderer Varianten nicht unbemerkt mitgespeichert werden
- **AND** verlangt ein mehrdeutiger bestehender Rabatt vor einem Inhalts-Save eine ausdrückliche Auswahl ohne Bereinigung beim bloßen Öffnen

#### Scenario: Kontingentregel ist vor dem Speichern verständlich

- **GIVEN** monatlicher Rhythmus, Gesamtmaximum 100 und Personenmaximum 1
- **WHEN** der Benutzer die Eingaben prüft
- **THEN** erklärt Studio insgesamt 100 Einlösungen und höchstens eine pro Person je Kalendermonat
- **AND** wird ein leeres Personenmaximum als fehlende zusätzliche Personenbegrenzung erklärt
- **AND** stimmen Kalendergrenzen mit dem nachgewiesenen Mainserver-Vertrag überein

#### Scenario: Einlösbarkeit und Sichtbarkeit sind getrennt

- **WHEN** ein neuer Gutschein einen zukünftigen Einlösebeginn besitzt
- **THEN** leitet Studio daraus kein automatisches Ausblenden ab
- **AND** ist bei Neuanlage ausgeblendetes Speichern vorausgewählt, während Anzeigen eine explizite berechtigte Wahl bleibt
- **AND** nennt die Zusammenfassung Vorteil, Ort, Mengenregel, Gültigkeit und Sichtbarkeit mit Rückwegen zu den Eingaben

#### Scenario: Keine unbemerkte Nebenaktion auf ungespeicherten Werten

- **WHEN** ein vorhandener Gutschein unveränderte Inhalte oder noch ungespeicherte Änderungen besitzt
- **THEN** löst ein unveränderter Inhalt keinen destruktiven Save aus
- **AND** verlangt eine getrennte Sichtbarkeitsaktion bei offenen Inhaltsänderungen zuerst deren Speichern oder ausdrückliches Verwerfen

### Requirement: Einlösungsreset wird konkret bestätigt

Studio MUST vor jedem verschachtelten POI-Save mit bestehenden Gutscheinen die Reset-Wirkung für alle dortigen Gutscheine erklären und ausdrücklich bestätigen lassen. Die Bestätigung SHALL den Ort und den betroffenen Gutscheinbestand benennen und darauf hinweisen, dass bisherige Einlösungen zurückgesetzt werden und erneute Einlösungen möglich sind. Die Bestätigung MUST serverseitig an Akteur, Operation und aktuellen relevanten Inhaltsstand gebunden sein.

#### Scenario: Ein Gutschein wird bearbeitet oder ergänzt

- **GIVEN** an einem Ort existieren mehrere Gutscheine
- **WHEN** ein Benutzer einen davon inhaltlich ändert oder einen weiteren hinzufügt
- **THEN** erklärt die Bestätigung den Reset für alle vorhandenen Gutscheine dieses Ortes
- **AND** findet ohne gültige Bestätigung kein destruktiver Schreibrequest statt

#### Scenario: Gewöhnliche Ortsänderung oder Abbruch

- **WHEN** ein Ort mit Gutscheinen über den normalen POI-Editor geändert wird
- **THEN** gilt dieselbe Reset-Bestätigung und inhaltliche Erhaltung
- **AND** sendet Abbrechen weder beim POI- noch beim Gutschein-Editor eine Mutation

#### Scenario: Destruktive Bestätigung benennt Folgen und Rückweg

- **WHEN** nach erfolgreicher Validierung bestehende Gutscheine am ausgewählten Ort betroffen sind
- **THEN** nennt der Dialog Ort, Anzahl und Titel der betroffenen Gutscheine und die Löschung aller bisherigen Einlösungen samt erneuter Einlösbarkeit und fehlender Rückgängigmachung im Studio
- **AND** lautet die explizite Bestätigungsaktion sinngemäß „Einlösungen zurücksetzen und speichern“ statt „OK“
- **AND** führen initial fokussierte Rückkehraktion, Escape und Schließen ohne Mutation zum erhaltenen Formular zurück
- **AND** durchlaufen alle Submit-Auslöser denselben gesperrten Ablauf ohne parallele Requests

#### Scenario: Kein bestehender Gutschein beim Anlegen

- **GIVEN** ein Ort besitzt keine Gutscheine
- **WHEN** ein neuer Gutschein gespeichert wird
- **THEN** verlangt Studio keinen Reset-Dialog für nicht vorhandene Einlösungen
- **AND** prüft der Server den Bestand vor Ausführung erneut
- **AND** erfordert ein inzwischen hinzugekommener Gutschein eine neue explizite Reset-Bestätigung

#### Scenario: UX-Abnahme erklärt die tatsächliche Wirkung

- **WHEN** die redaktionelle Abnahme des Onepagers erfolgt
- **THEN** prüfen Aufgaben für einen gelegentlichen Redakteur und einen Firmeninhaber die erkennbare Orts-, Rabatt-, Mengen-, Gültigkeits- und Sichtbarkeitsentscheidung sowie den Reset aller Geschwistergutscheine
- **AND** werden eine beobachtete Usability-Aufgabe und automatisierte Tests als unterschiedliche Nachweise ausgewiesen

### Requirement: Nutzungsdarstellung für gespeicherte Gutscheine

Studio SHALL die vom Mainserver registrierten Einlösungen pro Gutschein in Übersicht und Detail verständlich darstellen. Die Darstellung MUST absolute registrierte Einlösungen, Restkontingent, Gesamtmaximum, bei positiver Bezugsmenge prozentuale Auslastung und den zutreffenden Rhythmus/Bezugszeitraum unterscheiden. Einlösungen SHALL weder als eindeutige Personen noch als tatsächlich vor Ort abgegebene Leistungen bezeichnet werden.

#### Scenario: Nutzung ist ohne technische Kenntnisse verständlich

- **GIVEN** Gesamtmaximum 100, Restkontingent 63 und monatlicher Rhythmus
- **WHEN** ein berechtigter Benutzer den gespeicherten Gutschein öffnet
- **THEN** sieht er 37 registrierte Einlösungen, 63 verfügbare Einlösungen und 37 Prozent Auslastung im aktuellen Kalendermonat
- **AND** zeigt die Übersicht dieselbe Bedeutung kompakt als „37 von 100 eingelöst“ samt Restmenge und Zeitraum
- **AND** bleiben Zahlen und Bedeutung ohne Farbe oder grafischen Balken zugänglich

#### Scenario: Grenzen und Fehlzustände sind keine Nullwerte

- **WHEN** Nutzungswerte fehlen, widersprüchlich sind oder nicht aktualisiert werden können
- **THEN** unterscheidet die Oberfläche unbekannte Nutzung, widersprüchliche Daten und einen fehlgeschlagenen Aktualisierungsversuch
- **AND** werden zuvor erfolgreich geladene Zahlen nur mit ihrem alten Datenstand und sichtbarer Einschränkung weitergezeigt
- **AND** wird weder fehlende Nutzung zu null noch eine Überziehung zu höchstens 100 Prozent korrigiert

#### Scenario: Zähler und Zeitbezug bleiben ehrlich

- **WHEN** die Darstellung Nutzung erläutert oder ein Inhalt gespeichert wird
- **THEN** nennt sie den Abrufzeitpunkt und bietet einen erneuten reinen Datenabruf an
- **AND** erklärt sie fehlende Offline-Synchronisation und den akzeptierten Reset beim bestätigten Inhaltsspeichern
- **AND** behauptet sie weder historische Periodenreihen noch einen aus `updatedAt` geratenen letzten Reset-Zeitpunkt
- **AND** ersetzen ungespeicherte Formularwerte nicht die Nutzungsdaten des gespeicherten Standes

### Requirement: Sichtbarkeit ohne Inhaltsreset

Studio SHALL reines Anzeigen/Ausblenden eines Gutscheins über die vorhandene direkte Sichtbarkeitsmutation ausführen und SHALL dabei keinen POI-Inhalts-Save auslösen. Harte Gutscheinlöschung und eigenständige Archivierung SHALL im ersten Plugin-Umfang nicht angeboten werden.

#### Scenario: Gutschein wird ausgeblendet

- **WHEN** ein berechtigter Benutzer einen Gutschein ausblendet
- **THEN** verwendet Studio `changeVisibility` für das bestehende GenericItem
- **AND** bleiben im nachgewiesenen Mainserver-Vertrag Gutschein-ID, Kontingent und Einlösungen erhalten
- **AND** zeigt Studio erst nach bestätigtem Ergebnis Erfolg
