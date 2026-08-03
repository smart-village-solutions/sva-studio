## 1. Ingress-Vertrag und Konfiguration

- [x] 1.1 Vollständige Production-Tenant-Hostliste bestätigen und als Review-Evidenz im Change festhalten (63 eindeutige, syntaktisch gültige IDs).
- [x] 1.2 Dev-Compose auf Root-Host plus `de-teststadt-dev.studio-dev.smart-village.app` umstellen.
- [x] 1.3 Staging-Compose auf Root-Host plus `de-studio-sandbox.studio-staging.smart-village.app` umstellen.
- [x] 1.4 Production-Compose auf Root-Host plus bestätigte Tenant-Hostliste umstellen.
- [x] 1.5 Traefik-v1-Kompatibilitätslabels und Traefik-v2+-Routerregeln innerhalb jedes betroffenen Profils konsistent halten.

## 2. Validierung und Tests

- [x] 2.1 Statische Compose-Tests für die exakten Root- und Tenant-Hosts jeder Umgebung ergänzen; unerwartete Hosts und Duplikate ablehnen.
- [x] 2.2 Deploy-Render-/Acceptance-Gates so erweitern, dass ingressrelevante Hostregeln erhalten bleiben.
- [x] 2.3 Externe Smokes für Root-Host, alle explizit freigegebenen Tenant-Hosts und einen unbekannten Tenant-Host ergänzen.
- [x] 2.4 HTTPS-Zertifikatsprüfung für jeden expliziten Host ergänzen und sicherstellen, dass der Tenant-Login auf demselben Host bleibt.
- [x] 2.5 Nach jedem Änderungsblock den kleinsten relevanten Unit-, Type- und Runtime-Gate-Pfad ausführen; vor PR-Freigabe nach Möglichkeit `pnpm test:pr` ausführen.

## 3. Dokumentation und Rollout

- [x] 3.1 `docs/guides/studio-rollout-process.md` um die explizite Hostfreigabe vor Tenant-Aktivierung ergänzen, ohne einen zweiten Deploypfad einzuführen.
- [x] 3.2 `docs/guides/swarm-deployment-runbook.md` auf explizite Hostlisten und Einzelzertifikate aktualisieren.
- [x] 3.3 `docs/architecture/06-runtime-view.md` um den Ingress-/Registry-/TLS-Aktivierungsablauf aktualisieren.
- [x] 3.4 `docs/architecture/07-deployment-view.md` auf das tatsächlich betriebene explizite Hostrouting aktualisieren.
- [x] 3.5 Sicherheits- und Betriebsgrenzen in `docs/architecture/08-cross-cutting-concepts.md` sowie Skalierungsrisiko in `docs/architecture/11-risks-and-technical-debt.md` dokumentieren.
- [x] 3.6 Dev, Staging und Production ausschließlich über den kanonischen GitHub-Actions-Pfad ausrollen und die jeweiligen Post-Deploy-Smokes dokumentieren.
