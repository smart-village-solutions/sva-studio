# Backup & Restore Runbook: Redis Session Store

**Version:** 1.0
**Datum:** 4. Februar 2026
**Zielgruppe:** DevOps Engineers, Incident Responders

---

## 1. Overview

### 1.1 Redis Persistence-Modi

**RDB (Snapshot-basiert)**
- Binary-Format, speichereffizient
- Verwendet `docker-compose exec redis redis-cli BGSAVE`
- Pro: Schnell, kompakt
- Con: Potenzielle Datenverluste zwischen Snapshots (in-flight sessions)

**AOF (Append-Only-File)**
- Textbasiert, alle Schreibvorgänge protokolliert
- Verwendet `docker-compose exec redis redis-cli BGREWRITEAOF`
- Pro: Maximale Konsistenz, keine Datenverluste
- Con: Größere Dateien, langsameres Replay beim Startup

### 1.2 Empfohlene Strategie

**Staging/Dev:**
- RDB alle 6 Stunden (cron job)
- AOF optional

**Production (HA-Setup):**
- RDB alle 1 Stunde (Sentinel repliziert)
- AOF enabled mit `fsync = everysec` (1-Sekunden-Datenverlust max)
- Redis Replication zu Secondary (failover)

---

## 2. Backup-Strategien

### 2.1 Manuelles RDB-Backup

**Schritt 1: Trigger BGSAVE**
```bash
# Lokale Redis-Instanz
redis-cli BGSAVE

# Docker-Container
docker-compose exec redis redis-cli BGSAVE

# Verifikation
redis-cli LASTSAVE  # Zeigt Unix-Timestamp des letzten Snapshots
```

**Schritt 2: Warten bis BGSAVE abgeschlossen**
```bash
# Logs überwachen
docker-compose logs redis | grep "Background save"

# Oder Status prüfen
redis-cli INFO persistence | grep "rdb_bgsave_in_progress"
# Sollte "0" sein wenn fertig
```

**Schritt 3: Backup-Datei extrahieren**
```bash
# Standard RDB-Pfad
docker-compose exec redis cat /data/dump.rdb > ~/backups/redis-$(date +%Y%m%d-%H%M%S).rdb

# Mit Kompression (optional)
docker-compose exec redis cat /data/dump.rdb | gzip > ~/backups/redis-$(date +%Y%m%d-%H%M%S).rdb.gz
```

**Schritt 4: Integrität prüfen**
```bash
# RDB-Datei validieren
redis-check-rdb ~/backups/redis-20260204.rdb
# Sollte zeigen: "valid RDB file"
```

**Schritt 5: In Backup-System hochladen**
```bash
# S3 Example
aws s3 cp ~/backups/redis-20260204.rdb s3://sva-backups/redis/

# Or Google Cloud Storage
gsutil cp ~/backups/redis-20260204.rdb gs://sva-backups/redis/

# Oder externe HDD
cp ~/backups/redis-20260204.rdb /mnt/backup-drive/redis/
```

### 2.2 Automatisiertes RDB-Backup (Cron)

**Cron-Job Setup (Linux/macOS):**
```bash
# Edit crontab
crontab -e

# Add: Täglich um 02:00 Uhr Backup
0 2 * * * /usr/local/bin/redis-backup.sh >> /var/log/redis-backup.log 2>&1
```

**Backup-Script (`/usr/local/bin/redis-backup.sh`):**
```bash
#!/bin/bash

set -e

BACKUP_DIR="/backups/redis"
RETENTION_DAYS=30
REDIS_HOST="localhost"
REDIS_PORT=6379
S3_BUCKET="s3://sva-backups/redis"

# 1. Trigger backup
echo "$(date): Starting RDB backup..."
redis-cli -h $REDIS_HOST -p $REDIS_PORT BGSAVE

# 2. Wait for completion
while [ $(redis-cli -h $REDIS_HOST -p $REDIS_PORT INFO persistence | grep rdb_bgsave_in_progress | grep -o '[0-9]$') -eq 1 ]; do
  echo "$(date): Waiting for BGSAVE to complete..."
  sleep 5
done

# 3. Copy backup
FILENAME="redis-$(date +%Y%m%d-%H%M%S).rdb"
cp /var/lib/redis/dump.rdb "$BACKUP_DIR/$FILENAME"

# 4. Compress
gzip "$BACKUP_DIR/$FILENAME"
COMPRESSED_FILE="$BACKUP_DIR/${FILENAME}.gz"

# 5. Upload to S3
aws s3 cp "$COMPRESSED_FILE" "$S3_BUCKET/$(date +%Y/%m)/" --storage-class GLACIER

# 6. Local rotation (keep last 30 days)
find "$BACKUP_DIR" -name "redis-*.rdb.gz" -mtime +$RETENTION_DAYS -delete

# 7. Verify
if [ -f "$COMPRESSED_FILE" ]; then
  echo "$(date): Backup successful: $FILENAME"
  # Optional: Send metrics to monitoring
  echo "redis_backup_success 1 $(date +%s)" | nc -w0 -u monitoring.local 8125
else
  echo "$(date): ERROR - Backup failed!"
  exit 1
fi
```

