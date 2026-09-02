# Keycloak-Rollenzuweisungen in der Benutzerverwaltung

Die Benutzerverwaltung zeigt zwei getrennte Rollenbereiche:

- **Studio-Rollen** bündeln lokale Studio-Permissions und werden mit dem
  Benutzerformular gespeichert.
- **Keycloak-Rollen** gelten für angebundene Anwendungen. Sie werden direkt in
  Keycloak zugewiesen und verleihen allein keine Studio-Berechtigung.

Über das Schlüssel-Symbol in der Benutzerliste können Keycloak-Rollen auch für
App-Benutzer ohne lokales Studio-Konto geöffnet werden. Direkte Zuweisungen
lassen sich mit `iam.role.write` setzen oder entfernen. Geerbte Rollen werden
als „Geerbt“ angezeigt und können nur über die verursachende Composite Role
verändert werden.

Technische und geschützte Rollen sind read-only. `system_admin` wird weiterhin
über die lokale Studio-Rollenzuweisung verwaltet, damit Letztadmin- und
Hierarchieschutz erhalten bleiben. Rollendefinitionen werden im Studio nicht
angelegt, geändert oder gelöscht.
