## Context

`add-instance-account-invitation-templates` liefert die gespeicherte Instanzvorlage, Vererbungsreihenfolge und Keycloak-Projektion beim konkreten Versand. Dieser Change ergänzt ausschließlich die Tenant-Bedienung.

## Decisions

- Ein eigener Tenant-Endpunkt liest den Instanzkontext aus der Session; eine vom Client gesendete `instanceId` wird abgewiesen. Der bestehende Root-Endpunkt bleibt plattformgebunden.
- `iam.invitationTemplate.manage` ist eine verwaltete Tenant-Permission. Frontend-Guard und Sidebar nutzen sie zur Darstellung; die Auth-Runtime prüft sie für GET und PATCH. Die Schreiboperation durchläuft zusätzlich die vorhandene CSRF-, Actor- und Feature-Prüfung.
- Das vorhandene Instanz-Template-Feld, die Validierung, das Scoped-Repository und der Revisionsvertrag werden wiederverwendet. Die serverweite Fallback-Vorlage hat eine Plattform-RLS-Policy und wird deshalb separat über den vorhandenen Registry-Lesepfad gelesen. Speichern schreibt keinen Keycloak-Realm; der nächste konkrete Einladungsversand wendet den wirksamen Text an.

## Critical boundaries and evidence

- Tenant-Isolation: Session-Instanz, Actor-Instanz und scoped DB-Transaktion müssen übereinstimmen. Handler-Tests prüfen fehlende Permission, fremden Actor und abgewiesenen Instanzparameter.
- Datenintegrität: Revision und Vorlagenvalidierung sind serverseitig verbindlich. Handler- und UI-Tests prüfen ungültige Werte, Konflikt, Reset und Neuladen.
- Bedienung: Menüpunkt und Route benötigen ausschließlich die neue Permission; andere IAM-Schreibrechte reichen nicht. Sidebar- und Routentests prüfen positive und negative Fälle.

## Migration

Migration 0102 legt die Permission für bestehende Instanzen an, weist sie dort `system_admin` zu und invalidiert den Permission-Cache. Die Seeds enthalten dieselbe Ausgangslage für neue Instanzen. Der Down-Pfad entfernt keine bestehenden delegierten Rechte.
