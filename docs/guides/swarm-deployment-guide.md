
# SVA Studio – Docker Swarm / Planetary Quantum Deployment

Status: **Docker-Image gebaut & gepusht** ✅ | **Demo-Profil ohne Docker-Secrets aktiv** ✅

## Übersicht

Dieses Dokument beschreibt das Setup für den Deployment von sva-studio auf Planetary Quantum's Docker Swarm Cluster.

**Setup-Schritte:**
1. Demo-Umgebungsvariablen setzen
2. .quantum Konfiguration validieren
3. Stack deployen mit quantum-cli oder Portainer

---

## 0. Empfohlener Demo-Pfad

Für die aktuelle Demo wird bewusst **kein Docker-Secret-Handling** verwendet.
Stattdessen nutzt das Standardprofil direkte Umgebungsvariablen über [deploy/portainer/docker-compose.demo.yml](deploy/portainer/docker-compose.demo.yml).

### Verwendete Dateien

- Demo-Compose: [deploy/portainer/docker-compose.demo.yml](deploy/portainer/docker-compose.demo.yml)
- Demo-Env-Vorlage: [deploy/portainer/.env.demo.example](deploy/portainer/.env.demo.example)
- Quantum-Defaultprofil: [.quantum](.quantum)

### Demo-Deploy mit quantum-cli

```bash
cd /Users/wilimzig/Documents/Projects/SVA/sva-studio
set -a
source deploy/portainer/.env.demo.example
set +a

export QUANTUM_API_KEY=ptr_...
quantum-cli stacks update --environment demo --endpoint sva --stack sva-studio --project . --wait --no-pre-pull
```

### Demo-Deploy mit Portainer

1. Stack-Datei aus [deploy/portainer/docker-compose.demo.yml](deploy/portainer/docker-compose.demo.yml) verwenden
2. Werte aus [deploy/portainer/.env.demo.example](deploy/portainer/.env.demo.example) in der Stack-UI als Environment Variables setzen
3. Stack aktualisieren

### Warum dieses Profil?

- Keine Swarm-Secrets für die Demo erforderlich
- Kein Secret-Provisioning auf dem Node nötig
- Ein Stack bleibt erhalten
- `node-005.sva` bleibt als Placement gesetzt
- Traefik-v1-kompatible Labels statt Traefik-v2-Router-Konfiguration
- Keine Healthchecks im Demo-Profil
- Keine `update_config`-/`rollback_config`-Blöcke im Demo-Profil
- Nur kanonischer Host `studio.smart-village.app` im Demo-Profil

---

## 1. Secrets vorbereiten

Dieser Abschnitt bleibt für das alternative Referenzprofil mit Swarm-Secrets erhalten.

### Verfügbare Secrets

Alle Secrets sind in `/Users/wilimzig/sva-secrets/` vorhanden:

| Secret File | Docker Secret Name | Zweck |
|---|---|---|
| `postgres-password.txt` | `sva_studio_postgres_password` | PostgreSQL Root-Password |
| `redis-password.txt` | `sva_studio_redis_password` | Redis Auth-Password |
| `app-db-password.txt` | `sva_studio_app_db_password` | App DB-User Password |
| `encryption-key.txt` | `sva_studio_app_encryption_key` | Session Encryption Key |
| `state-secret.txt` | `sva_studio_app_auth_state_secret` | OIDC State Secret |
| `oidc-client-secret.txt` | `sva_studio_app_auth_client_secret` | OIDC Client Secret |
| `pii-keyring.json` | `sva_studio_app_pii_keyring_json-k1` | PII Keyring (k1) |
| `keycloak-admin-client-secret.txt` | `sva_studio_keycloak_admin_client_secret` | Keycloak Admin Secret |

### Secrets hochladen & registrieren

#### **Option 1: Portainer REST API (empfohlen – kein SSH erforderlich)** ⭐

Scenario: Kein SSH-Zugang zu node-005.sva, aber Zugang zur Portainer Web-UI unter https://console.planetary-quantum.com/#!/64/docker/swarm

