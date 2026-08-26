# Dossier 7: Identitäten und Berechtigungen

## Gemeinsamer Kontext

Benutzer erhalten Rechte bevorzugt über Gruppen und die darin gebündelten Rollen. Direkte Rollen
sind additive Sonderfälle. Organisationen liefern zusätzlich hierarchische Arbeits- und
Autorenkontexte. Plattformobjekte, extern verwaltete Objekte und geschützte Systemrollen können
nur lesbar sein.

## `admin.users.list` – Benutzer verwalten

- **Route / Typ / Owner:** `/admin/users`, Liste, Host.
- **Nutzerziel:** Benutzer suchen, Zustand prüfen und Verwaltungsaktionen starten.
- **Produktfakten:** Suche nach Name oder E-Mail, Statusfilter, optionale technische Accounts und
  Pagination. Die Liste zeigt Rolle, Status, Keycloak-Zuordnung und letzten Login. Möglich sind
  Anlegen, Bearbeiten, Aktivieren, Deaktivieren, Auswahl bis maximal 50 deaktivieren,
  Keycloak-Synchronisation und Mainserver-Aktualisierung.
- **Schutzregeln:** Eigenes Konto und letzter aktiver System-Administrator sind vor bestimmten
  Deaktivierungen geschützt.
- **Leitfragen / Stichwörter:** Was bedeuten zugeordnet, manuell prüfen und technischer Account?
  Benutzerliste, Keycloak-Sync, Aktivstatus, Mainserver-Daten.
- **Evidenz:** `routes/admin/users/-user-list-page.tsx`,
  `i18n/resources/de/admin/users.resources.ts`.

## `admin.users.create` – Benutzer anlegen

- **Route / Typ / Owner:** `/admin/users/new`, Anlegen, Host.
- **Nutzerziel:** Ein Konto in Keycloak und IAM mit passenden Startzuweisungen erstellen.
- **Produktfakten:** Persönliche Kontodaten werden mit Gruppen, optional direkten Rollen und
  optionaler Passwort-Einladung angelegt. Ein Konto kann als technisch markiert werden und ist dann
  von Kontolöschungsregeln ausgenommen. Gruppen sind der bevorzugte Startpunkt.
- **Kontextabhängig:** Die Einladungs-E-Mail kann nach erfolgreicher Kontoanlage separat
  fehlschlagen; das Konto ist dann trotzdem angelegt.
- **Leitfragen / Stichwörter:** Welche Gruppe passt? Ist eine direkte Rolle wirklich nötig? Was tun
  bei fehlgeschlagener Einladung? Benutzer anlegen, Gruppe, Rolle, Passwort-Einladung.
- **Evidenz:** `routes/admin/users/-user-create-page.tsx`,
  `routes/admin/users/user-create-account-options.tsx`.

## `admin.users.detail` – Benutzer bearbeiten

- **Route / Typ / Owner:** `/admin/users/$userId`, Detail, Host.
- **Nutzerziel:** Profil, Verwaltung, Organisationen, effektive Rechte und Historie eines Kontos
  prüfen oder ändern.
- **Produktfakten:** Tabs umfassen persönliche Daten, Verwaltung, Organisationen, Berechtigungen
  und Historie. Bearbeitbar sind unter anderem Rollen, Gruppen, Organisationsmitgliedschaften,
  Default-Kontext, technische Klassifikation, Notizen und Mainserver-Credentials. Effektive und
  inaktive Berechtigungsquellen werden schreibgeschützt aufgelöst.
- **Gefährliche Aktionen:** Physisches Löschen entfernt das Tenant-Konto in Studio und Keycloak;
  Inhalte folgen der wirksamen Regel. Aktive System-Administrator-Rolle blockiert Löschen.
- **Leitfragen / Stichwörter:** Woher stammt ein Recht? Welche Änderung erfordert Speichern? Wie
  unterscheiden sich direkte und geerbte Zuweisungen? Benutzer bearbeiten, effektive Rechte,
  Organisation, Historie, dauerhaft löschen.
- **Evidenz:** `routes/admin/users/-user-edit-page.tsx`,
  `routes/admin/users/use-user-edit-controller.ts`.

## `admin.groups.list` – Gruppen verwalten

