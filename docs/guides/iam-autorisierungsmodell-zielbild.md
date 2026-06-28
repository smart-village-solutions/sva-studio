# IAM-Autorisierungsmodell: Zielbild

## Ziel

Dieses Dokument beschreibt das fachliche Zielbild für Rollen, Permissions, Geltungsbereiche, Ownership und Autorenanzeige innerhalb eines Tenants.

## Geltungsbereich

- Alle nachfolgenden Regeln gelten tenant-lokal.
- Root verwaltet nur Tenants und ist nicht Teil des tenant-lokalen Rollen- und Berechtigungsmodells.

## Grundmodell

- Zugriffe, Funktionen und Rechte hängen immer an Permissions.
- Permissions werden ausschließlich Rollen zugewiesen.
- Gruppen bündeln ausschließlich Rollen.
- Accounts können Rollen direkt und zusätzlich indirekt über Gruppen erhalten.
- Gruppen haben keine eigenen Permissions.
- Accounts haben keine direkten Permissions.
- Direkte Account-Permissions sind kein Zielmodell. Falls technische Legacy-Tabellen oder Importreste existieren, dürfen sie nicht als fachliche Berechtigungsquelle gelten und müssen in Richtung Rollenmodell migriert oder entfernt werden.
- Organisationen haben keine eigenen Rollen und keine eigenen Gruppen.
- Ein Account kann mehreren Rollen zugeordnet sein.
- Ein Account kann mehreren Gruppen zugeordnet sein.
- Ein Account kann mehreren Organisationen zugeordnet sein.
- Ein Account darf auch ohne jede Rolle existieren.

## Berechtigungsprinzip

- Das Modell ist `allow-only`.
- Nicht gewährte Rechte sind automatisch verboten.
- Es gibt fachlich keine expliziten `deny`-Permissions.
- Konflikte werden nicht über `deny` aufgelöst, sondern durch fehlende Grants, kleinere Geltungsbereiche, Organisationskontext oder fachliche Validierung.
- Technisch vorhandene `deny`-Altlasten dürfen nicht als neue fachliche Modellierung verwendet werden.
- Ownership allein verleiht niemals Rechte.
- Organisationsmitgliedschaft allein verleiht niemals Rechte.
- Ohne passende Permission sieht oder bearbeitet ein Account auch die eigenen Inhalte nicht.
- Permissions sind unabhängig voneinander modellierbar.
- Auch Kombinationen wie `update` ohne `read` sind zulässig.

## Geltungsbereiche gescopter Permissions

Für gescopte Permissions gibt es genau drei Geltungsbereiche:

- `Eigene`
- `Aktive Organisation`
- `Alle`

### Fachliche Bedeutung

- `Eigene`: Der Zugriff gilt nur für Inhalte mit `ownerUserId = aktueller Account`.
- `Aktive Organisation`: Der Zugriff gilt für eigene Inhalte sowie für Inhalte mit `ownerOrganizationId = aktive Organisation`.
- `Alle`: Der Zugriff gilt für alle Inhalte innerhalb des Tenants.
- Fehlt eine aktive Organisation, verhält sich `Aktive Organisation` bei der Datensatzprüfung wie `Eigene`.

### Priorität

- Der effektive Scope einer Permission ist immer der weiteste erlaubte Scope aus allen Rollen- und Gruppenzuweisungen.
- Die Reihenfolge lautet: `Eigene < Aktive Organisation < Alle`.
- `Alle` überschreibt `Aktive Organisation` und `Eigene`.
- `Aktive Organisation` enthält fachlich immer auch `Eigene`.
- Hat ein Account keine Organisationszuordnung, fällt `Aktive Organisation` automatisch auf `Eigene` zurück.
- Dieser Fallback darf nicht dazu führen, dass Inhalte anderer Accounts oder ownerlose Inhalte sichtbar werden.

## Aktive Organisation

