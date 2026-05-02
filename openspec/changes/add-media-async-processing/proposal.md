# Change: Asynchrone Medienverarbeitung ergänzen

## Warum

Das aktuelle Medienmanagement erzeugt häufige Bildvarianten synchron im Upload-Pfad. Das ist für den MVP bewusst akzeptabel, belastet aber Latenz, Fehlerisolation und spätere Erweiterungen wie Malware-Scan, zusätzliche Presets oder größere Batch-Migrationen.

## Was ändert sich

- führt einen dedizierten asynchronen Processing-Pfad für Medienvarianten ein
- trennt Upload-Abschluss, Validierung und Variantenverarbeitung über Queue-/Worker-Verträge
- ergänzt Retry-, Dead-Letter- und Betriebsdiagnostik für fehlgeschlagene Medienjobs
- hält den bestehenden synchronen MVP-Vertrag als Fallback nur für kleine, häufige Standardfälle sauber abgegrenzt

## Auswirkungen

- betrifft `packages/auth-runtime`, `packages/data`, `packages/data-repositories` und die Betriebsdokumentation
- erweitert Audit-, Observability- und Fehlerklassifikationen für Medienjobs
- reduziert das bekannte Risiko aus synchroner Variantenverarbeitung im Request-Pfad
