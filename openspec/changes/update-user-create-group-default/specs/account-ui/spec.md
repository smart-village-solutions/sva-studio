## MODIFIED Requirements
### Requirement: User-Administrationsliste

Das System MUST eine User-Administrationsliste unter `/admin/users` bereitstellen, mit der Administratoren alle Benutzer-Accounts verwalten können.

#### Scenario: Neuen Nutzer anlegen

- **WENN** ein Administrator auf „Nutzer anlegen" klickt
- **DANN** öffnet sich ein Formular-Dialog oder Arbeitsbereich (`role="dialog"` oder gleichwertig zugänglicher Formularfluss)
- **UND** Pflichtfelder sind markiert mit `aria-required="true"`: Name und E-Mail
- **UND** die UI bietet eine primäre Auswahl für initiale Gruppenmitgliedschaften an
- **UND** die direkte Rollenwahl bleibt als optionale erweiterte Einstellung verfügbar
- **UND** nach dem Speichern wird der Nutzer in der IAM-DB und in Keycloak erstellt
- **UND** ausgewählte Gruppen werden dem Nutzer initial zugewiesen
- **UND** optional ausgewählte direkte Rollen werden zusätzlich zugewiesen
- **UND** der Nutzer erhält auf Wunsch eine Einladungs-E-Mail über Keycloak
- **UND** bei Escape oder Klick außerhalb wird der Dialog nur geschlossen, sofern der verwendete UI-Pattern dies zulässt und keine ungespeicherten Pflichtdaten verloren gehen
