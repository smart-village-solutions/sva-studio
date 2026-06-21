## 1. Implementation

- [x] 1.1 OpenSpec-Delta fuer die modulare Runtime-Orchestrierung ergaenzen und validieren
- [x] 1.2 Neue Runtime-Module fuer Doctor, Acceptance-Deploy, Smoke/Warmup, Remote-Verification und Command-Dispatch einfuehren
- [x] 1.3 `scripts/ops/runtime-env.ts` auf Fassade, Wiring und CLI-Einstieg reduzieren
- [x] 1.4 Bestehende Export-Fassaden (`runtimeEnvDangerousOperations`, `runtimeEnvRemoteVerification`, `runtimeEnvSmokeWarmup`) stabil halten
- [x] 1.5 Modultests fuer Doctor-/Deploy-Orchestrierung, Smoke-Retry und Remote-Verification-Helfer ergaenzen
- [x] 1.6 Relevante Unit- und Type-Gates fuer die geaenderten Skripte ausfuehren

## 2. Runtime-Readiness Nachlauf

- [x] 2.1 Wiederholte Runtime-Dependency-Typen in lokale, fachlich benannte Typgruppen zusammenziehen
- [x] 2.2 Grosse Runtime-Factory-Kapseln weiter in kleinere Builder-/Dispatch-Funktionen schneiden
- [ ] 2.3 Runtime-CRAP-Funde ohne echte Logikballung ueber gezielte Tests senken und echte Entscheidungsballungen refaktorieren
- [x] 2.4 Remote-App-Service-Aufloesung ueber Deploy, Doctor, Smoke und Reporting hinweg auf eine gemeinsame Quelle haerten
- [x] 2.5 Risikoreiche Adapter-Grenzen (`as never`, Placeholder-Wiring) im Remote-Orchestrator gezielt durch explizite Typen und stabilere Konstruktion ersetzen
- [x] 2.6 Runtime-Fallow-Audit, Runtime-Duplication-Check, LOC-Scan sowie relevante Script-Type- und Unit-Gates als Abschlussnachweis ausfuehren
