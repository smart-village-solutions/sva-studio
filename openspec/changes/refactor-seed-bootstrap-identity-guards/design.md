## Context

Historische Seeds schreiben heute nicht nur additive IAM-Basisdaten, sondern auch kritische Umgebungsidentität wie `parent_domain`, `primary_hostname`, `auth_realm` und `auth_client_id`. Das kollidiert mit lokalen Reconcile-Pfaden wie `local-keycloak`, die bewusst eine abweichende Host- und Realm-Topologie für die Entwicklung herstellen.

Die Folge ist Drift in die falsche Richtung: Ein vorhandener, funktionierender lokaler oder staging-naher Zustand kann durch einen Seed-Lauf still auf einen anderen Host- oder Realm-Vertrag zurückgedreht werden.

Ein konkreter lokaler Vorfall hat außerdem gezeigt, dass die Registry-Korrektur allein nicht ausreicht. Nach Wiederherstellung von `parent_domain`, `primary_hostname` und `auth_realm` war der Login-Start wieder korrekt, der Callback scheiterte jedoch weiter mit `unauthorized_client`, weil das tenant-spezifische `auth_client_secret` für den Realm-Client `sva-studio` in der lokalen DB fehlte. Die Runtime wich deshalb auf ein globales Secret aus. Nach Behebung dieses Drifts blieb der Schreibpfad weiter gestört: Das Anlegen neuer Rollen lieferte `503 keycloak_unavailable`, weil für den Tenant-Admin-Client `sva-studio-admin` zwar eine `tenant_admin_client_id`, aber kein `tenant_admin_client_secret` in der lokalen DB vorhanden war. Daraus folgt: Zum geschützten Umgebungsvertrag gehören auch tenant-spezifische Secret-Zuordnungen und deren Konsistenz mit dem Ziel-Realm, getrennt für Login- und Admin-Pfade.

## Goals / Non-Goals

- Goals:
  - additive Seed-Daten klar von autoritativer Umgebungsidentität trennen
  - bestehende lokale und staging-nahe Umgebungen gegen stilles Überschreiben schützen
  - neue Umgebungen weiterhin reproduzierbar initialisieren können
  - explizite Reconcile-/Bootstrap-Pfade für gewollte Identitätsänderungen beibehalten
  - den vollständigen Tenant-Login-Flow inklusive Secret-Auflösung reproduzierbar und driftresistent halten
  - bestehende Umgebungen auch bei fehlenden kanonischen Nebenbeständen in einen vollständigen Laufzeitzustand überführen
- Non-Goals:
  - keine vollständige Neugestaltung aller Seed-Dateien in einem Schritt
  - keine automatische Migration jeder bestehenden Umgebung auf neue Hostnamen
  - keine implizite Auflösung fachlicher Drift in produktiven oder staging-nahen Beständen
  - keine starre Festschreibung eines einzelnen lokalen Referenzzustands als globale Wahrheit für alle Umgebungen
  - kein Reconcile, der legitime umgebungsspezifische Unterschiede ohne explizite Freigabe einebnet

## Decisions

- Decision: Standard-Seeds sind normativ non-destructive für geschützte Identitätsfelder.
  - Geschützte Felder umfassen mindestens `parent_domain`, `primary_hostname`, `auth_realm`, `auth_client_id`, `tenant_admin_client_id` und tenant-spezifische Secret-Zuordnungen wie `auth_client_secret_ciphertext`.
  - Für bestehende Instanzen dürfen diese Felder im Standard-Seed nur gefüllt werden, wenn sie leer oder nicht gesetzt sind.

- Decision: Autoritative Identitätsänderungen laufen nur über explizite Bootstrap-/Reconcile-Pfade.
  - Neue Umgebungen dürfen diese Felder beim initialen Bootstrap setzen.
  - Bestehende Umgebungen dürfen diese Felder nur über einen expliziten Reconcile- oder Bootstrap-Modus ändern.

