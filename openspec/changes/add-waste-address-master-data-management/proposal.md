# Change: Adress-Stammdaten im Waste-Management pflegen und konsistent löschen

## Why

Regionen, Orte, Straßen und Hausnummern lassen sich derzeit über den Abholorte-Bereich anlegen; die vorhandenen Bearbeitungsdialoge haben dort keinen erreichbaren Einstieg. Einzelnes Löschen fehlt. Die unterschiedlichen bestehenden Fremdschlüsselaktionen würden beim Löschen teils Abholorte entfernen, teils ihre Adresse unbemerkt verallgemeinern und E-Mail-Abos zurücklassen oder die Löschung sperren.

## What Changes

- Ein Haupttab `Stammdaten` zeigt genau eine Tabelle für Regionen, Orte, Straßen oder Hausnummern. Ein beschriftetes Dropdown über der Tabelle wählt die Ebene. Navigation, Tabellenwerkzeuge, Zeilenaktionen und Dialoge folgen den vorhandenen Mustern des Plugins, auch auf Mobilgeräten und mit Tastatur. Der bestehende Tab `Abholorte` bleibt für konkrete Abholorte zuständig; dessen Adress-Anlegeaktionen wandern in den neuen Tab.
- Berechtigte Benutzer können auf jeder Ebene anlegen, Name beziehungsweise Nummer bearbeiten, die übergeordnete Zuordnung ändern und löschen. Elternoptionen zeigen ihren Adresskontext; Elternfilter helfen bei langen Listen. Vor einem Elternwechsel zeigt der Dialog mitwandernde Abholorte und betroffene E-Mail-Abos samt Outbox; deren Löschung erfordert eine ausdrückliche Bestätigung. Die vorhandenen Dialoge, Verträge, Repository- und Berechtigungspfade werden erweitert statt dupliziert.
- Vor einer Löschung zeigt das Studio zuerst die wesentlichen Folgen und danach bei Bedarf weitere Zählwerte: untergeordnete Stammdaten, Abholorte, deren Tour-Zuordnungen und ortsbezogene Termine, betroffene Einsätze sowie E-Mail-Abos einschließlich Abo-Positionen und Outbox-Einträgen aller Status. Bereits als `sent` markierte Outbox-Einträge werden eigens gezählt. Die API berechnet die Wirkung erneut und löscht alles atomar im Tenant-Kontext.
- Fraktionen, Touren und deren allgemeine Termin- und Verschiebungsregeln bleiben bestehen. Ein Einsatz mit weiteren Abholorten bleibt erhalten; ein Einsatz ohne Abholort wird entfernt. Eine bereits versandte E-Mail kann nicht zurückgerufen werden, ihr `sent`-Outbox-Datensatz darf mit dem Abo entfallen.
- Zuordnungsänderungen dürfen abhängige Abholorte nicht widersprüchlich oder breiter adressiert zurücklassen. Eine Verschiebung, die E-Mail-Abos auf eine andere Adresse umdeuten würde, entfernt die betroffenen Abos samt Positionen und Outbox aller Status nach ausdrücklicher Bestätigung atomar mit der Verschiebung. Unbetroffene Abos bleiben bestehen.

## Scope

- **Im Scope:** Waste-Adress-Stammdaten-UI, typisierter Tabellenzustand, bestehende Waste-HTTP-Verträge und tenantlokale Persistenz; transaktionale Vorschau/Löschung, Folgen für E-Mail-Erinnerungen und Tour-Einsätze, zielgerichtete Tests und aktuelle Dokumentation.
- **Nicht im Scope:** neue Datenbanktabellen oder ein zweiter Stammdaten-Service, Änderungen an Fraktions- oder Tourdefinitionen, automatische Neubuchung von Abos, Rückruf bereits versandter Nachrichten, Änderungen an der öffentlichen Kalender-UI oder an allgemeinen Datentools.

## Kritische Invarianten und Nachweis

1. Eine bestätigte Löschung wirkt nur auf den ausgewählten Adress-Teilbaum. Ortsweite Abholorte überstehen eine Straßenlöschung; straßenweite Abholorte überstehen eine Hausnummernlöschung. Gegenprobe: Datenbank-Integrationstests für alle vier Ebenen und gemischte Abholorte.
2. Kein betroffener Abholort wird durch `SET NULL` auf eine breitere Adresse umgedeutet. Alle betroffenen Abholorte, ortsbezogenen Termine und Verknüpfungen verschwinden gemeinsam oder gar nicht. Gegenprobe: Transaktions-/Rollback-Test und Prüfung der Referenzen nach der Löschung.
3. Bei Löschung und bestätigtem Elternwechsel verschwinden nur die jeweils betroffenen E-Mail-Abos einschließlich `pending`, `active`, `unsubscribed` und `expired` samt Positionen und Outbox-Einträgen (`sent` eingeschlossen); unbetroffene Abos und Fraktionen bleiben. Gegenprobe: Integrationstest mit Status- und Adressvarianten, einschließlich `street_id = 'all'`.
4. Touren und ihre unabhängigen Terminregeln bleiben; nur Einsätze ohne verbleibenden Abholort entfallen. Gegenprobe: Einsätze mit einem und mehreren Abholorten sowie Tour- und Fraktions-Readback.
5. Vorschau und Mutation prüfen Tenant, Berechtigung und Hierarchiekonsistenz serverseitig. Die endgültige Menge wird in der Löschtransaktion erneut bestimmt; konkurrierende Änderungen können keine unbestätigten Fremddaten erfassen. Gegenprobe: Handler-, Autorisierungs- und Konkurrenztests.

## Impact

- **Affected specs:** `waste-management`.
- **Erwartete Codebereiche:** `packages/plugin-waste-management/`, `packages/waste-management-contracts/`, `packages/waste-management-runtime/`; nur falls bestehende Host-Verdrahtung es erfordert `apps/sva-studio-react/`.
- **Dokumentation:** `docs/architecture/05-building-block-view.md`, `docs/architecture/08-cross-cutting-concepts.md` und die Waste-Schema-Beschreibung in `docs/development/studio-db-schema.md`. Ein Bestands-Tenant-Migrationsschritt und der separate Waste-Schema-Builder sind nur bei tatsächlich nötiger Constraint-Änderung anzupassen; der zentrale `studio-db-schema-final.sql`-Snapshot beschreibt nicht die Waste-Fachdatenbank.
- **Abgrenzung zu laufenden Changes:** Die laufenden Waste-Changes für Erinnerungs-Einstellungen, Tourstatus, Mainserver-Status und öffentliche Ausgabe werden nicht erweitert. Ihre Verbraucherpunkte sind bei der Implementierung auf Adress-Löschfolgen zu prüfen.

## Approval Status

Das fachliche Zielbild einschließlich Löschung betroffener Abos und `sent`-Outbox-Einträge bei Adresslöschung und ausdrücklich bestätigtem Elternwechsel wurde im Dialog am 16. Oktober 2026 geklärt. Die Umsetzung dieses Changes wurde anschließend ausdrücklich beauftragt.
