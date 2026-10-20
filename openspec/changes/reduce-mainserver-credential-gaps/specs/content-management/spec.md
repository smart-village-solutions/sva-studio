## ADDED Requirements

### Requirement: Inhaltsübersichten versuchen stille Wiederherstellung und erklären verbleibende Zugangsfehler

Das System SHALL einen geeigneten Credential-Fehler zunächst über den begrenzten stillen Wiederherstellungsversuch behandeln, ohne eine Verwaltungsaktion des Benutzers vorauszusetzen. Währenddessen SHALL ein zugänglicher neutraler Aktualisierungsstatus genügen. Ist Wiederherstellung nicht zulässig, nicht möglich oder fehlgeschlagen oder bleibt der Inhaltsabruf fehlerhaft, SHALL die bestehende Status-/Fehlerfläche die betroffene Funktion und Quelle, verständliche Ursache, Datenstand und das Ergebnis des automatischen Versuchs präzise anzeigen. Technische Codes SHALL die verständliche Erklärung nicht ersetzen.

Bei fehlendem ersten Snapshot SHALL die Oberfläche fehlende Ladbarkeit statt fachlicher Inhaltsleere melden. Ältere autorisierte Snapshots SHALL mit letztem erfolgreichen Aktualisierungszeitpunkt erhalten bleiben; gemischte Übersichten SHALL fehlende Typen und unvollständige Mengen ausdrücklich ausweisen. Texte und Statusdarstellung SHALL vorhandene Komponenten, de/en-Übersetzungen und zugängliche Meldungen verwenden.

#### Scenario: Stille Wiederherstellung gelingt

- **GIVEN** ein geeigneter Credential-Fehler betrifft die aktuelle Inhaltsübersicht
- **WHEN** Wiederherstellung, einmaliger erneuter Abruf und Read erfolgreich sind
- **THEN** zeigt Studio die aktuellen autorisierten Inhalte ohne erforderlichen Nutzereingriff
- **AND** bleibt keine Supportfehlermeldung für den behobenen Versuch stehen

#### Scenario: Erstabgleich bleibt ohne Snapshot blockiert

- **GIVEN** Nachrichten konnten nach ausgeschöpfter oder nicht möglicher Wiederherstellung nicht synchronisiert werden
- **WHEN** die Nachrichtenübersicht angezeigt wird
- **THEN** erklärt sie die fehlende Ladbarkeit und das Ergebnis des automatischen Versuchs
- **AND** stellt sie den Zustand nicht als „keine Nachrichten vorhanden“ dar

#### Scenario: Teilmenge bleibt verfügbar

- **GIVEN** ein älterer Snapshot oder andere angefragte Inhaltstypen sind autorisiert verfügbar
- **WHEN** der betroffene Typ auch nach dem Versuch nicht aktuell geladen werden kann
- **THEN** bleiben die verfügbaren Inhalte nutzbar
- **AND** zeigt die Oberfläche Alter beziehungsweise Unvollständigkeit ohne eine vollständige Gesamtmenge vorzutäuschen

### Requirement: Nicht behobene Inhaltsfehler liefern einen präzisen kopierbaren Supporttext

Das System SHALL bei nicht möglicher oder fehlgeschlagener Wiederherstellung und jedem verbleibenden Inhaltsfehler einen kopierbaren Diagnoseblock anbieten und den Benutzer bitten, diesen an `support@smart-village.solutions` zu senden. Der Block SHALL ausschließlich Instanzkennung, Funktion/Inhaltstyp, Zeitpunkt mit Zeitzone, stabilen Fehler-/Ursachencode, ursprüngliche Request-ID, soweit vorhanden korrelierte Recovery-Request-ID sowie Ergebnis und Phase des automatischen Versuchs enthalten. Fehlende Diagnosewerte SHALL nicht erfunden werden.

Das System SHALL Credentialwerte, Tokens, Fingerprints, Account-/Subject-IDs, persönliche E-Mail-Adressen, vollständige Benutzeridentitäten, Stacktraces und Provider-Rohantworten ausschließen. Es SHALL eine zugängliche Kopierfunktion mit selektierbarem Text als Fallback bereitstellen und SHALL weder automatisch E-Mails versenden noch Diagnoseinformationen hochladen. Die Meldung SHALL ohne Verwaltungsrecht nutzbar sein.

#### Scenario: Bekannte Version kann nicht nachgewiesen werden

- **GIVEN** die Organisationsrücksicherung ist wegen fehlender eindeutiger Verifikation nicht zulässig
- **WHEN** die Oberfläche den endgültigen Fehler darstellt
- **THEN** enthält der Supporttext Funktion, Quelle über den sicheren Code, Zeit, Request-Korrelation und den nicht ausgeführten Recovery-Schritt
- **AND** benennt die verständliche Meldung `support@smart-village.solutions` als Empfänger

#### Scenario: Rücksicherung war erfolgreich und Inhalte bleiben nicht ladbar

- **GIVEN** die bekannte Version wurde zurückgesichert und der erneute Inhaltsabruf schlägt fehl
- **WHEN** der Diagnoseblock kopiert wird
- **THEN** unterscheidet er Rücksicherungserfolg und verbliebenen Inhaltsfehler
- **AND** enthält er keine Credentialwerte, Fingerprints oder personenbezogenen Rohdaten

#### Scenario: Clipboard steht nicht zur Verfügung

- **WHEN** die Kopierfunktion nicht verfügbar ist oder fehlschlägt
- **THEN** bleibt der Diagnoseblock als selektierbarer Text zugänglich
- **AND** erfolgt weder automatischer Versand noch Upload
