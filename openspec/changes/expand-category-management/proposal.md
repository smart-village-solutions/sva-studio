# Change: Kategorienverwaltung im Studio vollständig ausbauen

## Why

Die bestehende Kategorienseite im Studio zeigt Mainserver-Kategorien nur in einer schreibgeschützten Tabelle. Anlegen, Bearbeiten, Hierarchieänderungen, Aktivstatus, Datentypzuordnung und sicheres Löschen sind trotz bereits vorhandener Studio-Permissions nicht nutzbar.

Der mit Jira `SVA-1753` und Mainserver-Commit `b01aead122485848cd03ea774c12eb9fc3efdd28` bereitgestellte GraphQL-Vertrag schließt diese Upstream-Lücke. Das Studio muss ihn nun über seine bestehende hostgeführte Mainserver-Fassade und das vorhandene `plugin-categories` typsicher, mandantengebunden und barrierefrei nutzbar machen.

Referenzen:

- Jira `SVA-1745` als übergeordnetes Vorhaben zur Ablösung fehlender Mainserver-GUI-Funktionen
- Jira `SVA-1753` für den bereitgestellten Mainserver-Vertrag
- GitHub PR `#533` für die bestehende Read-only-Grundlage des Kategorienmoduls

## What Changes

- Das Studio führt eine vollständige Kategorienverwaltung auf Basis des bestehenden `plugin-categories` ein: Management-Liste, Anlegen, Bearbeiten, Unterkategorie anlegen, Aktivieren beziehungsweise Deaktivieren und kontrolliertes Löschen.
- Die Management-Liste lädt lokale aktive und inaktive Kategorien mit den Feldern Name, Aktivstatus, Parent, Position, Icon, Benachrichtigungs-E-Mail, Datentypen sowie Erstellungs- und Änderungszeitpunkt.
- Normale Kategorienauswahlen in Content-Editoren behalten ihren bestehenden Active-only-Vertrag und erhalten keine inaktiven Kategorien.
- Die bestehende Host-Fassade in `@sva/sva-mainserver` erhält schema-gestützte Adapter für `categories(includeInactive: true)`, `saveCategory` und `deleteCategory` sowie getrennte HTTP-Operationen für Create, Update und Delete.
- Die bestehenden Actions `categories.read`, `categories.create`, `categories.update` und `categories.delete` werden an der jeweiligen serverseitigen Operationsgrenze erneut geprüft und steuern zusätzlich die sichtbaren UI-Aktionen.
- Hierarchieänderungen bleiben atomar und zyklusfrei. Statusänderungen an Elternkategorien machen die bestätigte Kaskadenwirkung auf Nachfahren vor der Mutation sichtbar und werten `affectedDescendantIds` nach der Mutation aus.
- Datentypen werden aus dem vorhandenen validierten Plugin-/Content-Type-Registry-Snapshot und den bestätigten Legacy-Mainserver-Typen angeboten. Es gibt keine freie Texteingabe. Bereits gespeicherte, aktuell nicht auswählbare Werte bleiben sichtbar und werden nur nach ausdrücklicher Entfernung verworfen.
- Safe-Delete zeigt blockierende Nutzungen strukturiert an und führt weder rekursives Löschen noch automatische Umkategorisierung aus.
- Create verwendet den vorhandenen hostseitigen Idempotenzvertrag mit einem operationsgebundenen `Idempotency-Key`. Terminal gespeicherte Ergebnisse werden replayed; bei nichtterminalem Ausgang blockiert die Fassade einen automatischen zweiten Upstream-Aufruf bis zum Management-Re-Read.
- Validierungs-, Berechtigungs-, Vertrags- und Upstream-Fehler werden mit stabilen Codes, Feldbezügen und lokalisierten Meldungen dargestellt, ohne fremde Mandantendaten oder PII offenzulegen.

## Non-Goals

- Keine Änderung der Mainserver-Persistenz oder des in `SVA-1753` bereitgestellten GraphQL-Vertrags.
- Keine neue generische Referenzdaten-, Taxonomie- oder Admin-Ressourcenplattform.
- Keine freie Eingabe neuer Datentyp-Identifier und keine pluginlokale Parallel-Registry.
- Keine rekursive Löschung, automatische Umkategorisierung, Reassign-Funktion oder Bulk-Bearbeitung.
- Keine Änderung der Kategorienauswahl oder Kategoriesemantik in News, Events, POI, Generic Items oder anderen Content-Editoren.
- Keine Verwaltung globaler oder fremder Municipality-Kategorien mit lokalen Credentials.
- Keine Studio-Datenbankschemaänderung und kein zweiter Audit-Speicher.
- Kein lokaler oder direkter Mainserver-Deploypfad; Bereitstellung folgt den jeweils geschützten Rolloutprozessen.

## Dependencies

- Der Ziel-Mainserver muss den Vertrag aus `SVA-1753` einschließlich `includeInactive`, `saveCategory`, `deleteCategory`, `affectedDescendantIds`, strukturierter Fehler und Usage-Zahlen bereitstellen.
- Der eingecheckte Mainserver-Schema-Snapshot muss aus einem verifizierten Ziel-Schema aktualisiert werden, bevor die neuen Studio-Adapter aktiviert werden.
- Die effektiv verwendeten persönlichen oder organisatorischen Mainserver-Credentials benötigen eine Management-Rolle, die Management-Reads und -Mutationen autorisiert.
- Die bestehenden Studio-Actions und Modulzuweisungen für `categories` bleiben die lokale Autorisierungsquelle.

## Impact

- Affected specs: neue Capability `category-management`, bestehende Capability `sva-mainserver-integration`
- Affected code: `packages/plugin-categories`, `packages/sva-mainserver`, dünne App-Adapter unter `apps/sva-studio-react`
- Affected docs: Kategorien-Bedienung, Mainserver-Vertragsreferenz und Abnahmehinweise
- Affected arc42 sections: 05 Bausteinsicht, 06 Laufzeitsicht und 08 Querschnittliche Konzepte
- Database impact: keine geplante Studio-Schemaänderung
- ADR impact: keine neue Architekturentscheidung; bestehende Plugin-, Host-Fassaden- und IAM-Muster werden erweitert
