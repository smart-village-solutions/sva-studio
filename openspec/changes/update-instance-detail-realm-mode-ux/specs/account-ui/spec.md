## MODIFIED Requirements
### Requirement: Progressive Informationsarchitektur auf der Instanz-Detailseite

Das System MUST die Instanz-Detailseite unter `/admin/instances/:instanceId` so strukturieren, dass aktuelle Betriebsbewertung, Konfiguration, technische Diagnose und Historie nicht mehr als gleichrangiger Lang-Scrollbereich konkurrieren. Die Detailseite MUST den Realm-Modus als führende Betriebsdimension behandeln und abhängig von `realmMode` unterschiedliche operative Hauptansichten rendern.

#### Scenario: Standardansicht priorisiert den aktuellen Operator-Kontext

- **WENN** ein berechtigter Operator die Detailseite einer Instanz oeffnet
- **DANN** zeigt die Seite zuerst eine kompakte Uebersicht mit aktuellem Gesamtzustand, den wichtigsten offenen Befunden und der naechsten primaeren Aktion
- **UND** enthaelt diese Uebersicht nicht mehrere gleichrangige Wiederholungen desselben Zustands in verschiedenen Card-Gruppen
- **UND** muss der Operator nicht zuerst Preflight, Keycloak-Status, Run-Historie und Formulare gleichzeitig interpretieren

#### Scenario: Uebersicht funktioniert wie ein operatives Cockpit

- **WENN** ein berechtigter Operator die Detailseite einer Instanz oeffnet
- **DANN** zeigt die Uebersicht mindestens Identitaet der Instanz, Gesamtstatus, Frische der dominanten Evidenz und den aktuell wichtigsten Handlungsaufruf
- **UND** ordnet die Seite Befunde vor Steuerung und Steuerung vor Historie an
- **UND** folgt der Erstblick dem Prinzip `overview first, anomalies second, controls third, history last`

#### Scenario: Sekundaerbereiche folgen progressiver Offenlegung

- **WENN** ein Operator tiefer in Konfiguration, Diagnose oder Historie einsteigen moechte
- **DANN** sind diese Informationen in klar getrennten Arbeitsbereichen wie Tabs, Panels oder gleichwertigen Sektionen erreichbar
- **UND** bleibt der aktuelle Uebersichtsblock visuell von diesen Sekundaerbereichen unterscheidbar
- **UND** fuehrt die Seite kein zweites konkurrierendes Gesamtlayout fuer dieselbe Instanz ein

#### Scenario: Historische Fehl-Laeufe wirken nicht wie ein aktueller Gesamtblocker

- **WENN** eine Instanz aktuell betriebsbereit oder strukturell gruen ist, aber aeltere fehlgeschlagene Provisioning-Laeufe besitzt
- **DANN** trennt die Detailseite den aktuellen Zustand klar von der historischen Run-Historie
- **UND** darf ein aelterer Fehl-Lauf nicht denselben visuellen Rang wie ein aktueller blockierender Befund erhalten

#### Scenario: Detailseite rendert mode-aware Operationsansicht fuer neue Realms

- **WENN** `realmMode` einer Instanz auf `new` steht
- **DANN** zeigt die Detailseite im operativen Hauptbereich einen linearen Aufbaupfad fuer Realm-Erzeugung und Erstbootstrap
- **UND** priorisiert sie die naechste sinnvolle Aufbauaktion gegenueber Diagnose- oder Rohstatuslisten
- **UND** stellt sie erwartbar noch nicht erzeugte Artefakte nicht als aktuellen Defekt derselben Stufe wie echte Fehlzustaende dar

#### Scenario: Neuer Realm fuehrt ueber die tatsaechlichen technischen Teilphasen

- **WENN** `realmMode` einer Instanz auf `new` steht
- **DANN** bildet die Detailseite den Aufbaupfad mindestens entlang der Teilphasen `Registry-Vertrag`, `Vorbedingungen`, `Worker-Plan`, `Realm`, `Login-Client`, `Tenant-Admin-Client`, `instanceId-Mapper`, `Realm-Rollen`, `Tenant-Admin`, `Secret-Sync` und `Abschlussvalidierung` ab
- **UND** fasst sie diese Teilphasen nicht zu einer einzigen unscharfen Gesamtaktion ohne Zwischenschritte zusammen
- **UND** bleibt fuer einen Operator erkennbar, welche Teilphase bereits erfolgreich, welche laufend und welche als naechste vorgesehen ist

#### Scenario: Neuer Realm zeigt pro Schritt belastbare Zwischenausgaben

- **WENN** die Detailseite eine Teilphase des `new`-Pfads rendert
- **DANN** zeigt sie fuer diese Teilphase mindestens einen fachlichen Status, die letzte belastbare Evidenz und einen kurzen artefaktspezifischen Hinweis
- **UND** nennt sie bei Fehlern den betroffenen Artefakttyp explizit, statt nur einen generischen Gesamtfehler fuer `Provisioning` auszugeben
- **UND** bleibt dadurch unterscheidbar, ob der Fehler aus Vorbedingungen, Plan, Keycloak-Ausfuehrung oder Abschlussvalidierung stammt

#### Scenario: Detailseite rendert mode-aware Operationsansicht fuer Bestands-Realms

