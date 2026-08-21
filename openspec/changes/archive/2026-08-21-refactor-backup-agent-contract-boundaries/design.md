## Context

Der zentrale Backup-Agent läuft als einzelnes Node.js-ESM-Programm im eigenen Container. Seine Restore-Fassade `validRestoreRequest` entscheidet derzeit gleichzeitig über Objektform, Allowlist-Felder, Version und Aktion, Umgebung, Datenbank-/Tenant-Kopplung, Request-ID, Wartungsfensterreferenz, SHA-256, den einmaligen Waste-Import, Objektpfad und Ablaufzeit. Der Vertrag ist produktiv und sicherheitskritisch; diese Änderung darf keine seiner Entscheidungen verändern.

Parallel erweitert `update-restore-runtime-principal-reconciliation` die Nacharbeiten eines erfolgreichen Restores. Die hier geplante Änderung berührt weder diese Mutation noch ihre Evidenz und beschränkt sich auf die davor liegende Request-Validierung.

## Goals / Non-Goals

- Goals:
  - reine, einzeln testbare Contract-Validatoren mit expliziten Ergebnisgrenzen schaffen;
  - die Komplexität der öffentlichen booleschen Fassaden deutlich reduzieren;
  - die vorhandene positive und negative Semantik von Backup v1/v2, Restore v1 und Waste-Import v1 beweisen;
  - die ESM-Auflösung im gebauten Container deterministisch halten.
- Non-Goals:
  - neue Vertragsversionen, Aktionen, Felder oder Zielsysteme;
  - Änderungen an OIDC, HMAC, Replay-Schutz oder Restore-Ausführung;
  - Rollout, Deployment, Restore-Drill oder externe Konfigurationsänderungen.

## Decisions

### Decision: Validatoren liefern typisierte Ergebnisgrenzen

Jede reine Grenze liefert ein diskriminiertes Ergebnis mit `ok: true` oder `ok: false`. Die öffentlichen Funktionen `validRequest` und `validRestoreRequest` bleiben boolesch und falten die Ergebnisse ohne neue Fehlertexte oder Seiteneffekte zusammen. Dadurch können Tests die genaue abgelehnte Grenze prüfen, während bestehende Aufrufer unverändert bleiben.

Alternativen considered:

- Ausschließlich boolesche Hilfsfunktionen: kleiner, aber schlechter diagnostizierbar und weniger typsicher in TypeScript-Vertragstests.
- Schema-Bibliothek ergänzen: würde neue Runtime-Ownership und mögliche Coercion-/Unknown-Key-Semantik in eine bereits stabile Security-Grenze einführen.

### Decision: Zielableitung bleibt injiziert und umgebungsgebunden

Das Validator-Modul enthält keine frei konfigurierbaren Buckets, Hosts oder Datenbanken. Die Fassade übergibt ausschließlich die bereits im Agenten kompilierte Präfixsicht und die fest verdrahtete Waste-Import-Identität. Damit entsteht kein zweiter Konfigurationsvertrag.

### Decision: Runtime-Module werden explizit in das Image kopiert

Alle relativen Laufzeitimporte verwenden `.mjs`. Der Docker-Build kopiert jedes benötigte Modul explizit nach `/app`; ein Unit-Test beziehungsweise Container-Start-Smoke stellt sicher, dass kein im Repository vorhandenes, aber im Image fehlendes Modul unbemerkt bleibt.

## Risks / Trade-offs

- Semantische Drift durch Neuordnung von Prüfungen → Die Negativmatrix wird vor der Extraktion ergänzt und bleibt als Characterization-Test bestehen.
- Fehlendes Runtime-Modul im Container → Explizite `COPY`-Einträge und der vollständige Integrationstest bauen das reale Image.
- Paralleländerung an Restore-Nacharbeiten → Die Änderung bleibt auf Request-Validierung beschränkt und verändert keine Restore-Ausführungsfunktion.

## Migration Plan

1. Negativmatrix gegen den bisherigen Monolithen ergänzen und grün ausführen.
2. Reine Validatoren extrahieren und boolesche Fassaden unverändert anbinden.
3. Container-Modulauflösung und vollständigen Backup-Agent-Integrationstest prüfen.
4. Keine Datenmigration, Konfigurationsänderung oder Laufzeitumschaltung durchführen.

## Open Questions

- Keine. Jede notwendige Vertragsänderung ist ein Stop-Kriterium und benötigt einen separaten Change.