**Machen executable:**
```bash
chmod +x /usr/local/bin/redis-backup.sh
```

### 2.3 AOF-Backup

**Enable AOF in docker-compose.yml:**
```yaml
services:
  redis:
    command: redis-server
      --dir /data
      --appendonly yes
      --appendfsync everysec
      --auto-aof-rewrite-percentage 100
      --auto-aof-rewrite-min-size 64mb
```

**AOF-Rewrite triggern:**
```bash
# Manuell
redis-cli BGREWRITEAOF

# AOF-Datei komprimieren (nach Rewrite)
gzip /data/appendonly.aof
```

**Backup der AOF-Datei:**
```bash
# Während AOF wird geschrieben - Redis pausieren (optional)
redis-cli BGSAVE  # Auch RDB erstellen
docker-compose exec redis cat /data/appendonly.aof > ~/backups/redis-aof-$(date +%Y%m%d).aof

# Upload
aws s3 cp ~/backups/redis-aof-20260204.aof s3://sva-backups/redis/aof/
```

---

## 3. Restore-Szenarien

### 3.1 Scenario A: Kompletter Redis-Ausfall (Fresh Start)

**Situation:** Redis-Container ist crasht, Datenbank ist leer

**Restore-Steps:**

```bash
# 1. Stop Redis
docker-compose down redis

# 2. Verify old data is gone
docker volume ls | grep redis
# If volume still exists, remove it
docker volume rm sva-studio_redis_data

# 3. Restore from backup
aws s3 cp s3://sva-backups/redis/redis-20260204.rdb ./redis-backup.rdb
gunzip redis-backup.rdb.gz

# 4. Prepare volume
docker-compose up -d redis  # Erstellt frisches volume
# Wait 5s for startup
sleep 5
docker-compose down redis

# 5. Copy backup-datei in Redis volume
# Get volume mount path
VOLUME_PATH=$(docker volume inspect sva-studio_redis_data | grep Mountpoint | awk '{print $2}' | tr -d '",')
cp redis-backup.rdb $VOLUME_PATH/dump.rdb
chown 999:999 $VOLUME_PATH/dump.rdb  # Redis UID:GID

# 6. Start Redis
docker-compose up -d redis

# 7. Verify restore
docker-compose logs redis | grep "ready to accept"
redis-cli DBSIZE
redis-cli KEYS "session:*" | wc -l
```

**Verification:**
```bash
# Check session count
redis-cli DBSIZE
# Expected: Number of sessions matches backup

# Spot-check sessions
redis-cli KEYS "session:*" | head -5
redis-cli GET "session:xyz123"
# Should return encrypted session data

# Check TTLs
redis-cli TTL "session:xyz123"
# Should show remaining seconds (not -1)
```

### 3.2 Scenario B: Korrupte Daten / Encryption-Key-Fehler

**Situation:** Sessions sind zurückgestellt aber decryption schlägt fehl (ENCRYPTION_KEY falsch)

**Restore-Steps:**

```bash
# 1. Checkpoint current Redis (für Investigation)
docker-compose exec redis redis-cli BGSAVE
docker-compose exec redis cat /data/dump.rdb > ~/redis-corrupt-$(date +%Y%m%d).rdb

# 2. Check ENCRYPTION_KEY
grep ENCRYPTION_KEY .env.staging
# Falls falsch: Update mit korrektem Key

# 3. Restart mit korrektem Key
docker-compose restart sva-studio-react  # Nicht Redis!

# 4. Test if sessions are now readable
curl http://localhost:3000/api/auth/me -H "X-Session-ID: <session-id>"
# Should return 200 with decrypted session data

# 5. Falls immer noch Failed: Rollback zu letztem guten Backup
## a. Stop services
docker-compose down sva-studio-react
docker-compose down redis

## b. Restore previous backup (vor Corruption)
# Find good backup from 1h ago
aws s3 ls s3://sva-backups/redis/ | tail -10
aws s3 cp s3://sva-backups/redis/redis-20260204-0100.rdb.gz ./redis-restore.rdb.gz
gunzip redis-restore.rdb.gz

## c. Clear current Redis data
docker volume rm sva-studio_redis_data

## d. Restore & start
docker-compose up -d redis
sleep 5
docker-compose down redis
VOLUME_PATH=$(docker volume inspect sva-studio_redis_data | grep Mountpoint | awk '{print $2}' | tr -d '",')
cp redis-restore.rdb $VOLUME_PATH/dump.rdb
chown 999:999 $VOLUME_PATH/dump.rdb
docker-compose up -d

# 6. Accept data loss from last hour
# All sessions from last hour are lost (users need to re-login)
```

