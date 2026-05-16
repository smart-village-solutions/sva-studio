## Context

Historische Seeds schreiben heute nicht nur additive IAM-Basisdaten, sondern auch kritische Umgebungsidentität wie `parent_domain`, `primary_hostname`, `auth_realm` und `auth_client_id`. Das kollidiert mit lokalen Reconcile-Pfaden wie `local-keycloak`, die bewusst eine abweichende Host- und Realm-Topologie für die Entwicklung herstellen.

Die Folge ist Drift in die falsche Richtung: Ein vorhandener, funktionierender lokaler oder staging-naher Zustand kann durch einen Seed-Lauf still auf einen anderen Host- oder Realm-Vertrag zurückgedreht werden.

Ein konkreter lokaler Vorfall hat außerdem gezeigt, dass die Registry-Korrektur allein nicht ausreicht. Nach Wiederherstellung von `parent_domain`, `primary_hostname` und `auth_realm` war der Login-Start wieder korrekt, der Callback scheiterte jedoch weiter mit `unauthorized_client`, weil das tenant-spezifische `auth_client_secret` für den Realm-Client `sva-studio` in der lokalen DB fehlte. Die Runtime wich deshalb auf ein globales Secret aus. Daraus folgt: Zum geschützten Umgebungsvertrag gehören auch tenant-spezifische Secret-Zuordnungen und deren Konsistenz mit dem Ziel-Realm.

## Goals / Non-Goals

- Goals:
  - additive Seed-Daten klar von autoritativer Umgebungsidentität trennen
  - bestehende lokale und staging-nahe Umgebungen gegen stilles Überschreiben schützen
  - neue Umgebungen weiterhin reproduzierbar initialisieren können
  - explizite Reconcile-/Bootstrap-Pfade für gewollte Identitätsänderungen beibehalten
  - den vollständigen Tenant-Login-Flow inklusive Secret-Auflösung reproduzierbar und driftresistent halten
- Non-Goals:
  - keine vollständige Neugestaltung aller Seed-Dateien in einem Schritt
  - keine automatische Migration jeder bestehenden Umgebung auf neue Hostnamen
  - keine implizite Auflösung fachlicher Drift in produktiven oder staging-nahen Beständen

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

- Decision: Bestehende staging-nahe Umgebungen brauchen Guardrails.
  - Wenn ein Bootstrap-/Seed-Pfad auf bereits belegte geschützte Felder mit abweichenden Zielwerten trifft, muss der Pfad mindestens warnen und darf standardmäßig nicht still überschreiben.

- Decision: Secret-Fallbacks dürfen fehlende Tenant-Konfiguration nicht als stabilen Sollzustand maskieren.
  - Wenn eine Umgebung tenant-spezifische Auth-Clients nutzt, muss ein Bootstrap-/Reconcile-/Readiness-Pfad prüfen können, ob das tenant-spezifische Secret vorhanden und lesbar ist.
  - Ein globales Secret-Fallback darf bestehende Drift diagnostisch überbrücken, ersetzt aber nicht die Pflicht zur Wiederherstellung des tenant-spezifischen Secret-Zustands.

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
- Secret-Synchronisation erhöht die Zahl der umgebungsspezifischen Artefakte, die beim Bootstrap oder Reconcile bewusst gepflegt werden müssen.

## Migration Plan

1. Normativen Vertrag in Specs für Seed, Bootstrap und Reconcile festschreiben.
2. Historische Seeds so umstellen, dass geschützte Identitätsfelder bei bestehenden Instanzen nicht mehr autoritativ überschrieben werden.
3. Explizite Bootstrap-/Reconcile-Pfade für neue und bewusst zu korrigierende Umgebungen beibehalten oder schärfen.
4. Guardrails für lokale und staging-nahe Bestände ergänzen.
5. Tenant-spezifische Secret-Bereitstellung und Readiness-Prüfungen in Bootstrap-/Reconcile-Vertrag aufnehmen.
6. Betriebs- und Architektur-Dokumentation anpassen.

## Open Questions

- Ob Guardrails für bestehende Staging-Umgebungen standardmäßig als `warn` oder als harter `fail` ausgerollt werden sollen, bleibt eine Implementierungsentscheidung.
- Ob Secret-Drift standardmäßig bereits beim Bootstrap/Reconcile hart fehlschlagen oder zunächst nur als Readiness-Verletzung ausgewiesen werden soll, bleibt eine Implementierungsentscheidung.
