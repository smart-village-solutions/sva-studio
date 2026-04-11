## 1. Umsetzung

- [x] 1.0 `update-studio-swarm-migration-job` als implementierte Grundlage bestaetigen und doppelte Migrations-/Bootstrap-Annahmen aus diesem Change fernhalten
- [x] 1.1 OpenSpec-Deltas für Deployment-Topologie und Architekturdokumentation auf Netzwerk-, Ingress- und Recovery-Vertrag begrenzen
- [x] 1.2 arc42-Abschnitte `07-deployment-view` und `08-cross-cutting-concepts` auf den gehärteten Rolloutvertrag aktualisieren
- [x] 1.3 Runtime-Runbook für `studio` auf Soll-/Live-Spec-Drift, Temp-Job-Stack-Trennung und Recovery-Pfad schärfen
- [x] 1.4 Runtime-Checks für Netzwerk-/Ingress-Drift und Remote-Service-Contract validieren
- [x] 1.5 `studio.local.vars` auf den bewusst freigegebenen Live-Digest konvergieren
- [x] 1.6 Produktivnahen `app-only`-Rollout für `studio` erfolgreich durchlaufen und Smoke-/Precheck-Nachweise sichern
- [x] 1.7 Produktivnahen `env:migrate:studio`- und `schema-and-app`-Pfad nur noch darauf verifizieren, dass die vorhandenen Temp-Job-Stacks keine Seiteneffekte auf `studio_app` erzeugen
