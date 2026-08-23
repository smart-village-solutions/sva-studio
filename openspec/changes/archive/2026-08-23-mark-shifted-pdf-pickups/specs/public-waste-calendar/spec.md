## ADDED Requirements

### Requirement: PDF kennzeichnet Ausweichtermine eindeutig

Das System SHALL jeden PDF-Abholungstermin, dessen wirksames Datum vom regulären Ursprungsdatum abweicht, sichtbar als Ausweichtermin kennzeichnen.

#### Scenario: Manuell verschobener Termin erhält einen Asterisk

- **WHEN** eine Tour- oder globale Datumsverschiebung einen regulären Abholungstermin auf ein anderes Datum verlegt
- **THEN** zeigt das PDF unmittelbar rechts neben der farbigen Fraktionsbox einen roten, fetten Asterisk
- **AND** der Asterisk liegt außerhalb der farbigen Box
- **AND** nachfolgende Fraktionsboxen überlappen den Asterisk nicht
- **AND** erklärt eine eigene Legendenzeile den Asterisk mit `* = Ausweichtermin`

#### Scenario: Feiertagsregel erzeugt einen Ausweichtermin

- **WHEN** eine Feiertagsregel das wirksame Datum eines regulären Abholungstermins verändert
- **THEN** kennzeichnet das PDF den betroffenen Abholungseintrag ebenfalls mit einem roten, fetten Asterisk

#### Scenario: Regulärer Termin bleibt unmarkiert

- **WHEN** das wirksame Datum eines Abholungstermins seinem regulären Ursprungsdatum entspricht
- **THEN** zeigt das PDF an diesem Abholungseintrag keinen Asterisk
