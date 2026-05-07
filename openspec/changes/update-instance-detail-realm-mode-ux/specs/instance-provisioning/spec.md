## ADDED Requirements
### Requirement: Realm-Modus steuert die UI-Semantik der Instanz-Detailbewertung

Das System SHALL fuer die Instanz-Detailansicht denselben strukturellen Datenstand je nach `realmMode` unterschiedlich bewerten, damit der Aufbau eines neuen Realms nicht mit Drift eines Bestands-Realms verwechselt wird.

#### Scenario: Neuer Realm behandelt nicht erzeugte Artefakte als erwartbaren Folgezustand

- **WHEN** eine Instanz `realmMode = new` besitzt
- **AND** Realm, Clients oder Secrets vor dem ersten Provisioning noch nicht in Keycloak existieren
- **THEN** darf die Detailansicht diese Artefakte als `geplant`, `noch nicht ausgefuehrt` oder fachlich gleichwertig markieren
- **AND** stellt sie diese Zustaende nicht automatisch als aktuellen Strukturdefekt desselben Rangs wie echte Fehlzustaende dar

#### Scenario: Bestands-Realm behandelt fehlende Artefakte als Drift oder Defekt

- **WHEN** eine Instanz `realmMode = existing` besitzt
- **AND** erwartete Realm-, Client- oder Secret-Artefakte fehlen oder weichen vom Vertrag ab
- **THEN** zeigt die Detailansicht diese Zustaende als Drift, Blocker oder fachlich gleichwertigen Defekt
- **AND** ordnet sie dazu passende Reparaturaktionen dem sichtbaren Befund zu

#### Scenario: Aktuelle Schrittphase bleibt im neuen Realm nachvollziehbar

- **WHEN** eine Instanz `realmMode = new` besitzt
- **AND** Provisioning-, Secret-Sync- oder Tenant-Admin-Schritte bereits teilweise ausgefuehrt wurden
- **THEN** kann die Detailansicht den aktuellen Fortschritt entlang einer linearen Aufbauphase darstellen
- **AND** bleibt erkennbar, welcher Schritt erfolgreich war, welcher laeuft und welcher noch offen ist

#### Scenario: Neuer Realm orientiert sich an der tatsaechlichen Worker-Schrittkette

- **WHEN** eine Instanz `realmMode = new` besitzt
- **THEN** orientiert die Detailansicht die Aufbauphase mindestens an `Registry-Vertrag`, `Preflight`, `Plan`, `Realm`, `Login-Client`, `Tenant-Admin-Client`, `Realm-Rollen`, `Tenant-Admin`, `Secret-Sync` und `Abschlussvalidierung`
- **AND** behandelt sie diese Schritte als getrennt beobachtbare Artefaktphasen
- **AND** vermeidet sie eine gleichwertige Vermischung von Registry-Vorbereitung, Keycloak-Ausfuehrung und nachgelagerter Validierung

#### Scenario: Secret-Sync ist ein eigener Folgeschritt nach erfolgreicher Keycloak-Ausfuehrung

- **WHEN** eine Instanz `realmMode = new` besitzt
- **AND** Realm und Clients in Keycloak bereits erfolgreich angelegt oder abgeglichen wurden
- **THEN** behandelt die Detailansicht das Zurueckschreiben erzeugter Tenant-Secrets in die Registry als eigene Folgeschrittphase
- **AND** bleibt erkennbar, dass ein technischer Erfolg in Keycloak noch nicht automatisch einen vollstaendig abgeschlossenen Registry-Zielzustand bedeutet

#### Scenario: Abschlussvalidierung ist vom Ausfuehrungsschritt getrennt

- **WHEN** ein Provisioning-Lauf fuer einen neuen Realm abgeschlossen wurde
- **THEN** prueft die Detailansicht den resultierenden Zustand getrennt von der eigentlichen Ausfuehrung gegen Realm, Clients, Secrets, Rollen und Tenant-Admin
- **AND** kann dadurch einen Fehler in der Abschlussvalidierung anzeigen, obwohl fruehere Ausfuehrungsschritte erfolgreich waren

#### Scenario: Neuer Realm mit bereits existierendem Live-Realm erzeugt einen Moduskonflikt