### 3.3 Scenario C: Incremental Recovery (AOF)

**Situation:** Redis-Daten sind teils ok, aber einzelne Sessions corrupted

**Restore-Steps (nur mit AOF enabled):**

```bash
# 1. Stop Redis
docker-compose down redis

# 2. Export AOF zu human-readable format
redis-cli --rdb /tmp/redis.rdb --pipe < /data/appendonly.aof

# 3. Inspect AOF-Einträge (optional - für debugging)
# AOF ist Textformat: *3\r\n$3\r\nSET\r\n$7\r\n...
# Kannst du mit `less` inspizieren für Fehler

# 4. Reload Redis mit AOF (all commands replayed)
docker-compose up -d redis
docker-compose logs redis | grep "Ready to accept connections"

# 5. Verify sessions
redis-cli DBSIZE
redis-cli KEYS "session:*" | wc -l

# 6. Falls spezifische Sessions corrupted sind
# Manuelle Deletion möglich:
redis-cli DEL "session:corrupted-session-id"
```

---

## 4. Disaster Recovery Plan

### 4.1 RTO/RPO Targets

| Szenario | RTO | RPO | Recovery-Method |
|----------|-----|-----|-----------------|
| **Staging-Datenbank-Verlust** | 30 min | 1 Tag | Restore from S3 daily backup |
| **Production-Single-Node-Ausfall** | 5 min | 0 min | Failover zu Redis Sentinel Replica |
| **Production-Datenbank-Corruption** | 15 min | 15 min | Restore from hourly S3 backup |
| **Encryption-Key-Verlust** | 2 h | 1 h | Restore from Key-Vault + DB-Restore |

### 4.2 High-Availability Setup (Production)

**Redis Sentinel (3-Node Cluster):**
```yaml
# docker-compose.yml (Production HA)
version: '3.8'

services:
  # Primary Redis
  redis-master:
    image: redis:7
    command: redis-server --port 6379
    volumes:
      - redis-master-data:/data
    networks:
      - backend

  # Replica 1
  redis-replica1:
    image: redis:7
    command: redis-server --port 6379 --slaveof redis-master 6379
    volumes:
      - redis-replica1-data:/data
    networks:
      - backend
    depends_on:
      - redis-master

  # Replica 2
  redis-replica2:
    image: redis:7
    command: redis-server --port 6379 --slaveof redis-master 6379
    volumes:
      - redis-replica2-data:/data
    networks:
      - backend
    depends_on:
      - redis-master

  # Sentinel 1
  sentinel1:
    image: redis:7
    command: redis-sentinel /etc/redis/sentinel.conf --port 26379
    volumes:
      - ./sentinel-1.conf:/etc/redis/sentinel.conf
    networks:
      - backend
    depends_on:
      - redis-master

  # ... Sentinel 2 & 3 ...

volumes:
  redis-master-data:
  redis-replica1-data:
  redis-replica2-data:
```

**Sentinel Failover automatisch:**
- Wenn Master-Node down → Sentinel wählt automatisch Replica als neue Master
- Clients reconnect mit VIP (Virtual IP) oder DNS-Name
- Zero-downtime failover (bei richtigem Connection-Retry)

### 4.3 Cross-Region Backup

**Für Disaster Recovery (z.B. Rechenzentrum-Ausfall):**

```bash
# Backup in verschiedene Regionen
aws s3 cp redis-backup.rdb s3://sva-backups-eu-west-1/redis/
aws s3 cp redis-backup.rdb s3://sva-backups-us-east-1/redis/

# Oder mit GCP
gsutil -m cp redis-backup.rdb gs://sva-backups-eu/redis/
gsutil -m cp redis-backup.rdb gs://sva-backups-us/redis/
```

---

## 5. Testing & Validation

### 5.1 Regelmäßige Backup-Tests

**Monatlich (1. des Monats):**
```bash
#!/bin/bash
# Test-Restore durchführen auf Staging

# 1. Get latest backup from S3
aws s3 cp s3://sva-backups/redis/$(date -d "7 days ago" +%Y/%m)/redis-*.rdb.gz ./test-backup.rdb.gz
gunzip test-backup.rdb.gz

# 2. Spin up test Redis in Docker
docker run -d --name redis-test -p 6399:6379 \
  -v "$(pwd)/test-backup.rdb:/data/dump.rdb" \
  redis:7 redis-server --dir /data

# 3. Verify restore
sleep 5
redis-cli -p 6399 DBSIZE
redis-cli -p 6399 KEYS "session:*" | head -10

# 4. Test decryption (spot-check)
SESSION_ID=$(redis-cli -p 6399 KEYS "session:*" | head -1)
ENCRYPTED=$(redis-cli -p 6399 GET "$SESSION_ID")
echo "Session $SESSION_ID:"
echo "$ENCRYPTED" | jq . 2>/dev/null || echo "Encrypted format: OK"

# 5. Cleanup
docker stop redis-test && docker rm redis-test
```

