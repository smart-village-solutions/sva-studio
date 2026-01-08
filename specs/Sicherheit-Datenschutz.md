# Sicherheit und Datenschutz

Die Sicherheit und der Datenschutz sind zentrale Anforderungen für den Betrieb eines kommunalen CMS, das mit sensiblen Bürgerdaten arbeitet. Die Anforderungen orientieren sich an der IT-Sicherheits-Leitlinie, dem BSI-Grundschutz und der DSGVO.

---

## 1. Sicherheitskonzept und Dokumentation

Das CMS muss technische Grundlagen für ein ISMS bereitstellen.

**Anforderungen:**

- Sicherheitsdokumentation für Administratoren verfügbar (Hardening-Guide, Best Practices)
- Sicherheitsrelevante Konfigurationsoptionen dokumentiert
- Security-Checkliste für Installation und Betrieb
- Template für Sicherheitsrichtlinien als Markdown/PDF
- Beispiel-Konfigurationen für gängige Sicherheitsszenarien

**Messkriterium:**

- Sicherheitsdokumentation vollständig verfügbar
- Hardening-Guide mit konkreten Schritten
- Security-Checkliste mit mindestens 20 Punkten
- Beispiel-Konfigurationen für 3 Sicherheitslevel (Basic, Standard, High)

---

## 2. Datenklassifizierung und Schutzmaßnahmen

Das CMS muss verschiedene Schutzlevel für unterschiedliche Datenarten unterstützen.

**Anforderungen:**
- Konfigurierbare Sicherheitslevel pro Content-Typ/Datenfeld
- Automatische Anwendung von Schutzmaßnahmen basierend auf Klassifizierung:
  - **Öffentlich**: Standard-Schutz, caching erlaubt
  - **Intern**: Zugriffsschutz, verschlüsselte Speicherung
  - **Vertraulich**: Verschlüsselung, Audit-Logging, MFA-Pflicht
- Vorkonfigurierte Profile für typische Datenarten (personenbezogen, Zugangsdaten, etc.)
- Admin-UI zur Verwaltung der Klassifizierungen
- Warnung bei unklassifizierten sensiblen Daten

**Messkriterium:**
- 3 Sicherheitslevel konfigurierbar
- Automatische Verschlüsselung für "Vertraulich"-Daten
- Vordefinierte Profile für 5 Datenarten
- Admin-UI zur Klassifizierung vorhanden
- Automatische Erkennung sensibler Felder (Email, Telefon, etc.)

---

## 3. BSI IT-Grundschutz-Kataloge

Implementierung der BSI IT-Grundschutz-Kataloge zur Gewährleistung eines angemessenen Sicherheitsniveaus.

### 3.1 Technische Maßnahmen

**Sichere Konfiguration:**
- Härtung aller Systeme nach BSI-Empfehlungen (SiSyPHuS Win10, Linux-Härtung)
- Deaktivierung unnötiger Dienste und Ports
- Sichere Default-Einstellungen (Security by Default)
- Regelmäßige Überprüfung der Konfiguration (Configuration Management)
- Automatisierte Compliance-Checks (z.B. mit OpenSCAP)

**Verschlüsselte Kommunikation:**
- TLS 1.3 für alle externen Verbindungen (API, Web-Interface)
- Verschlüsselung im Transit: HTTPS Strict Transport Security (HSTS)
- Verschlüsselung at Rest: Datenbank-Verschlüsselung (Transparent Data Encryption)
- Verschlüsselung von Backups
- Ende-zu-Ende-Verschlüsselung für besonders sensible Daten
- Certificate Pinning für mobile Apps

**Zugriffskontrollen:**
- Mehrstufige Authentifizierung (Multi-Factor Authentication) für administrative Zugriffe
- Passwortrichtlinie nach BSI (mindestens 12 Zeichen, Komplexität, Ablauf nach 90 Tagen)
- Privileged Access Management (PAM) für Admin-Accounts
- Principle of Least Privilege: Minimale Rechte für alle Accounts
- Session-Management mit automatischem Timeout (30 Minuten Inaktivität)
- IP-Whitelisting für administrative Zugriffe (optional)
- Account-Lockout nach 5 fehlgeschlagenen Login-Versuchen

