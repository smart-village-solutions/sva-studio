# Anforderungen: Secure Software Lifecycle (BSI TR-03185-2)

Dieses Kapitel beschreibt die Anforderungen an den sicheren Software-Lebenszyklus des CMS 2.0 gemäß **BSI TR-03185-2: Secure Software Lifecycle for Open Source Software**. Da das CMS als Open-Source-Projekt entwickelt wird, gelten die spezifischen Anforderungen für FLOSS/FOSS-Projekte.

## Übersicht und Zielsetzung

* Das CMS wird als **Open-Source-Software** entwickelt und unter einer OSI-konformen Lizenz veröffentlicht (z. B. EUPL, AGPL).
* Die Entwicklung folgt den **BSI-Richtlinien für sichere Software-Lebenszyklen**, um die Anforderungen des **Cyber Resilience Act (CRA)** und des **BSI IT-Grundschutzes** zu erfüllen.
* Die Anforderungen richten sich an:
  * **Maintainer** (Projektverantwortliche)
  * **Contributors** (Beitragende Entwickler:innen)
  * **Stewards** (Organisationen, die das Projekt langfristig unterstützen)
  * **Downstream-Nutzer** (Kommunen, Dienstleister, die das CMS einsetzen)

---

## GV: Governance (Projektführung)

### GV.01: Contribution Guidelines (MUSS)

* Es **MUSS** eine öffentlich zugängliche **Dokumentation für Beiträge** vorhanden sein (z. B. `CONTRIBUTING.md` im Repository).
* Diese Dokumentation **MUSS** folgende Informationen enthalten:
  * Wie können Entwickler:innen zum Projekt beitragen? (Code, Dokumentation, Bug Reports)
  * Welche **Code-Qualitätsstandards** werden erwartet? (z. B. Coding Conventions, Linting, Testing)
  * Wie funktioniert der **Review-Prozess** für Pull Requests?
  * Welche **Lizenz** wird für Beiträge verwendet? (z. B. Developer Certificate of Origin, CLA)
* Es **SOLLTE** Informationen zur erwarteten **Qualität von Beiträgen** geben:
  * Tests müssen erfolgreich durchlaufen
  * Code muss dokumentiert sein
  * Security-Checks müssen bestanden werden

**Referenzen:** OC 4.1.2, OSPS-GV-03

---

### GV.02: Zugriffskontrolle und Schutz sensibler Daten (MUSS)

* Das **Repository, Websites und sensible Daten** des Projekts **MÜSSEN** gegen unbefugten Zugriff geschützt sein:
  * **Repository-Zugriff**: Nur autorisierte Maintainer dürfen direkt in den `main`-Branch pushen
  * **Branch Protection**: Pull Requests müssen geprüft werden, bevor sie gemerged werden
  * **Secrets Management**: API-Keys, Zugangsdaten und Zertifikate dürfen nicht im Repository gespeichert werden
  * **Zwei-Faktor-Authentifizierung (2FA)**: Pflicht für alle Maintainer mit Schreibrechten
  * **Audit-Logs**: Alle Änderungen an Repository-Einstellungen und Zugriffsrechten werden protokolliert
* **Website-Sicherheit**: Projekt-Websites (z. B. Dokumentation, Download-Server) müssen gegen Angriffe geschützt sein (HTTPS, WAF, DDoS-Schutz)

**Referenzen:** OSPS-AC-01, CRA Annex I Part I No. 2(d-f), SSDF PS.1.1

---

## LE: Legal (Rechtliche Anforderungen)

### LE.01: Lizenzierung aller Inhalte (MUSS)

* Für **alle vom Projekt veröffentlichten Inhalte** (Code, Dokumentation, Assets) **MUSS** eine **Lizenz angegeben** sein.
* Die Lizenz **MUSS** eindeutig identifizierbar sein (z. B. über `LICENSE`-Datei im Repository-Root oder SPDX-Identifier in Dateien).
* Empfohlene Lizenzen für das CMS:
  * **Code**: EUPL-1.2, AGPL-3.0, MIT, Apache-2.0
  * **Dokumentation**: CC BY 4.0, CC BY-SA 4.0
  * **Assets (Bilder, Icons)**: CC BY 4.0, CC0 (Public Domain)

**Referenzen:** OSPS-LE-02

---