- Decision: Bootstrap und Reconcile unterscheiden normativ zwischen "neue Umgebung" und "bestehende Umgebung".
  - Neue Umgebung: autoritatives Setzen ist erlaubt.
  - Bestehende Umgebung: Abweichungen werden sichtbar gemacht und standardmäßig nicht still überschrieben.
  - Bestehende Umgebung: fehlende kanonische Nebenbestände dürfen ergänzt oder in den aktuellen Sollzustand reconciled werden, solange bestehende Umgebungsidentität dabei nicht still geändert wird.

- Decision: Autoritative Quellen werden pro Datenart statt global pro Umgebung festgelegt.
  - Registry-Identität, Login-Secrets, Tenant-Admin-Secrets, Profilprojektion und External-Interface-Backbones haben jeweils eigene autoritative Pfade.
  - Ein lokaler Reconcile darf nur für die Datenarten autoritativ sein, die ihm explizit zugewiesen sind.
  - Dadurch schützen wir die lokale Entwicklungsumgebung, ohne andere gültige Umgebungszustände pauschal zu überschreiben.

- Decision: Bestehende staging-nahe Umgebungen brauchen Guardrails.
  - Wenn ein Bootstrap-/Seed-Pfad auf bereits belegte geschützte Felder mit abweichenden Zielwerten trifft, muss der Pfad mindestens warnen und darf standardmäßig nicht still überschreiben.

- Decision: Secret-Fallbacks und partielle Secret-Konfiguration dürfen fehlende Tenant-Konfiguration nicht als stabilen Sollzustand maskieren.
  - Wenn eine Umgebung tenant-spezifische Auth-Clients nutzt, muss ein Bootstrap-/Reconcile-/Readiness-Pfad prüfen können, ob das tenant-spezifische Login-Secret und das tenant-spezifische Tenant-Admin-Secret vorhanden und lesbar sind.
  - Ein globales Secret-Fallback darf bestehende Drift diagnostisch überbrücken, ersetzt aber nicht die Pflicht zur Wiederherstellung des tenant-spezifischen Login-Secret-Zustands.
  - Eine vorhandene `tenant_admin_client_id` ohne passendes `tenant_admin_client_secret` gilt als unvollständige Admin-Konfiguration und darf nicht erst bei schreibenden Operationen auffallen.

- Decision: Reconcile für bestehende Umgebungen muss kanonische Laufzeit-Backbones nachziehen.
  - Wenn die Runtime für einen Funktionspfad einen neuen kanonischen Speicherort nutzt, zum Beispiel `iam.instance_external_interfaces` statt eines Legacy-Stores, muss der Reconcile-Pfad bestehende lokale und staging-nahe Umgebungen auf diesen kanonischen Backbone ergänzen können.
  - Das bloße Nicht-Überschreiben historischer Werte ist unzureichend, wenn dadurch die aktuelle Runtime weiterhin in `config_not_found`, leere Projektionen oder andere Folgefehler läuft.
  - Dieses Nachziehen ist additiv auszulegen: fehlende Pflichtbestände werden ergänzt, bestehende gültige Datensätze werden nicht pauschal durch lokale Defaults ersetzt.

- Decision: Readiness muss mehrstufige Laufzeitgesundheit statt nur Basisauth prüfen.
  - Eine Umgebung gilt nicht schon dann als gesund, wenn Tenant-Auflösung und Login funktionieren.
  - Zur Readiness gehören mindestens Login-Flow, Admin-Schreibpfad, Profilprojektion und die Prüfung kanonischer externer Schnittstellenkonfiguration.

- Decision: Guardrails sollen Drift früh sichtbar machen, aber nicht in jedem Fall sofort destruktiv korrigieren.
  - Für bestehende Umgebungen ist `ergänzen oder warnen` der Standard.
  - `überschreiben oder fail-hard` bleibt ein expliziter Modus für bewusste Bootstrap- oder Reparaturpfade.
  - So bleibt der Vertrag robust gegen künftige Änderungen an lokalen Umgebungen, ohne andere Bestände unnötig zu beschädigen.

