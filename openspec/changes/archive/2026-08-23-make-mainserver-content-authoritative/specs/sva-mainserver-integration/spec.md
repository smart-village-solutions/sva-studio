## ADDED Requirements

### Requirement: Mainserver ist die fachliche Wahrheit für Mainserver-basierte Content Items

Das System MUST Existenz, Identität, fachliche Felder, Lifecycle, Veröffentlichung, Autor und Ownership eines Mainserver-basierten Content Items ausschließlich aus dem bestätigten typisierten Mainserver-Vertrag ableiten. Lokale Content-Cores, External-Content-References, History- und Listenprojektionen MUST optional und vollständig rekonstruierbar bleiben und dürfen Sichtbarkeit, Detailzugriff oder reguläre Bearbeitung eines autorisierten Mainserver-Inhalts nicht voraussetzen.

#### Scenario: Inhalt wurde außerhalb des Studios erzeugt

- **GIVEN** ein autorisierter API-Client hat einen gültigen Mainserver-Inhalt angelegt
- **AND** im Studio existieren weder Content-Core noch External-Content-Reference oder History
- **WHEN** ein Benutzer mit der typspezifischen Read-Action die Fachliste oder den Detailpfad öffnet
- **THEN** zeigt das Studio den Inhalt aus dem typisierten Mainserver-Vertrag an
- **AND** erzeugt keine fachlichen Ersatzwerte aus lokalen Tabellen

#### Scenario: Lokaler Cache fehlt oder ist veraltet

- **GIVEN** ein Mainserver-Inhalt existiert und der lokale Projektionszustand fehlt oder ist veraltet
- **WHEN** die typisierte Quelle oder vollständige Reconciliation den Datensatz liefert
- **THEN** bleibt der Mainserver-Datensatz fachlich führend
- **AND** kann die lokale Projektion ohne fachliche Datenmigration neu aufgebaut werden

### Requirement: IAM autorisiert Mainserver-Content-Aktionen ohne lokale fachliche Ownership

Das System MUST Studio-IAM-Actions weiterhin vor Listen-, Detail- und Mutationszugriffen prüfen. IAM MUST dabei die erlaubte Aktion und den effektiven Organisations- oder Benutzerkontext bestimmen, darf aber weder die fachliche Existenz noch Status, Autor, Veröffentlichung oder Ownership eines Mainserver-Inhalts aus einem lokalen Content-Core ableiten.

#### Scenario: Read-Action ist vorhanden und lokaler Core fehlt

- **GIVEN** ein Mainserver-Inhalt existiert ohne lokalen Content-Core
- **AND** der Benutzer besitzt die typspezifische Read-Action im effektiven Credential-Kontext
- **WHEN** der Benutzer den Inhalt liest
- **THEN** erlaubt das Studio den typisierten Mainserver-Zugriff
- **AND** verlangt keinen lokalen Owner-Scope als zusätzliche Existenzbedingung

### Requirement: Lokale Folgefehler ändern bestätigte Mainserver-Mutationen nicht

Das System MUST eine vom Mainserver bestätigte Content-Mutation als fachlich erfolgreich behandeln. Nachgelagerte Fehler beim Schreiben von Reference, History oder Projektion MUST beobachtbar und reconciliation-fähig sein, dürfen aber weder einen Provider-Rollback vortäuschen noch dem Client einen fachlichen Mutationsfehler melden.

#### Scenario: Externes Projekt wird ohne lokalen Core aktualisiert

- **GIVEN** ein gültiges `FeaturedProject` existiert ausschließlich im Mainserver
- **AND** der Benutzer besitzt `projects.update`
- **WHEN** der Mainserver das Update bestätigt
- **THEN** antwortet der Projekte-Endpunkt erfolgreich mit dem Mainserver-Zustand
- **AND** ein fehlender oder fehlschlagender lokaler Begleitzustand ändert diesen Erfolg nicht

## MODIFIED Requirements

### Requirement: Mainserver-Inhalte besitzen eine wiederverwendbare hostseitige Referenz

Das System MUST für Studio-initiierte Mutationen eine allgemeine External-Content-Referenz verwenden können, um Idempotenz, Studio-History und lokale Folgearbeit mit einer Mainserver-Entität zu korrelieren. Die Referenz MUST mindestens Instanz, Quellsystem, Quellentitätstyp, externe Entitäts-ID und Reconciliation-Status führen. Sie MUST optional bleiben und darf weder für Read-Pfade noch als fachliche Existenz-, Lifecycle-, Veröffentlichungs-, Autoren- oder Ownership-Quelle verwendet werden.

#### Scenario: Projekt-Create wird erfolgreich gebunden

- **WHEN** der Mainserver ein mit stabiler `externalId` angelegtes Projekt bestätigt
- **THEN** kann der Host die Studio-Mutation idempotent an die Mainserver-ID binden
- **AND** bleibt die Mainserver-ID auch ohne erfolgreiche lokale Bindung fachlich lesbar

#### Scenario: Providerantwort geht nach erfolgreichem Create verloren

- **WHEN** das Create-Ergebnis unbekannt bleibt, obwohl der Mainserver den Datensatz möglicherweise angelegt hat
- **THEN** markiert der Host vorhandene lokale Folgearbeit als `reconciliation_required`
- **AND** sucht der Repair-Pfad über die stabile `externalId`, bevor er eine erneute Anlage zulässt

#### Scenario: Mainserverwerte weichen vom lokalen Begleitzustand ab

- **WHEN** Status, Veröffentlichung, Autor oder Ownership im Mainserver von lokalen Cache- oder History-Metadaten abweichen
- **THEN** bleiben die Mainserverwerte fachlich führend
- **AND** repariert oder verwirft Reconciliation den lokalen Begleitzustand ohne fachliche Mainserver-Felder zu überschreiben

### Requirement: Mainserver-Zugriffe grenzen Featured Projects als eigenen GenericItem-Typ ab

Das System MUST Projekte-Routen auf GenericItems mit `genericType` gleich `FeaturedProject` begrenzen und diese Datensätze als `projects.project` projizieren. Listen MUST vollständig nach dem technischen Diskriminator und dem internen Löschstatus filtern, bevor lokale Pagination angewendet wird. Sie MUST auch Datensätze ohne lokalen Content-Core oder External-Content-Reference zurückgeben. Der frühere Diskriminator `PROJECT` MUST ohne Übergangs- oder Fallback-Verhalten als Fremdtyp gelten.

#### Scenario: Projekte-Liste wird aus gemischten GenericItems erzeugt

- **GIVEN** die Upstream-Seiten enthalten Projekte, gelöschte Projekte und andere GenericItem-Typen
- **WHEN** der Host die Projekte-Liste erzeugt
- **THEN** liest er alle Upstream-Seiten bis zum nachgewiesenen Ende
- **AND** gibt ausschließlich aktive Datensätze mit `genericType` gleich `FeaturedProject` zurück
- **AND** verlangt keine lokale Reference oder keinen lokalen Content-Core
- **AND** wendet erst danach die lokale Pagination an

#### Scenario: Fremdtyp wird über Projekte-Endpunkt adressiert

- **WHEN** eine Mainserver-ID eines anderen GenericItem-Typs einschließlich `PROJECT` über einen Projekte-Detail- oder Mutationspfad adressiert wird
- **THEN** antwortet der Host wie bei einer unbekannten Projekt-ID
- **AND** führt keine Mutation aus
