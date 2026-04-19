## Kontext

Mit mehr Plugin-Beiträgen steigt die Gefahr, dass neue Erweiterungspunkte ohne klare Reihenfolge eingeführt werden. Der Host benötigt daher einen expliziten Lifecycle für Build-time-Registrierungen.

## Entscheidungen

### 1. Registrierungen erfolgen in benannten Phasen

Plugin-Beiträge werden entlang klarer Phasen wie Inhalt, Admin, Routing, Audit und Suche materialisiert.

### 2. Phasen definieren Reihenfolge und Verantwortungsgrenzen

Die Materialisierung folgt einer lesbaren Reihenfolge zwischen SDK, Host-Projektion und finaler App-Integration.

### 3. Phasenfremde Beiträge sind nicht Teil des Vertrags

Neue Erweiterungspunkte werden nur über definierte Phasen eingeführt, nicht als ad hoc Sonderpfade.
