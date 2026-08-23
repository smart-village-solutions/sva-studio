## ADDED Requirements

### Requirement: Waste-Management übernimmt einen Jahres-Tourensatz ausschließlich in das direkte Folgejahr

Das System SHALL berechtigten Benutzern einen mehrstufigen Assistenten bereitstellen, der ein unterstütztes Quelljahr erfasst und das unveränderliche Folgejahr ausschließlich serverseitig als `Quelljahr + 1` ableitet. Es SHALL keine freie Zieljahrauswahl, Rückwärtskopie oder Mehrjahresverschiebung anbieten.

#### Scenario: Aktuelles Jahr wird in das nächste Jahr übernommen

- **WHEN** ein Benutzer das aktuelle Kalenderjahr als Quelljahr auswählt
- **THEN** zeigt das System das nächste Kalenderjahr unveränderlich als Folgejahr an
- **AND** verwendet es dieses Folgejahr in Vorschau und Erstellung

#### Scenario: Vorheriges Jahr wird in das aktuelle Jahr übernommen

- **WHEN** ein Benutzer das unmittelbar vorherige Kalenderjahr als Quelljahr auswählt
- **THEN** zeigt das System das aktuelle Kalenderjahr unveränderlich als Folgejahr an
- **AND** bleibt der erzeugte Bestand über den vorhandenen relativen Jahresfilter auffindbar

#### Scenario: Nicht unterstütztes Quelljahr wird abgelehnt

- **WHEN** ein Request ein anderes als das aktuelle oder unmittelbar vorherige Kalenderjahr enthält oder ein Zieljahr mitsendet
- **THEN** verhindert das System die Vorschau und Erstellung
- **AND** erklärt verständlich, welche Quelljahre unterstützt werden

### Requirement: Waste-Management klassifiziert den vollständigen relevanten Quellbestand

Das System SHALL alle aktiven Touren berücksichtigen, deren Gültigkeitszeitraum das Quelljahr überschneidet oder die mindestens einen expliziten Termin im Quelljahr besitzen. Es SHALL jede relevante Tour nachvollziehbar genau als `wird übernommen`, `gilt bereits im Folgejahr` oder `blockiert` klassifizieren.

#### Scenario: Auf das Quelljahr begrenzte Tour wird übernommen

- **WHEN** eine aktive Tour im Quelljahr wirksam ist und weder ihr Gültigkeitszeitraum noch ein expliziter Termin bereits im Folgejahr wirksam ist
- **THEN** klassifiziert das System die Tour als `wird übernommen`
- **AND** lässt es den Benutzer die Tour vor der Bestätigung abwählen

#### Scenario: Quelltour gilt bereits im Folgejahr

- **WHEN** eine aktive Quelltour durch ihren Gültigkeitszeitraum oder einen expliziten Termin bereits im Folgejahr wirksam ist
- **THEN** klassifiziert das System die Tour als `gilt bereits im Folgejahr`
- **AND** dupliziert es die Tour nicht
- **AND** erklärt es, dass die unveränderte Quelltour im Folgejahr weiterwirkt

#### Scenario: Tour kann nicht sicher abgebildet werden

- **WHEN** eine relevante Tour ungültige oder unvollständige Planungsdaten oder einen ungelösten Datumsblocker besitzt
- **THEN** klassifiziert das System die Tour als `blockiert`
- **AND** nennt es den konkreten Grund und eine geeignete manuelle Folgeaktion
- **AND** lässt es die Tour nicht bestätigen

### Requirement: Waste-Management verwendet einen vollständigen Folgejahr-Übernahmevertrag

Das System SHALL für jede bestätigte Tour genau einen Übernahmevertrag verwenden. Dieser SHALL die Tourstammdaten, Abholorte und alle im Quelljahr wirksamen Planungsbeziehungen vollständig in das Folgejahr übertragen und Daten außerhalb des Quelljahres ausschließen.

#### Scenario: Tour und Beziehungen werden vollständig übernommen

- **WHEN** eine als `wird übernommen` klassifizierte Tour bestätigt wird
- **THEN** übernimmt das System Name, Beschreibung, Abfallarten, Abholorte, Turnus oder Abstandspreset
- **AND** übernimmt es konkrete Tourtermine, ortsbezogene Abholtermine und explizite Tour-Einsätze einschließlich ihrer Abholorte
- **AND** ergänzt es kein Kopie-Suffix am Tournamen