### LE.02: Bereitstellung von Lizenztexten (MUSS)

* **Kopien aller verwendeten Lizenzen** oder **Verweise darauf** **MÜSSEN** bereitgestellt werden:
  * `LICENSE`-Datei im Repository-Root (Haupt-Lizenz des Projekts)
  * `LICENSES/`-Ordner für alle verwendeten Drittanbieter-Lizenzen
  * SPDX-Identifier in Datei-Headern (z. B. `// SPDX-License-Identifier: EUPL-1.2`)
  * `THIRD-PARTY-NOTICES.md` oder `ATTRIBUTION.md` mit vollständiger Liste aller Abhängigkeiten und deren Lizenzen

**Referenzen:** OSPS-LE-03

---

## QA: Quality Assurance (Qualitätssicherung)

### QA.01: Liste aller Drittanbieter-Komponenten (MUSS)

* Eine **Liste aller Drittanbieter-Komponenten** (Dependencies), die in der Software verwendet werden, **MUSS** verfügbar sein:
  * **Software Bill of Materials (SBOM)**: Automatisch generiert (z. B. via CycloneDX, SPDX)
  * Enthalten in jedem Release als `sbom.json` oder `sbom.xml`
  * **Informationen pro Komponente**:
    * Name, Version, Lizenz
    * Download-Quelle (z. B. npm, PyPI, GitHub)
    * Bekannte Schwachstellen (z. B. via CVE-Datenbank)
  * **Automatische Updates**: Abhängigkeiten werden regelmäßig auf Sicherheitslücken geprüft (z. B. via Dependabot, Renovate)

**Referenzen:** OSPS-QA-02, OSPS-DO-06, OCRE 863-521

---

### QA.02: Öffentlich lesbarer Quellcode (MUSS)

* **Aller Quellcode des Projekts MUSS öffentlich lesbar** sein:
  * Repository ist auf GitHub/GitLab/Codeberg öffentlich zugänglich
  * Keine privaten Branches oder versteckten Repositories für sicherheitsrelevante Komponenten
  * Ausnahme: Security-Patches können vor Veröffentlichung temporär privat gehalten werden (Responsible Disclosure)

**Referenzen:** OSPS-QA-01

---

### QA.03: Bug Reporting (MUSS)

* Das Projekt **MUSS** dokumentieren, **wie Fehler gemeldet werden** können:
  * **GitHub Issues** oder vergleichbares Issue-Tracking-System ist aktiv
  * Link zur Issue-Erstellung in `README.md` und `CONTRIBUTING.md`
  * **Templates** für Bug Reports (z. B. `.github/ISSUE_TEMPLATE/bug_report.md`)
  * **Erwartete Informationen**: Schritte zur Reproduktion, erwartetes Verhalten, tatsächliches Verhalten, System-Informationen
  * **Unterscheidung**: Sicherheitslücken müssen über separaten Kanal gemeldet werden (siehe VM.01)

**Referenzen:** OSPS-DO-02, OSPS-GV-02, CRA Annex II No. 2

---

### QA.04: Testing-Prozesse (MUSS)

* **Verfahren zum Testen MÜSSEN implementiert und genutzt werden**:
  * **Unit-Tests**: Automatisierte Tests für einzelne Funktionen/Komponenten
  * **Integration-Tests**: Tests für Zusammenspiel verschiedener Module
  * **End-to-End-Tests**: Tests für vollständige User-Journeys
  * **CI/CD-Pipeline**: Automatische Ausführung aller Tests bei jedem Commit/Pull Request
  * **Test-Coverage**: Mindestens 70% Code-Abdeckung (konfigurierbar)
  * **Lokal ausführbar**: Entwickler:innen können Tests vor dem Commit lokal laufen lassen

**Referenzen:** OSPS-GV-03, OSPS-QA-06

---

### QA.05: Memory Safety (SOLLTE)

