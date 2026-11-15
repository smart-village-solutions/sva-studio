## ADDED Requirements

### Requirement: Fraktionslöschung bietet ausschließlich anwendbare Varianten mit Vorschau

Das System SHALL vor dem Löschen einer einzelnen Abfallfraktion die Auswirkungen der explizit gewählten Variante serverseitig anzeigen. Es SHALL das Erhalten der Touren nur anbieten, wenn nach Entfernung der Quelle jede betroffene Tour noch mindestens eine andere Fraktion besitzt. Es SHALL alternativ vollständige Tourlöschung oder Ersetzung durch eine andere aktive Fraktion desselben Tenants anbieten, ohne destruktive Vorauswahl.

#### Scenario: Alle betroffenen Touren behalten weitere Fraktionen

- **GIVEN** jede der Quelle zugeordnete Tour besitzt mindestens eine weitere Fraktion
- **WHEN** der berechtigte Benutzer die Löschvorschau öffnet
- **THEN** ist „Touren erhalten und Fraktion entfernen“ verfügbar
- **AND** diese Variante entfernt nur die Quelle und ihre Fraktionszuordnungen, während Touren und Termine erhalten bleiben

#### Scenario: Eine Tour würde fraktionslos

- **GIVEN** mindestens eine betroffene Tour besitzt ausschließlich die Quellfraktion
- **WHEN** die Löschvorschau angezeigt wird
- **THEN** wird „Touren erhalten und Fraktion entfernen“ gar nicht angeboten
- **AND** der Server weist eine dennoch angeforderte Ausführung dieser Variante ohne Mutation zurück

#### Scenario: Die Quelle ist unbenutzt

- **WHEN** keine Tour die Quelle verwendet
- **THEN** kann sie nach einer einfachen Auswirkungsvorschau gelöscht werden
- **AND** es werden keine künstlichen Tourentscheidungen verlangt

### Requirement: Bestätigte Tourlöschung entfernt vollständig nur die betroffenen Tourdaten

Das System SHALL bei ausdrücklich bestätigter Tourlöschung alle der Quelle zugeordneten Touren unabhängig von ihrem Status einschließlich abhängiger Zuordnungen, Einsätze, standortbezogener Termine und tourbezogener Verschiebungen sowie die Quellfraktion atomar löschen. Gemeinsam genutzte Touren und die Auswirkungen auf weitere Fraktionen MUST vor Bestätigung hervorgehoben werden.

#### Scenario: Eine gemeinsam genutzte Tour wird ausdrücklich mitgelöscht

- **GIVEN** eine Tour besitzt die Quelle und eine weitere Fraktion
- **WHEN** der Benutzer die vollständige Tourlöschung nach Sichtung der Auswirkungen bestätigt
- **THEN** werden die Tour und ihre abhängigen Daten vollständig gelöscht
- **AND** die weitere Fraktion, andere Touren, Abholorte und globale Regeln bleiben erhalten

### Requirement: Fraktionsersetzung erhält Touren und verhindert neue Dubletten

Das System SHALL die Quelle in allen betroffenen Touren durch die ausgewählte Zielfraktion ersetzen und anschließend löschen, ohne Touren oder Termine neu anzulegen oder zusammenzuführen. Pro Tour MUST die Zielfraktion genau einmal vorkommen. Neu entstehende Abholkollisionen verschiedener Touren am selben Abholort für dieselbe Fraktion und denselben wirksamen Tag MUST vor Ausführung erkannt und ohne Mutation zurückgewiesen werden.

#### Scenario: Die Zielfraktion ist bereits in einer Tour enthalten

- **WHEN** die Quelle durch eine in derselben Tour bereits vorhandene Zielfraktion ersetzt wird
- **THEN** entfällt die Quelle und die vorhandene Zielzuordnung bleibt genau einmal an ihrer bisherigen Position
- **AND** die Reihenfolge der übrigen Fraktionen, Tour-IDs, Termine, Regeln und Hinweise bleibt erhalten

