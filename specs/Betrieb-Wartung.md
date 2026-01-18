# Betrieb und Wartung

Die Anforderungen an Betrieb und Wartung stellen sicher, dass das CMS 2.0 auch von kleineren Kommunen und externen Dienstleistern effizient betrieben und gewartet werden kann.

## Zweck und Mehrwert

**Herausforderungen:**
* Kommunen haben oft begrenzte IT-Ressourcen und -Kenntnisse
* Externe Dienstleister müssen das System schnell übernehmen können
* Wartungsaufwand muss minimiert werden (automatische Updates, Self-Healing)
* 24/7-Betrieb erforderlich bei begrenztem Personal
* Sicherheitsupdates müssen zeitnah eingespielt werden können

**Nutzen:**
* **Für Kommunen**: Geringer Wartungsaufwand, planbare Kosten, hohe Verfügbarkeit
* **Für IT-Dienstleister**: Schnelle Einarbeitung, standardisierte Prozesse, automatisiertes Monitoring
* **Für Administrator:innen**: Klare Wartungspläne, automatische Backups, einfache Updates

---

## Installation und Deployment

### Einfache Installation

**Anforderungen:**
* **One-Click-Installation für Standard-Szenarien**:
  * Installer-Skript für Linux (Ubuntu/Debian, RHEL/CentOS)
  * Docker-Compose-Setup für Container-Deployment
  * Helm-Chart für Kubernetes-Deployment
  * Automatische Erkennung und Installation von Abhängigkeiten
* **Installationsvarianten**:
  * All-in-One (CMS + Datenbank + Web-Server auf einem Server)
  * Multi-Server (getrennte DB, App-Server, Load-Balancer)
  * Cloud-native (Kubernetes, Managed Services)
  * Development-Setup (lokale Entwicklungsumgebung mit Docker)
* **Setup-Wizard**:
  * Web-basierter Installations-Assistent
  * Schritt-für-Schritt-Anleitung (7 Schritte: System-Check, Datenbank-Config, Admin-Account, SMTP-Config, Systemeinstellungen, Sicherheit, Abschluss)
  * Automatische System-Checks (PHP-Version, Speicherplatz, Berechtigungen, Ports)
  * Pre-Flight-Checks mit Warnungen und Empfehlungen
* **Rollback-Mechanismus**:
  * Automatisches Backup vor Installation
  * Rollback-Skript bei fehlgeschlagener Installation
  * Restore-to-previous-state-Funktion

**Messkriterium:**
* Installation von Null auf lauffähiges System in < 30 Minuten
* Setup-Wizard deckt 90% der Standard-Szenarien ab
* Mindestens 3 Deployment-Varianten (Bare-Metal, Docker, Kubernetes) dokumentiert
* Erfolgsrate der Installation > 95% (basierend auf Telemetrie-Daten)
* Rollback funktioniert in 100% der Fälle

### Systemanforderungen

**Anforderungen:**
* **Minimale Anforderungen (Single-Server, bis 1.000 Nutzer:innen)**:
  * CPU: 2 Cores, 2 GHz
  * RAM: 4 GB
  * Speicher: 50 GB SSD
  * Betriebssystem: Ubuntu 22.04 LTS, Debian 12, RHEL 8+, oder Docker
* **Empfohlene Anforderungen (bis 10.000 Nutzer:innen)**:
  * CPU: 4 Cores, 3 GHz
  * RAM: 16 GB
  * Speicher: 200 GB SSD (RAID 1 für Daten)
  * Betriebssystem: Ubuntu 22.04 LTS oder Kubernetes-Cluster
* **Enterprise-Anforderungen (> 10.000 Nutzer:innen)**:
  * Multi-Server-Setup (Load-Balancer, mehrere App-Server, DB-Cluster)
  * CPU: 8+ Cores pro App-Server
  * RAM: 32+ GB pro App-Server
  * Speicher: 1+ TB SSD (RAID 10), separater Storage für Medien
  * CDN für statische Assets und Bilder
* **Software-Anforderungen**:
  * Web-Server: Nginx 1.20+ oder Apache 2.4+
  * PHP: 8.2+ (mit Extensions: pdo_pgsql, gd, curl, mbstring, xml, zip, intl)
  * Datenbank: PostgreSQL 14+ oder MySQL 8.0+
  * Redis: 6.0+ (für Caching und Sessions)
  * Node.js: 18 LTS+ (für Build-Prozesse)