- Ein Account hat im Studio genau eine aktive Organisation als aktuellen Kontext.
- Die aktive Organisation ist benutzerbezogen persistent gespeichert.
- Ein Account kann die aktive Organisation selbst zwischen seinen zugeordneten Organisationen umschalten.
- Die aktive Organisation ist ein echter Autorisierungsfilter und nicht nur ein UI-Kontext.
- Die aktive Organisation liefert zusätzlich Standardwerte beim Erstellen neuer Inhalte.
- Die aktive Organisation darf nur auf eine Organisation gesetzt werden, der der Account zugeordnet ist.
- Wenn keine aktive Organisation vorhanden ist, bleiben ungescopte Permissions unverändert wirksam; `Aktive Organisation`-Scopes fallen für inhaltsartige Ressourcen auf `Eigene` zurück.

## Ressourcentypen mit und ohne Scope-Logik

Die Scope-Logik gilt für inhaltsartige Ressourcen:

- Inhalte
- News
- Events
- POIs
- zukünftige vergleichbare Content-Typen
- Medien gegebenenfalls später

Die Scope-Logik gilt derzeit nicht für:

- Kategorien
- Integrationen

Für Ressourcen ohne Ownership- und Scope-Modell gilt:

- Permission vorhanden = Zugriff auf alle Datensätze dieser Ressource im Tenant.
- `Eigene` und `Aktive Organisation` haben dort keine fachliche Bedeutung.
- Pro Permission wird technisch festgelegt, welche Geltungsbereiche überhaupt zulässig sind.

## Permission-Modell

- Der Geltungsbereich hängt immer an der konkreten Permission, nicht pauschal an Rolle, Gruppe oder Modul.
- `create` ist unscoped.
- Bestandsbezogene Aktionen sind gescoped.
- Dazu zählen insbesondere:
  - `read`
  - `update`
  - `delete`
  - `publish`
  - `archive`
  - `restore`
- Historie, Revisionen, Entwürfe und interne Metadaten hängen an der normalen `read`-Permission.
- Es gibt keinen separaten Sichtbarkeitsraum für Listen, Detailansicht, Historie, Entwürfe oder interne Metadaten.
- Innerhalb einer Rolle darf eine Permission genau einmal mit genau einem Geltungsbereich vorkommen.
- Scope-fähige und nicht scope-fähige Permissions werden technisch pro Permission-Katalog festgelegt.
- Für nicht scope-fähige Permissions ist fachlich ausschließlich `Alle` zulässig.

## Ownership-Modell

Ownership wird nicht aus den Fachdaten abgeleitet, sondern separat in der IAM-Schicht geführt.

Pro Inhalt werden intern bewusst beide IAM-Ownership-Bezüge parallel gespeichert:

- `ownerUserId` optional
- `ownerOrganizationId` optional

Zusätzlich gilt:

- `ownerUserId` ist nicht identisch mit Ersteller, Bearbeiter oder sichtbarem Autor.
- `ownerOrganizationId` ist nicht identisch mit einem beliebigen Organisationsfilter oder externen Quellsystem-Kontext.
- Inhalte dürfen ownerlos sein.
- Ownerlose Inhalte sind nur mit `Alle` sichtbar und bearbeitbar.
- Ownership darf den Tenant niemals verlassen.
- Technische Spaltennamen dürfen abweichen, müssen aber eindeutig auf `ownerUserId` und `ownerOrganizationId` abbildbar sein.
- Legacy-Felder wie `owner_subject_id` dürfen höchstens noch für Migrations- oder Projektionskompatibilität existieren. Sie sind keine Autorisierungsquelle und dürfen nicht als drittes Ownership-Modell verwendet werden.

### Setzen von Ownership beim Erstellen

Beim Erstellen eines neuen Inhalts werden für die IAM-Logik immer automatisch gesetzt:

