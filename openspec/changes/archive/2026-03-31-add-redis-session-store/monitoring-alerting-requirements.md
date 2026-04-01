# Monitoring & Alerting: Redis Session Store
## Anforderungen & Metriken

**Version:** 2.0
**Datum:** 31. März 2026
**Status:** Gültig für `Single Redis + Backup/Restore`

---

## 1. Monitoring-Anforderungen

### 1.1 Kritische Metriken

#### Redis-Konnektivität
```text
Metrik: redis_connection_status
Type: Gauge (0 = down, 1 = up)
Labels: environment, instance
Alert: CRITICAL wenn status == 0 für >30s
```

#### Session-Operationen
```text
Metrik: session_operations_total
Type: Counter
Labels: operation, status
Alert: CRITICAL wenn Error-Rate > 5 % für >5min
```

#### Session-Latenz
```text
Metrik: session_operation_duration_seconds
Type: Histogram
Labels: operation
Alert: HIGH wenn P99 > 500ms für >10min
```

#### Aktive Sessions
```text
Metrik: sessions_active
Type: Gauge
Labels: environment
Alert: INFO bei >80 % der geplanten Kapazität
```

#### Session-Erstellungs-Rate
```text
Metrik: sessions_created_total
Type: Counter
Labels: source
Alert: CRITICAL bei starker Abweichung vom üblichen Verlauf
```

### 1.2 Wichtige Zusatzmetriken

- `session_ttl_seconds` zur Prüfung korrekter TTL-Ableitung
- `session_encryption_errors_total` für Verschlüsselungs- und Schlüsselprobleme
- `redis_memory_used_bytes` für Kapazitäts- und Leckindikatoren
- `redis_tls_connections_active` zur Verifikation des gesicherten Betriebs

---

## 2. Alerting-Regeln

### 2.1 Verbindlicher Mindeststandard

Für den ersten Produktionsschnitt `Single Redis + Backup/Restore` gelten diese Regeln:

- `CRITICAL`: Redis nicht erreichbar länger als 30 Sekunden
- `CRITICAL`: Fehlerquote von Session-Operationen größer als 5 % über 5 Minuten
- `CRITICAL`: stark erhöhte Session-Erzeugungsrate als möglicher Missbrauchsindikator
- `HIGH`: P99-Latenz für Session-Operationen über 500 ms für 10 Minuten
- `HIGH`: Redis-Speicherauslastung über 90 %
- `HIGH`: Verschlüsselungskonfiguration fehlt oder ist fehlerhaft
- `INFO`: aktive Sessions über 80 % der geplanten Kapazität

### 2.2 Reaktion je Schweregrad

- `CRITICAL`: Incident eröffnen, On-Call alarmieren, Redis-Erreichbarkeit und Restore-Punkt prüfen
- `HIGH`: Team-Benachrichtigung, Kapazität oder Konfiguration prüfen, Eskalation bei anhaltender Wirkung
- `INFO`: Trend dokumentieren und im nächsten Betriebsreview auswerten

### 2.3 Beispielregeln

```yaml
Alert: RedisConnectionLost
Condition: redis_connection_status == 0 for 30s
Severity: CRITICAL
Action: On-Call alarmieren, Restore-Runbook prüfen
```

```yaml
Alert: SessionOperationErrorRate
Condition: |
  rate(session_operations_total{status="error"}[5m])
  / rate(session_operations_total[5m]) > 0.05
Severity: CRITICAL
Action: Incident eröffnen, Session- und Redis-Fehler prüfen
```

```yaml
Alert: HighSessionLatency
Condition: histogram_quantile(0.99, session_operation_duration_seconds) > 0.5
Severity: HIGH
Action: Redis CPU, Netzwerk, I/O und aktuelle Deployments prüfen
```

---

## 3. Retention und Auswertung

### 3.1 Mindestaufbewahrung

- Alert-Historie: mindestens 90 Tage
- Session- und Redis-Betriebsmetriken mit 1-Minuten-Auflösung: mindestens 30 Tage
- verdichtete Trenddaten für Kapazitätsplanung: mindestens 180 Tage

### 3.2 Zweckbindung

- Betriebsmetriken dienen Verfügbarkeit, Incident Response und Kapazitätsplanung
- Audit-Logs bleiben davon getrennt und folgen ihrer eigenen Aufbewahrungsregel
- Auswertungen zu Sessions dürfen keine unverschlüsselten Tokens oder andere schützenswerte Inhalte offenlegen

---

## 4. Nachfolgeoptionen

### 4.1 Mögliches späteres HA-Zielbild

Dieses Monitoring-Set ist kompatibel mit einem späteren Nachfolgechange für:

- `Redis Sentinel` als ersten HA-Ausbauschritt
- replizierte Single-Writer-Topologien mit kontrolliertem Failover
- erweitertes Capacity-Monitoring bei wachsender Session-Last

### 4.2 Post-Launch-Optimierungen

Nach dem ersten stabilen Betrieb können folgende Erweiterungen separat nachgezogen werden:

- feinere Session-TTL-Verteilungen
- SLO-basierte Alert-Schwellen pro Umgebung
- anomaliestützende Erkennung für auffällige Login-State-Muster
- zusätzliche Dashboards für Restore-Historie und Backup-Güte
