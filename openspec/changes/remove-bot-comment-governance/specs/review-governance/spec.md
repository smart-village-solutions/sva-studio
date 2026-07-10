## REMOVED Requirements

### Requirement: Bot-Kommentare müssen vor Merge bearbeitet werden

**Reason**: Der native GitHub-Review-Prozess deckt die fachliche Bearbeitung und den Abschluss von Review-Threads ab; ein zusätzliches proprietäres Marker-Gate erzeugt doppelte Governance ohne verpflichtenden Merge-Schutz.

**Migration**: Relevante Bot-Hinweise werden weiterhin vor dem Merge geprüft. Umgesetzte oder begründet abgelehnte Hinweise werden über Antworten und den nativen Thread-Status nachvollziehbar abgeschlossen.

### Requirement: Bearbeitungsnachweise müssen standardisierte Abschlusszustände tragen

**Reason**: Die HTML-Marker `accepted`, `rejected` und `resolved` werden ausschließlich vom entfernten Sonderworkflow benötigt.

**Migration**: Der Bearbeitungsstand wird über normale Review-Antworten, Commits, Checks und den nativen GitHub-Thread-Status dokumentiert.

### Requirement: Bot-Kommentar-Gate muss Review-Threads und normale PR-Kommentare getrennt auswerten

**Reason**: Ohne separates Bot-Kommentar-Gate ist keine eigene maschinelle Klassifizierung der beiden Kommentararten erforderlich.

**Migration**: Review-Threads werden nativ aufgelöst; normale PR-Kommentare werden im üblichen PR-Dialog beantwortet.
