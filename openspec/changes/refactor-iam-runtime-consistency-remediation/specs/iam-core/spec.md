## MODIFIED Requirements

### Requirement: Token Validation & User Identity
Das System MUST von Keycloak ausgestellte JWT-Tokens validieren, nur die fuer Session- und Autorisierungspfad erforderlichen Identity-Claims extrahieren und die daraus abgeleitete fachliche User-Identität mit Membership-, Profil- und Rollenprojektion konsistent auflösen.

#### Scenario: Technische Identität und fachliche Projektion bleiben konsistent

- **WHEN** ein Token gueltig ist
- **THEN** extrahiert das System mindestens die Claims `sub`, `instanceId` und Rollen-/Berechtigungsinformationen
- **AND** die nachgelagerte fachliche Auflösung für User, Membership, Profil und Rollen verwendet denselben kanonischen Identitätsbezug
- **AND** `/auth/me`, Self-Service-Profile und Admin-Listen widersprechen sich nicht in Status, Rollen oder Anzeigename

### Requirement: Keycloak Admin API Integration

Das System MUST über einen dedizierten Service-Account mit der Keycloak Admin REST API kommunizieren, um Benutzer-Accounts und Rollen-Zuweisungen synchron zu halten, technische und fachliche Reconcile-Ergebnisse klar zu unterscheiden und blockierende Drift-Voraussetzungen fail-closed zu behandeln.

#### Scenario: Rollen-Reconcile liefert deterministisches Ergebnis

- **WHEN** ein Administrator einen Rollen-Reconcile für den aktiven `instanceId`-Kontext auslöst
- **THEN** liefert das System ein deterministisches Ergebnis mit mindestens `checked`, `corrected`, `failed` und `manualReview`
- **AND** technische Fehler wie IDP-Nichtverfügbarkeit werden von Berechtigungsfehlern und fachlichen Prüfrestfällen getrennt behandelt
- **AND** ein formal erfolgreicher Reconcile hinterlässt keine leere oder widersprüchliche Rollenprojektion ohne erklärten Restzustand

#### Scenario: User-Sync bleibt nicht hängen

- **WHEN** ein Administrator einen User-Sync gegen Keycloak auslöst
- **THEN** beendet das System den Lauf deterministisch mit Erfolg, Teilfehler oder klarer Blockierung
- **AND** der Pfad bleibt für Browser und UI responsiv
- **AND** gestartete, aber hängende Sync-Läufe ohne Ergebnis werden nicht toleriert

#### Scenario: Drift blockiert Tenant-Admin-abhängige Sync-Pfade

- **WHEN** für die aktive Instanz blockerrelevanter Drift bei Tenant-Admin-Client, Secret-Ausrichtung oder vergleichbaren Reconcile-Voraussetzungen besteht
- **THEN** startet das System keinen scheinbar erfolgreichen Reconcile-Lauf
- **AND** meldet den Drift als vorrangigen Blocker
- **AND** vermeidet Folgeinkonsistenzen in User- oder Rollenprojektion
