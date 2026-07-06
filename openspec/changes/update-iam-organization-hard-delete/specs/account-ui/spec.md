## MODIFIED Requirements
### Requirement: Organisations-Verwaltungsseite

Das System MUST eine Organisations-Verwaltungsseite unter `/admin/organizations` bereitstellen, auf der berechtigte Administratoren Organisationen instanzgebunden pflegen und zulässige Blatt-Organisationen endgültig löschen können.

#### Scenario: Blatt-Organisation löschen

- **WENN** ein Administrator auf der Organisationsliste oder im Detail eine Organisation ohne Children löscht
- **DANN** ruft die UI den Delete-Endpunkt auf und entfernt die Organisation nach Erfolg aus dem sichtbaren Zustand
- **UND** erklärt der Bestätigungsdialog, dass Memberships und organisationsgebundene Credentials mit entfernt werden