* Das Projekt **SOLLTE** Maßnahmen ergreifen, um **Speichersicherheitsprobleme** zu reduzieren oder zu vermeiden:
  * **Verwendung von memory-safe Sprachen** (z. B. TypeScript, Rust, Go) bevorzugt
  * **Static Analysis Tools**: Einsatz von Linters und Security-Scannern (z. B. ESLint, Semgrep, CodeQL)
  * **Contribution Guidelines**: Hinweise zur Memory Safety (z. B. „Vermeide `eval()`, verwende parameterisierte Queries")
  * **Input Validation**: Alle Nutzereingaben müssen validiert und sanitisiert werden
  * **Dependency Scanning**: Automatische Prüfung auf bekannte Schwachstellen in Dependencies

**Referenzen:** OSPS-GV-03, OSPS-QA-06, SSDF PW.5.1, PW.6.1, PW.6.2

---

### QA.06: Code Review (SOLLTE)

* **Alle Änderungen am Quellcode SOLLTEN durch Peer-Review geprüft werden**:
  * **Pull Request-basierter Workflow**: Keine direkten Commits in `main`
  * **Mindestens 1 Review** erforderlich vor Merge (bei kritischen Änderungen: 2+ Reviews)
  * **Review-Checkliste**:
    * Code ist lesbar und dokumentiert
    * Tests sind vorhanden und erfolgreich
    * Keine offensichtlichen Sicherheitslücken
    * Keine Secrets im Code
  * **Automatisierte Checks**: Linting, Testing, Security-Scans laufen automatisch vor Review

**Referenzen:** OSPS-AC-03, SSDF PW.2.1

---

## BR: Build and Release (Build und Veröffentlichung)

### BR.01: Build-Anleitung (MUSS)

* **Informationen zum Bauen aller Software-Assets MÜSSEN öffentlich verfügbar sein**:
  * `README.md` oder `BUILD.md` mit vollständiger Build-Anleitung
  * **Voraussetzungen**: Welche Tools/Versionen werden benötigt? (z. B. Node.js 20+, Docker, Python 3.11+)
  * **Schritt-für-Schritt-Anleitung**: Wie wird das Projekt lokal gebaut?
  * **Umgebungsvariablen**: Welche Variablen müssen gesetzt werden?
  * **Reproduzierbarkeit**: Build sollte deterministisch sein (gleiche Inputs → gleicher Output)

**Referenzen:** OSPS-DO-01, OSPS-DO-03, SLSA 1.1 Build L1

---

### BR.02: Versionierung (MUSS)

* **Alle Releases und veröffentlichten Software-Assets MÜSSEN eindeutige, monoton steigende Versionsbezeichner** erhalten:
  * **Semantic Versioning** (empfohlen): `MAJOR.MINOR.PATCH` (z. B. `2.1.0`)
  * **Calendar Versioning** (alternativ): `YYYY.MM.DD` (z. B. `2025.12.06`)
  * **Git-Tags**: Jeder Release wird als Git-Tag markiert (z. B. `v2.1.0`)
  * **Release Notes**: Jeder Release enthält Changelog (siehe BR.04)
  * **Pre-Releases**: Alpha/Beta-Versionen werden gekennzeichnet (z. B. `2.1.0-beta.1`)

**Referenzen:** OSPS-BR-02, CRA Annex I Part I No. 2(f)

---

### BR.03: Integritäts- und Authentizitätssicherung (MUSS)

* **Alle Assets MÜSSEN so verteilt werden, dass Integrität gewahrt oder zumindest verifizierbar ist**:
  * **Checksums**: SHA256-Hashes für alle Download-Dateien (z. B. `sha256sums.txt`)
  * **Digitale Signaturen**: Releases werden mit GPG/PGP signiert (empfohlen)
  * **GitHub Releases**: Verwendung von GitHub Release Checksums
  * **Container Images**: Signaturen via Sigstore/Cosign (für Docker-Images)
  * **HTTPS**: Alle Downloads erfolgen ausschließlich über HTTPS
  * **Dokumentation**: Anleitung zur Verifikation von Downloads in `README.md`

**Referenzen:** OSPS-DO-03, OSPS-BR-03, OSPS-BR-06, CRA Annex I Part I No. 2(d-f, i-k)

---

### BR.04: Changelog/Release Notes (MUSS)

* **Alle Releases MÜSSEN ein beschreibendes Log funktionaler und sicherheitsrelevanter Änderungen** bereitstellen:
  * `CHANGELOG.md` im Repository (nach Keep a Changelog-Format)
  * **Pro Release**:
    * **Added**: Neue Features
    * **Changed**: Änderungen an bestehenden Features
    * **Deprecated**: Features, die in Zukunft entfernt werden
    * **Removed**: Entfernte Features
    * **Fixed**: Bugfixes
    * **Security**: Sicherheits-Patches (mit CVE-Nummern, falls vorhanden)
  * **GitHub Release Notes**: Automatisch aus Changelog generiert oder manuell gepflegt
  * **Breaking Changes**: Deutlich markiert mit Migration-Hinweisen

**Referenzen:** OSPS-BR-04, CRA Annex I Part I No. 2(l), Annex I Part II No. 4, Annex II No. 8(b)

---

### BR.05: Source Package Integrity (MUSS)

* **Veröffentlichte Source Packages DÜRFEN KEINEN Inhalt enthalten, der nicht im Repository vorhanden ist** oder nicht deterministisch daraus generiert werden kann:
  * Keine vorcompilierten Binaries in Source-Releases (außer sie sind deterministisch reproduzierbar)
  * Keine Secrets, temporäre Dateien oder Build-Artefakte in Source-Packages
  * **Automatisierung**: Source-Packages werden über CI/CD automatisch aus Git-Tags erstellt
  * **Verifikation**: `git archive` oder ähnliche Tools zur Erstellung von Source-Packages

**Referenzen:** OSPS-QA-05

---

### BR.06: Reproducible Builds (SOLLTE)

* **Builds SOLLTEN reproduzierbar sein**:
  * **Deterministisches Build-System**: Gleiche Inputs führen zu bitgenau identischen Outputs
  * **Fixierte Abhängigkeiten**: Lockfiles für alle Dependencies (z. B. `package-lock.json`, `poetry.lock`)
  * **Build-Umgebung**: Dokumentation der exakten Build-Umgebung (OS, Compiler-Version, etc.)
  * **Verifizierung**: Dritte können den Build reproduzieren und Hashes vergleichen

**Referenzen:** SLSA 1.1 Build L1

---

## VM: Vulnerability Management (Schwachstellen-Management)

### VM.01: Security Contacts und Responsible Disclosure (MUSS)

* Die **Projekt-Dokumentation MUSS Security-Kontakte** für die Meldung von Schwachstellen enthalten:
  * **`SECURITY.md`** im Repository-Root (GitHub zeigt dies automatisch an)
  * **Kontaktinformationen**:
    * E-Mail-Adresse für Security-Reports (z. B. `security@smart-village.app`)
    * PGP-Key für verschlüsselte Kommunikation (empfohlen)
    * Link zu GitHub Security Advisories (falls genutzt)
  * **Responsible Disclosure Policy**:
    * **Private Meldung** SOLLTE möglich sein (z. B. via GitHub Private Vulnerability Reporting)
    * **Response Time**: Bestätigung innerhalb von 3 Werktagen
    * **Disclosure Timeline**: Koordinierte Veröffentlichung nach max. 90 Tagen
  * **Bug Bounty**: Falls vorhanden, Hinweis auf Bug-Bounty-Programm

**Referenzen:** OSPS-VM-01, OSPS-VM-02, OSPS-VM-03, CRA Annex I Part I No. 2(c), Annex I Part II No. 5-7, Annex II No. 1-3

---

### VM.02: Veröffentlichung von Schwachstellen (MUSS)

* Das Projekt **MUSS** Informationen über entdeckte Schwachstellen **innerhalb angemessener Zeit** veröffentlichen:
  * **Security Advisories**: Veröffentlichung auf GitHub Security Advisories
  * **CVE-Nummern**: Beantragung von CVE-IDs für kritische Schwachstellen
  * **Informationen**:
    * Beschreibung der Schwachstelle
    * Betroffene Versionen
    * Fixed-in-Version
    * Workarounds (falls vorhanden)
    * CVSS-Score (empfohlen)
  * **Benachrichtigung**:
    * Nutzer:innen werden per E-Mail/Newsletter informiert
    * Warnung im CMS-Dashboard (falls Update verfügbar)
  * **Timeline**: Veröffentlichung erfolgt zeitnah nach Patch-Release (koordinierte Disclosure)

**Referenzen:** CRA Annex I Part II No. 1, 4, 6, OSPS-VM-04

---

## DE: Decommissioning (Einstellung des Projekts)

### DE.01: Kommunikation der Einstellung (SOLLTE)

* Die **Einstellung des Projekts, einzelner Teile oder spezifischer Versionen SOLLTE angemessen kommuniziert werden**:
  * **Ankündigung**: Mindestens 6 Monate im Voraus (bei kritischer Infrastruktur: 12 Monate)
  * **Kanäle**:
    * GitHub README mit deutlichem Hinweis ("⚠️ Deprecated", "🔴 End of Life")
    * Mailing-Liste / Newsletter
    * Release Notes
    * Im CMS-Dashboard (für betroffene Instanzen)
  * **Informationen**:
    * **Was** wird eingestellt? (Ganzes Projekt / einzelne Features / bestimmte Versionen)
    * **Wann** erfolgt die Einstellung? (End-of-Life-Datum)
    * **Warum** wird eingestellt? (z. B. Ressourcenmangel, bessere Alternative verfügbar)
    * **Was passiert danach?** (Wird das Repository archiviert? Gibt es einen Fork?)

**Referenzen:** TR PROD.DECOM.2, OSPS-DO-04, OSPS-DO-05

---

### DE.02: Migrationspfade (KANN)

* **Migrationspfade KÖNNEN aufgezeigt werden**:
  * Dokumentation, wie Nutzer:innen zu Alternativen migrieren können
  * Empfehlungen für Nachfolge-Projekte oder Forks
  * Export-Tools für Daten (falls relevant)
  * Community-Support für Migration (z. B. Forum, Discord)

**Referenzen:** TR PROD.DECOM.2

---

## Umsetzung und Verantwortlichkeiten

### Rollen

* **Maintainers** (Kernteam):
  * Verantwortlich für Einhaltung aller MUSS-Anforderungen
  * Code-Review und Freigabe von Pull Requests
  * Release-Management und Versionierung
  * Security-Response und Vulnerability-Management
* **Contributors** (Community):
  * Einhaltung der Contribution Guidelines
  * Code-Qualität und Testing
  * Meldung von Bugs und Security-Issues
* **Stewards** (z. B. DigitalService4Germany, Kommunale IT-Dienstleister):
  * Langfristige Unterstützung und Finanzierung
  * Koordination mit Downstream-Nutzern
  * Compliance mit CRA und BSI-Anforderungen
* **Downstream-Nutzer** (Kommunen, Rechenzentren):
  * Einhaltung lokaler Security-Policies
  * Feedback zu Security-Issues
  * Optional: Upstream-Contributions

### Compliance-Nachweis

* **Dokumentation**: Alle MUSS- und SOLLTE-Anforderungen werden in der Projekt-Dokumentation adressiert
* **Audit-Logs**: Repository-Aktivitäten, CI/CD-Runs und Security-Scans werden protokolliert
* **Self-Assessment**: Regelmäßige (z. B. jährliche) Überprüfung der Einhaltung aller Anforderungen
* **Externe Audits**: Optional durch BSI, TÜV oder andere Zertifizierungsstellen

---

## Tooling und Automatisierung

### Empfohlene Tools

* **CI/CD**: GitHub Actions, GitLab CI, Jenkins
* **Code Quality**: ESLint, Prettier, SonarQube
* **Security Scanning**: Snyk, Dependabot, CodeQL, Trivy
* **SBOM Generation**: CycloneDX, SPDX-SBOM-Generator
* **Build Reproducibility**: Nix, Bazel, Docker
* **Signing**: Sigstore Cosign, GPG
* **Dependency Management**: Renovate, Dependabot

### Automatisierung

* **Pre-Commit Hooks**: Linting und Formatierung
* **Pull Request Checks**: Tests, Security-Scans, Lizenz-Checks
* **Release Automation**: Automatische Erstellung von Releases, Changelogs, SBOMs
* **Dependency Updates**: Automatische PRs für Security-Patches
* **Vulnerability Scanning**: Wöchentliche Scans mit Alerts bei kritischen Issues

---

## Referenzen und Standards

* **BSI TR-03185-2**: Secure Software Lifecycle for Open Source Software (Version 1.1.0, August 2025)
* **Cyber Resilience Act (CRA)**: EU Regulation 2024/2847
* **BSI IT-Grundschutz**: Kompendium 2023
* **OpenChain Security Assurance**: ISO/IEC 18974
* **OpenSSF Security Baseline**: Version 2025-02-25
* **SLSA**: Supply-chain Levels for Software Artifacts v1.1
* **NIST SSDF**: Secure Software Development Framework (SP 800-218)
