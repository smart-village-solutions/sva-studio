## MODIFIED Requirements

### Requirement: Account-Profilseite

Das System MUST eine Account-Profilseite unter `/account` bereitstellen, auf der authentifizierte Nutzer ihre eigenen Basis-Daten einsehen und bearbeiten können und deren Status-, Rollen- und Profildarstellung mit dem fachlichen IAM-Kontext konsistent bleibt.

#### Scenario: Profil zeigt fachlich konsistente Rollen- und Statusdaten

- **WENN** ein authentifizierter Nutzer `/account` aufruft
- **DANN** stammen Status, Rollenanzeige, Anzeigename und weitere Profilfelder aus derselben fachlichen Projektion wie die zugehörigen Admin-Ansichten
- **UND** leere Rollenanzeigen, UUID-Ersatznamen oder `Ausstehend`-Zustände erscheinen nur bei tatsächlich entsprechendem Fachzustand
- **UND** technische Auth-Erreichbarkeit allein genügt nicht, um widersprüchliche Profilzustände stillschweigend zu akzeptieren

### Requirement: User-Administrationsliste

Das System MUST eine User-Administrationsliste unter `/admin/users` bereitstellen, mit der Administratoren alle Benutzer-Accounts verwalten und den Keycloak-Abgleich stabil ausführen können.

#### Scenario: Keycloak-Benutzer synchronisieren ohne Hänger

- **WENN** ein Administrator in `/admin/users` die Aktion „Aus Keycloak synchronisieren" ausführt
- **DANN** beendet die UI den Vorgang mit einem belastbaren Abschlusszustand
- **UND** zeigt Erfolg, Teilfehler oder Blockierung nachvollziehbar an
- **UND** die Seite bleibt interaktiv und kippt nicht in einen hängenden Zustand ohne Abschluss
- **UND** die anschließend geladene Benutzerliste spiegelt den fachlichen Endzustand des Syncs wider

#### Scenario: Benutzerliste bleibt mit Profil- und Rollenprojektion konsistent

- **WENN** die Benutzerliste nach Login, Sync oder Reconcile neu geladen wird
- **DANN** stimmen Name, E-Mail, Rolle und Status mit der Self-Service-Sicht und dem serverseitigen IAM-Kontext überein
- **UND** inkonsistente Ersatzbilder wie UUID statt Anzeigename oder fehlende Rollen trotz erfolgreicher fachlicher Zuordnung bleiben aus

### Requirement: Rollenverwaltung bildet echten Reconcile-Zustand ab

Das System MUST in `/admin/roles` den fachlichen Zustand des Keycloak-Rollenabgleichs belastbar darstellen und daraus folgende Aktionen konsistent ermöglichen.

#### Scenario: Rollen-Reconcile zeigt wirksamen Endzustand

- **WENN** ein Administrator die Aktion „Bereits in Keycloak angelegte Rollen importieren" ausführt
- **DANN** zeigt die UI einen belastbaren Abschlusszustand mit geprüften, korrigierten, fehlgeschlagenen und manuell zu prüfenden Einträgen
- **UND** die Rollenliste wird anschließend so neu geladen, dass importierte oder reparierte Rollen sichtbar werden
- **UND** ein scheinbar erfolgreicher Reconcile mit weiterhin leerer oder widersprüchlicher Rollenliste gilt als Fehlerfall

#### Scenario: Fachliche und technische Fehlerpfade bleiben unterscheidbar

- **WENN** Rollenabgleich oder Einzel-Reconcile fehlschlagen
- **DANN** unterscheidet die UI mindestens zwischen Nichtverfügbarkeit, Berechtigungsfehler und fachlichem Prüfrest
- **UND** `IDP_FORBIDDEN` und `IDP_UNAVAILABLE` bleiben für Administratoren sichtbar
- **UND** allgemeine grüne Health-Signale überdecken den fachlich fehlgeschlagenen Rollenabgleich nicht