- **Route / Typ / Owner:** `/admin/groups`, Liste, Host.
- **Nutzerziel:** Instanzgebundene Rollenbündel finden und verwalten.
- **Produktfakten:** Suche erfasst Gruppen und Rollen. Angezeigt werden Gruppentyp, gebündelte
  Rollen, Mitgliederzahl und Aktivstatus. Die Seite benötigt einen aktiven Instanzkontext.
- **Leitfragen / Stichwörter:** Welche Nutzeraufgabe bündelt die Gruppe? Ist sie aktiv und wie viele
  Mitglieder betrifft eine Änderung? Gruppe, Rollenbündel, Mitgliedschaft, Instanz.
- **Evidenz:** `routes/admin/groups/-groups-page.tsx`,
  `i18n/resources/de/admin/groups.resources.ts`.

## `admin.groups.create` – Gruppe anlegen

- **Route / Typ / Owner:** `/admin/groups/new`, Anlegen, Host.
- **Nutzerziel:** Eine wiederverwendbare Gruppe mit technischem Schlüssel und Rollen erstellen.
- **Produktfakten:** Erfasst werden technischer Gruppenschlüssel, Anzeigename, Beschreibung und
  gebündelte Rollen. Mitgliedschaften werden nach Anlage in der Detailansicht gepflegt.
- **Leitfragen / Stichwörter:** Ist der Schlüssel dauerhaft verständlich? Welche Rollen gehören
  fachlich zusammen? Gruppe anlegen, Gruppenschlüssel, Rollenbündel.
- **Evidenz:** `routes/admin/groups/-group-create-page.tsx`,
  `routes/admin/groups/-group-shared.tsx`.

## `admin.groups.detail` – Gruppe bearbeiten

- **Route / Typ / Owner:** `/admin/groups/$groupId`, Detail, Host.
- **Nutzerziel:** Rollenbündel, Status und zeitlich begrenzte Mitgliedschaften pflegen.
- **Produktfakten:** Neben Gruppendaten werden Mitglieder über Keycloak-Subject, Gültig-ab und
  Gültig-bis zugewiesen oder entfernt. Löschen entfernt Gruppe und Mitgliedschaften dauerhaft.
- **Kontextabhängig:** Ungültige Datumswerte werden in der Fachzeitzone Europe/Berlin abgelehnt.
- **Leitfragen / Stichwörter:** Wann wird eine Mitgliedschaft wirksam oder unwirksam? Welche Rechte
  verlieren Mitglieder beim Löschen? Gruppe bearbeiten, Gültigkeit, Mitglied entfernen.
- **Evidenz:** `routes/admin/groups/-group-detail-page.tsx`,
  `routes/admin/groups/-group-shared.tsx`.

## `admin.roles.list` – Rollen verwalten

- **Route / Typ / Owner:** `/admin/roles`, Liste, Host.
- **Nutzerziel:** Rollen, Rechteumfang und Synchronisationszustand überblicken.
- **Produktfakten:** Suche erfasst Rolle und Berechtigung. Die Tabelle unterscheidet System-,
  benutzerdefinierte, externe und Keycloak-Built-in-Rollen und zeigt Rechte, Nutzerzahl sowie
  Synchronisation. Aktionen umfassen Anlegen, Import aus Keycloak und Reconcile.
- **Kontextabhängig:** Plattformrollen werden in einer eigenen, möglicherweise nur lesbaren Sicht
  dargestellt.
- **Leitfragen / Stichwörter:** Wer verwaltet die Rolle führend? Was synchronisiert Reconcile?
  Rollenliste, Systemrolle, externe Rolle, Keycloak, Reconcile.
- **Evidenz:** `routes/admin/roles/-roles-page.tsx`,
  `i18n/resources/de/admin/roles.resources.ts`.

## `admin.roles.create` – Rolle anlegen

- **Route / Typ / Owner:** `/admin/roles/new`, Anlegen, Host.
- **Nutzerziel:** Eine benutzerdefinierte Rolle mit technischem Schlüssel und Metadaten erstellen.
- **Produktfakten:** Angelegt werden technischer Schlüssel, Anzeigename, Beschreibung und
  Rollenlevel. Berechtigungen und Zuweisungen werden anschließend im Detail gepflegt.
- **Leitfragen / Stichwörter:** Ist eine neue Rolle nötig oder existiert ein passendes Bündel? Welche
  dauerhafte Bedeutung hat der technische Schlüssel? Rolle anlegen, Rollenlevel, Metadaten.
