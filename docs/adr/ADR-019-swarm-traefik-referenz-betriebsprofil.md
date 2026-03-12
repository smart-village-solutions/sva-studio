# ADR-019: Swarm-/Traefik-Referenz-Betriebsprofil

**Status:** Accepted
**Entscheidungsdatum:** 2026-03-12
**Entschieden durch:** Plattform/DevOps Team
**GitHub Issue:** TBD
**GitHub PR:** #157

---

## Kontext

Der bestehende Portainer-Stack (`deploy/portainer/docker-compose.yml`) nutzt reguläres Docker Compose mit `build:`-Direktive, `ports:`-Bindings und Host-Bind-Mounts für DB-Initialisierung. Für einen serverbasierten Betrieb mit mehreren Instanzen (Multi-Host über Subdomains) und kontrollierten Updates ist ein Swarm-taugliches Betriebsprofil erforderlich.

Anforderungen:

- Vorgebaute Images aus einer Container-Registry statt lokaler Build
- TLS-Terminierung und Host-basiertes Routing über Traefik
- Secret-Management über Docker Swarm Secrets statt Env-Variablen
- Rolling Updates mit Zero-Downtime-Ziel
- Persistenz-Garantien für stateful Services

## Entscheidung

Der Portainer-Stack wird als **Swarm-/Traefik-Referenz-Betriebsprofil** definiert.

### 1. Image-basiertes Deployment

```yaml
image: ${SVA_REGISTRY:-ghcr.io/smart-village-solutions}/sva-studio:${SVA_IMAGE_TAG:-latest}
```

- Kein `build:`-Block im Stack. Images werden in CI/CD gebaut und in eine Registry gepusht.
- `SVA_REGISTRY` und `SVA_IMAGE_TAG` als parametrisierbare Stack-Variablen.

### 2. Traefik als Ingress-Proxy

- Externes Overlay-Netzwerk `public` verbindet Traefik mit den App-Containern.
- `HostRegexp`-basiertes Routing für Instanz-Subdomains unter einer konfigurierbaren `SVA_PARENT_DOMAIN`.
- TLS-Terminierung über Traefiks `certresolver` (Let's Encrypt oder beigestellt).

### 3. Docker Swarm Secrets

Vertrauliche Werte als externe Swarm Secrets mit Namenskonvention `sva_studio_<service>_<secret_name>`. Die Zuordnung Secret-Datei → Umgebungsvariable erfolgt über ein Shell-Entrypoint-Skript (`entrypoint.sh`), das abwärtskompatibel ist (No-Op ohne `/run/secrets/`).

### 4. Rolling Updates

```yaml
deploy:
  update_config:
    order: start-first
  rollback_config:
    order: stop-first
```

Start-first für Updates (neuer Container startet vor dem Stopp des alten), stop-first für Rollbacks.

### 5. Persistenz

Stateful Services (Postgres, Redis) erhalten `placement.constraints: node.role == manager` in Single-Node-Setups, damit Volumes auf demselben Node liegen bleiben. Named Volumes statt Bind-Mounts.

### 6. Entfernung nicht-Swarm-tauglicher Muster

- `depends_on` entfernt (Swarm ignoriert es).
- Bind-Mounts für `postgres-init/` entfernt. DB-Initialisierung wird als bewusster, manueller Betriebsschritt dokumentiert.
- `ports:`-Mappings durch Traefik-Labels ersetzt.

## Begründung

1. Registry-Images entkoppeln Build und Deployment. Swarm-Nodes benötigen keinen Quellcode.
2. Traefik als Ingress ermöglicht TLS-Terminierung und Host-basiertes Routing ohne zusätzlichen Reverse-Proxy.
3. Swarm Secrets sind sicherer als Klartext-Env-Variablen in Stack-Definitionen.
4. Start-first Updates reduzieren Downtime auf die Dauer eines Health-Checks.
5. Placement-Constraints sichern Volume-Affinität in einfachen Setups.

## Alternativen

### Alternative A: Kubernetes

**Vorteile:**
- Umfangreichere Orchestrierungsmöglichkeiten, größeres Ökosystem

**Nachteile:**
- Höherer Betriebsaufwand für die aktuelle Zielgruppe (Development-Phase, wenige Instanzen)
- Portainer-Integration weniger direkt

**Warum verworfen:**
Für die aktuelle Development-Phase mit wenigen Instanzen ist die Komplexität nicht gerechtfertigt. Kubernetes bleibt als Folgeoption offen.

### Alternative B: Reguläres Docker Compose ohne Swarm

**Vorteile:**
- Einfacherer Einstieg, bekanntes Modell

**Nachteile:**
- Kein natives Secret-Management
- Kein Rolling Update
- Kein Overlay-Networking für Multi-Host

**Warum verworfen:**
Erfüllt die Anforderungen an Secret-Handling und Zero-Downtime-Updates nicht.

## Konsequenzen

### Positive Konsequenzen

- Klares, reproduzierbares Deployment-Artefakt (Stack + Secrets)
- TLS und Multi-Host-Routing ohne manuelle Proxy-Konfiguration
- Secrets außerhalb des Stack-Files und der Env-Dateien

### Negative Konsequenzen

- Swarm-Initialisierung als Voraussetzung auf dem Zielserver
- DB-Initialisierung erfordert manuellen Schritt pro frischer Instanz
- Traefik muss als separater Service betrieben werden

## Verwandte ADRs

- [ADR-011](ADR-011-instanceid-kanonischer-mandanten-scope.md): `instanceId` als kanonischer Mandanten-Scope (Subdomain-Ableitung)
- [ADR-020](ADR-020-kanonischer-auth-host-multi-host-grenze.md): Kanonischer Auth-Host und Multi-Host-Grenze

## Gültigkeitsdauer

Diese ADR ist gültig, bis ein alternatives Betriebsprofil (z. B. Kubernetes) beschlossen wird.
