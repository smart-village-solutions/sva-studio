# Operations & Reliability Review – Template

Nutze dieses Template für Betriebs-/Zuverlässigkeits-Reviews. Fokus: Deployments, Backups, Observability.

## Entscheidung
- Betriebsreife: [Low | Medium | High]
- Begründung (1–2 Sätze):

## Executive Summary (3–5 Punkte)
- Punkt 1
- Punkt 2
- Punkt 3

## Befundübersicht
| ID | Thema | Schwere | Bereich | Evidenz |
|---:|-------|---------|---------|---------|
| O1 | …     | 🔴/🟡/🟢 | Deploy/Backup/Monitor | Link/Zitat |

## Detail-Findings
### O1 – Kurztitel
- Beschreibung: …
- Impact/Risiko (Verfügbarkeit, Datenverlust, MTTR): …
- Evidenz/Quelle: (Pipelines, Scripts, Dashboards)
- Referenzen: Betrieb-Wartung, Qualität-Zuverlässigkeit
- Empfehlung/Abhilfe: …

## Checkliste (Status)
- [ ] Installierbarkeit: Docker/Compose/K8s vorhanden + dokumentiert
- [ ] Zero-Downtime-Deployments (Blue/Green, Rolling, Canary)
- [ ] Rollback < X Minuten; Migrations rückwärtskompatibel
- [ ] Backups: RTO/RPO-Ziele, Restore-Tests, Offsite, Verschlüsselung
- [ ] Monitoring/Logging/Alerting: Metriken, Schwellen, Kanäle, De-Dup
- [ ] Wartungsmodus + Notfallszenarien (Runbooks, DR-Drills)
- [ ] Ressourcenbedarf/Skalierung (Auto-Scaling, HPA, Limits)
- [ ] SLO/SLA-Ziele (Uptime, MTTR) definiert

## Anhänge
- Eingesetzte Inputs: (Deploy-Files, Backup-Configs, Dashboards)