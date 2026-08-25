## ADDED Requirements

### Requirement: Worker-Nebenpfade sind korreliert und begrenzt beobachtbar

Das System MUST Fehler unabhängiger Worker-Nebenpfade wie Abbruchabfragen oder Persistenz eines Fehlerzustands mit Job-, Execution- oder vergleichbarer Ausführungskorrelation sichtbar machen. Diese Diagnose MUST den bestehenden fachlichen Kontrollfluss unverändert lassen und wiederholte identische Ereignisse aus pollenden Pfaden pro Ausführung und Fehlerzustand deduplizieren oder begrenzen.

#### Scenario: Abbruchabfrage schlägt während eines Jobs fehl

- **WHEN** die periodische Abbruchabfrage eines laufenden Jobs fehlschlägt
- **THEN** protokolliert der Worker ein strukturiertes sekundäres Ereignis mit Ausführungskorrelation, Operation, stabilem Fehlercode und Folgebehandlung
- **AND** setzt er den bestehenden Hauptkontrollfluss gemäß bisherigem Vertrag fort
- **AND** erzeugt er nicht bei jedem Poll-Zyklus dasselbe Warnereignis unbeschränkt erneut

#### Scenario: Fehlerzustand kann nicht persistiert werden

- **WHEN** der Worker nach einem primären Fehler den vorgesehenen Fehlerzustand nicht persistieren kann
- **THEN** protokolliert er den Persistenzfehler als separates sekundäres Ereignis
- **AND** bleibt das kanonische Ereignis des primären Jobfehlers eindeutig erkennbar

#### Scenario: Nebenpfad erholt sich

- **WHEN** ein zuvor fehlgeschlagener pollender Nebenpfad innerhalb derselben Ausführung wieder erfolgreich ist
- **THEN** darf der Worker genau ein korreliertes Recovery-Ereignis emittieren
- **AND** setzt er die Begrenzung für einen späteren neuen Fehlerzustand kontrolliert zurück
