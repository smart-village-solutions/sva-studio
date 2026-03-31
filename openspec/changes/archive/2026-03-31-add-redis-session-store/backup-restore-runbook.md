# Backup & Restore Runbook: Redis Session Store

**Version:** 2.0
**Datum:** 31. März 2026
**Zielgruppe:** DevOps Engineers, Incident Responders
**Status:** Gültig für `Single Redis + Backup/Restore`

---

## 1. Überblick

### 1.1 Geltungsbereich

Dieses Runbook beschreibt den operativen Standard für den aktuell festgelegten
Betrieb des Redis-basierten Session-Stores:

- `staging`: Self-Hosted Redis
- `production`: Single Redis mit Backup/Restore
- kein Sentinel, kein Redis Cluster und kein automatisches Failover in diesem Change

Redis ist der technische Primärspeicher für aktive Sessions und Login-States.
Bei einem vollständigen Redis-Verlust können aktive Sitzungen verloren gehen.
Die Wiederherstellung dient primär dazu, ungeplante Ausfälle zu verkürzen,
nicht ein HA-System zu simulieren.

### 1.2 Persistence-Modi

**RDB (Snapshot-basiert)**
- Binary-Format, speichereffizient
- geeignet für regelmäßige Sicherungen
- erlaubt begrenzten Datenverlust zwischen zwei Snapshots

**AOF (Append-Only-File)**
- protokolliert Schreibvorgänge fortlaufend
- reduziert den maximalen Datenverlust
- erhöht Speicherbedarf und Recovery-Zeit

### 1.3 Verbindliche Betriebsstrategie

**Staging**
- Self-Hosted Redis
- RDB-Backups mindestens alle 6 Stunden
- AOF optional

**Production**
- Single Redis
- AOF aktiviert mit `appendfsync everysec`
- RDB-Snapshots mindestens stündlich
- tägliche externe Backups mit Aufbewahrung
- Restore statt automatischem Failover

### 1.4 Zielwerte

- `RPO`: bis zu 60 Minuten bei RDB-only, typischerweise deutlich geringer mit AOF
- `RTO`: Wiederanlauf des Session-Stores innerhalb von 30 Minuten nach erkanntem Redis-Ausfall
- Fachlicher Hinweis: Nutzer können bei Restore abgemeldet werden; das ist für dieses erste Betriebsmodell akzeptiert

---

## 2. Backup-Strategien

### 2.1 Manuelles RDB-Backup

**Schritt 1: Trigger BGSAVE**
```bash
redis-cli BGSAVE
docker-compose exec redis redis-cli BGSAVE
redis-cli LASTSAVE
```

**Schritt 2: Warten bis BGSAVE abgeschlossen**
```bash
docker-compose logs redis | grep "Background save"
redis-cli INFO persistence | grep "rdb_bgsave_in_progress"
```

**Schritt 3: Backup-Datei extrahieren**
```bash
docker-compose exec redis cat /data/dump.rdb > ~/backups/redis-$(date +%Y%m%d-%H%M%S).rdb
docker-compose exec redis cat /data/dump.rdb | gzip > ~/backups/redis-$(date +%Y%m%d-%H%M%S).rdb.gz
```

**Schritt 4: Integrität prüfen**
```bash
redis-check-rdb ~/backups/redis-20260331.rdb
```

**Schritt 5: In Backup-System hochladen**
```bash
aws s3 cp ~/backups/redis-20260331.rdb s3://sva-backups/redis/
gsutil cp ~/backups/redis-20260331.rdb gs://sva-backups/redis/
cp ~/backups/redis-20260331.rdb /mnt/backup-drive/redis/
```

### 2.2 Automatisiertes RDB-Backup