- `ownerUserId = aktueller Account`
- `ownerOrganizationId = aktive Organisation`, falls vorhanden

Dabei gilt:

- `ownerUserId` wird beim Erstellen aus dem aktuell handelnden Account abgeleitet.
- `ownerOrganizationId` wird beim Erstellen aus der aktiven Organisation abgeleitet.
- Request-Payloads dürfen diese Standardwerte beim normalen Erstellen nicht stillschweigend überschreiben.
- `ownerOrganizationId` bleibt danach stabil, bis er explizit geändert wird.
- Alt-Daten ohne Ownership-Eintrag werden zunächst als ownerlos behandelt.

## Rechteprüfung auf Inhalte

Für inhaltsartige Ressourcen gelten dieselben Scope-Regeln für:

- `read`
- `update`
- `delete`
- `publish`
- `archive`
- `restore`
- vergleichbare Status-Aktionen

Die Auswertung erfolgt wie folgt:

- `Eigene` prüft nur `ownerUserId = aktueller Account`.
- `Aktive Organisation` prüft `ownerUserId = aktueller Account` oder `ownerOrganizationId = aktive Organisation`.
- `Alle` erlaubt den Zugriff auf alle Inhalte des Tenants.
- Ownerlose Inhalte sind nur mit `Alle` zugänglich.

Zusätzlich gilt:

- Listen- und Detailzugriff haben exakt dieselbe Autorisierungslogik.
- Was sichtbar ist, muss auch im Detail zugreifbar sein.
- Was im Detail zugreifbar ist, muss grundsätzlich auch in Listen auftauchen.
- Listenfilter müssen dieselben Owner- und Organisationsbedingungen verwenden wie Detail- und Mutationsprüfungen.
- Eine Listenoptimierung darf `Eigene` nicht nur über Organisationen approximieren.

## Ownership ändern

- Ownership-Änderungen hängen an der normalen `update`-Permission.
- Wer einen Inhalt bearbeiten darf, darf auch `ownerUserId` und `ownerOrganizationId` ändern.
- Das gilt auch für fremde Inhalte der aktiven Organisation, sofern `update` mit `Aktive Organisation` erlaubt ist.
- Das gilt auch für eigene Inhalte, sofern `update` mit `Eigene` erlaubt ist.
- Ein Nutzer darf die Ownership eigener oder berechtigter Inhalte auch so ändern, dass der Inhalt danach aus dem eigenen Zugriffsbereich herausfällt.
- Mit ausreichendem `update`-Recht dürfen `ownerUserId` und `ownerOrganizationId` tenant-intern frei geändert werden.
- Ein `ownerloser` Inhalt kann nur von einem Account mit entsprechendem globalem `update`-Recht neu zugewiesen werden.
- Eine Ownership-Änderung ändert nicht automatisch Ersteller, letzten Bearbeiter oder sichtbaren Autor.

Die genaue fachliche Spezifikation eines expliziten Ownership-Transfers folgt später separat.

## System Admin

- `System Admin` ist innerhalb des Tenants der vollständige Superuser.
- `System Admin` darf innerhalb des Tenants alles, einschließlich IAM-Verwaltung.
- Fachlich wird `System Admin` als normale, geschützte Rolle modelliert.
- `System Admin` ist kein separater Runtime-Bypass.
- Effektiv entspricht diese Rolle tenant-weit `Alle` für sämtliche tenant-relevanten Permissions.
- Der vollständige Zugriff wird durch einen deterministischen Permission-Sync hergestellt.
- Neue tenant-relevante Permissions und Modul-Permissions müssen automatisch oder über ein verbindliches Gate in die `System Admin`-Rolle aufgenommen werden.
- Root-only Permissions bleiben außerhalb des tenant-lokalen `System Admin`.

## Sichtbare Autorenanzeige

Ownership für IAM und sichtbare Autorenanzeige nach außen sind getrennte Modelle.

### Interne IAM-Ownership