**Messkriterium:**
* System läuft stabil auf Mindestanforderungen mit bis zu 1.000 aktiven Nutzer:innen
* Performance-Benchmarks für verschiedene Hardware-Konfigurationen dokumentiert
* Skalierungsplan für wachsende Nutzer:innenzahlen vorhanden

### Deployment-Strategien

**Anforderungen:**
* **Blue-Green-Deployment**:
  * Parallelbetrieb von alter (blue) und neuer (green) Version
  * Traffic-Umschaltung ohne Downtime
  * Sofortiger Rollback bei Problemen
* **Canary-Deployment**:
  * Schrittweise Ausrollung neuer Versionen (z.B. 10% → 50% → 100% des Traffics)
  * Monitoring und automatischer Rollback bei erhöhter Fehlerrate
* **Rolling-Updates**:
  * Sukzessive Update einzelner Server/Pods
  * Keine Downtime während des Updates
  * Health-Checks zwischen Updates
* **Zero-Downtime-Updates**:
  * Datenbank-Migrationen rückwärtskompatibel
  * Feature-Flags für neue Funktionen
  * Graceful Shutdown von Prozessen

**Messkriterium:**
* Updates ohne Downtime möglich (< 1 Sekunde Unterbrechung)
* Rollback in < 2 Minuten durchführbar
* Automatische Health-Checks nach jedem Deployment-Schritt

---

## Wartung und Updates

### Automatische Updates

**Anforderungen:**
* **Update-Kanäle**:
  * Stable (vierteljährlich, produktionsreif)
  * Beta (monatlich, für Early Adopters)
  * Nightly (täglich, nur für Entwicklung/Testing)
* **Automatische Update-Installation**:
  * Optional: Automatisches Installieren von Sicherheitsupdates
  * Konfigurierbar: Zeitfenster für Updates (z.B. nachts 2-4 Uhr)
  * Pre-Update-Backup automatisch erstellt
  * Post-Update-Tests (Smoke-Tests) automatisch durchgeführt
* **Update-Benachrichtigungen**:
  * E-Mail-Benachrichtigung an Admins bei verfügbaren Updates
  * In-App-Notification: "Neue Version verfügbar"
  * Changelog mit allen Änderungen anzeigen
  * Security-Advisories bei kritischen Sicherheitsupdates
* **Rollback-Mechanismus**:
  * Ein-Klick-Rollback zur vorherigen Version
  * Automatischer Rollback bei fehlgeschlagenen Updates
  * Datenbank-Rollback (wenn nötig)

**Messkriterium:**
* Sicherheitsupdates werden innerhalb von 24 Stunden nach Veröffentlichung installiert (wenn Auto-Update aktiviert)
* Update-Erfolgsrate > 98%
* Rollback-Zeit < 5 Minuten
* Alle Updates in < 15 Minuten abgeschlossen (inklusive DB-Migrationen)

### Patch-Management

**Anforderungen:**
* **Kritische Sicherheitspatches**:
  * Hotfix-Releases bei kritischen Sicherheitslücken (CVE-Score > 7.0)
  * Out-of-Band-Updates außerhalb regulärer Release-Zyklen
  * Schnelle Bereitstellung (< 48 Stunden nach Bekanntwerden)
* **Patch-Testen**:
  * Automatische Tests vor Patch-Veröffentlichung
  * Staging-Umgebung für manuelle Tests empfohlen
  * Rollback-Plan für jeden Patch
* **Patch-Historie**:
  * Übersicht aller installierten Patches im CMS
  * Changelog und CVE-Referenzen
  * Audit-Log für Patch-Installationen

**Messkriterium:**
* Kritische Sicherheitspatches innerhalb von 48 Stunden verfügbar
* Patch-Erfolgsrate > 99%
* Alle Patches rückwärtskompatibel innerhalb Major-Version

### Wartungsmodus

**Anforderungen:**
* **Aktivierung des Wartungsmodus**:
  * Ein-Klick-Aktivierung im CMS (Admin-Panel)
  * CLI-Befehl für Wartungsmodus
  * Automatische Aktivierung bei kritischen Fehlern (Circuit-Breaker)