**Anforderungen:**
- Portainer API Token (erzeugen unter https://console.planetary-quantum.com/#!/settings/tokens)
- `jq` installiert: `brew install jq`
- bash-Skript verfügbar

**Ausführung:**
```bash
# Secrets-Verzeichnis vorbereiten (falls nicht vorhanden)
mkdir -p ~/sva-secrets

# Portainer API Token als Umgebungsvariable
export PORTAINER_TOKEN="dpt_..."  # Von https://console.planetary-quantum.com/#!/settings/tokens

# Skript ausführen – erstellt alle 8 Secrets via API
chmod +x scripts/ops/create-secrets-portainer-api.sh
./scripts/ops/create-secrets-portainer-api.sh
```

Das Skript:
- Validiert Portainer-Zugang
- Erstellt alle 8 Secrets via REST API (keine SSH nötig!)
- Verifizt am Ende, dass alle Secrets vorhanden sind

**Vorteil:** Vollautomatisiert, kein direkter Node-Zugang erforderlich.

---

#### **Option 2: SSH + Docker CLI (klassisch)**

```bash
# 1. SSH zu node-005.sva verbinden:
ssh node-005.sva

# 2. Von lokalem Rechner in neuem Terminal: Secrets hochladen
cd /Users/wilimzig/sva-secrets
scp *.txt pii-keyring.json node-005.sva:/tmp/

# 3. Auf node-005.sva: Docker Secrets registrieren:
# PostgreSQL
docker secret create sva_studio_postgres_password < /tmp/postgres-password.txt

# Redis
docker secret create sva_studio_redis_password < /tmp/redis-password.txt

# App Secrets
docker secret create sva_studio_app_db_password < /tmp/app-db-password.txt
docker secret create sva_studio_app_encryption_key < /tmp/encryption-key.txt
docker secret create sva_studio_app_auth_state_secret < /tmp/state-secret.txt
docker secret create sva_studio_app_auth_client_secret < /tmp/oidc-client-secret.txt
docker secret create sva_studio_app_pii_keyring_json-k1 < /tmp/pii-keyring.json

# Keycloak
docker secret create sva_studio_keycloak_admin_client_secret < /tmp/keycloak-admin-client-secret.txt

# Verifizierung:
docker secret ls | grep sva_studio
```

---

#### **Option 3: Portainer Web-UI (manuell)**

1. Login: https://console.planetary-quantum.com/#!/64/docker/swarm
2. Navigiere zu **Secrets**
3. Klick **Create a new secret**
4. Wiederhole für alle 8 Secrets oben

---

## 2. Quantum-CLI konfigurieren

Die `.quantum` Datei ist bereits vorhanden unter `{repo_root}/.quantum`:

```yaml
---
version: "1.0"
compose: deploy/portainer/docker-compose.demo.yml
environments:
  - name: swarm-secrets
    compose: deploy/portainer/docker-compose.yml
```

### API-Key persistent speichern (optional):
```bash
mkdir -p ~/.config/quantum
cat > ~/.config/quantum/env << 'EOF'
QUANTUM_API_KEY=ptr_your-api-key-here
QUANTUM_HOST=https://console.planetary-quantum.com
EOF
```

### ⚠️ Hinweis: Secret-Management

**quantum-cli unterstützt KEIN Secret-Management.** (Siehe [Dokumentation](https://docs.planetary-quantum.com/reference/quantum-cli-reference/))

Für das aktuelle Demo-Profil sind Docker-Secrets nicht erforderlich.

Das alternative Referenzprofil `swarm-secrets` benötigt Secrets über eines der folgenden Verfahren:
- **Portainer REST API** (empfohlen – `scripts/ops/create-secrets-portainer-api.sh`)
- **Docker CLI** (SSH zu node-005.sva erforderlich)
- **Portainer Web-UI** (manuell, unter https://console.planetary-quantum.com/#!/64/docker/swarm)

---

## 3. Docker-Image

Das Docker-Image wurde bereits gebaut und zu GHCR gepusht:

```bash
ghcr.io/smart-village-solutions/sva-studio:latest
ghcr.io/smart-village-solutions/sva-studio:9722bd6
```

**Build-Prozess (falls neu):**
```bash
cd /Users/wilimzig/Documents/Projects/SVA/sva-studio
docker buildx build -f deploy/portainer/Dockerfile \
  -t ghcr.io/smart-village-solutions/sva-studio:latest \
  -t ghcr.io/smart-village-solutions/sva-studio:$(git rev-parse --short HEAD) \
  .
docker push ghcr.io/smart-village-solutions/sva-studio:latest
docker push ghcr.io/smart-village-solutions/sva-studio:$(git rev-parse --short HEAD)
```

---

## 4. Stack deployen

### Voraussetzungen:
- ✅ quantum-cli installiert (v2.9.1)
- ✅ API-Key gesetzt (QUANTUM_API_KEY)
- ✅ Demo-Umgebungsvariablen gesetzt
- ✅ External Network "public" existiert
- ✅ Traefik läuft im Swarm

### Deploy-Kommando:
```bash
cd /Users/wilimzig/Documents/Projects/SVA/sva-studio
export QUANTUM_API_KEY=ptr_... # Falls nicht persistent konfiguriert

# Stack Update mit Warten auf Completion
set -a
source deploy/portainer/.env.demo.example
set +a
quantum-cli stacks update --environment demo --endpoint sva --stack sva-studio --project . --wait --no-pre-pull

# Alternatives Referenzprofil mit Swarm-Secrets:
quantum-cli stacks update --environment swarm-secrets --endpoint sva --stack sva-studio --project . --wait --no-pre-pull

# Oder nur validieren (ohne Deploy):
quantum-cli validate --project .
```

### Status prüfen:
```bash
quantum-cli ps --endpoint sva --stack sva-studio
quantum-cli ps --endpoint sva --stack sva-studio --all  # Mit möglichen Failures
```

---

## 5. Häufige Probleme

### `postgres: non-zero exit (1)`
**Demo-Profil:** Prüfe `POSTGRES_PASSWORD` in [deploy/portainer/.env.demo.example](deploy/portainer/.env.demo.example) bzw. in der Portainer-Stack-UI.
**Referenzprofil:** Secret `sva_studio_postgres_password` prüfen.

### `app: No such image: ghcr.io/smart-village-solutions/sva-studio:...`
**Ursache:** Image nicht gepusht oder nicht pullbar auf dem Node.
**Lösung:**
```bash
# Lokal neu bauen & pushen
docker buildx build -f deploy/portainer/Dockerfile -t ghcr.io/smart-village-solutions/sva-studio:latest --push .
```

### `--user / QUANTUM_USER not set`
**Ursache:** quantum-cli Auth nicht aktiv.
**Lösung:**
```bash
export QUANTUM_API_KEY=ptr_...
quantum-cli auth status
```

---

## 6. Interne Abhängigkeiten

### Netzwerke (müssen existieren):
- **public** (overlay, extern) – für Traefik & HTTP-Ingress
- **internal** (overlay) – für interne Kommunikation (App ↔ DB ↔ Redis)

### Node-Platzierung:
Beide Services sind auf **node-005.sva** gepinnt:
```yaml
placement:
  constraints:
    - node.hostname == node-005.sva
```

Falls dieser Node nicht existiert oder nicht erreichbar ist, ändere diese Constraints in `deploy/portainer/docker-compose.yml`.

### Volumes (persistent):
- **postgres-data**
- **redis-data**

---

## 7. Nächste Schritte

Nach erfolgreichem Deploy:

1. **DB initialisieren** (erste Ausführung):
   ```bash
   # Via exec in laufenden Container
   quantum-cli exec --endpoint sva --stack sva-studio --service app \
     pnpm run db:migrate
   ```

2. **Health-Check:**
   ```bash
   curl https://<domain>/health/live
   ```

3. **Logs prüfen:**
   ```bash
   quantum-cli ps --endpoint sva --stack sva-studio --all
   ```

---

**Kontakt für Fragen:**
- quantum-cli Docs: https://docs.planetary-quantum.com/
- Repo: smart-village-solutions/sva-studio
- Branch: feat/add-swarm-portainer-deployment
