# Playbook

# Allgemeine Regeln

## Sprache
Doku und Konzepte auf deutsch, code auf englisch.

## Paket-Abhängigkeiten
Abhängigkeiten von externen Paketen und Libraries erhöhen die Komplexität sowie das Risiko für Sicherheitslücken und Instabilitäten. Daher prüfen wir externe Pakete sorgfältig hinsichtlich ihres Mehrwerts, ihrer Qualität und der Lizenzkompatibilität. Eine Einbindung erfolgt nur nach einer gründlichen und dokumentierten Abwägung.

## Code-Quali
Wir setzen auf statistische Code-Analyse und wählen ein passendes Tool (z.B. CodeClimate, SonarQube, ...)


# Regeln für die Arbeit mit KI

## 1. Grundprinzipien
Der Mensch bleibt verantwortlich: Jede Codezeile, die entsteht, gehört uns – auch wenn sie von einer KI vorgeschlagen wurde.
KI beschleunigt, entscheidet aber nicht: Architektur, Design und Prioritäten liegen immer beim Team.
Qualität vor Geschwindigkeit: Schnell geschriebener, schlechter Code kostet später mehr.

## 2. Datenschutz und Sicherheit
Keine sensiblen Daten: Es werden niemals Passwörter, API-Keys, echte Kundendaten oder hochgradig proprietäre Geschäftsgeheimnisse in öffentliche KI-Modelle hochgeladen.
Security-Checks: Da KI oft funktionalen, aber unsicheren Code schreibt, streben wir den Einsatz von Security-Scannern (z. B. für SQL-Injections oder XSS) an.

## 3. Erst denken, dann coden: Anforderungen & Planung
Problem beschreiben, nicht nach Code fragen: KI liefert bessere Ergebnisse, wenn der Kontext klar ist.
Gemeinsame Planung: Wir nutzen KI, um Anforderungen zu klären, Randfälle zu sammeln und Annahmen zu prüfen.
Dokumentation: Die Ergebnisse werden vor der Implementierung in Markdown Specs im Repo festgehalten.
Reihenfolge: Erst wenn klar ist, was gebaut wird, lassen wir die KI Code erzeugen.

## 4. Arbeit in kleine Schritte zerlegen
Granularität: Große Features werden in kleine, klar abgegrenzte Aufgaben zerlegt.
Pro Task/Anfrage: Eine Funktion, ein Bug oder ein klarer Änderungspunkt. Nichts "noch eben mit optimieren"
Iteratives Vorgehen: Nach jedem Schritt wird getestet und committet, bevor die nächste Aufgabe angegangen wird. Der Aufgabenstatus wird stetig aktualisiert.

## Kontinuierliche Dokumentation
Wir dokumentieren alle Anforderungen, Arbeitsschritte und die finalen Arbeitsergebnisse. Change- und Release-Logs machen Änderungen nachvollziehbar. Zeitstempel machen eine chronologische Nachvervollziehbarkeit möglich.

## 5. Der KI ausreichend Kontext geben
Notwendige Informationen: Um präzise Vorschläge zu erhalten, übergeben wir relevante Code-Dateien, APIs, Architekturregeln und Coding-Konventionen.
Einschränkungen: Es muss explizit kommuniziert werden, was nicht verändert werden darf.
Faustregel: Wenn ein menschlicher Kollege bestimmte Informationen für die Aufgabe bräuchte, benötigt die KI diese ebenfalls.

## 6. Umgang mit Halluzinationen und Wissenslücken
Faktencheck: KIs können Fakten oder Bibliotheken erfinden. Alle vorgeschlagenen Funktionen oder Pakete (Dependcy-Management, schlanke SBOM) müssen auf Existenz und Aktualität geprüft werden.
Versions-Gap: Da KIs ein Wissenslimit haben (Cut-off), prüfen wir Vorschläge gegen die aktuelle Dokumentation unserer Frameworks.
Kein blindes Vertrauen: Erklärungen der KI werden kritisch hinterfragt.

## 7. Alles prüfen: Lesen, testen, verstehen
Verständnis-Pflicht: Kein KI-Code wird übernommen, ohne dass ein Mensch ihn vollständig verstanden hat.
Review-Prozess: Wir führen manuelle Reviews durch und nutzen bei Bedarf eine zweite KI-Instanz für eine Gegenprüfung.
Vereinfachung: Ist der KI-Code zu komplex (wie messen wir das) oder unklar, wird er vereinfacht oder neu geschrieben.

## 8. Tests als Sicherheitsnetz
Absicherung: Wir nutzen KI aktiv zum Vorschlagen von Testfällen und zum Schreiben von Unit-Tests.
Regeln: Neue Logik erfordert neue Tests. Ein Bugfix ist erst mit einem entsprechenden Test vollständig.
Abnahmekriterium: Ohne Tests gilt eine Aufgabe nicht als abgeschlossen.
Keine Lazy-Tests: KI neigt dazu, Tests zu schreiben, die erfolgreich sind. Hier ist der Mensch gefragt, damit auch die korrekten Logiken getestet werden.

## 9. Häufig committen und Versionskontrolle
Rückfallpunkte: Da KI schnell große Mengen Code erzeugt, sind häufige und kleine Commits essenziell.
Transparenz: Wir nutzen aussagekräftige Commit-Messages und führen Experimente konsequent in separaten Branches durch.
Goldene Regel: Niemals Code committen, den man nicht selbst erklären kann.

## 10. Team-Synchronisation und Standards
KI-Instruktionen: Wir geben der KI unsere Team-Standards (Stil, Patterns, Do’s & Don’ts) explizit mit.

## 11. Automatisierung nutzen
Kombination: Wir integrieren KI in unsere bestehende Tool-Kette (CI/CD, Linter, Type-Checks).
Workflow: Die KI schreibt Code, die Pipeline validiert diesen. Fehler-Logs werden an die KI zurückgegeben, um Korrekturen zu beschleunigen.

## 12. KI als Lernverstärker begreifen
Wissensaufbau: KI hilft uns, neue Patterns zu lernen und Frameworks schneller zu verstehen.
Grundlagen: Wir sind uns bewusst, dass nur fundiertes Basiswissen es ermöglicht, die Ergebnisse der KI qualitativ zu bewerten.
Reflektion: Wir stellen aktiv “Warum”-Fragen und coden regelmäßig auch ohne KI, um unsere eigenen Fähigkeiten zu schärfen.

## Zusammenfassung
Wir nutzen KI zur Beschleunigung und zur Reduzierung von Routineaufgaben, um mehr Fokus auf Architektur und Qualität zu legen. Dabei bleiben wir in der vollen Verantwortung, planen sauber, testen konsequent und reviewen kritisch. (edited)