* **Wartungsmodus-Funktionen**:
  * Anzeige einer Wartungsseite für Besucher:innen
  * Admin-Zugriff weiterhin möglich (über spezielle URL oder IP-Whitelist)
  * API-Endpoints blockiert (außer Read-Only)
  * Zeitplan konfigurierbar: "Wartung geplant von ... bis ..."
* **Wartungsmodus-Seite anpassen**:
  * Eigene Wartungsseite hochladen (HTML/CSS)
  * Countdown bis Ende der Wartung
  * Kontaktinformationen anzeigen
  * Mehrsprachig

**Messkriterium:**
* Wartungsmodus in < 10 Sekunden aktiviert/deaktiviert
* Admin-Zugriff während Wartungsmodus funktioniert
* Wartungsseite in mindestens 2 Sprachen verfügbar

---

## Monitoring und Überwachung

### System-Monitoring

**Anforderungen:**
* **Performance-Metriken**:
  * CPU-Auslastung (pro Core, Durchschnitt, Max)
  * RAM-Nutzung (Used, Free, Cached)
  * Disk-I/O (Read/Write MB/s, IOPS)
  * Netzwerk-Traffic (In/Out MB/s)
  * Durchschnittliche Response-Zeit (ms)
  * Request-Rate (Requests pro Sekunde)
* **Application-Metriken**:
  * Anzahl aktiver Nutzer:innen (aktuell online)
  * API-Request-Rate (pro Endpoint)
  * Fehlerrate (4xx, 5xx HTTP-Status)
  * Datenbank-Query-Performance (Slow Queries)
  * Cache-Hit-Rate (Redis, Browser-Cache)
  * Queue-Länge (Background-Jobs)
* **Datenbank-Monitoring**:
  * Aktive Connections
  * Slow Queries (> 1 Sekunde)
  * Deadlocks und Transaktions-Fehler
  * Tabellen-Größe und Index-Nutzung
  * Replikations-Lag (bei Master-Slave-Setup)
* **Externe Abhängigkeiten**:
  * API-Verfügbarkeit (Geocoding, Wetter-APIs, etc.)
  * SMTP-Server-Status
  * CDN-Verfügbarkeit
  * DNS-Auflösung

**Messkriterium:**
* Metriken werden mindestens alle 60 Sekunden aktualisiert
* Historische Daten für mindestens 30 Tage gespeichert
* Export von Metriken in Standard-Formaten (Prometheus, StatsD, Graphite)

### Alerting und Benachrichtigungen

**Anforderungen:**
* **Alert-Regeln konfigurieren**:
  * Schwellwerte für alle Metriken definierbar (z.B. CPU > 80%, RAM > 90%)
  * Kombinierte Alerts (z.B. CPU > 80% UND Response-Zeit > 2s)
  * Zeitfenster für Alerts (z.B. nur werktags 8-18 Uhr)
* **Alert-Kanäle**:
  * E-Mail (an Admin-Gruppe oder individuelle Adressen)
  * SMS (via Twilio, Nexmo)
  * Slack / Microsoft Teams
  * PagerDuty / Opsgenie (für On-Call-Management)
  * Webhook (Custom-Integration)
* **Alert-Prioritäten**:
  * Critical (sofort handeln): System offline, Datenbank down, Sicherheitsvorfall
  * Warning (bald handeln): CPU > 80%, Disk > 85%, hohe Fehlerrate
  * Info (FYI): Backup abgeschlossen, Update verfügbar
* **Alert-Aggregation und De-Duplication**:
  * Mehrere gleichartige Alerts werden gruppiert
  * Wiederholte Alerts werden unterdrückt (max. 1x pro Stunde)
  * Eskalation bei nicht-bestätigten Critical-Alerts (nach 15 Min. nochmal benachrichtigen)

**Messkriterium:**
* Alerts werden innerhalb von 60 Sekunden nach Schwellwert-Überschreitung gesendet
* Mindestens 3 Alert-Kanäle verfügbar (E-Mail, Slack, Webhook)
* False-Positive-Rate < 5%

### Logging und Audit-Logs

**Anforderungen:**
* **Application-Logs**:
  * Log-Level konfigurierbar (DEBUG, INFO, WARNING, ERROR, CRITICAL)
  * Strukturierte Logs (JSON-Format) für einfaches Parsing
  * Request-Logs mit Korrelations-ID (für Tracing über mehrere Services)
  * Performance-Logs (Slow Requests > 2 Sekunden)