**Cron-Job Setup:**
```bash
crontab -e
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

echo "$(date): Starting RDB backup..."
redis-cli -h $REDIS_HOST -p $REDIS_PORT BGSAVE

while [ $(redis-cli -h $REDIS_HOST -p $REDIS_PORT INFO persistence | grep rdb_bgsave_in_progress | grep -o '[0-9]$') -eq 1 ]; do
  echo "$(date): Waiting for BGSAVE to complete..."
  sleep 5
done

FILENAME="redis-$(date +%Y%m%d-%H%M%S).rdb"
cp /var/lib/redis/dump.rdb "$BACKUP_DIR/$FILENAME"
gzip "$BACKUP_DIR/$FILENAME"
COMPRESSED_FILE="$BACKUP_DIR/${FILENAME}.gz"

aws s3 cp "$COMPRESSED_FILE" "$S3_BUCKET/$(date +%Y/%m)/"
find "$BACKUP_DIR" -name "redis-*.rdb.gz" -mtime +$RETENTION_DAYS -delete

if [ -f "$COMPRESSED_FILE" ]; then
  echo "$(date): Backup successful: $FILENAME"
else
  echo "$(date): ERROR - Backup failed!"
  exit 1
fi
```

### 2.3 AOF-Backup

**AOF-Konfiguration:**
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

**AOF-Rewrite und Sicherung:**
```bash
redis-cli BGREWRITEAOF
redis-cli BGSAVE
docker-compose exec redis cat /data/appendonly.aof > ~/backups/redis-aof-$(date +%Y%m%d).aof
aws s3 cp ~/backups/redis-aof-20260331.aof s3://sva-backups/redis/aof/
```

### 2.4 Aufbewahrung und Archivierung

- lokale operative Backups: mindestens 30 Tage
- externe verschlüsselte Backups: mindestens 90 Tage
- produktive Restore-Punkte: mindestens letzter erfolgreicher Tages- und Stundenstand
- Audit-Logs werden nicht im Redis-Backup archiviert, sondern über den separaten Audit-Pfad aufbewahrt
- Backups mit potenziellen Sessiondaten sind als vertrauliche Betriebsartefakte zu behandeln

---

## 3. Incident-Response und Restore

### 3.1 Auslöser für Incident und Restore

Ein Restore-Prozess wird gestartet, wenn mindestens einer der folgenden Fälle eintritt:

- `redis_connection_status == 0` und keine schnelle Wiederverbindung möglich ist
- Redis startet mit leerem oder beschädigtem Datenverzeichnis
- AOF oder RDB ist beschädigt und Redis kann nicht sauber hochfahren
- Redis ist zwar erreichbar, aber Sessions und Login-States fehlen unerwartet breitflächig

### 3.2 Sofortmaßnahmen

1. Schreibzugriffe auf Redis stoppen, wenn ein beschädigter Datenstand vermutet wird.
2. Incident erfassen und Zeitpunkt des Ausfalls festhalten.
3. Letzten bekannten gesunden Backup-Stand bestimmen.
4. Prüfen, ob ein regulärer Neustart ohne Restore möglich ist.
5. Nur wenn das fehlschlägt, Restore aus Backup einleiten.

### 3.3 Szenario A: Kompletter Redis-Ausfall

**Situation:** Redis-Container ist abgestürzt oder das Volume ist verloren gegangen.

**Restore-Schritte:**
```bash
docker-compose down redis
docker volume ls | grep redis
docker volume rm sva-studio_redis_data

aws s3 cp s3://sva-backups/redis/redis-20260331.rdb.gz ./redis-backup.rdb.gz
gunzip redis-backup.rdb.gz

docker-compose up -d redis
sleep 5
docker-compose down redis

VOLUME_PATH=$(docker volume inspect sva-studio_redis_data | grep Mountpoint | awk '{print $2}' | tr -d '\",')
cp redis-backup.rdb $VOLUME_PATH/dump.rdb
chown 999:999 $VOLUME_PATH/dump.rdb

docker-compose up -d redis
docker-compose logs redis | grep "ready to accept"
redis-cli DBSIZE
redis-cli KEYS "session:*" | wc -l
```