**Netzwerksicherheit:**
- Firewall-Regeln nach Whitelist-Prinzip
- Intrusion Detection/Prevention System (IDS/IPS)
- Web Application Firewall (WAF)
- DDoS-Protection
- Network Segmentation (DMZ für öffentliche Services)

**Logging und Monitoring:**
- Zentrale Protokollierung aller sicherheitsrelevanten Ereignisse
- SIEM-Integration (Security Information and Event Management)
- Log-Retention mindestens 6 Monate (besser 1 Jahr)
- Integritätsschutz der Logs (Write-Once-Read-Many)
- Automatische Alarmierung bei Sicherheitsvorfällen

**Schwachstellen-Management:**
- Automatische Dependency-Checks (npm audit, Dependabot)
- Integrierte Vulnerability-Scanner für Container-Images
- Security-Update-Benachrichtigungen im Admin-Interface
- CLI-Tool für Security-Checks
- Security Advisories im Repository veröffentlichen

### 3.2 Backup und Recovery

**Backup-Funktionen:**
- Automatisches Backup-System mit konfigurierbaren Intervallen
- Unterstützung verschiedener Backup-Strategien (Full, Incremental, Differential)
- Verschlüsselte Backups (AES-256)
- Backup-Verifizierung (Integritätsprüfung)
- Point-in-Time-Recovery möglich
- Export/Import-Funktionen für manuelle Backups
- Backup auf verschiedene Ziele (Lokal, S3, NFS, etc.)

**Recovery-Funktionen:**
- One-Click-Restore für vollständige Wiederherstellung
- Selektives Restore einzelner Content-Typen
- Disaster-Recovery-Dokumentation mit Schritt-für-Schritt-Anleitung
- CLI-Tools für Recovery-Operationen
- Health-Check nach Recovery

**Messkriterium:**
- Automatisches Backup konfigurierbar (täglich, wöchentlich, monatlich)
- Backup-Verschlüsselung aktiv
- Point-in-Time-Recovery innerhalb 1 Stunde möglich
- Restore-Test erfolgreich durchgeführt
- Verschlüsselung: TLS 1.3, AES-256 für Datenbank
- MFA für Admin-Accounts verfügbar

---

## 4. Datenschutz durch Technik und Voreinstellungen (Privacy by Design/Default)

Das CMS muss standardmäßig so konfiguriert sein, dass es DSGVO-konform arbeitet.

### 4.1 Privacy by Design

**Datenminimierung:**
- Nur notwendige Daten werden erfasst
- Optionale Felder klar gekennzeichnet
- Automatische Anonymisierung von Analysedaten
- Pseudonymisierung wo möglich (z.B. User-IDs statt Namen in Logs)

**Zweckbindung:**
- Jede Datenverarbeitung hat einen dokumentierten Zweck
- Keine Weiterverarbeitung ohne neue Rechtsgrundlage
- Klare Trennung zwischen verschiedenen Verarbeitungszwecken

**Transparenz:**
- Datenschutzerklärung integriert und verständlich
- Privacy Dashboard für Nutzer: Welche Daten werden gespeichert?
- Einwilligungsverwaltung (Consent Management)
- Tracking-Optionen klar kommuniziert (Opt-In, nicht Opt-Out)

### 4.2 Privacy by Default

**Standard-Einstellungen:**
- Strengste Datenschutz-Einstellungen als Default
- Tracking standardmäßig deaktiviert (Cookie-Banner mit Opt-In)
- Keine Drittanbieter-Skripte ohne explizite Zustimmung
- Minimale Datenerhebung in Kontaktformularen
- Profile standardmäßig nicht öffentlich

