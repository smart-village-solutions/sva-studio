
# SVA Studio – Docker Swarm / Planetary Quantum Deployment

Status: **Docker-Image gebaut & gepusht** ✅ | **Secrets noch zu registrieren** ⏳

## Übersicht

Dieses Dokument beschreibt das Setup für den Deployment von sva-studio auf Planetary Quantum's Docker Swarm Cluster.

**Setup-Schritte:**
1. Secrets auf node-005.sva registrieren
2. .quantum Konfiguration validieren
3. Stack deployen mit quantum-cli

---

## 1. Secrets vorbereiten

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

**1a. SSH zu node-005.sva verbinden:**
```bash
ssh node-005.sva
```

**1b. Secrets hochladen (von deinem Lokal-Rechner in neuem Terminal):**
```bash
cd /Users/wilimzig/sva-secrets
scp *.txt pii-keyring.json node-005.sva:/tmp/
```

**1c. Auf node-005.sva: Docker Secrets registrieren:**
```bash
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
```

**Verifizierung:**
```bash
docker secret ls | grep sva_studio
```

---

## 2. Quantum-CLI konfigurieren

Die `.quantum` Datei ist bereits vorhanden unter `{repo_root}/.quantum`:

```yaml
---
version: "1.0"
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
- ✅ Secrets auf node-005.sva registriert
- ✅ External Network "public" existiert
- ✅ Traefik läuft im Swarm

### Deploy-Kommando:
```bash
cd /Users/wilimzig/Documents/Projects/SVA/sva-studio
export QUANTUM_API_KEY=ptr_... # Falls nicht persistent konfiguriert

# Stack Update mit Warten auf Completion
quantum-cli stack update --endpoint sva --wait sva-studio

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
**Ursache:** Secret `sva_studio_postgres_password` existiert nicht.  
**Lösung:** Siehe Schritt 1c.

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
