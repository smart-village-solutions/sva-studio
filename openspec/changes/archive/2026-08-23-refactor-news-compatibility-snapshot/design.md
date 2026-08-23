## Context

Der News-Editor führt vereinfachte redaktionelle Formularfelder und interne Compatibility-Aliase für historische Mainserver-Felder zusammen. Nur als `touched` markierte Aliase dürfen den bestehenden Snapshot aktualisieren; mehrere Felder besitzen zusätzliche fachliche Regeln.

## Goals / Non-Goals

- Goals: unveränderte Touched- und Laufzeittypprüfung, unveränderte Publication- und Payload-Priorität, kleinere einzeln prüfbare Synchronisationsschritte.
- Non-Goals: neue Legacy-Felder, öffentliche Formtypen, Scheduling-Korrekturen, API- oder Mainserver-Änderungen.

## Decisions

- Nur gleichförmige String- und Boolean-Felder werden in expliziten, vollständig typisierten Feldgruppen beschrieben.
- `publishedAt`, `publicationDate`, `pushNotification`, `address` und `contentBlocks` bleiben benannte Sonderfunktionen, damit Reihenfolge und Seiteneffekte sichtbar bleiben.
- Der bestehende Snapshot wird weiterhin in-place aktualisiert; Objekt- und Arrayreferenzen werden nicht zusätzlich geklont.

## Risks / Trade-offs

- Eine falsche Feldgruppenzuordnung könnte Laufzeittypen verändern. Die tabellengetriebene Altcode-Characterization prüft deshalb jedes Feld mit true/false/fehlendem Touched-Marker und passendem/falschem Typ.
- Eine veränderte Sonderfallreihenfolge könnte Scheduling oder redaktionelle Inhalte überschreiben. Die Sonderpfade bleiben in derselben Aufrufreihenfolge und erhalten gezielte Konflikttests.

## Migration Plan

Kein Daten- oder API-Migrationsschritt. Das Refactoring wird durch Characterization, Nx-Gates und statischen sowie coveragegestützten New-only-Audit abgesichert.
