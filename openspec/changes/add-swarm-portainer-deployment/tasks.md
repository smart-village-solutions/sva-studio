## 1. Analyse und Design

- [x] 1.1 Bestehenden Portainer-Compose-Stack gegen Swarm-/Traefik-Betriebsmodell abgleichen
- [x] 1.2 Zielbild für das Swarm-Referenzprofil mit externem Netzwerk, Traefik-Labels und Registry-Image dokumentieren
- [x] 1.3 Host-Validierungsvertrag für `subdomain == instanceId` unter einer festen Parent-Domain definieren (inkl. IDN/Punycode-Ausschluss, identischer `403`-Fehlervertrag für alle Ablehnungsgründe)
- [x] 1.4 Kanonischen Auth-Host sowie fail-closed-Grenzen für OIDC-Redirects, Logout-Redirects, Base-URL und Cookie-Domain-Scoping dokumentieren
- [x] 1.5 Betriebsmodell für die Env-Allowlist als aktuell autoritative Quelle gültiger `instanceId`s definieren (inkl. Startup-Validierung, Set-basierter Lookup, Skalierungsschwellwert)
- [x] 1.6 Secrets-/Config-Klassifizierungstabelle gemäß `design.md` erstellen und im Runbook verankern

## 2. Implementierung

- [x] 2.1 `deploy/portainer/docker-compose.yml` auf Swarm-/Traefik-Deployment umbauen (`restart:` → `deploy.restart_policy`, `ports:` → Traefik-Labels)
- [x] 2.2 Build-Ziel auf vorgebautes Image statt `build:` umstellen; parametrisierbares Image-Muster (`${SVA_REGISTRY}/sva-studio:${SVA_IMAGE_TAG}`) verwenden
- [x] 2.3 Secrets-/Config-Handling gemäß Klassifizierungstabelle für Swarm als externe Betriebsressourcen umsetzen; Namenskonvention `sva_studio_<service>_<secret_name>` anwenden
- [x] 2.4 Nicht-Swarm-taugliche Bind-Mount-Annahmen aus dem Stack entfernen (DB-Migrationsverfahren wird in Development-Phase mit frischen Instanzen noch nicht benötigt; Folgearbeit für produktiven Betrieb)
- [x] 2.5 Deployment-Variablen auf konfigurierbare Parent-Domain (`SVA_PARENT_DOMAIN`), kanonischen Auth-Host und HostRegexp-Routing ausrichten
- [x] 2.6 Runtime-Konfiguration für erlaubte `instanceId`s im Stack als autoritative Allowlist vorsehen; Startup-Validierung gegen `instanceId`-Regex implementieren
- [x] 2.7 Persistenz-Annahmen für stateful Services im Stack dokumentieren

## 3. Dokumentation und Validierung

- [x] 3.1 Bestehenden Guide [`docs/guides/portainer-deployment-ohne-monitoring.md`](../../docs/guides/portainer-deployment-ohne-monitoring.md) aktualisieren oder durch Swarm-Runbook ersetzen; Runbook mit Rollout, Secret-Bootstrap und Smoke-Checks auf Deutsch
- [x] 3.2 arc42-Abschnitte aktualisieren: [`docs/architecture/05-building-block-view.md`](../../docs/architecture/05-building-block-view.md), [`docs/architecture/06-runtime-view.md`](../../docs/architecture/06-runtime-view.md), [`docs/architecture/07-deployment-view.md`](../../docs/architecture/07-deployment-view.md) (bestehenden Portainer-Abschnitt durch Swarm-Referenzprofil konsolidieren), [`docs/architecture/08-cross-cutting-concepts.md`](../../docs/architecture/08-cross-cutting-concepts.md), [`docs/architecture/09-architecture-decisions.md`](../../docs/architecture/09-architecture-decisions.md), [`docs/architecture/10-quality-requirements.md`](../../docs/architecture/10-quality-requirements.md), [`docs/architecture/11-risks-and-technical-debt.md`](../../docs/architecture/11-risks-and-technical-debt.md) (inkl. Allowlist-Skalierungsschwellwert), [`docs/architecture/12-glossary.md`](../../docs/architecture/12-glossary.md) (neue Begriffe: Referenz-Betriebsprofil, kanonischer Auth-Host, Env-Allowlist, fail-closed-Policy, Parent-Domain)
- [x] 3.3 ADRs anlegen oder fortschreiben:
  - **ADR-019: Swarm-/Traefik-Referenz-Betriebsprofil** (Decisions 1, 2, 6 aus `design.md`)
  - **ADR-011 fortgeschrieben:** Subdomain-Ableitung, URL-Mapping und Env-Allowlist als Erweiterung des bestehenden `instanceId`-Scopes (Decisions 3, 4 aus `design.md`)
  - **ADR-020: Kanonischer Auth-Host und Multi-Host-Grenze** (Decision 5 aus `design.md`, OIDC-Discovery, Cookie-Scoping)
- [x] 3.4 Dokumentation zur Ableitung `instanceId` aus der Subdomain, zur Root-Domain als kanonischem Auth-Host, zum fail-closed-Error-Contract (`403` + `{ error, message }` + `X-Request-Id`) und zum IDN/Punycode-Ausschluss ergänzen
- [x] 3.5 Dokumentation zur Env-Allowlist als autoritativer Freigabequelle ergänzen (Startup-Validierung, Format, Skalierungsgrenze)
- [ ] 3.6 Compose-/Stack-Datei statisch validieren, z. B. über `docker compose -f deploy/portainer/docker-compose.yml config`
- [ ] 3.7 Swarm-Smoke-Deployment mit Overlay-Netz, Stack-Deploy, erlaubtem Host, unbekanntem Host und Root-Domain-Verhalten validieren
- [ ] 3.8 Kanonischen Login-/Logout-Flow sowie die fail-closed-Grenze für nicht unterstützte Instanz-Host-Auth-Flows validieren
