# Change: Runtime-sichere Logging-v1 für produktiven App-Code

## Why
Der SDK-Logger ist heute serverzentriert, während produktiver Browser-App-Code an einzelnen Stellen weiterhin `console.*` direkt nutzt. Zusätzlich existiert die Redaction-Logik doppelt im Server-Logger und in der Browser-Development-Log-Capture.

## What Changes
- Führt eine kleine browser-taugliche Logger-API im SDK ein.
- Extrahiert gemeinsame Redaction-Helfer in ein runtime-neutrales Modul.
- Migriert ausgewählte produktive Browser-Hotspots von rohem `console.*` auf den Browser-Logger.
- Hält die bestehende Server-Logger-Architektur unverändert nutzbar.

## Impact
- Affected specs: `monitoring-client`, `iam-core`
- Affected code: `packages/sdk`, `apps/sva-studio-react`
- Affected arc42 sections: `08-cross-cutting-concepts`
