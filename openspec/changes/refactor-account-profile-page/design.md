## Kontext

`AccountProfilePage` enthält aktuell sowohl framework-unabhängige Profilregeln als auch React-Lifecycle, IAM-Aufrufe und umfangreiche Darstellung. Die Seite ist gut charakterisiert, überschreitet aber die Complexity-Grenzen deutlich.

Der parallel dokumentierte Change `add-account-credential-self-service` beschreibt den Credential-Self-Service und dessen Rückkehrstatus. Seine Implementierung ist bereits Bestandteil der Seite. Dieses Refactoring behandelt diesen Vertrag als unveränderliche Eingabe und führt keine zweite fachliche Definition dafür ein.

## Ziele / Nicht-Ziele

### Ziele

- Reine Formularableitung, Normalisierung und Validierung ohne React-Abhängigkeit bereitstellen.
- Asynchronen Seitenzustand und Präsentation in kleine, nachvollziehbare Einheiten trennen.
- Alle vorhandenen Lade-, Fehler-, Read-only-, Editier-, Action-Status-, Mutations- und Fokuspfade erhalten.
- Die drei Complexity-Baselines der Ausgangsdatei auflösen, ohne neue kritische Funktionen zu erzeugen.

### Nicht-Ziele

- Keine Änderung an IAM-Endpunkten, Payload-Verträgen oder Editierbarkeitsregeln.
- Keine Änderung an Credential-Self-Service oder dessen URL-Parametern.
- Keine neue UI, Übersetzung oder Design-System-Komponente.

## Entscheidungen

### Entscheidung 1: Formularregeln bleiben framework-unabhängig

Formwerte, Normalisierung, Anzeigenamenableitung und Validierung werden in einem React-freien Modul gebündelt. Übersetzte Texte werden erst an der UI-Grenze aus stabilen Fehlercodes abgeleitet.

### Entscheidung 2: React koordiniert, Präsentationsbausteine rendern

Ein kleiner zustandsführender Hook kapselt Laden, Bearbeiten und Speichern. Die Route wählt ausschließlich den passenden Seitenzustand; fokussierte Präsentationsbausteine rendern bestehendes Markup und bestehende Design-System-Komponenten.

### Entscheidung 3: Bestehende Verträge werden durch Characterization gesichert

Vor der Extraktion werden insbesondere Lade- und Fehlerzweige, Plattform-Read-only, Mutationserfolg und -fehler, Validierungsfokus sowie alle bekannten, fehlenden und ungültigen `accountAction`-Werte getestet. Diese Tests bilden die Grenze des Refactorings.

## Risiken / Trade-offs

- Mehrere co-located Dateien erhöhen die Zahl der Module, reduzieren aber die langfristige Ownership durch eindeutige Verantwortungen.
- Eine versehentliche Änderung der Fokusreihenfolge oder Fehlerassoziation wäre für Tastaturnutzer sichtbar; deshalb werden diese Pfade vor der Extraktion charakterisiert.
