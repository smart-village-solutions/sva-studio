## Context

Mainserver-Inhalte können durch Studio, n8n, Fachverfahren oder andere autorisierte API-Clients entstehen. Lokale Studio-Zustände können deshalb nie vollständig die fachliche Existenz dieser Datensätze bestimmen.

## Goals / Non-Goals

- Goal: Jeder autorisierte Mainserver-Inhalt ist ohne lokalen Content-Core im passenden Studio-Fachplugin sichtbar und lesbar.
- Goal: IAM bleibt die alleinige Studio-Autorisierungsinstanz für Content-Actions.
- Goal: Lokale Begleitzustände bleiben optional, reparierbar und nicht destruktiv.
- Non-Goal: Externe Änderungen ohne bestätigten Event-Vertrag rückwirkend als Studio-History zu erfinden.
- Non-Goal: Einen generischen Browser-GraphQL-Zugriff einzuführen.

## Decisions

### Mainserver-first Read-Modell

Typisierte Mainserver-Listen und -Details liefern die fachlichen Datensätze unmittelbar. Lokale Projektionen dürfen als account- und credential-scope-isolierter Cache dienen, müssen aber vollständig aus dem Mainserver rekonstruierbar sein. Ein innerer Join auf Content-Core oder External Reference ist im Read-Pfad unzulässig.

### IAM autorisiert Aktionen, nicht Datensatzexistenz

Listen prüfen die typspezifische Read-Action. Detail- und Mutationspfade prüfen die jeweilige Action und den expliziten Organisations- oder Benutzerkontext. Mainserver-Felder bestimmen Status, Veröffentlichung, Autor und Ownership; lokale IAM-Content-Metadaten dürfen diese Werte nicht überschreiben.

### Stabile Mainserver-ID als kanonische Read-ID

Extern entstandene Inhalte besitzen keine lokale Content-ID. Deshalb verwenden Read- und reguläre Mutationspfade die stabile Mainserver-ID. Für bestehende Studio-Datensätze darf eine vorhandene External Reference lokale IDs kompatibel auflösen, ohne für neue Reads erforderlich zu sein.

### Lokale Folgearbeit ist best effort

Nach bestätigtem Mainserver-Erfolg werden Projection, Reference und Studio-History nachgezogen. Fehler werden deterministisch protokolliert und durch Reconciliation repariert; sie ändern den Provider-Erfolg nicht.

### History bleibt ehrlich begrenzt

History wird nur für nachvollziehbare Studio-Mutationen angeboten. Extern erzeugte oder geänderte Inhalte dürfen ohne History erscheinen. Die API kennzeichnet diese Begrenzung als `coverage = studio_mutations`.

## Risks / Trade-offs

- Bestehende lokale IDs und Mainserver-IDs können abweichen. Kompatible Reference-Auflösung verhindert gebrochene Links während der Umstellung.
- Lokale Projektionen können vorübergehend veraltet sein. Account-scope-isolierte vollständige Reconciliation bleibt der Reparaturpfad.
- Ownership-basierte Datensatzfilter sind ohne bestätigten Mainserver-Owner nicht ableitbar. Der Read-Pfad bleibt auf typspezifische Actions und den effektiven Credential-Kontext begrenzt und erfindet keine lokale Ownership.

## Migration Plan

1. Projekte-Read-Pfad vom lokalen Inner Join lösen und Mainserver-IDs akzeptieren.
2. Projektmodell vollständig aus Mainserver-Feldern ableiten.
3. Bestehende lokale Reference-Auflösung für kompatible History und alte Links beibehalten.
4. Gemeinsame Projektions- und History-Verträge für alle Mainserver-Typen dokumentieren und testen.
5. Nach erfolgreichem Rollout vollständige Reconciliation laufen lassen; keine fachlichen Mainserver-Daten migrieren oder zurücksetzen.