- **Evidenz:** `routes/admin/roles/-role-create-page.tsx`,
  `routes/admin/roles/-roles-shared.ts`.

## `admin.roles.detail` – Rolle bearbeiten

- **Route / Typ / Owner:** `/admin/roles/$roleId`, Detail, Host.
- **Nutzerziel:** Metadaten, Berechtigungen, direkte Benutzerzuweisungen und Keycloak-Status prüfen.
- **Produktfakten:** Tabs sind Allgemein, Berechtigungen, Zuweisungen und Synchronisierung.
  Berechtigungen lassen sich suchen, einzeln oder gesammelt zuweisen und mit Scope versehen.
  Keycloak-Synchronisation betrifft nur relevante Rollenmetadaten; lokale Berechtigungen,
  Zuweisungen und Schutzmerkmale bleiben im Studio.
- **Kontextabhängig:** Systemrollen und externe Rollen sind schreibgeschützt. Löschen entfernt auch
  bestehende Benutzer- und Gruppenzuordnungen der Rolle.
- **Leitfragen / Stichwörter:** Welche Quelle ist führend? Welcher Scope ist erforderlich? Rolle
  bearbeiten, Berechtigung, Scope, Zuweisung, Metadatensynchronisation.
- **Evidenz:** `routes/admin/roles/-role-detail-page.tsx`,
  `i18n/resources/de/admin/roles.resources.ts`.

## `admin.organizations.list` – Organisationen verwalten

- **Route / Typ / Owner:** `/admin/organizations`, Liste, Host.
- **Nutzerziel:** Organisationen in der aktiven Instanz suchen und hierarchisch einordnen.
- **Produktfakten:** Suche, Typ- und Statusfilter sowie Pagination. Die Tabelle zeigt Typ, Parent,
  Kinder, Mitglieder und Status. Organisationen können aktiviert, deaktiviert, bearbeitet oder
  gelöscht werden.
- **Leitfragen / Stichwörter:** Wo liegt die Organisation in der Hierarchie? Welche Mitglieder und
  Kindorganisationen sind betroffen? Organisation, Parent, Hierarchie, Aktivstatus.
- **Evidenz:** `routes/admin/organizations/-organizations-page.tsx`,
  `i18n/resources/de/admin/organizations.resources.ts`.

## `admin.organizations.create` – Organisation anlegen

- **Route / Typ / Owner:** `/admin/organizations/new`, Anlegen, Host.
- **Nutzerziel:** Einen hierarchischen Arbeitskontext in der aktiven Instanz erstellen.
- **Produktfakten:** Felder umfassen technischen Schlüssel, Anzeigename, Typ, Parent und
  Autoren-Policy. Typen sind Landkreis, Gemeinde, Ortsteil, Unternehmen, Agentur, Verein,
  Institution und Sonstige. Die Policy erlaubt nur Organisation oder Organisation beziehungsweise
  Person als Autorenkontext.
- **Leitfragen / Stichwörter:** Welcher Parent und welcher Typ sind korrekt? Dürfen Mitglieder
  persönlich schreiben? Organisation anlegen, Autoren-Policy, Parent, Organisationstyp.
- **Evidenz:** `routes/admin/organizations/-organization-create-page.tsx`,
  `routes/admin/organizations/-organization-shared.tsx`.

## `admin.organizations.detail` – Organisation bearbeiten

- **Route / Typ / Owner:** `/admin/organizations/$organizationId`, Detail, Host.
- **Nutzerziel:** Stammdaten, Hierarchie, Mainserver-Anbindung und Mitgliedschaften pflegen.
- **Produktfakten:** Tabs trennen Organisation und Mitgliedschaften. Accounts können zugewiesen,
  entfernt und als Default-Kontext markiert werden. Mainserver Application-ID und Secret sowie
  Provisionierungsstatus sind vorhanden; gespeicherte Secrets werden nicht ausgegeben.
- **Gefährliche Aktionen:** Löschen entfernt Zugehörigkeiten und organisationsgebundene Credentials;
  Kindorganisationen blockieren das Löschen.
- **Leitfragen / Stichwörter:** Welche Folgen hat ein Parent-Wechsel? Wer benötigt Default-Kontext?
  Organisation bearbeiten, Mitgliedschaft, Default-Kontext, Mainserver-Provisionierung.
- **Evidenz:** `routes/admin/organizations/-organization-detail-page.tsx`,
  `routes/admin/organizations/-organization-shared.tsx`.
