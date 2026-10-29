## MODIFIED Requirements

### Requirement: Zentraler scope-gebundener Effective-Access-State

Das System MUST für die angemeldete Session genau einen gemeinsam konsumierten aktuellen Effective-Access-State pro Auth-Generation und diskriminiertem Plattform- oder Tenant-Scope bereitstellen. Ein Tenant-State MUST an die aktive `instanceId`, die aktive `organizationId` beziehungsweise einen ausdrücklich organisationslosen Kontext und die aktuelle Modulzuweisungs-Generation gebunden sein und SHALL strukturierte effektive Permissions statt einer unscoped Action-Liste als Entscheidungsbasis verwenden. Ein Plattform-State MUST auf dokumentierte technische Root-/Control-Plane-Flächen begrenzt bleiben. Session-Recovery und Wiederaufnahme MUST den zugehörigen Organisations- und Access-State dedupliziert revalidieren; gleiche Rollen- oder Modulnamen begründen keine Aktualität.

#### Scenario: Mehrere UI-Verbraucher verwenden denselben Scope-Snapshot

- **WENN** Sidebar, Route-Bindings, Host-Seite und Plugin-Fläche im selben Instanz- und Organisationskontext gerendert werden
- **DANN** beziehen sie ihre Access-Entscheidungen aus derselben Snapshot-Generation
- **UND** führt keiner dieser Verbraucher einen unabhängigen Permission-Read mit eigenem aktivem Organisationszustand aus

#### Scenario: Plattform- und Tenant-State sind getrennt

- **WENN** dieselbe Session technische Plattformflächen und tenantgebundene Flächen erreichen kann
- **DANN** besitzen beide Flächen diskriminierte Scope-Schlüssel und getrennte Entscheidungsquellen
- **UND** erweitert eine technische Plattformrolle keine tenantgebundene Action
- **UND** erweitert eine tenantgebundene Permission keine Root- oder Control-Plane-Aktion

#### Scenario: Organisation wird gewechselt

- **WENN** ein Benutzer den aktiven Organisationskontext wechselt
- **DANN** verwirft der Host alle Entscheidungen des vorherigen Scope-Schlüssels vor einer Freigabe im neuen Kontext
- **UND** darf eine verspätete Antwort des alten Scopes den neuen Effective-Access-State nicht überschreiben
- **UND** werden Navigation, Route-Guards und Aktionsflächen atomar aus derselben neuen Snapshot-Generation aktualisiert

#### Scenario: Permission-Read ist nicht belastbar

- **WENN** der Effective-Access-State `unresolved`, `loading` oder `error` ist
- **DANN** wird keine geschützte UI-Aktion als erlaubt behandelt
- **UND** übernimmt die UI keine Permissions aus einem früheren Scope oder einer früheren Generation
- **UND** zeigt eine weiterhin lesbare Fläche einen lokalisierten und zugänglichen Lade-, Fehler- oder Retry-Zustand

#### Scenario: Stabiles Stale-Signal invalidiert den Snapshot

- **WENN** eine Serverantwort ein stabiles Stale-, Scope- oder Snapshot-Versionssignal enthält
- **DANN** zeigt die UI einen verständlichen autorisierungsbezogenen Fehlerzustand
- **UND** invalidiert sie den betroffenen State höchstens einmal für die aktuelle Generation über den zentralen Invalidation-Pfad
- **UND** aktualisiert sie sichtbare Aktionen erst nach einer neuen scope-korrekten Entscheidung

#### Scenario: Modul wird entzogen

- **WENN** ein Modul im aktiven Tenant-Scope entzogen wird
- **DANN** invalidiert der Host die betroffene Effective-Access-Generation
- **UND** verweigern Navigation, Routen und Aktionen das Modul fail-closed, bevor ein neuer Tenant-Snapshot Freigaben liefern darf

#### Scenario: Wiederaufnahme oder Session-Recovery bei unveränderten Rollennamen

- **WHEN** der Browser wieder sichtbar wird oder eine Session-Recovery erfolgreich ist
- **THEN** werden aktueller Organisationskontext und anschließend effektive Rechte einmal je zusammengeführtem Anlass geprüft
- **AND** verhindert ein unveränderter Rollen-/Modulname diesen Recheck nicht
- **AND** bleiben Mutationen bis zu einer aktuellen Entscheidung gesperrt, während lesbare Inhalte und Entwürfe erhalten bleiben

#### Scenario: Ressourcenverbot besitzt kein Stale-Signal

- **WHEN** eine Ressourcen-/Ownership-Aktion mit 403 ohne explizites Stale-/Scope-/Versionssignal abgelehnt wird
- **THEN** behandelt die UI die Ablehnung lokal
- **AND** startet sie weder einen globalen Permission-Refetch noch eine Session-Anmeldung allein aufgrund des HTTP-Status

## ADDED Requirements

### Requirement: Technische Bereitschaft und fehlendes Recht werden in Aktionsflächen getrennt behandelt

Das Studio MUST ausführbare Mutationen ohne passende aktuelle Permission, Modulzuweisung oder erforderliche Ressourcenfreigabe ausblenden. Wenn Rechte vorhanden sind, aber eine technische Voraussetzung des ausgewählten Principals fehlt, SHALL die vorhandene Fläche den Entwurf erhalten, die Mutation sperren und einen lokalisierten zugänglichen Grund mit sicherer Fehlerreferenz beziehungsweise Folgeaktion anzeigen. Eine technische Capability oder Readiness MUST keinen IAM-Grant ersetzen.

#### Scenario: Berechtigte Erstellung ohne bereiten Organisationszugang

- **WHEN** ein Benutzer Create-Recht besitzt, aber der ausgewählte Organisationsprincipal lokal nicht bereit ist
- **THEN** ist Speichern begründet gesperrt statt erst nach dem Submit als Berechtigungsfehler abzubrechen
- **AND** bleiben Eingaben und vorhandener Verlassensschutz erhalten
- **AND** kann nach expliziter Behebung oder Neuladen die bestehende Readiness erneut geprüft werden

#### Scenario: Systemadministrator ohne fachliche Freigabe

- **WHEN** die aktuelle Entscheidung eine Action nicht erlaubt, auch wenn die Identität `system_admin` trägt
- **THEN** erzeugt der Rollenname keinen UI- oder Server-Bypass
- **AND** bleibt die ausführbare Aktion einschließlich Tastatur-Submit gesperrt
