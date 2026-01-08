# Föderale IT-Architekturrichtlinien (FIT)

Die Föderalen IT-Architekturrichtlinien (FIT-Architekturrichtlinien) zielen darauf ab, eine interoperable, wirtschaftliche und zukunftssichere IT-Landschaft in der öffentlichen Verwaltung zu schaffen. Für das CMS 2.0 ergeben sich daraus detaillierte Anforderungen an Systemarchitektur, Datenmanagement und Betrieb.

---

## 1. Systemarchitektur und Interoperabilität

Die Anforderungen konzentrieren sich auf eine offene und flexible Systemgestaltung.

### Modulare Bauweise

Das CMS muss als lose gekoppelte Komponente konzipiert sein. Es soll nicht als monolithisches System, sondern als ein Dienst betrachtet werden, der über standardisierte Schnittstellen (APIs) Content bereitstellt.

**Messkriterium:**
- Microservices-Architektur oder modularer Monolith mit klaren Service-Grenzen
- Unabhängige Deploybarkeit einzelner Module
- Event-driven Architecture für lose Kopplung

---

### Offene Schnittstellen

Die API zur Anbindung der Smart Village App muss offen, standardisiert (z.B. RESTful, GraphQL), öffentlich dokumentiert und maschinell lesbar sein. Dies ermöglicht eine einfache Anbindung und Nutzung durch andere föderale oder kommunale IT-Systeme.

**Messkriterium:**
- OpenAPI 3.0 Spezifikation für REST-APIs
- GraphQL-Schema öffentlich verfügbar
- API-Dokumentation unter offener Lizenz (CC BY 4.0)
- Maschinenlesbare API-Beschreibung (Swagger/OpenAPI, GraphQL Schema)
- Öffentliches API-Portal mit Beispielen und Tutorials

---

### Wiederverwendung

Bevorzugen Sie, wo möglich, etablierte IT-Lösungen und Komponenten, die bereits in der föderalen IT-Landschaft eingesetzt werden (zum Beispiel ein gängiges Open Source CMS mit einer großen Community).

**Messkriterium:**
- Verwendung etablierter Open-Source-Frameworks (React, Vue.js, Angular für Frontend; Node.js, Python, Java für Backend)
- Nutzung standardisierter Komponenten (PostgreSQL, Redis, Elasticsearch)
- Integration föderaler Basisdienste (BundID, BayernID, GovData)
- Dokumentierte Wiederverwendbarkeit von Modulen

---

### Standardkonformität

Die Architektur des CMS muss sich in die Nationale Architekturrichtlinie einfügen. Das bedeutet, es muss die Nutzung gängiger Industriestandards (z.B. für Datenformate wie JSON, XML) und Protokolle (z.B. HTTPS, OAuth 2.0 für Authentifizierung) sicherstellen.

**Messkriterium:**
- Datenformate: JSON, XML, CSV, GeoJSON
- Protokolle: HTTPS (TLS 1.3), OAuth 2.0, OpenID Connect, SAML 2.0
- Compliance mit W3C-Standards (HTML5, CSS3, WCAG 2.1)
- Einhaltung von REST-Prinzipien (HATEOAS, Statelessness)
- Unterstützung von Content Negotiation (Accept-Header)

---

### Entkoppelung (Headless-Ansatz)

Der Content-Dienst des CMS muss von der Präsentationsebene (der Smart Village App selbst) strikt getrennt sein (Headless-Ansatz).

**Messkriterium:**
- API-first-Architektur: Frontend konsumiert ausschließlich APIs
- Keine direkte Datenbankanbindung im Frontend
- Strikte Trennung von Backend (Content Management) und Frontend (Präsentation)
- Möglichkeit, verschiedene Frontends (Web, Mobile, IoT) anzubinden
- GraphQL oder REST als einzige Schnittstelle zum Backend

---

## 2. Datenmanagement und Datensouveränität

Die Richtlinien fordern eine hohe Kontrolle über Daten und die Vermeidung von Abhängigkeiten.

### Digitale Souveränität

Das CMS muss so konzipiert sein, dass ein Anbieter- oder Technologiewechsel (Vendor Lock-in) leicht möglich ist. Dies wird durch die Verwendung von Open Source, offenen Datenformaten und klar definierten Schnittstellen erreicht.

**Messkriterium:**
- 100% Open-Source-Stack (keine proprietären Komponenten im Core)
- Verwendung offener Datenformate (JSON, XML, CSV, PostgreSQL)
- Dokumentierte Migrations-Pfade zu/von anderen Systemen
- Export aller Daten in standardisierten Formaten (JSON, CSV, SQL-Dump)
- Keine Abhängigkeit von proprietären Cloud-Services (AWS-spezifisch, Azure-spezifisch)
- Verwendung von Container-Technologien (Docker) für Portabilität

---

### Datenhaltung

Die Datenhaltung sollte technologieunabhängig und in gängigen, offenen Datenbanksystemen erfolgen.

**Messkriterium:**
- Verwendung von Open-Source-Datenbanken (PostgreSQL, MySQL, MariaDB)
- Keine NoSQL-Datenbanken mit proprietären Query Languages
- Datenbank-Abstraktionsschicht (ORM) für einfachen Wechsel
- Standardisierte Backups (SQL-Dumps, pg_dump)
- Dokumentierte Datenbank-Schemas

