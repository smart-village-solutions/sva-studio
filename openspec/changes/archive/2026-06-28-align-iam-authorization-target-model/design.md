# Design: IAM-Zielbild-Abgleich

## Kontext

`update-iam-ownership-authorization-model` hat die Grundlage für Allow-only-RBAC und owner-basierte Scopes gelegt. Die aktuelle Codeanalyse zeigt aber Restabweichungen vom Zielbild:

- Ownership-Transfer prüft teilweise Zielzugriff statt nur die Berechtigung am aktuellen Inhalt.
- Die sichtbare Autorenanzeige ist derzeit überwiegend ein Display-Name und kein eigenes fachliches Modell.
- Einzelne System-Admin-Pfade bleiben rollenbasiert oder umgehen Hierarchieprüfungen.
- Effektive Permissions können mehrere Scope-Zeilen für denselben fachlichen Grant zurückgeben.
- Die Mainserver-Projektion behandelt externen Organisationskontext teilweise wie IAM-Ownership.

## Entscheidungen

### Ownership-Transfer

Ein Ownership-Transfer ist eine Mutation am aktuellen Inhalt. Die Autorisierung SHALL daher auf der Berechtigung beruhen, diesen aktuellen Inhalt zu aktualisieren. Der Ziel-Owner ist Validierungsziel, aber kein zusätzlicher Lesebereich, den der Actor bereits besitzen muss.

Nach erfolgreicher Übertragung kann der Actor den Inhalt aus seiner anschließenden Read-Sicht verlieren. Das ist erwartetes Verhalten und kein Grund, die Mutation vorher zu verweigern.

### Sichtbare Autorenanzeige

Die sichtbare Autorenanzeige wird als fachliche Inhaltsmetadaten modelliert, getrennt von technischer Ownership:

- `ownerUserId` und `ownerOrganizationId` steuern Autorisierung.
- `authorDisplayMode` steuert die sichtbare Urheberschaft.
- Der sichtbare Name wird als validierter Snapshot persistiert. Dadurch bleiben veröffentlichte Inhalte stabil, auch wenn sich Organisations- oder Benutzeranzeigenamen später ändern.

Organisationen mit `content_author_policy = 'org_only'` erzwingen Organisationsanzeige. Bei `org_or_personal` darf der Actor zwischen Organisations- und persönlicher Anzeige wählen, soweit der aktive Kontext das erlaubt.

### System Admin

Runtime-Autorisierung SHALL auf expliziten Permissions beruhen. `system_admin` darf nicht als genereller Bypass für tenantfachliche Mutationen dienen.

Zulässige Ausnahmen sind eng begrenzte Plattform-, Bootstrap- oder Reconcile-Pfade, die nicht als normale Tenant-Admin-Funktion exponiert sind und auditierbar bleiben. Legacy-Group- oder Reconcile-Handler müssen entweder permission-backed werden oder als Ausnahme dokumentiert und technisch begrenzt bleiben.

### Scope-Normalisierung

Für identische fachliche Permission-Keys SHALL das Read Model den weitesten wirksamen Scope zurückgeben. Scope-Reihenfolge:

1. `own`
2. `organization`
3. `all`

Provenienz aus Rollen und Gruppen bleibt erhalten, darf aber keine mehrfachen fachlich widersprüchlichen Grants erzwingen.

### Mainserver-Projektion

Mainserver-Organisationen, Data-Provider oder externe Quellkontexte sind nicht automatisch IAM-Owner. Ein Mainserver-DataProvider ist die externe Veröffentlichungsidentität, an der die verwendeten API-Credentials hängen. Die Projektion SHALL diese Werte als Quellmetadaten führen. `ownerOrganizationId` wird nur gesetzt, wenn ein kanonischer Studio-IAM-Owner explizit bestimmt ist.

Ownerlose externe Inhalte sind nicht implizit organisationssichtbar. Sie sind nur über globale Berechtigung oder über einen expliziten, späteren Ownership-Mapping-Schritt sichtbar.

Die fachliche Zuordnung folgt dieser Trennung:

- `ownerUserId` und `ownerOrganizationId` steuern Studio-Autorisierung.
- `authorDisplayMode` und `authorDisplayName` steuern die sichtbare Urheberschaft.
- `sourceDataProviderId`, `sourceDataProviderName` und `credentialSource` beschreiben die externe Mainserver-Identität.
- Organisation- oder Benutzer-Credentials können explizit mit einem erwarteten Mainserver-DataProvider verknüpft werden.

Für `org_only` ist der Normalfall, dass die aktive Studio-Organisation ihre Organisations-Credentials verwendet und der resultierende Mainserver-DataProvider explizit dieser Organisation zugeordnet ist. Für `org_or_personal` mit User-Fallback-Credentials darf das System nicht stillschweigend Organisationsownership annehmen; ohne explizite Organisationszuordnung bleibt der Inhalt user-owned oder ownerlos.

### Mehrorganisationskontext

Mehrorganisationsfähigkeit bleibt fachlich erforderlich. Ein Benutzer kann Mitglied in mehreren Organisationen sein und Inhalte im Namen einer bestimmten Organisation anlegen. Das System SHALL diese Komplexität nicht durch implizite Ableitung reduzieren, sondern durch einen expliziten Mutationskontext kontrollieren.

Jede schreibende Mainserver- oder Content-Mutation läuft genau in einem der folgenden Modi:

- `organization`: im Namen der validierten `activeOrganizationId`.
- `user`: persönlich im Namen des aktuellen Accounts.

Im Organisationsmodus SHALL der Server vor der Mutation die Mitgliedschaft des Benutzers in der aktiven Organisation prüfen, Credentials ausschließlich für diese Organisation auflösen und die daraus erzeugte technische Mainserver-Identität als Quellmetadatum speichern. Im persönlichen Modus SHALL der Server keine Organisationsownership aus der letzten aktiven Organisation, einem Listenfilter oder einem Mainserver-DataProvider ableiten.

Die aktive Organisation darf nicht aus Mainserver-Antworten, DataProvider-Werten, UI-Filtern oder bisherigen Session-Verläufen geraten werden. Sie muss vor der Mutation im Session-/Request-Kontext eindeutig feststehen und serverseitig validiert werden.

## Migration und Kompatibilität

- Wenn ein neues Feld wie `authorDisplayMode` eingeführt wird, erhält bestehender Content einen deterministischen Default, bevorzugt `organization`, sofern eine Organisation ableitbar ist.
- Bestehende `authorDisplayName`-Werte dürfen als Snapshot erhalten bleiben, werden aber nicht als technische Ownership interpretiert.
- Projection-Daten müssen so migriert oder neu aufgebaut werden, dass externe Organisationswerte nicht mehr stillschweigend `ownerOrganizationId` füllen.
- Bestehende Projection-Daten mit Mainserver-`dataProvider` benötigen eine explizite Mapping-Regel auf Studio-Organisation, Studio-User oder ownerlosen Status.
- Bestehende Mehrorganisations-Sessions bleiben unterstützt; die Umsetzung darf den Fall mehrerer Organisationsmitgliedschaften nicht als Fehler behandeln.

## Offene Fragen

- Müssen ownerlose Mainserver-Projektionen initial einem administrativen Nachbearbeitungsworkflow zugeführt werden?
