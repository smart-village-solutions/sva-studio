## ADDED Requirements

### Requirement: HTML-Schutzheader besitzen einen belegten Owner und kompatiblen Auslieferungsvertrag

Das System MUST für Studio-, Auth- und öffentliche Kalender-HTML-Antworten einschließlich HTML-Fehlern den zuständigen App- oder bereits nachgewiesenen Edge-Pfad für CSP/Framing-Schutz, MIME-Sniffing-Schutz und Referrer-Policy benennen. Fehlende Policies MUST im vorhandenen zuständigen Pfad ergänzt werden; widersprüchliche doppelte Policies MUST vermieden werden. Die Aussage über produktiv wirksame Header MUST auf tatsächlichen freigegebenen Zielantworten beruhen und MUST von lokaler Konfiguration getrennt bleiben.

#### Scenario: Basisheader schützen HTML einschließlich tokenhaltiger Seiten

- **WHEN** der zuständige Auslieferungspfad eine HTML-Seite oder HTML-Fehlerseite liefert
- **THEN** setzt er nosniff, eine zur Seite passende Referrer-Policy und einen expliziten CSP-Framing-Vertrag
- **AND** gilt für normale Seiten mindestens strict-origin-when-cross-origin und für tokenhaltige Auth-/Reminder-Seiten no-referrer
- **AND** bleiben strengere vorhandene Download-/MCP-Policies erhalten

#### Scenario: CSP-Enforcement folgt auf Ressourceninventar und Funktionsnachweise

- **WHEN** eine fehlende Script-CSP eingeführt wird
- **THEN** werden benötigte Ressourcen und Frame-Beziehungen zunächst inventarisiert und die Script-Policy als Report-Only geprüft
- **AND** werden feste Inline-Skripte mit Hashes und dynamische SSR-/Start-Skripte mit einem Request-Nonce des unterstützten Frameworkpfads zugelassen
- **AND** werden nicht pauschal unsafe-inline, unsafe-eval oder Nonces für alle vorgefundenen Script-Tags freigegeben
- **AND** erfolgt Enforcement erst nach belegten Login-/Silent-SSO-, SSR-/Navigations-, Theme-, Karten-, Medien- und Exportfällen
- **AND** gilt Report-Only allein nicht als abgeschlossene Durchsetzung

#### Scenario: Öffentliche Einbettung und CORS bleiben funktional

- **WHEN** öffentliche Kalender-HTML-Seiten Schutzheader erhalten
- **THEN** berücksichtigt die Framing-Policy die tatsächlich belegten Einbettungsanforderungen
- **AND** bleiben das bestehende Shadow-DOM-Embed und credential-freie CORS-Verträge für öffentliche API und Assets erhalten
- **AND** wird dadurch keine Credential-CORS-Freigabe für DOI- oder Abmeldeseiten eingeführt

#### Scenario: Unbekannte Edge-Policy gilt nicht als Produktionsnachweis

- **WHEN** reale Zielheader oder deren Zuständigkeit noch nicht mit freigegebenen Zielen geprüft wurden
- **THEN** bleibt die produktive Header-Abnahme offen
- **AND** werden weder externe Konfigurationen überschrieben noch lokale bestandene Tests als Live-Evidenz dargestellt