**Messkriterium:**
- Privacy Impact Assessment (PIA) durchgeführt
- Datenschutzfolgenabschätzung (DSFA) für Hochrisiko-Verarbeitungen
- Datenschutzerklärung vollständig und aktuell
- Privacy Dashboard für Nutzer verfügbar
- Cookie-Banner mit Opt-In (DSGVO-konform)

---

## 5. Zugriffskontrolle und Berechtigungsmanagement

Feingranulares Rollen- und Rechtesystem zur Sicherstellung, dass nur autorisierte Nutzer auf personenbezogene Daten zugreifen können (Art. 32 DSGVO).

**Anforderungen:**

**Rollenbasierte Zugriffskontrolle (RBAC):**
- Vordefinierte Rollen (Admin, Redakteur, Moderator, Viewer)
- Granulare Berechtigungen pro Rolle
- Vererbung von Berechtigungen
- Rollenbasierte Content-Sichtbarkeit

**Attributbasierte Zugriffskontrolle (ABAC):**
- Zugriff basierend auf Nutzer-Attributen (Abteilung, Standort, Mandant)
- Dynamische Policies
- Context-aware Permissions (z.B. nur während Arbeitszeit)

**Audit-Trail:**
- Protokollierung aller Zugriffe auf personenbezogene Daten
- Wer hat wann auf welche Daten zugegriffen?
- Änderungshistorie für alle Datensätze
- Unveränderlichkeit der Audit-Logs

**Berechtigungsprüfung:**
- Admin-Report über Berechtigungen pro Nutzer/Rolle
- Benachrichtigung bei ungewöhnlichen Zugriffsmustern (anomaly detection)
- Automatische Deaktivierung inaktiver Accounts (konfigurierbar)
- Ablaufdatum für Berechtigungen (z.B. temporärer Admin-Zugang)

**Messkriterium:**
- RBAC mit mindestens 5 vordefinierten Rollen
- ABAC für mandantenfähige Umgebungen
- 100% der Zugriffe auf personenbezogene Daten werden geloggt
- Berechtigungs-Report verfügbar
- Audit-Logs unveränderlich gespeichert
- Automatische Account-Deaktivierung nach konfigurierbarer Inaktivitätsdauer

---

## 6. Verfahrensverzeichnis (Art. 30 DSGVO)

Die Verarbeitungsvorgänge müssen dokumentiert werden können.

**Anforderungen:**
- Automatische Generierung eines Verfahrensverzeichnisses basierend auf System-Konfiguration
- Admin-UI zur Pflege von Verarbeitungstätigkeiten mit Feldern:
  - Name und Kontaktdaten des Verantwortlichen
  - Zwecke der Verarbeitung
  - Kategorien betroffener Personen
  - Kategorien personenbezogener Daten
  - Kategorien von Empfängern
  - Drittlandtransfers (falls vorhanden)
  - Löschfristen
  - Technische und organisatorische Maßnahmen (TOM)
- Export-Funktion für Verfahrensverzeichnis (PDF, DOCX, JSON)
- Versionierung des Verfahrensverzeichnisses
- Template-System für Standard-Verarbeitungstätigkeiten

**Messkriterium:**
- Admin-UI für Verfahrensverzeichnis vorhanden
- Alle DSGVO-Pflichtfelder als Formular verfügbar
- Export in 3 Formaten (PDF, DOCX, JSON)
- Versionierung mit Änderungshistorie
- 5 vordefinierte Templates

---

## 7. Löschkonzepte und Betroffenenrechte

Automatische Mechanismen zur Einhaltung von Löschfristen und zur Umsetzung von Betroffenenrechten (Art. 17 DSGVO).

### 7.1 Automatische Löschung

**Löschfristen:**
- Konfigurierbare Aufbewahrungsfristen pro Datenart
- Automatische Löschung nach Ablauf der Frist
- Warnung vor Löschung (30 Tage vorher)
- Protokollierung aller Löschvorgänge
- Anonymisierung statt Löschung wo möglich (für Statistiken)