#### Scenario: Tourbezogene Verschiebungen werden nach ihrer Jahressemantik übernommen

- **WHEN** die bestätigte Tour jahresunabhängige oder im Quelljahr wirksame jahresspezifische Verschiebungen besitzt
- **THEN** verknüpft das System jahresunabhängige Regeln unverändert mit der neuen Tour
- **AND** bildet es jahresspezifische Verschiebungen des Quelljahres auf das Folgejahr ab
- **AND** erhält es bei einer Verschiebung über die Jahresgrenze den relativen Jahresversatz zwischen Ursprungs- und Zieldatum
- **AND** übernimmt es keine jahresspezifischen Verschiebungen außerhalb des Quelljahres

### Requirement: Waste-Management überträgt Folgejahrdaten deterministisch

Das System SHALL wiederkehrende Tagesabstandstouren ohne Taktunterbrechung in das Folgejahr fortführen und SHALL konkrete Jahresdaten nach einer festen, serverseitig identischen Folgejahrregel abbilden.

#### Scenario: Tagesabstand wird ohne Unterbrechung fortgeführt

- **WHEN** eine wöchentliche, zweiwöchentliche, vierwöchentliche oder durch ein Abstandspreset bestimmte Tour übernommen wird
- **THEN** überträgt das System den im Quelljahr wirksamen Gültigkeitsausschnitt nach Monat und Tag in das Folgejahr
- **AND** berechnet es den ersten Zieltermin durch Fortführung des bestehenden Tagesabstands
- **AND** bleiben Wochentag und Taktlage auch über einen Schaltjahreswechsel hinweg erhalten

#### Scenario: Konkreter Termin behält seine fachliche Wochenlage

- **WHEN** ein konkreter Quelltermin in das Folgejahr übertragen wird
- **THEN** verwendet das System den nächstgelegenen gleichen Wochentag zu demselben Monat und Tag des Folgejahres
- **AND** liegt das Ergebnis stets innerhalb des Folgejahres
- **AND** zeigt die Vorschau Quell- und Zieldatum einschließlich Wochentag an

#### Scenario: Jährliche Tour behält ihren ursprünglichen Jahrestag

- **WHEN** eine jährliche Tour bereits vor dem Quelljahr begonnen hat
- **THEN** verwendet das System im Folgejahr weiterhin Monat und Tag ihres ursprünglichen Beginns
- **AND** setzt es den Jahrestag nicht auf den Beginn des wirksamen Quelljahrausschnitts

#### Scenario: Kalenderdatum existiert im Folgejahr nicht

- **WHEN** ein zu übertragender Monat und Tag wie der 29. Februar im Folgejahr nicht existiert
- **THEN** trifft das System keine stille Ersatzentscheidung
- **AND** verlangt es ein konkretes Ersatzdatum im Folgejahr für die betroffene Quellressource
- **AND** blockiert es die Tour bis zu einer gültigen Auswahl oder Abwahl

#### Scenario: Mehrere Quellen kollidieren auf derselben Zielbeziehung

- **WHEN** unterschiedliche Quelltermine oder Verschiebungen auf dieselbe fachliche Zielbeziehung abgebildet würden
- **THEN** führt das System sie nicht stillschweigend zusammen
- **AND** verlangt es eine eindeutige Ersatzentscheidung oder die Abwahl der betroffenen Tour

#### Scenario: Ersatzdatum darf nur einen gemeldeten Konflikt auflösen

- **WHEN** ein Client ein Ersatzdatum für eine unbekannte, doppelte oder ohne Ersatz abbildbare Quellressource sendet
- **THEN** lehnt der Server die Vorschau als `replacement_date_invalid` ab
- **AND** verändert er die deterministische Folgejahrabbildung nicht

### Requirement: Waste-Management bindet die Bestätigung an eine unveränderte Vorschau

Das System SHALL vor der Erstellung serverseitig eine schreibfreie Vorschau mit einem kanonischen fachlichen Fingerprint erzeugen und SHALL ausschließlich den unverändert erneut berechneten Vorschaustand schreiben.

#### Scenario: Vorschau erklärt den vollständigen Jahreswechsel

