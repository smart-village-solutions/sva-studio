## MODIFIED Requirements

### Requirement: Mainserver-Zugriffe grenzen Featured Projects als eigenen GenericItem-Typ ab

Das System MUST Projekte-Routen auf GenericItems mit `genericType` gleich `FeaturedProject` begrenzen und diese Datensätze als `projects.project` projizieren. Listen MUST vollständig nach dem technischen Diskriminator und dem internen Löschstatus filtern, bevor lokale Pagination angewendet wird. Der frühere Diskriminator `PROJECT` MUST ohne Übergangs- oder Fallback-Verhalten als Fremdtyp gelten.

#### Scenario: Projekte-Liste wird aus gemischten GenericItems erzeugt

- **GIVEN** die Upstream-Seiten enthalten Projekte, gelöschte Projekte und andere GenericItem-Typen
- **WHEN** der Host die Projekte-Liste erzeugt
- **THEN** liest er alle Upstream-Seiten bis zum nachgewiesenen Ende
- **AND** gibt ausschließlich aktive Datensätze mit `genericType` gleich `FeaturedProject` zurück
- **AND** wendet erst danach die lokale Pagination an

#### Scenario: Fremdtyp wird über Projekte-Endpunkt adressiert

- **WHEN** eine ID eines anderen GenericItem-Typs einschließlich `PROJECT` über einen Projekte-Detail- oder Mutationspfad adressiert wird
- **THEN** antwortet der Host wie bei einer unbekannten Projekt-ID
- **AND** führt keine Mutation aus