**Löschkaskaden:**
- Abhängige Daten werden mitgelöscht (Cascade Delete)
- Backup-Löschung berücksichtigen (gilt auch für Backups!)
- Sichere Löschung (Überschreiben, nicht nur Markierung)

### 7.2 Betroffenenrechte

**Recht auf Auskunft (Art. 15 DSGVO):**
- Self-Service-Portal für Nutzer
- Automatische Generierung eines Datenexports (JSON, PDF)
- Auflistung aller gespeicherten Daten
- Auskunft über Empfänger und Verarbeitungszwecke

**Recht auf Löschung (Art. 17 DSGVO):**
- One-Click-Löschung des Accounts
- Vollständige Löschung aller personenbezogenen Daten
- Ausnahmen für gesetzliche Aufbewahrungspflichten
- Bestätigungsmail nach Löschung

**Recht auf Datenübertragbarkeit (Art. 20 DSGVO):**
- Export aller Daten in maschinenlesbarem Format (JSON, XML, CSV)
- Import in andere Systeme möglich
- API für automatisierte Datenübertragung

**Recht auf Berichtigung (Art. 16 DSGVO):**
- Nutzer können ihre Daten selbst korrigieren
- Admin-Funktion zur Korrektur von Nutzerdaten
- Änderungshistorie wird gespeichert

**Recht auf Widerspruch (Art. 21 DSGVO):**
- Opt-Out für Marketingzwecke
- Widerspruch gegen Profiling
- Deaktivierung von Tracking

**Messkriterium:**
- Automatische Löschung nach konfigurierbaren Fristen implementiert
- Self-Service-Portal für Betroffenenrechte verfügbar
- Datenexport in 3 Formaten (JSON, XML, CSV)
- Account-Löschung innerhalb 48 Stunden
- 100% der DSGVO-Betroffenenrechte implementiert
- Löschung von Backups innerhalb gesetzlicher Fristen

---

## 8. Zusammenfassung der Anforderungen

**Sicherheitskonzept:**
- Vollständige Sicherheitsdokumentation (Hardening-Guide, Best Practices)
- Security-Checkliste und Beispiel-Konfigurationen

**Datenklassifizierung:**
- 3 konfigurierbare Sicherheitslevel (Öffentlich, Intern, Vertraulich)
- Automatische Schutzmaßnahmen basierend auf Klassifizierung

**BSI IT-Grundschutz (Technisch):**
- Sichere Konfiguration, TLS 1.3, AES-256 Verschlüsselung
- MFA, RBAC/ABAC, Session-Management, Account-Lockout
- WAF-Integration, Rate Limiting, CORS
- SIEM-Integration, Audit-Logging, Log-Retention
- Automatische Security-Checks, Dependency-Scanning

**Backup und Recovery:**
- Automatisches verschlüsseltes Backup-System
- Point-in-Time-Recovery, selektives Restore
- Disaster-Recovery-Dokumentation

**Privacy by Design/Default:**
- Datenminimierung, Zweckbindung, Transparenz
- Privacy Dashboard, Consent Management
- Strengste Datenschutz-Einstellungen als Default

**Zugriffskontrolle:**
- RBAC + ABAC mit mindestens 5 vordefinierten Rollen
- Audit-Trail für alle Zugriffe auf personenbezogene Daten
- Automatische Account-Deaktivierung bei Inaktivität

**Verfahrensverzeichnis:**
- Admin-UI zur Pflege von Verarbeitungstätigkeiten
- Automatische Generierung gemäß Art. 30 DSGVO
- Export-Funktion (PDF, DOCX, JSON), Versionierung

**Löschkonzepte und Betroffenenrechte:**
- Automatische Löschung nach konfigurierbaren Fristen
- Self-Service-Portal für alle DSGVO-Betroffenenrechte (Art. 15-21)
- Datenexport in 3 Formaten, Account-Löschung innerhalb 48h
