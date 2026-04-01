## Context
Der Server-Logger in `@sva/sdk/server` ist etabliert und an Winston, OTEL und den Development-Log-Buffer gekoppelt. Browser-Code kann diese API nicht sinnvoll nutzen und verwendet deshalb teilweise direkt `console.*`. Gleichzeitig pflegen Server und Browser heute ähnliche Redaction-Regeln separat.

## Goals / Non-Goals
- Goals:
  - Gemeinsame Redaction-Regeln für Server- und Browser-Logs
  - Kleine browser-taugliche Logger-API für produktiven App-Code
  - Keine Verhaltensänderung für bestehende Server-Logger-Aufrufer
- Non-Goals:
  - Kein zentraler Browser-Log-Ingest
  - Keine Vollmigration von Scripts, Benchmarks oder Tests
  - Keine komplette Neugestaltung der Server-Logging-Runtime

## Decisions
- Decision: Die Redaction wird in ein runtime-neutrales SDK-Modul verschoben und von Server-Logger sowie Browser-Development-Log-Store gemeinsam verwendet.
- Decision: Für Browser-Code wird eine dünne API `createBrowserLogger({ component, level? })` eingeführt.
- Decision: Der Browser-Logger schreibt weiterhin in `console.*` und zusätzlich optional in den bestehenden Browser-Development-Log-Store.
- Decision: `createSdkLogger` in `@sva/sdk/server` bleibt stabil und delegiert nur die Redaction an das gemeinsame Modul.

## Risks / Trade-offs
- Die Browser-Logger-API ist in v1 bewusst kleiner als die Server-Architektur. Das reduziert Churn, schafft aber noch keine vollständige API-Konvergenz.
- Die Development-Log-Capture bleibt ein Sonderfall mit bewusstem `console`-Hooking für Browser-Diagnostik.

## Migration Plan
1. Gemeinsame Redaction-Helfer einführen und bestehende Nutzer umstellen.
2. Browser-Logger einführen und produktive Browser-Hotspots migrieren.
3. Regeln und Tests auf das neue v1-Modell anpassen.

## Open Questions
- Keine für v1. Browser-Transport zu zentralen Backends bleibt explizit außerhalb des Scopes.
