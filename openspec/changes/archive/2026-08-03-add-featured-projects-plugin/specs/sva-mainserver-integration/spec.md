## ADDED Requirements

### Requirement: Mainserver-Inhalte besitzen eine wiederverwendbare hostseitige Referenz

Das System MUST einen lokalen Content-Core-Datensatz über eine allgemeine External-Content-Referenz eindeutig mit seiner Mainserver-Entität verbinden. Die Referenz MUST mindestens Instanz, Quellsystem, Quellentitätstyp, externe Entitäts-ID und Reconciliation-Status führen. Sie darf weder projektspezifisch modelliert sein noch eine zweite Idempotenz- oder History-Persistenz einführen.

#### Scenario: Projekt-Create wird erfolgreich gebunden

- **WHEN** der Mainserver ein mit stabiler `externalId` angelegtes Projekt bestätigt
- **THEN** bindet der Host genau einen lokalen Content-Core-Datensatz an genau diese Mainserver-ID
- **AND** finalisiert er Idempotenz und Reconciliation-Status ohne doppelte Referenz

#### Scenario: Providerantwort geht nach erfolgreichem Create verloren

- **WHEN** das Create-Ergebnis unbekannt bleibt, obwohl der Mainserver den Datensatz möglicherweise angelegt hat
- **THEN** markiert der Host die Referenz als `reconciliation_required`
- **AND** sucht der Repair-Pfad über die stabile `externalId`, bevor er eine erneute Anlage zulässt

#### Scenario: Spiegelwerte weichen vom lokalen Core ab

- **WHEN** `payload.status`, `visible`, `publishedAt` oder `author` von den host-owned Metadaten abweichen
- **THEN** bleibt der lokale Core für Lifecycle, Veröffentlichung und Autorenschaft führend
- **AND** meldet oder repariert der Host die Abweichung über den Reconciliation-Vertrag
- **AND** überschreibt er fachliche Mainserver-Felder nicht als Nebenwirkung

### Requirement: Mainserver-Zugriffe grenzen Featured Projects als eigenen GenericItem-Typ ab

Das System MUST Projekte-Routen auf GenericItems mit `genericType` gleich `PROJECT` begrenzen und diese Datensätze als `projects.project` projizieren. Listen MUST vollständig nach dem technischen Diskriminator und dem internen Löschstatus filtern, bevor lokale Pagination angewendet wird.

#### Scenario: Projekte-Liste wird aus gemischten GenericItems erzeugt

- **GIVEN** die Upstream-Seiten enthalten Projekte, gelöschte Projekte und andere GenericItem-Typen
- **WHEN** der Host die Projekte-Liste erzeugt
- **THEN** liest er alle Upstream-Seiten bis zum nachgewiesenen Ende
- **AND** gibt ausschließlich aktive Datensätze mit `genericType` gleich `PROJECT` zurück
- **AND** wendet erst danach die lokale Pagination an

#### Scenario: Fremdtyp wird über Projekte-Endpunkt adressiert

- **WHEN** eine ID eines anderen GenericItem-Typs über einen Projekte-Detail- oder Mutationspfad adressiert wird
- **THEN** antwortet der Host wie bei einer unbekannten Projekt-ID
- **AND** führt keine Mutation aus

### Requirement: Mainserver-Adapter bildet FeaturedProject-Felder verlustfrei ab

Das System MUST die kontrollierten FeaturedProject-Felder auf die festgelegten GenericItem-Felder abbilden und bei Studio-Updates alle fachfremden, unmittelbar zuvor gelesenen Felder erhalten. Der Adapter MUST den host-owned Status nach `payload.status` spiegeln sowie `visible` und `publishedAt` daraus ableiten; der Payload-Wert darf nicht zur unabhängigen Lifecycle-Quelle werden. Bildpositionen MUST aus der stabilen `mediaContents`-Reihenfolge abgeleitet werden; `sourceUrl.description` MUST im Projekte-Vertrag als Alternativtext behandelt werden.

#### Scenario: Sichtbare Projektfelder werden aktualisiert

- **GIVEN** ein bestehendes Projekt enthält sichtbare und verborgene GenericItem-Werte
- **WHEN** der Host eine gültige Projekte-Aktualisierung verarbeitet
- **THEN** ersetzt er ausschließlich die vom FeaturedProject-Vertrag kontrollierten Werte
- **AND** erhält alle übrigen GenericItem-Felder und unbekannten Payload-Schlüssel

#### Scenario: Bilder werden über den Projekte-Vertrag gelesen

- **WHEN** der Host die `mediaContents` eines Projekts in den FeaturedProject-Vertrag überführt
- **THEN** bildet er URL, Alternativtext, Bildunterschrift und Credits auf die vereinbarten Bildfelder ab
- **AND** erzeugt er die Position aus der Reihenfolge

#### Scenario: Abgeleitetes Veröffentlichungsfeld wird nicht als Eingabe akzeptiert

- **WHEN** eine Projekte-Mutation das nur lesbare Feld `Published` enthält
- **THEN** weist der Host die Mutation vor dem Mainserver-Aufruf ab
- **AND** leitet er `visible`, `publishedAt` und das ausgegebene Feld `Published` ausschließlich aus dem host-owned Lifecycle ab