* **System-Logs**:
  * Web-Server-Access-Logs (Nginx, Apache)
  * Error-Logs (PHP-Errors, Segfaults, etc.)
  * Datenbank-Logs (PostgreSQL/MySQL)
  * Cron-Job-Logs
* **Audit-Logs** (siehe auch CMS.md):
  * Alle kritischen Aktionen: Login, Logout, Inhalts-Änderungen, Nutzer-Verwaltung, Konfig-Änderungen
  * Unveränderlich (Append-Only)
  * DSGVO-konform (personenbezogene Daten verschlüsselt)
  * Retention: 90 Tage Standard, bis zu 2 Jahre konfigurierbar
* **Log-Aggregation**:
  * Zentrale Log-Sammlung (Elasticsearch, Loki, Splunk)
  * Log-Rotation (täglich oder bei > 100 MB)
  * Archivierung alter Logs (S3, NAS)
* **Log-Analyse**:
  * Dashboard für häufige Fehler
  * Suche und Filterung nach Zeit, Log-Level, Nutzer, IP
  * Anomalie-Erkennung (ML-basiert): Ungewöhnliche Patterns erkennen

**Messkriterium:**
* Alle Logs strukturiert (JSON) und mit Zeitstempel (ISO 8601)
* Log-Retention mindestens 30 Tage
* Audit-Logs unveränderlich (kryptografische Signatur)
* Volltext-Suche in Logs in < 2 Sekunden

---

## Backup und Disaster Recovery

### Automatische Backups

**Anforderungen:**
* **Backup-Strategien**:
  * **Full-Backup**: Komplettes Backup (Datenbank + Dateien + Konfiguration)
  * **Incremental-Backup**: Nur geänderte Dateien seit letztem Backup
  * **Differential-Backup**: Alle Änderungen seit letztem Full-Backup
* **Backup-Häufigkeit**:
  * Datenbank: Täglich (Full) + stündlich (Incremental)
  * Dateien/Medien: Täglich (Incremental)
  * Konfiguration: Bei jeder Änderung
* **Backup-Speicherorte**:
  * Lokal (separater Storage, nicht auf gleicher Disk)
  * Remote (NAS, NFS, S3, Azure Blob Storage, Google Cloud Storage)
  * Offsite (geografisch getrennt, für Disaster Recovery)
  * Verschlüsselt (AES-256) mit Key-Management
* **Backup-Retention**:
  * Täglich: 7 Tage
  * Wöchentlich: 4 Wochen
  * Monatlich: 12 Monate
  * Jährlich: 5 Jahre (optional, für Archivierung)
* **Backup-Verifikation**:
  * Automatische Integritätsprüfung (Checksumme)
  * Regelmäßige Restore-Tests (monatlich)
  * Benachrichtigung bei fehlgeschlagenen Backups

**Messkriterium:**
* Backup-Erfolgsrate > 99%
* Full-Backup in < 2 Stunden abgeschlossen
* Backup-Größe < 50% der Original-Daten (durch Kompression)
* Benachrichtigung bei fehlgeschlagenen Backups innerhalb von 15 Minuten

### Backup-Verwaltung im CMS

**Anforderungen:**
* **Backup-Dashboard im Admin-Panel**:
  * Übersicht aller verfügbaren Backups (Liste mit Datum, Zeit, Typ, Größe, Status)
  * Filter nach Typ (Full, Incremental, Differential, Manuell)
  * Sortierung nach Datum (neueste zuerst)
  * Status-Anzeige: Erfolgreich ✓, Fehlgeschlagen ✗, In Progress ⟳
  * Speicherplatz-Übersicht: Genutzter Backup-Storage vs. verfügbarer Platz
* **Manuelle Backup-Erstellung**:
  * "Backup jetzt erstellen"-Button im Admin-Panel
  * Auswahl des Backup-Typs (Full, Nur Datenbank, Nur Dateien, Nur Konfiguration)
  * Backup-Beschreibung hinzufügen (z.B. "Vor großem Update")
  * Progress-Bar während Backup-Erstellung
  * Download-Link nach erfolgreichem Backup