- `ownerUserId`
- `ownerOrganizationId`

### Externe Autorenanzeige

Die sichtbare Autorenanzeige wird separat gesteuert.

Eine Organisation kennt dafür genau zwei Modi:

1. Immer `Organisation`
2. Wählbar zwischen `User` und `Organisation`

Zusätzlich gilt:

- Wenn die Anzeige wählbar ist, ist der Default trotzdem `Organisation`.
- Die Auswahl wird pro Inhalt separat von der IAM-Ownership gespeichert.
- Die sichtbare Autorenanzeige ist nach dem Erstellen änderbar.
- Die Änderung der sichtbaren Autorenanzeige hängt an der normalen `update`-Permission.
- Die aktive Organisation dient auch hier als Standardkontext beim Erstellen.
- Ein normales Update eines Inhalts ändert den sichtbaren Autor nicht automatisch.
- Ersteller, letzter Bearbeiter, IAM-Owner und sichtbarer Autor sind getrennte Begriffe.

## Mainserver-DataProvider und externe Identität

Mainserver-`dataProvider` sind externe Veröffentlichungsidentitäten. Sie sind nicht automatisch Studio-IAM-Owner.

Für Mainserver-Projektionen gilt:

- `sourceDataProviderId` und `sourceDataProviderName` beschreiben den vom Mainserver gelieferten DataProvider.
- `credentialSource` beschreibt, ob die Projektion über Organisations- oder persönliche Credentials gelesen beziehungsweise geschrieben wurde.
- `ownerUserId` und `ownerOrganizationId` bleiben die einzigen IAM-Ownership-Felder.
- `ownerOrganizationId` darf nur gesetzt werden, wenn eine explizite Studio-IAM-Zuordnung zur Organisation besteht.
- Eine aktive Organisation, ein UI-Filter, ein Mainserver-Organisationswert oder ein DataProvider darf keine Organisationsownership implizit erzeugen.
- Ownerlose externe Inhalte bleiben fail-closed und sind nur mit globalem Recht oder nach expliziter Ownership-Zuordnung sichtbar.

Schreibende Mainserver-Flows laufen immer in genau einem Kontext:

- `organization`: im Namen der validierten aktiven Organisation und mit deren Credentials.
- `user`: persönlich im Namen des aktuellen Accounts.

Bei Benutzern mit mehreren Organisationen muss die aktive Organisation vor der Mutation eindeutig im Request-/Session-Kontext feststehen und serverseitig validiert sein.

## Audit

Ownership-Änderungen und Änderungen an der sichtbaren Autorenanzeige müssen historisiert werden.

Die Historie dient ausschließlich der Nachvollziehbarkeit, nicht der Wiederherstellung.

Nachvollziehbar sein muss mindestens:

- alter Wert
- neuer Wert
- Zeitpunkt
- auslösender Account
- betroffener Inhalt
- betroffener Feldtyp, also mindestens `ownerUserId`, `ownerOrganizationId` oder sichtbare Autorenanzeige

## Leitsätze

- Permissions verleihen Rechte, Ownership nicht.
- Das Modell bleibt `allow-only`; explizite `deny`-Permissions gehören nicht zum Zielbild.
- Geltungsbereiche gelten pro Permission, nicht pro Rolle oder Modul.
- Es gibt genau drei Geltungsbereiche: `Eigene`, `Aktive Organisation`, `Alle`.
- `create` ist unscoped.
- `Aktive Organisation` ist sowohl Sichtbarkeitsfilter als auch Erstellungs-Default.
- Ownership wird separat in der IAM-Schicht geführt.
- Sichtbarer Autor und IAM-Ownership sind getrennt.
- Listen- und Detailzugriff dürfen fachlich nicht auseinanderlaufen.
- `System Admin` ist tenant-lokal der vollständige Superuser als geschützte normale Rolle mit vollständigem Permission-Sync.
