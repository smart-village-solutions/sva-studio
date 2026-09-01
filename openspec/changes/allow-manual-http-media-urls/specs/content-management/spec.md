## ADDED Requirements

### Requirement: Manuelle Bild-URLs bevorzugen HTTPS und kennzeichnen HTTP

Das System MUST manuell eingegebene Bild-URLs nach abgeschlossener Eingabe im gemeinsamen Bildblock normalisieren, HTTPS bevorzugen und ausdrücklich eingegebene persistierbare HTTP-URLs als nicht blockierenden Warnzustand behandeln. Diese Ausnahme MUST auf manuelle Content-Verwendungen begrenzt bleiben und darf den HTTPS-only-Vertrag für Medienbibliotheksassets nicht lockern.

#### Scenario: Gültige HTTPS-Bild-URL wird übernommen

- **WENN** ein Redakteur eine gültige, dauerhaft persistierbare HTTPS-Bild-URL manuell eingibt und die Eingabe abschließt
- **DANN** entfernt das Studio führende und nachgestellte Leerzeichen
- **UND** übernimmt es die HTTPS-URL ohne Sicherheitswarnung
- **UND** entfernt es einen zuvor für dieses Feld angezeigten URL-Fehler unmittelbar

#### Scenario: Protokollfreie Bildadresse besitzt eine funktionierende HTTPS-Variante

- **WENN** ein Redakteur eine plausible absolute Bildadresse ohne Protokoll manuell eingibt und die Eingabe abschließt
- **UND** die um `https://` ergänzte Variante über den Browser-Bildpfad geladen werden kann
- **DANN** übernimmt das Studio die HTTPS-URL
- **UND** meldet es die Aktualisierung verständlich und zugänglich

#### Scenario: Explizite HTTP-Bildadresse kann auf HTTPS aktualisiert werden

- **WENN** ein Redakteur eine persistierbare `http://`-Bildadresse manuell eingibt und die Eingabe abschließt
- **UND** die entsprechende HTTPS-Variante über den Browser-Bildpfad geladen werden kann
- **DANN** ersetzt das Studio die Eingabe durch die HTTPS-Variante
- **UND** meldet es die Aktualisierung verständlich und zugänglich

#### Scenario: Explizite HTTP-Bildadresse besitzt keine nachweisbar funktionierende HTTPS-Variante

- **WENN** ein Redakteur eine persistierbare `http://`-Bildadresse manuell eingibt und die Eingabe abschließt
- **UND** die entsprechende HTTPS-Variante über den Browser-Bildpfad nicht geladen werden kann
- **DANN** bleibt die getrimmte HTTP-URL speicherbar
- **UND** zeigt das Studio direkt am Feld eine sichtbare und semantisch zugeordnete Warnung zur unsicheren Übertragung und möglichen Mixed-Content-Blockierung
- **UND** blockiert die Warnung das Speichern nicht

#### Scenario: Protokollfreie Bildadresse kann nicht über HTTPS geladen werden

- **WENN** ein Redakteur eine Bildadresse ohne Protokoll manuell eingibt und die Eingabe abschließt
- **UND** die ergänzte HTTPS-Variante nicht als Bild geladen werden kann
- **DANN** fällt das Studio nicht still auf HTTP zurück
- **UND** bleibt die Eingabe als nicht speicherbar gekennzeichnet

#### Scenario: Manuelle URL enthält nicht persistierbare Bestandteile

- **WENN** eine manuell eingegebene HTTP- oder HTTPS-URL Zugangsdaten oder bekannte signierte beziehungsweise kurzlebige Query-Parameter enthält
- **DANN** lehnt das Studio die URL weiterhin als nicht speicherbar ab
- **UND** übernimmt es weder die ursprüngliche noch eine normalisierte Variante

#### Scenario: Medienbibliotheksasset liefert keine dauerhafte HTTPS-URL

- **WENN** ein Medienbibliotheksasset nur eine HTTP-, signierte, kurzlebige oder anderweitig ungeeignete Auslieferungs-URL besitzt
- **DANN** bleibt das Asset für den Content-Snapshot nicht auswählbar
- **UND** wird die Ausnahme für manuelle Bild-URLs nicht auf das Asset angewendet