* **Backup-Details ansehen**:
  * Klick auf Backup öffnet Detail-Ansicht
  * Informationen: Zeitstempel, Größe, Typ, Status, Dauer, Checksum (MD5/SHA-256)
  * Enthaltene Komponenten: Datenbank (✓), Dateien (✓), Konfiguration (✓), Medien (✓)
  * Liste der wichtigsten geänderten Dateien seit letztem Backup
  * Log-Ausgabe des Backup-Prozesses
* **Backup-Download**:
  * Download-Button für jedes Backup
  * Format-Auswahl: .tar.gz, .zip, .sql (nur DB)
  * Optionale Verschlüsselung mit Passwort beim Download
  * Ablauf-Link (Download-URL gültig für 24 Stunden)
* **Backup-Löschen**:
  * Einzelnes Backup löschen (mit Bestätigung)
  * Alte Backups automatisch löschen (gemäß Retention-Policy)
  * Bulk-Delete: Mehrere Backups auf einmal löschen
  * "Geschützte Backups" markieren (können nicht automatisch gelöscht werden)

**Messkriterium:**
* Backup-Dashboard zeigt alle Backups in < 2 Sekunden
* Manuelles Backup kann mit 3 Klicks erstellt werden
* Download eines Backups startet sofort (kein zusätzlicher Prozess nötig)
* Backup-Details enthalten alle relevanten Informationen (Größe, Checksum, Inhalt)

### Restore und Rollback-Funktion im CMS

**Anforderungen:**
* **Ein-Klick-Restore im Admin-Panel**:
  * "Wiederherstellen"-Button bei jedem Backup
  * Restore-Wizard mit 4 Schritten:
    1. Backup auswählen (aus Liste)
    2. Restore-Optionen wählen (Full, Nur DB, Nur Dateien, Selektiv)
    3. Vorschau: Was wird überschrieben? (Warnung bei Datenverlust)
    4. Bestätigung + Start
  * Zwei-Faktor-Authentifizierung vor kritischen Restores (optional konfigurierbar)
  * Automatische Aktivierung des Wartungsmodus während Restore
* **Selektive Wiederherstellung**:
  * Nur bestimmte Komponenten wiederherstellen:
    - Nur Datenbank
    - Nur Dateien/Medien
    - Nur Konfiguration (z.B. Module, Einstellungen)
    - Nur bestimmte Inhaltstypen (z.B. nur News wiederherstellen)
  * Checkboxen im Restore-Wizard für Auswahl
  * Konfliktauflösung: "Überschreiben" oder "Zusammenführen" bei partiellen Restores
* **Point-in-Time-Recovery im CMS**:
  * Kalender-Widget: Datum und Uhrzeit auswählen
  * System sucht automatisch das passende Backup (Full + Incremental)
  * Anzeige: "Wiederherstellung auf Zustand vom 05.12.2025, 14:30 Uhr"
  * Vorschau: Welche Daten gehen verloren? (seit diesem Zeitpunkt)
* **Restore-Preview und Vergleich**:
  * Vor dem Restore: Diff-Ansicht zwischen aktuellem Stand und Backup
  * Anzeige geänderter Dateien: Hinzugefügt (+), Gelöscht (-), Geändert (Δ)
  * Anzahl betroffener Datensätze in Datenbank
  * Warnung bei großen Unterschieden (z.B. "> 1000 Datensätze werden überschrieben")
* **Rollback nach fehlgeschlagenem Update**:
  * Automatisches Backup vor jedem Update
  * Bei fehlgeschlagenem Update: Prominent angezeigter "Rollback"-Button
  * Ein-Klick-Rollback zur Version vor dem Update
  * Status-Anzeige: "System wird auf Version 2.5.3 zurückgesetzt..."
  * Automatischer Neustart nach erfolgreichem Rollback
* **Restore-Fortschritt und -Überwachung**:
  * Echtzeit-Progress-Bar während Restore (0-100%)
  * Anzeige aktueller Schritt: "Datenbank wird wiederhergestellt... (2/5)"
  * Geschätzte verbleibende Zeit
  * Log-Ausgabe live mitsehen (optional aufklappbar)
  * Benachrichtigung per E-Mail nach Abschluss
