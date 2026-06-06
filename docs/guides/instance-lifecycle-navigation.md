# Instanz-Lebenszyklus und Navigation

Diese Anleitung beschreibt den neuen Arbeitsablauf in der Instanzverwaltung
unter `/admin/instances`.

## Zielbild

Die Verwaltung trennt jetzt klar zwischen:

1. `Anlage` einer neuen Instanz
2. `Setup abschließen` als einmaligem Inbetriebnahme-Flow
3. `Betrieb` als Standardansicht für Bestandsinstanzen
4. `Doctor` als Diagnose- und Reparaturmodus
5. `Einstellungen` für Stammdaten und Vertragswerte

## Typischer Ablauf

1. Neue Instanz über `/admin/instances/new` anlegen.
2. Nach erfolgreicher Anlage direkt in `/admin/instances/<instanceId>/setup` wechseln.
3. Im Setup die Instanz aktivieren und die Tenant-Admin-Struktur initialisieren.
4. Erst nach abgeschlossenem Setup auf die Bestandsseite wechseln.
5. Bestandsinstanzen standardmäßig im Modus `Betrieb` verwalten.

## Setup abschließen

Der Setup-Flow ist bewusst von der späteren Bestandsverwaltung getrennt.

`Setup abschließen` gilt erst dann als erledigt, wenn beide Bedingungen erfüllt
sind:

- die Instanz ist aktiv
- die Tenant-Admin-Struktur ist initialisiert

Während des Setups stehen nur die dafür relevanten Schritte und Aktionen im
Vordergrund. Die dauerhaften Bestandsmodi werden hier nicht eingeblendet.

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