**Verifikation:**
```bash
redis-cli DBSIZE
redis-cli KEYS "session:*" | head -5
redis-cli GET "session:xyz123"
redis-cli TTL "session:xyz123"
```

### 3.4 Szenario B: Korrupte Daten oder falscher Encryption-Key

**Situation:** Redis ist erreichbar, aber Sessions können nicht entschlüsselt werden.

**Restore-Schritte:**
```bash
docker-compose exec redis redis-cli BGSAVE
docker-compose exec redis cat /data/dump.rdb > ~/redis-corrupt-$(date +%Y%m%d).rdb

grep ENCRYPTION_KEY .env.staging
docker-compose restart sva-studio-react

curl http://localhost:3000/api/auth/me -H "X-Session-ID: <session-id>"
```

Wenn Decryption weiter fehlschlägt:

```bash
docker-compose down sva-studio-react
docker-compose down redis

aws s3 ls s3://sva-backups/redis/ | tail -10
aws s3 cp s3://sva-backups/redis/redis-20260331-0100.rdb.gz ./redis-restore.rdb.gz
gunzip redis-restore.rdb.gz

docker volume rm sva-studio_redis_data
docker-compose up -d redis
sleep 5
docker-compose down redis

VOLUME_PATH=$(docker volume inspect sva-studio_redis_data | grep Mountpoint | awk '{print $2}' | tr -d '\",')
cp redis-restore.rdb $VOLUME_PATH/dump.rdb
chown 999:999 $VOLUME_PATH/dump.rdb

docker-compose up -d
```

### 3.5 Incident-Abschluss

Vor dem Schließen des Incidents müssen mindestens folgende Punkte dokumentiert sein:

- Ursache des Ausfalls
- verwendeter Restore-Punkt
- geschätzter Session-Verlust und Nutzerwirkung
- verstrichene `RTO`
- nötige Folgearbeiten für Monitoring, Backup-Frequenz oder Kapazität

---

## 4. Alerting und Betriebsentscheidungen

### 4.1 Kritische Alerts

- `redis_connection_status == 0` länger als 30 Sekunden
- Fehlerquote für `session_operations_total` größer als 5 % über 5 Minuten
- starke Anomalie bei Session-Erzeugung als möglicher Missbrauchsindikator

### 4.2 Hohe Priorität

- `p99(session_operation_duration_seconds) > 500ms` über 10 Minuten
- Redis-Speicherauslastung über 90 %
- fehlende oder fehlerhafte Verschlüsselungskonfiguration

### 4.3 Operative Standardreaktion

1. Redis-Erreichbarkeit prüfen.
2. Letzten erfolgreichen Snapshot und AOF-Status prüfen.
3. Session-Anomalie gegen Deployments oder Lastspitzen abgleichen.
4. Falls kein schneller Recover möglich ist, Restore nach Abschnitt 3 durchführen.

---

## 5. Tests und regelmäßige Validierung

### 5.1 Monatlicher Restore-Test

Mindestens monatlich ist ein kontrollierter Restore auf einer isolierten Umgebung durchzuführen:

```bash
aws s3 cp s3://sva-backups/redis/redis-20260324.rdb.gz ./test-backup.rdb.gz
gunzip test-backup.rdb.gz

docker run -d --name redis-test -p 6399:6379 \
  -v "$(pwd)/test-backup.rdb:/data/dump.rdb" \
  redis:7 redis-server --dir /data

sleep 5
redis-cli -p 6399 DBSIZE
redis-cli -p 6399 KEYS "session:*" | head -10
docker stop redis-test && docker rm redis-test
```

### 5.2 Quartalsweise Review

Quartalsweise sind diese Punkte zu prüfen:

- reicht `Single Redis + Backup/Restore` noch aus
- passt die Backup-Frequenz zur realen Last
- stimmen Retention und Datenschutzvorgaben noch
- ist ein späteres HA-Zielbild als Nachfolgechange nötig