- **WHEN** eine gültige Quelljahrauswahl vorliegt
- **THEN** zeigt das System je Tour Klassifikation, Quell- und Zielzeitraum, ersten Zieltermin, Turnus sowie die Anzahl der Abfallarten, Abholorte, Termine, Einsätze und Verschiebungen
- **AND** fasst es übernommene, bereits weitergeltende, blockierte und ausgeschlossene Daten verständlich zusammen
- **AND** verändert die Vorschau keine Waste-Daten

#### Scenario: Quellplanung ändert sich nach der Vorschau

- **WHEN** sich eine kopierrelevante Tour, Beziehung oder Ersatzdatumsentscheidung zwischen Vorschau und Bestätigung ändert
- **THEN** lehnt das System die Erstellung mit `preview_stale` ohne Schreibzugriff ab
- **AND** liefert es eine aktualisierte Vorschau
- **AND** verlangt es eine erneute ausdrückliche Bestätigung

#### Scenario: Batch überschreitet ein serverseitiges Limit

- **WHEN** die Anzahl von 1.000 Touren oder insgesamt 100.000 zu kopierenden Beziehungen überschritten wird
- **THEN** lehnen Vorschau und Erstellung den Vorgang konsistent mit `batch_limit_exceeded` ab
- **AND** nennen sie den überschrittenen Grenzwert ohne Teilverarbeitung

### Requirement: Waste-Management behandelt Zielkonflikte nachvollziehbar

Das System SHALL stabile fachliche Zielidentitäten und mögliche inhaltliche Überschneidungen unterscheiden. Es SHALL keine bestehende Tour automatisch ersetzen, verändern oder löschen.

#### Scenario: Vorhandene stabile Zielidentität entspricht dem Ergebnis

- **WHEN** die aus Instanz, Quelltour und Folgejahr stabil abgeleitete Zieltour bereits mit vollständig identischem fachlichem Inhalt existiert
- **THEN** behandelt das System sie als vorhandenes idempotentes Ergebnis
- **AND** erzeugt es keine weitere Tour oder Beziehung

#### Scenario: Vorhandene stabile Zielidentität weicht ab

- **WHEN** die stabil abgeleitete Zieltour oder eine ihrer stabil abgeleiteten Beziehungen mit abweichendem fachlichem Inhalt existiert
- **THEN** lehnt das System die gesamte Erstellung mit `target_identity_conflict` ohne Änderung ab
- **AND** überschreibt es keine vorhandenen Daten

#### Scenario: Andere Tour besitzt eine möglicherweise parallele Planung

- **WHEN** eine andere bestehende Tour identische Abfallarten und Abholorte, denselben effektiven Tagesabstand, einen überschneidenden Zielzeitraum und mindestens einen gemeinsamen Termin besitzt
- **THEN** zeigt das System einen möglichen fachlichen Konflikt mit den ausschlaggebenden Merkmalen
- **AND** wählt es die Quelltour zunächst ab
- **AND** erlaubt es die Übernahme nur nach ausdrücklicher Kenntnisnahme, weil parallele Einsätze zulässig sein können

#### Scenario: Neuer Konflikt entsteht vor der Bestätigung

- **WHEN** nach der Vorschau und vor dem Schreiben ein neuer stabiler oder möglicher Zielkonflikt entsteht
- **THEN** legt das System keine Tour und keine Beziehung an
- **AND** liefert es eine aktualisierte Vorschau zur erneuten Bestätigung

### Requirement: Waste-Management legt den bestätigten Tourensatz atomar und idempotent inaktiv an

Das System SHALL den ausdrücklich bestätigten Tourensatz einschließlich aller Beziehungen unter einer mandanten- und folgejahrbezogenen Sperre in einer Waste-Datenbanktransaktion mit `active = false` anlegen. Wiederholungen SHALL fachlich auf dieselben stabilen Zielressourcen konvergieren.

#### Scenario: Bestätigter Tourensatz wird vollständig angelegt

- **WHEN** ein berechtigter Benutzer einen gültigen und unveränderten Vorschaustand ausdrücklich bestätigt
- **THEN** sperrt der Server den Jahreswechsel für Mandant und Folgejahr
- **AND** prüft er Quellbestand, Fingerprint und Konflikte innerhalb derselben Transaktion erneut
- **AND** legt er alle bestätigten Touren und Beziehungen gemeinsam inaktiv an
- **AND** lässt er den Quellbestand unverändert
- **AND** gibt er die IDs, eine verständliche Ergebnissumme und ein Ziel zur gefilterten Tourenliste zurück