* **Restore-Historie und Audit-Log**:
  * Alle Restore-Aktionen werden protokolliert
  * Anzeige: Wer, Wann, Welches Backup, Erfolg/Fehler
  * Begründung für Restore (optionales Textfeld bei Restore)
  * Unveränderliche Audit-Logs (DSGVO-konform)

**Messkriterium:**
* Full-Restore über Admin-Panel in < 5 Minuten durchführbar (für Systeme < 10 GB)
* Restore-Wizard ist selbsterklärend (keine externe Dokumentation nötig)
* Point-in-Time-Recovery funktioniert mit Genauigkeit von ± 5 Minuten
* Rollback nach fehlgeschlagenem Update in < 3 Minuten
* 100% der Restore-Aktionen werden im Audit-Log erfasst

### Weitere Restore-Optionen

**Anforderungen:**
* **CLI-Tool für erweiterte Restores**:
  * Kommandozeilen-Tool für Admins und Skripte
  * Granulare Restore-Optionen (einzelne Tabellen, Verzeichnisse)
  * Batch-Processing (mehrere Restores automatisieren)
  * Restore von Remote-Backups (S3, Azure, Google Cloud)
* **Single-Item-Restore**:
  * Einzelne Datei aus Backup wiederherstellen (im Admin-Panel)
  * Einzelne Datenbank-Tabelle wiederherstellen
  * Einzelnen Inhalt wiederherstellen (z.B. gelöschter News-Artikel)
  * File-Browser im Backup: Verzeichnisstruktur durchsuchen und einzelne Dateien auswählen
* **Restore-Zeit (RTO - Recovery Time Objective)**:
  * Kritisches System: < 1 Stunde
  * Standard-System: < 4 Stunden
  * Development/Test: < 24 Stunden
* **Disaster Recovery Plan**:
  * Dokumentierter Notfallplan
  * Verantwortlichkeiten definiert (wer macht was?)
  * Kontaktliste (Admins, Dienstleister, Hoster)
  * Regelmäßige DR-Drills (halbjährlich)

**Messkriterium:**
* Full-Restore in < 4 Stunden (Standard-Setup)
* Point-in-Time-Recovery mit Genauigkeit von ± 1 Minute
* Erfolgreicher Restore-Test mindestens 1x pro Quartal
* RPO (Recovery Point Objective) < 1 Stunde (max. Datenverlust)

---

## Skalierbarkeit

### Horizontale Skalierung

**Anforderungen:**
* **Stateless-Architektur**:
  * Sessions in Redis (nicht im App-Server-Speicher)
  * Keine lokalen Dateien (alles in Object-Storage oder NAS)
  * Load-Balancing über mehrere App-Server
* **Auto-Scaling**:
  * Automatisches Hinzufügen von App-Servern bei hoher Last (Kubernetes HPA)
  * Scale-Out bei CPU > 70% oder Request-Rate > 1000 req/s
  * Scale-In bei niedriger Last (min. 2 App-Server)
* **Load-Balancing**:
  * Nginx / HAProxy / Cloud Load-Balancer
  * Health-Checks für App-Server (alle 10 Sekunden)
  * Session-Persistenz (Sticky Sessions) optional

**Messkriterium:**
* System skaliert auf 10+ App-Server ohne Code-Änderungen
* Auto-Scaling funktioniert innerhalb von 2 Minuten
* Load-Balancer verteilt Traffic gleichmäßig (Varianz < 10%)

### Vertikale Skalierung

**Anforderungen:**
* **Ressourcen-Limits anpassbar**:
  * PHP Memory-Limit erhöhbar (256 MB → 1 GB)
  * Max. Upload-Size konfigurierbar (bis 500 MB)
  * Worker-Prozesse skalierbar (PHP-FPM)
* **Datenbank-Optimierung**:
  * Connection-Pooling (PgBouncer, ProxySQL)
  * Read-Replicas für lesende Zugriffe
  * Query-Caching und Prepared Statements

**Messkriterium:**
* System läuft stabil mit 32 GB RAM und 16 CPU-Cores
* Datenbank-Performance bei 10.000 gleichzeitigen Nutzern:innen

---

## Performance-Optimierung

### Caching-Strategien

**Anforderungen:**
* **Multi-Level-Caching**:
  * Browser-Cache (HTTP-Headers: Cache-Control, ETag)
  * CDN-Cache (CloudFlare, Akamai, AWS CloudFront)
  * Application-Cache (Redis)
  * OPcache (PHP-Bytecode-Caching)
  * Database-Query-Cache