---

### Datenhoheit

Es muss jederzeit sichergestellt sein, dass die Kommune/Verwaltung die volle Datenhoheit über alle im CMS gespeicherten Inhalte besitzt.

**Messkriterium:**
- Selfhosting-Option verfügbar
- Alle Daten physisch auf Servern der Kommune oder in Deutschland/EU gehostet
- Keine automatische Datenübertragung an Dritte ohne Zustimmung
- Vollständige Transparenz über Datenflüsse
- DSGVO-konforme Datenverarbeitung
- Möglichkeit zur vollständigen Datenlöschung (Right to be forgotten)

---

### Datenstandards

Es muss gewährleistet sein, dass die Schnittstelle des CMS die Fähigkeit besitzt, die geforderten externen Datenstandards (xZuFi, OParl, Open311, schema.org) zu bedienen und die Inhalte in diese Modelle zu mappen.

**Messkriterium:**
- Import/Export-Funktionen für xZuFi (Verwaltungsleistungen)
- OParl 1.1-konforme Endpoints für Ratsinformationen
- Open311 GeoReport v2-Unterstützung
- Schema.org JSON-LD-Ausgabe für SEO
- GTFS für ÖPNV-Daten
- GeoJSON für Geodaten
- Dokumentierte Mapping-Tabellen zwischen internen und externen Datenmodellen

---

## 3. Wirtschaftlichkeit und Betrieb

Die Aspekte der Wirtschaftlichkeit und des effizienten Betriebs spielen eine wichtige Rolle.

### Wirtschaftlichkeit (Total Cost of Ownership)

Die Auswahl des CMS muss unter Berücksichtigung der gesamten Lebenszykluskosten (Total Cost of Ownership, TCO) erfolgen. Open-Source-Lösungen sind hierbei oft zu präferieren.

**Messkriterium:**
- Transparente TCO-Kalkulation (Lizenzkosten: 0€, Betriebskosten, Wartungskosten, Schulungskosten)
- Keine versteckten Lizenzgebühren
- Community-getriebene Entwicklung reduziert Vendor-Abhängigkeit
- Kostenfreie Updates und Sicherheitspatches
- Open-Source-Lizenz (EUPL, GPLv3, MIT, Apache 2.0)

---

### Skalierbarkeit

Das CMS muss in der Lage sein, mit wachsenden Nutzerzahlen und steigendem Datenverkehr (Performance) ohne signifikante Verzögerungen oder Betriebsausfälle umzugehen (z.B. durch eine einfache horizontale Skalierung des Backends).

**Messkriterium:**
- Horizontale Skalierbarkeit: Mehrere Backend-Instanzen parallel betreibbar
- Stateless Application Design (Session-Daten in Redis/Database)
- Load Balancing-fähig (Nginx, HAProxy, AWS ALB)
- Caching-Strategien (Redis, Varnish, CDN)
- Performante Datenbank-Queries (Indizes, Query-Optimierung)
- Unterstützung für Read Replicas (Database Scaling)
- Auto-Scaling in Cloud-Umgebungen möglich

---

### Cloud-Fähigkeit

Das System sollte idealerweise Cloud-bereit sein, um die Nutzung föderaler oder kommunaler Cloud-Infrastrukturen zu ermöglichen. Dabei sind die Sicherheits- und Compliance-Anforderungen an den Cloud-Betrieb zu beachten (Stichwort: BSI C5-Katalog).

**Messkriterium:**
- Container-basierte Architektur (Docker, Kubernetes)
- 12-Factor-App-Prinzipien eingehalten
- Cloud-agnostisch: Läuft auf AWS, Azure, Google Cloud, OpenStack, On-Premise
- Unterstützung für Cloud-Native-Services (Object Storage, Managed Databases)
- BSI C5-Katalog-Konformität für Cloud-Betrieb:
  - Sichere Konfiguration
  - Verschlüsselung in Transit und at Rest
  - Logging und Monitoring
  - Incident Management
  - Backup und Disaster Recovery
- Compliance mit föderalen Cloud-Anforderungen (z.B. Govcloud, Open Telekom Cloud)

---

## 4. Zusammenfassung der FIT-Anforderungen

**Systemarchitektur:**
- Modulare, lose gekoppelte Komponenten
- Offene, standardisierte APIs (REST, GraphQL)
- Headless CMS-Ansatz (strikte Trennung von Content und Präsentation)
- Wiederverwendung etablierter Open-Source-Komponenten

**Datenmanagement:**
- Digitale Souveränität durch Open Source und offene Formate
- Volle Datenhoheit für Kommunen
- Unterstützung föderaler Datenstandards (xZuFi, OParl, Open311, schema.org)

**Wirtschaftlichkeit:**
- Transparente TCO-Kalkulation
- Open-Source-Präferenz
- Horizontale Skalierbarkeit
- Cloud-Fähigkeit mit BSI C5-Konformität

**Interoperabilität:**
- Standardkonforme Schnittstellen
- Integration mit föderalen Basisdiensten
- Offene Dokumentation