## Alternatives Considered

- Seed mit Policy-Layer und mehreren Modi
  - Vorteil: ein zentrales Seed-System
  - Nachteil: hohe Komplexität und erhöhte Fehlbedienungsgefahr

- Vollständig autoritative Seeds mit nachgelagertem Reconcile
  - Vorteil: einfache Seed-Logik
  - Nachteil: bestehende Umgebungen bleiben fragil und können weiter unbemerkt kippen

- Gewählte Richtung: semantische Trennung zwischen Baseline-Seed und autoritativer Umgebungsidentität
  - Vorteil: klarere Betriebsgrenzen, niedrigere Driftgefahr, bessere Debuggability

## Risks / Trade-offs

- Bestehende Workflows, die bisher still auf autoritative Seeds vertraut haben, müssen auf explizite Bootstrap-/Reconcile-Pfade umgestellt werden.
- Einzelne historische Seeds könnten implizit mehr Verantwortung tragen als bisher dokumentiert; das muss bei der Umsetzung schrittweise herausgelöst werden.
- Guardrails können zunächst zusätzliche Warnungen oder Failures sichtbar machen, wo heute Drift unbemerkt bleibt.
- Secret-Synchronisation erhöht die Zahl der umgebungsspezifischen Artefakte, die beim Bootstrap oder Reconcile bewusst gepflegt werden müssen; insbesondere Login- und Tenant-Admin-Secret können unabhängig voneinander driften.
- Das Ergänzen kanonischer Nebenbestände in bestehenden Umgebungen erhöht die Reconcile-Komplexität, ist aber notwendig, damit lokale und staging-nahe Laufzeitpfade nicht an halb migrierten Altbeständen scheitern.
- Eine zu lokal spezifizierte Reconcile-Logik könnte andere Entwicklungs- oder Staging-Bestände unbeabsichtigt vereinheitlichen; deshalb muss der Change strikt zwischen `Pflichtbestand ergänzen` und `Bestandswert überschreiben` unterscheiden.

## Migration Plan

1. Normativen Vertrag in Specs für Seed, Bootstrap und Reconcile festschreiben.
2. Historische Seeds so umstellen, dass geschützte Identitätsfelder bei bestehenden Instanzen nicht mehr autoritativ überschrieben werden.
3. Explizite Bootstrap-/Reconcile-Pfade für neue und bewusst zu korrigierende Umgebungen beibehalten oder schärfen.
4. Guardrails für lokale und staging-nahe Bestände ergänzen.
5. Tenant-spezifische Secret-Bereitstellung und Readiness-Prüfungen in Bootstrap-/Reconcile-Vertrag aufnehmen, getrennt für Login- und Tenant-Admin-Clients.
6. Autoritative Quellen und erlaubte Reconcile-Aktionen pro Datenart dokumentieren.
7. Kanonische Nebenbestände wie External-Interface-Registry für bestehende Umgebungen über additive Reconcile-Pfade ergänzen.
8. Schreibpfade wie Rollenanlage sowie Profil- und Integrationspfade in die Readiness- oder Smoke-Prüfung aufnehmen, damit unvollständige Laufzeitbestände sichtbar werden.
9. Betriebs- und Architektur-Dokumentation anpassen.

## Open Questions

- Ob Guardrails für bestehende Staging-Umgebungen standardmäßig als `warn` oder als harter `fail` ausgerollt werden sollen, bleibt eine Implementierungsentscheidung.
- Ob Secret-Drift standardmäßig bereits beim Bootstrap/Reconcile hart fehlschlagen oder zunächst nur als Readiness-Verletzung ausgewiesen werden soll, bleibt eine Implementierungsentscheidung.