* **Cache-Invalidierung**:
  * Automatische Invalidierung bei Inhalts-Änderungen
  * Tag-basierte Invalidierung (z.B. alle News-Caches löschen)
  * Time-to-Live (TTL) konfigurierbar pro Cache-Typ
* **Cache-Warming**:
  * Pre-Caching von häufig abgerufenen Seiten (z.B. Startseite)
  * Automatisches Aufwärmen nach Cache-Clear

**Messkriterium:**
* Cache-Hit-Rate > 80%
* Page-Load-Time mit Cache < 500 ms
* Cache-Invalidierung in < 5 Sekunden

### Datenbank-Optimierung

**Anforderungen:**
* **Indexierung**:
  * Automatische Index-Optimierung
  * Regelmäßige Index-Analyse (EXPLAIN ANALYZE)
  * Hinweise auf fehlende Indizes
* **Query-Optimierung**:
  * Slow-Query-Log aktiviert (> 1 Sekunde)
  * N+1-Query-Problem vermieden (Eager Loading)
  * Connection-Pooling
* **Datenbank-Wartung**:
  * Automatisches VACUUM (PostgreSQL)
  * OPTIMIZE TABLE (MySQL)
  * Index-Rebuild bei Fragmentierung

**Messkriterium:**
* Durchschnittliche Query-Zeit < 50 ms
* Keine Queries > 2 Sekunden im Production-Betrieb
* Index-Nutzung > 95% bei SELECT-Queries

---

## Wartbarkeit und Code-Qualität

### Code-Standards

**Anforderungen:**
* **Coding-Standards eingehalten**:
  * PSR-12 (PHP), ESLint (JavaScript), PEP 8 (Python)
  * Automatische Code-Formatierung (Prettier, PHP-CS-Fixer)
  * Linting in CI/CD-Pipeline
* **Code-Komplexität**:
  * Cyclomatic Complexity < 15 pro Funktion
  * Verschachtelungstiefe < 4
  * Funktions-Länge < 50 Zeilen
* **Test-Coverage**:
  * Unit-Tests für Business-Logik (> 80% Coverage)
  * Integration-Tests für APIs (> 70% Coverage)
  * E2E-Tests für kritische User-Flows (> 50% Coverage)

**Messkriterium:**
* Code-Complexity-Score < 10 (durchschnittlich)
* Test-Coverage > 75%
* Zero Critical-Issues in SonarQube / CodeClimate

### Technische Dokumentation

**Anforderungen:**
* **Architektur-Dokumentation**:
  * Systemübersicht (Komponenten-Diagramm)
  * Datenfluss-Diagramme
  * Entscheidungs-Dokumentation (ADRs - Architecture Decision Records)
* **Code-Dokumentation**:
  * PHPDoc / JSDoc für alle Public-Funktionen
  * README in jedem Modul
  * API-Dokumentation (OpenAPI 3.0)
* **Betriebsdokumentation**:
  * Installations-Anleitung
  * Deployment-Guide
  * Troubleshooting-Handbuch
  * Runbooks für häufige Probleme

**Messkriterium:**
* 100% der Public-APIs dokumentiert
* Installations-Anleitung für alle Deployment-Varianten vorhanden
* Runbooks für Top-10-Fehler verfügbar

---

## Sicherheitswartung

### Security-Updates

**Anforderungen:**
* **Automatische Dependency-Scans**:
  * Tägliche Scans auf bekannte Vulnerabilities (npm audit, Composer audit)
  * OWASP Dependency-Check in CI/CD
  * Benachrichtigung bei CVEs (CVSS > 7.0)
* **Security-Patches**:
  * Hotfixes für kritische Sicherheitslücken (< 48h)
  * Reguläre Security-Updates (monatlich)
  * Changelog mit CVE-Referenzen

**Messkriterium:**
* Zero Known Vulnerabilities mit CVSS > 8.0 in Production
* Security-Patches innerhalb von 7 Tagen nach Veröffentlichung installiert
* Dependency-Scan-Erfolgsrate 100% (kein Auslassen von Dependencies)

### Security-Monitoring

