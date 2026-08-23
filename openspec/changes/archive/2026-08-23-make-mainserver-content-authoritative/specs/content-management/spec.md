## ADDED Requirements

### Requirement: Lokale Content-Projektionen bleiben austauschbare Mainserver-Caches

Das Content-Management MUST lokale Listenprojektionen Mainserver-basierter Inhalte als vollständig rekonstruierbare, account- und credential-scope-isolierte Caches behandeln. Ein fehlender Content-Core, eine fehlende External-Content-Reference oder eine fehlende Studio-History darf einen vom Mainserver gelieferten und durch IAM autorisierten Inhalt nicht dauerhaft aus der Fachliste oder Detailansicht entfernen.

#### Scenario: Vollständige Reconciliation entdeckt externen Inhalt

- **GIVEN** ein Inhalt wurde außerhalb des Studios im Mainserver angelegt
- **WHEN** die vollständige typisierte Reconciliation den Inhalt liest
- **THEN** materialisiert oder aktualisiert sie dessen lokale Listenprojektion
- **AND** erfindet keinen lokalen fachlichen Lifecycle, Autor oder Owner

### Requirement: History beschreibt ausschließlich beobachtete Studio-Mutationen

Das Content-Management MUST Mainserver-Inhalte auch ohne lokale History anzeigen und bearbeiten können. Die History-API MUST ihre Abdeckung als `coverage = studio_mutations` ausweisen und darf externe Mainserver-Änderungen ohne bestätigten Event-Vertrag nicht als vollständig historisiert darstellen.

#### Scenario: Extern erzeugter Inhalt besitzt keine Studio-History

- **GIVEN** ein Mainserver-Inhalt wurde außerhalb des Studios erzeugt und nie im Studio mutiert
- **WHEN** ein autorisierter Benutzer dessen Detailansicht öffnet
- **THEN** ist der fachliche Inhalt vollständig verfügbar
- **AND** die History ist leer oder nicht verfügbar mit `coverage = studio_mutations`
- **AND** der fehlende lokale History-Core blockiert weder Detail noch Bearbeitung