- **WENN** `realmMode` einer Instanz auf `existing` steht
- **DANN** zeigt die Detailseite im operativen Hauptbereich einen Diagnose- und Reconcile-Pfad fuer den vorhandenen Realm
- **UND** stellt sie fehlende oder abweichende Vertrags- und Keycloak-Artefakte als echte Befunde oder Drift dar
- **UND** bleibt klar erkennbar, welche Aktion den sichtbaren Befund adressiert

#### Scenario: Teilweise erfolgreicher Aufbaupfad bleibt nachvollziehbar

- **WENN** `realmMode` einer Instanz auf `new` steht
- **UND** einzelne fruehe Aufbau-Schritte bereits erfolgreich waren, aber ein spaeterer Schritt fehlgeschlagen ist
- **DANN** zeigt die Detailseite den letzten erfolgreichen Schritt, den ersten fehlgeschlagenen Schritt und die naechste sinnvolle Fortsetzungs- oder Reparaturaktion
- **UND** faellt sie dabei nicht in eine generische Driftdarstellung fuer Bestands-Realms zurueck

#### Scenario: Detailseite leitet fuer neue Realms genau eine naechste Hauptaktion ab

- **WENN** `realmMode` einer Instanz auf `new` steht
- **DANN** leitet die Detailseite aus dem ersten noch offenen oder fehlgeschlagenen relevanten Schritt genau eine primaere naechste Aktion ab
- **UND** aendert sich diese primaere Aktion nachvollziehbar, wenn Vorbedingungen blockieren, ein Retry sinnvoll ist oder der Abschluss bereits erfolgreich war
- **UND** muss der Operator nicht mehrere gleichrangige Buttons interpretieren, um den naechsten fachlich richtigen Schritt zu erraten

#### Scenario: Neuer Realm endet im Cockpit beim erfolgreichen Realm-Grundaufbau

- **WENN** `realmMode` einer Instanz auf `new` steht
- **UND** Realm, Clients, Mapper, Rollen, Tenant-Admin, Secret-Sync und Abschlussvalidierung erfolgreich sind
- **DANN** markiert die Detailseite den `new`-Kernworkflow als fachlich abgeschlossen
- **UND** behandelt sie eine optionale Instanzaktivierung oder nachgelagerte Modul-/IAM-Folgearbeiten nicht als noch fehlenden Pflichtschritt desselben Kernworkflows

#### Scenario: Folgearbeiten bleiben sichtbar, aber vom Realm-Grundaufbau getrennt

- **WENN** nach erfolgreichem Realm-Grundaufbau noch Modulzuordnung, Modul-IAM-Synchronisation oder andere Folgearbeiten sinnvoll sind
- **DANN** zeigt die Detailseite diese Arbeiten als nachgelagerte Empfehlungen oder getrennten Bereich
- **UND** vermischt sie diese Folgearbeiten nicht mit der linearen Aufbau-Schrittkette des neuen Realm

#### Scenario: Moduskonflikt bei neuem Realm wird explizit angezeigt

- **WENN** `realmMode` einer Instanz auf `new` steht
- **UND** der Ziel-Realm in Keycloak bereits existiert
- **DANN** zeigt die Detailseite einen expliziten Konflikt zwischen Sollmodus und Live-Zustand
- **UND** blockiert den linearen Erstaufbaupfad sichtbar, bis der Konflikt geklaert oder bereinigt wurde

#### Scenario: Moduskonflikt bei Bestands-Realm wird als harter Defekt angezeigt

- **WENN** `realmMode` einer Instanz auf `existing` steht
- **UND** der erwartete Realm live nicht existiert
- **DANN** zeigt die Detailseite diesen Zustand als harten Strukturdefekt
- **UND** stellt sie ihn nicht als geringfuegige Konfigurationsabweichung oder normalen Folge-Drift dar

#### Scenario: Veraltete Evidenz bleibt von aktuellem Zustand unterscheidbar

- **WENN** die Detailseite nur alte oder unvollstaendige Live-Evidenz fuer Provisioning, Keycloak-Status oder Tenant-IAM besitzt
- **DANN** markiert die Uebersicht diese Evidenz sichtbar als veraltet, unvollstaendig oder fachlich gleichwertig
- **UND** trennt den Hinweis klar von historischen Run-Eintraegen und aktuellen Erfolgs- oder Fehleraussagen

#### Scenario: Erstblick bleibt trotz Fehlerdiagnose kompakt

- **WENN** fuer einen Schritt technische Fehlerdetails, Request-IDs oder Rohmeldungen vorliegen
- **DANN** zeigt der Erstblick nur Schritt, Kurzursache und naechste Aktion
- **UND** bleiben technische Details ueber nachgelagerte Detailbereiche oder Expand-Zustaende erreichbar
- **UND** kippt die Hauptuebersicht dadurch nicht erneut in ein konkurrierendes Lang-Scroll-Diagnoselayout

#### Scenario: Nicht ausfuehrbare Aktionen bleiben sichtbar erklaert

- **WENN** eine im Workflow naechstliegende Operator-Aktion aus Berechtigungs- oder Technikgruenden aktuell nicht ausfuehrbar ist
- **DANN** bleibt der fachliche Schritt in der Detailseite sichtbar
- **UND** kennzeichnet die UI die Aktion als nicht ausfuehrbar inklusive Grundhinweis
- **UND** verschweigt sie nicht, dass dieser Schritt grundsaetzlich zum Workflow gehoert