#### Scenario: Die Zielfraktion ist noch nicht in einer Tour enthalten

- **WHEN** die Ersetzung konfliktfrei ausgeführt wird
- **THEN** ersetzt die Zielfraktion die Quelle an deren Position
- **AND** unbetroffene Fraktionszuordnungen und Tourdaten bleiben unverändert

#### Scenario: Eine neue Terminkollision entsteht

- **GIVEN** nach Ersetzung würden verschiedene Touren am selben Abholort dieselbe Zielfraktion am selben wirksamen Tag abholen
- **WHEN** die Vorschau oder die erneute Ausführungsprüfung diese neue Kollision erkennt
- **THEN** werden die betroffenen Touren, Abholorte und Tage als Konflikte angezeigt
- **AND** Quelle, Ziel, Touren und Termine bleiben unverändert
- **AND** es erfolgt keine automatische Zusammenführung oder Löschung von Terminen oder Hinweisen

#### Scenario: Die Prüfung kann den relevanten Gültigkeitsbereich nicht vollständig abdecken

- **WHEN** Konfliktfreiheit nur für ein begrenztes Anzeigefenster nachgewiesen werden kann
- **THEN** wird die Ersetzung mit einem konkreten Hinweis blockiert
- **AND** das System behauptet keine darüber hinausgehende Konfliktfreiheit

### Requirement: Fraktionsmutation bindet Bestätigung und vollständige Ausführung an denselben Bestand

Das System SHALL Vorschau und Ausführung mit bestehender Berechtigung, CSRF-Prüfung und serverseitigem Tenant-Kontext schützen. Die Ausführung MUST Quelle, Variante, Ziel, Auswirkungen und Konflikte unter geeigneter Serialisierung erneut prüfen und vollständig in einer Transaktion erfolgen. Direkte oder mehrfache Löschaufrufe ohne ausdrücklich bestätigte Variante MUST den bisherigen referenziellen Löschschutz behalten.

#### Scenario: Der Bestand hat sich seit der Vorschau geändert

- **WHEN** eine konkurrierende Änderung die bestätigten Auswirkungen oder Konflikte verändert
- **THEN** wird die Mutation zurückgewiesen und eine neue Vorschau verlangt
- **AND** es wird keine zusätzliche Tour stillschweigend gelöscht und kein Teilzustand gespeichert

#### Scenario: Die Ausführung scheitert nach einem Teilschritt

- **WHEN** innerhalb der Mutation eine Validierung oder ein Datenbankzugriff fehlschlägt
- **THEN** wird die gesamte Mutation zurückgerollt
- **AND** Fraktionen, Zuordnungen, Tourdaten und Reminder bleiben auf dem vorherigen Stand

#### Scenario: Quelle oder Ziel gehört nicht zum autorisierten Tenant

- **WHEN** ein Request eine fremde Quelle oder Zielfraktion verwendet
- **THEN** weist das System ihn ohne fremde Datenoffenlegung und ohne Mutation zurück

#### Scenario: Lokale Mutation ist erfolgreich und externer Sync scheitert

- **WHEN** die Mutation committed wurde und der bestehende Mainserver-Sync nicht erfolgreich abgeschlossen wird
- **THEN** bleibt die lokale Mutation erhalten
- **AND** zeigt die Oberfläche die bestehende Sync-Warnung mit Wiederholmöglichkeit
- **AND** behauptet sie keinen abgeschlossenen externen Sync

#### Scenario: Die Quelle besitzt E-Mail-Erinnerungsauswahlen

- **WHEN** die Quelle gelöscht oder ersetzt wird
- **THEN** benennt die Vorschau das Entfernen ihrer Erinnerungsauswahlen
- **AND** werden diese nicht automatisch auf die Zielfraktion übertragen
- **AND** hinterlässt die Mutation keine später auszuliefernden Erinnerungen mit ungültigem Bezug auf gelöschte Fraktionen oder Termine