### 5.2 RTO-Test (Failover-Test)

**Monatlich auf Staging:**
```bash
#!/bin/bash
# Simulate Redis outage + failover

echo "[$(date)] Starting RTO test..."

# 1. Kill Redis
docker-compose kill redis
echo "[$(date)] Redis killed - measuring RTO..."

# 2. Start failover timer
START_TIME=$(date +%s%N | cut -b1-13)

# 3. Restore from backup
# (Steps from Section 3.1)

# 4. When Redis is ready
docker-compose exec redis redis-cli PING
END_TIME=$(date +%s%N | cut -b1-13)

RTO_MS=$((($END_TIME - $START_TIME)))
echo "[$(date)] RTO: ${RTO_MS}ms"

if [ $RTO_MS -lt 300000 ]; then  # 5 minutes
  echo "✅ RTO test PASSED"
else
  echo "❌ RTO test FAILED - took too long"
  exit 1
fi
```

---

## 6. Troubleshooting

### Problem: BGSAVE nimmt zu lange

**Ursachen:**
- Redis-Speicher sehr groß (> 10GB)
- Disk-I/O bottleneck
- CPU-Last

**Lösung:**
```bash
# 1. Check Redis memory
redis-cli INFO memory | grep used_memory_human

# 2. Check Disk Speed
fio --name=randwrite --ioengine=libaio --iodepth=16 \
  --rw=randwrite --bs=4k --direct=1 --size=1G --numjobs=1

# 3. Falls zu langsam: Increase disk IOPS
# Bei cloud: Upgrade disk to faster tier
# Bei lokal: Prüfe HDD vs SSD

# 4. Reduce Redis memory
# Implement session TTL cleanup
redis-cli EVAL "return redis.call('del', unpack(redis.call('keys', 'session:*')))" 0
```

### Problem: RDB-Datei ist corrupted

**Symptoms:** `redis-check-rdb` zeigt Fehler

**Lösung:**
```bash
# 1. Versuch mit redis-check-rdb (built-in)
redis-check-rdb /path/to/dump.rdb

# 2. Falls Fehler: Try redis-cli --rdb
redis-cli --rdb /tmp/redis-fixed.rdb --pipe

# 3. Falls das auch fehlschlägt: Restore von älterem Backup
aws s3 ls s3://sva-backups/redis/ | tail -5
# Pick backup von 1-2 Stunden vorher
```

### Problem: AOF ist zu groß

**Symptoms:** `/data/appendonly.aof` > 5GB

**Lösung:**
```bash
# Trigger AOF-Rewrite
redis-cli BGREWRITEAOF

# Überwachen
watch -n 1 'ls -lh /data/appendonly.aof'

# Nach Rewrite: komprimieren & archivieren
gzip /data/appendonly.aof
aws s3 cp /data/appendonly.aof.gz s3://sva-backups/redis/aof/
```

---

## 7. Checkliste für Incident Response

### Wenn Redis-Session-Daten verloren:

- [ ] Immediate: Notify Ops + Security Team
- [ ] Within 15 min: Start restore process (Section 3)
- [ ] Within 30 min: Verify restored data integrity
- [ ] Within 1h: All services back online
- [ ] Post-Incident: Root-cause analysis + preventive measures

### Wenn Backup selbst corrupted:

- [ ] Check multiple backups (aus verschiedenen Tagen)
- [ ] Verify checksums in S3 (ETag mismatch?)
- [ ] Restore from geographically different backup location
- [ ] Implement backup validation tests (Section 5.1)

---

## 8. Automatisierte Restore-Automation (Optional)

**Kubernetes CronJob für tägliche Backup-Validierung:**

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: redis-backup-validation
  namespace: sva-system
spec:
  schedule: "0 3 * * *"  # Every day at 3 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup-validator
            image: redis:7
            command:
            - /bin/sh
            - -c
            - |
              set -e
              # Download latest backup
              aws s3 cp s3://sva-backups/redis/$(date +%Y/%m/%d)/redis-latest.rdb.gz /tmp/
              gunzip /tmp/redis-latest.rdb.gz

              # Validate
              redis-check-rdb /tmp/redis-latest.rdb
              echo "✅ Backup validation successful"
          restartPolicy: OnFailure
          serviceAccountName: backup-validator
```

---

**Last Updated:** 4. Februar 2026
**Next Review:** Nach Production-Deployment