- **WHEN** eine Instanz `realmMode = new` besitzt
- **AND** der Ziel-Realm live bereits existiert
- **THEN** bewertet die Detailansicht diesen Zustand als Konflikt zwischen erwartetem Aufbaupfad und vorgefundenem Live-Zustand
- **AND** leitet daraus keine normale Erfolgsprojektion des `new`-Pfads ohne ausdruecklichen Konflikthinweis ab

#### Scenario: Bestands-Realm ohne Live-Realm bleibt ein harter Defekt

- **WHEN** eine Instanz `realmMode = existing` besitzt
- **AND** der erwartete Realm live nicht existiert
- **THEN** bewertet die Detailansicht diesen Zustand als harten Strukturdefekt
- **AND** behandelt ihn nicht wie einen geringfuegigen Driftfall

#### Scenario: Schrittfehler bleiben dem betroffenen Aufbau- oder Reconcile-Schritt zugeordnet

- **WHEN** Secret-Sync, Tenant-Admin-Bootstrap oder Reconcile fuer eine Instanz fehlschlagen
- **THEN** ordnet die Detailansicht den Fehler dem betroffenen Workflow-Schritt zu
- **AND** bleibt sichtbar, welche vorangehenden Schritte erfolgreich waren und welcher Folgeschritt dadurch blockiert ist

#### Scenario: Naechste Aktion folgt dem ersten relevanten offenen oder fehlgeschlagenen Schritt

- **WHEN** fuer einen neuen Realm mehrere Teilphasen in unterschiedlichem Zustand vorliegen
- **THEN** leitet die Detailansicht die primaere naechste Aktion aus dem ersten fachlich relevanten offenen, blockierten oder fehlgeschlagenen Schritt ab
- **AND** priorisiert sie dabei Vorbedingungen vor Worker-Start, Worker-Start vor Secret-Sync und Secret-Sync vor Abschlussvalidierung

#### Scenario: Naechste Aktion folgt einer festen Prioritaetsregel fuer neue Realms

- **WHEN** fuer eine Instanz `realmMode = new` mehrere moegliche Folgeaktionen gleichzeitig in Frage kommen
- **THEN** priorisiert die Detailansicht Konfigurationskorrektur vor Moduskonflikt, Moduskonflikt vor Preflight-Blocker, Preflight-Blocker vor Worker-Start oder Retry, Worker-Start oder Retry vor Secret-Sync, Secret-Sync vor Abschlussvalidierung und Abschlussvalidierung vor optionalen Folgearbeiten
- **AND** bleibt diese Prioritaetsregel fuer Tests und Projektion als isolierte Logik abbildbar

#### Scenario: Neuer Realm erreicht einen expliziten Abschluss vor optionalen Folgearbeiten

- **WHEN** Realm, Clients, Rollen, Tenant-Admin, Secret-Sync und Abschlussvalidierung fuer eine Instanz `realmMode = new` erfolgreich sind
- **THEN** betrachtet die Detailansicht den Realm-Grundaufbau als erfolgreich abgeschlossen
- **AND** behandelt sie optionale Aktivierung, Modulzuordnung oder modulbezogene IAM-Synchronisation nicht als blockierenden Restschritt desselben Kernflows

#### Scenario: Tenant-IAM- und Modul-IAM-Folgearbeiten bleiben ausserhalb des Kernflows

- **WHEN** nach erfolgreichem Realm-Grundaufbau weitere tenant- oder modulbezogene IAM-Arbeiten anstehen
- **THEN** stellt die Detailansicht diese Arbeiten als getrennte Folgearbeiten oder Empfehlungen dar
- **AND** mischt sie diese Folgearbeiten nicht in die Pflichtschritte der Realm-Erzeugung ein

#### Scenario: Veraltete Live-Evidenz wird nicht mit aktuellem Zustand verwechselt

- **WHEN** fuer eine Instanz nur veraltete, unvollstaendige oder widerspruechliche Live-Evidenz vorliegt
- **THEN** markiert die Detailansicht diese Evidenz als diagnostisch eingeschraenkt
- **AND** vermeidet eine gleichrangige Darstellung als sicherer aktueller Erfolgs- oder Fehlerzustand
