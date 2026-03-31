# Change: Logging-Runtime für Development und Production vereinfachen

## Why
Die bisherige Logging-Struktur in der Entwicklung war widersprüchlich dokumentiert und im Laufzeitverhalten zu implizit. Besonders problematisch waren stilles OTEL-No-op-Verhalten, unklare Dev-Defaults und fehlende lokale Browser-/Server-Diagnostik in der UI.

## What Changes
- Vereinfacht das Logging auf zwei feste Betriebsmodi für Development und Production.
- Führt eine lokale Dev-Konsole für Browser- und Server-Logs ein.
- Macht den OTEL-Status im SDK explizit und für Logger/Frontend nutzbar.
- Bereinigt aktive Dokumentation und Dev Rules auf ein widerspruchsfreies Logging-Modell.

## Impact
- Affected specs: `monitoring-client`
- Affected code: `packages/sdk`, `apps/sva-studio-react`, Logging-/Observability-Doku
- Affected arc42 sections: `06-runtime-view`, `08-cross-cutting-concepts`
