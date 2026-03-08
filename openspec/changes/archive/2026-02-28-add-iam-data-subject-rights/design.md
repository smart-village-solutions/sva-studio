# Design: Child F – DSGVO-Betroffenenrechte im IAM

## Kontext

Child F implementiert die DSGVO-Betroffenenrechte (Art. 15–21) für IAM-Daten auf Basis des stabilen Datenmodells aus Child B.

## Ziele

- Self-Service-Auskunft und Datenportabilität (JSON/CSV/XML)
- Rechtssichere Löschung mit Fristen, Kaskaden und Legal-Hold
- Berichtigung und Widerspruch im IAM-Kontext
- Vollständige Auditierbarkeit aller Betroffenenanfragen

## Architekturentscheidungen

1. Betroffenenanfragen als eigene Prozessobjekte mit Statushistorie
2. Löschung zweistufig: Soft-Delete -> finale Löschung nach Karenz
3. Audit-Events werden bei Löschung pseudonymisiert, nicht gelöscht
4. Legal Hold blockiert irreversible Löschschritte

## Prozessflüsse

- Auskunft/Portabilität: Anfrage -> Datensammlung -> (optional async) Exportgenerierung -> Statusverfolgung -> Bereitstellung
- Löschung: Antrag -> Soft-Delete -> Fristüberwachung -> Löschkaskade/Pseudonymisierung
- Berichtigung: Änderungsantrag -> Validierung -> Persistenz -> Audit-Event

## Export-Mechanik

- Kleine Exporte können synchron beantwortet werden.
- Für große Datenmengen wird ein asynchroner Export-Request mit Statusmodell `queued|processing|completed|failed` genutzt.
- Der Export ist instanzgebunden (`instanceId`) und nur für die anfragende Identität bzw. berechtigte Admin-Rolle abrufbar.

## SLA und Eskalation

- 48h-SLA bezieht sich auf den Zeitraum zwischen Annahme eines gültigen Löschantrags und Sperrung/Soft-Delete.
- SLA-Metriken werden mit Zeitstempeln (`requestAcceptedAt`, `softDeletedAt`) gemessen und auditierbar gespeichert.
- Bei SLA-Verstoß wird ein Eskalationsereignis erzeugt und im Operations-Monitoring sichtbar.

## Löschkaskaden

- Primärdaten: Account, Zuordnungen, Rollenbezüge, Sessions
- Sekundärdaten: referenzierende IAM-Datensätze gemäß Löschmatrix
- Audit-Daten: Pseudonymisierung statt physischer Löschung

## Legal-Hold-Mechanik

- Vor finaler Löschung wird Legal-Hold-Status geprüft
- Bei aktivem Hold: Prozessstatus auf blockiert, mit Begründung und Audit-Eintrag
- Aufhebung des Holds reaktiviert nur berechtigte offene Anfragen

## Backup- und Restore-Strategie

- Es gibt keine punktuelle Löschung einzelner Datensätze in unveränderlichen Backups.
- Compliance erfolgt über definierte Backup-Retention und einen Restore-Sanitization-Prozess, der bereits gelöschte Accounts nach Restore erneut bereinigt.

## Alternativen und Abwägung

- Sofortige Hard-Delete-Löschung: verworfen wegen Rechts- und Betriebsrisiko
- Vollständige Audit-Log-Löschung: verworfen wegen Revisionsanforderungen

## Verifikation

- Integrationstests für vollständige Löschkaskaden
- Negativtests für aktive Legal Holds
- Format- und Vollständigkeitstests für Exporte
- Frist- und Eskalationstests für offene Anfragen