**Anforderungen:**
* **Intrusion-Detection**:
  * Failed-Login-Monitoring (5 Fehlversuche → Account-Lock)
  * Rate-Limiting (max. 100 Requests/Minute pro IP)
  * Anomalie-Erkennung (ungewöhnliche API-Calls, SQL-Injection-Versuche)
* **Security-Logs**:
  * Alle Login-Versuche (erfolgreich + fehlgeschlagen)
  * Zugriff auf sensible Daten (Nutzer-Daten, Config)
  * Änderungen an Sicherheitseinstellungen
* **Vulnerability-Scanning**:
  * Wöchentliche Scans mit OWASP ZAP oder Burp Suite
  * Penetration-Tests (jährlich durch externe Firma)

**Messkriterium:**
* Alle Security-Incidents innerhalb von 15 Minuten erkannt
* Vulnerability-Scans finden < 5 Medium-Severity-Issues
* Penetration-Tests bestanden (keine Critical/High-Findings)

---

## Support und Troubleshooting

### Self-Service-Diagnostics

**Anforderungen:**
* **System-Health-Dashboard**:
  * Übersicht aller Systemkomponenten (Web-Server, DB, Redis, Queue)
  * Status-Ampeln (Grün, Gelb, Rot)
  * Quick-Checks (Disk-Space, Memory, CPU, Services)
* **Diagnostics-Tool**:
  * Ein-Klick-System-Check (generiert Report)
  * Log-Viewer mit Filterung und Suche
  * Performance-Profiler (für langsame Requests)
* **Troubleshooting-Wizard**:
  * Guided Problem-Solving ("Welches Problem haben Sie?")
  * Schritt-für-Schritt-Anleitung für häufige Probleme
  * Lösungsvorschläge mit Links zur Dokumentation

**Messkriterium:**
* System-Health-Check in < 10 Sekunden durchführbar
* Diagnostics-Report enthält alle relevanten Informationen (Logs, Configs, Metriken)
* Top-10-Probleme durch Wizard lösbar (ohne Support-Ticket)

### Support-Kanäle

**Anforderungen:**
* **Community-Support**:
  * Forum / Discourse
  * GitHub-Discussions
  * FAQ / Knowledge-Base
* **Professioneller Support**:
  * E-Mail-Support (Antwort innerhalb 24h)
  * Ticket-System mit Prioritäten (Low, Medium, High, Critical)
  * SLA-Zeiten definiert:
    - Critical: Reaktion < 2h, Lösung < 4h
    - High: Reaktion < 4h, Lösung < 24h
    - Medium: Reaktion < 24h, Lösung < 5 Tage
    - Low: Reaktion < 3 Tage, Best-Effort
* **Remote-Support**:
  * Screen-Sharing (TeamViewer, AnyDesk)
  * SSH-Zugriff (mit 2FA) für Dienstleister
  * Audit-Log für Support-Zugriffe

**Messkriterium:**
* 90% der Support-Anfragen innerhalb SLA beantwortet
* 80% der Tickets beim ersten Kontakt gelöst (First-Contact-Resolution)
* Customer-Satisfaction-Score (CSAT) > 4.5/5

---

## Zusammenfassung

**Installation:** One-Click-Installer, Setup-Wizard, < 30 Min. Installation, 3 Deployment-Varianten

**Updates:** Automatische Updates, 4 Update-Kanäle, Rollback < 5 Min., Patch-Erfolgsrate > 99%

**Monitoring:** Performance-/Application-/DB-Metriken, Alerting (E-Mail, Slack, SMS), strukturierte Logs

**Backup:** Täglich Full-Backup, stündlich Incremental, verschlüsselt, Offsite-Storage, Retention 7/30/365 Tage

**Restore:** Full/Partial/Point-in-Time, RTO < 4h, RPO < 1h, quartalsweise DR-Tests

**Skalierung:** Horizontal (10+ App-Server), Auto-Scaling, Load-Balancing, Stateless-Architektur

**Performance:** Multi-Level-Caching (80% Hit-Rate), DB-Optimierung, Page-Load < 500ms

**Code-Qualität:** Cyclomatic Complexity < 15, Test-Coverage > 75%, vollständige Dokumentation

**Security:** Automatische Dependency-Scans, Security-Patches < 7 Tage, Intrusion-Detection

**Support:** Self-Service-Diagnostics, SLA-definiert, Community + Professional Support
