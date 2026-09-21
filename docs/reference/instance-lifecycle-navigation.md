# Instanz-Lebenszyklus und Navigation

Diese Anleitung beschreibt den neuen Arbeitsablauf in der Instanzverwaltung
unter `/admin/instances`.

## Zielbild

Die Verwaltung bündelt den Lebenszyklus einer Instanz in einem Detailfluss und trennt dort klar zwischen:

1. `Anlage` einer neuen Instanz
2. `Bereitstellung abschließen` als geführtem Abschnitt der Detailseite
3. `Betrieb` als Standardansicht für Bestandsinstanzen
4. `Doctor` als Diagnose- und Reparaturmodus
5. `Einstellungen` für Stammdaten und Vertragswerte

## Typischer Ablauf

1. Neue Instanz über `/admin/instances/new` anlegen.
2. Nach erfolgreicher Anlage direkt in `/admin/instances/<instanceId>` wechseln.
3. Auf der Detailseite die technische Bereitschaft herstellen und prüfen.
4. Die Instanz erst nach erfüllten Readiness-Gates manuell aktivieren.
5. Aktive Bestandsinstanzen auf derselben Seite im Modus `Betrieb` verwalten.

## Bereitstellung abschließen

Die Bereitstellung ist ein geführter Abschnitt der Instanzdetailseite und kein eigener Route- oder Geschäftsprozess.

`Setup abschließen` gilt erst dann als erledigt, wenn beide Bedingungen erfüllt
sind:

- die Instanz ist aktiv
- die Tenant-Admin-Struktur ist initialisiert

Bis zur Aktivierung stehen die Readiness-Schritte und ihre nächste zulässige Aktion im Vordergrund. Danach bleibt dieselbe Detailseite der Einstieg für Betrieb, Doctor und Einstellungen.

## Betrieb

`Betrieb` ist die normale Standardansicht für eingerichtete Instanzen.

Hier stehen vor allem diese Aufgaben im Vordergrund:

- Module zuweisen und entziehen
- laufende Verwaltungsarbeit an der Instanz
- wiederkehrende Standardaktionen im Tagesbetrieb

Der Happy Path liegt damit bewusst auf der Modulverwaltung und nicht mehr auf
Diagnose oder Stammdatenpflege.

## Doctor

`Doctor` ist dauerhaft erreichbar und dient der Diagnose und Reparatur.

Der Einstiegspunkt `Doctor öffnen` bleibt immer an derselben Stelle im Kopf der
Bestandsseite sichtbar:

- bei automatisch erkannten Problemen mit zusätzlichem Warnkontext
- ohne erkannte Probleme als normaler, manuell nutzbarer Einstieg

Der Doctor folgt immer demselben Ablauf:

1. `Überblick`
2. `Empfohlene Maßnahme`
3. `Reparatur ausführen`
4. `Validieren`

Zusätzlich liegt die technische Historie im Doctor-Kontext, damit frühere Läufe
und aktuelle Befunde zusammen gelesen werden können.

## Einstellungen

`Einstellungen` bündelt nachgeordnete Änderungen, die nicht zum laufenden
Betrieb gehören.

Dazu zählen insbesondere:

- Anzeigename
- Parent-Domain
- Realm- und Client-Zuordnung
- Issuer- und Secret-bezogene Vertragswerte
- Tenant-Admin- und Client-Basisdaten

Diese Änderungen sind bewusst aus dem Standard-Erstblick herausgezogen.

## Orientierung im Kopf

Der Kopf der Bestandsseite dient nur der schnellen Einordnung:

- Instanzidentität
- Setup-Status
- Betriebsstatus
- fixer Einstieg `Doctor öffnen`

Wenn ein Problem erkannt wird, erscheint dort zusätzlich ein Warnhinweis. Die
Position des Doctor-Einstiegs ändert sich dabei nicht.