#### Scenario: Fehler rollt den gesamten Satz zurück

- **WHEN** das Prüfen oder Anlegen einer Tour oder Beziehung fehlschlägt
- **THEN** rollt das System die vollständige Waste-Datenbanktransaktion zurück
- **AND** bleibt kein Teilergebnis des bestätigten Satzes bestehen

#### Scenario: Identischer Request wird idempotent wiederholt

- **WHEN** derselbe mandantenbezogene Idempotenzschlüssel mit derselben fachlichen Payload erneut übermittelt wird
- **THEN** gibt das System dasselbe fachliche Ergebnis zurück
- **AND** erzeugt es keine weiteren Touren oder Beziehungen
- **AND** lehnt es denselben Schlüssel mit einer abweichenden Payload als Konflikt ab

#### Scenario: Identischer Request wird während der Verarbeitung erneut gesendet

- **WHEN** derselbe Idempotenzschlüssel mit derselben Payload noch verarbeitet wird
- **THEN** antwortet das System mit `idempotency_in_progress`
- **AND** startet es keine zweite Waste-Transaktion
- **AND** erzeugt es kein zusätzliches Audit-Ereignis

#### Scenario: Prozess endet nach dem Waste-Commit

- **WHEN** die Waste-Transaktion erfolgreich committet und der Prozess vor Abschluss des zentralen Idempotenzeintrags endet
- **THEN** rekonstruiert eine Wiederholung das Ergebnis anhand der stabilen Ziel- und Beziehungs-IDs
- **AND** behandelt sie vollständig identische Daten als Replay
- **AND** behandelt sie fehlende Daten als erneut atomar ausführbar und abweichende Daten als `target_identity_conflict`

### Requirement: Folgejahrübernahme schützt Berechtigungen, Auditdaten und barrierefreie Bedienung

Das System SHALL Vorschau und Erstellung gemäß den Waste-Berechtigungen schützen, die bestätigte Erstellung datensparsam auditieren und den gesamten Assistenten barrierefrei sowie ohne interne technische Begriffe erklären.

#### Scenario: Fehlende Berechtigung verhindert den Vorgang

- **WHEN** ein Benutzer nicht über `waste-management.tours.manage` und `waste-management.scheduling.manage` verfügt
- **THEN** verweigert das System Vorschau und Erstellung
- **AND** verändert es keine Waste-Daten

#### Scenario: Batch-Ergebnis wird revisionsfähig auditiert

- **WHEN** die bestätigte Erstellung erfolgreich ist oder fehlschlägt
- **THEN** erzeugt das System genau ein zusammenfassendes Audit-Ereignis mit Jahren, Klassifikations- und Ergebnismengen, Ergebnis und technischen Ressourcen-IDs
- **AND** protokolliert es keine Notizen, Adressdaten oder fachlichen Freitexte
- **AND** erzeugen Vorschau und reine Validierungsfehler vor einer bestätigten Mutation kein Audit-Ereignis

#### Scenario: Assistent ist verständlich und barrierefrei bedienbar

- **WHEN** ein Benutzer den Assistenten per Tastatur oder Screenreader bedient
- **THEN** sind Schritte, Tourgruppen, Auswahl, Ersatzdatumseingaben, Vorschau, Konflikte, Bestätigung und Fehlermeldungen vollständig erreichbar und beschriftet
- **AND** werden Status oder Konflikte nicht ausschließlich durch Farbe vermittelt
- **AND** erklären die Texte das unveränderliche Folgejahr und alle Ausschlussgründe ohne interne technische Begriffe

#### Scenario: Veraltete Vorschau wird zugänglich aktualisiert

- **WHEN** die Erstellung mit `preview_stale` abgelehnt wird
- **THEN** bleiben Quelljahrauswahl und gültige Ersatzdaten erhalten
- **AND** setzt das System den Fokus auf die aktualisierte verständliche Zusammenfassung
- **AND** verlangt es vor einem neuen Schreibversuch eine erneute Bestätigung
