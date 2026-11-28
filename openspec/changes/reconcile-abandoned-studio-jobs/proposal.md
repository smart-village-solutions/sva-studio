# Verwaiste Studio-Jobs abschließen

## Ausgangslage

Der Frankfurter Abfallabgleich blieb nach fünf Worker-Abstürzen im Studio als laufend gespeichert. Der Queue-Eintrag war ungesperrt und hatte sein Versuchslimit erreicht. Eine spätere Abbruchanfrage änderte den Jobstatus nicht. Ein Queue-Eintrag ohne ausführbaren Versuch und ein offener Studio-Job können heute dauerhaft auseinanderlaufen.

Die bestehende Plugin-Aktivierung prüft abgelaufene Ausführungs-Leases bereits serverseitig und schreibt einen Jobstatus mit Historienereignis. Die allgemeine Jobplattform benötigt denselben verlässlichen Abschluss für übrige Jobs, damit Betrieb und Oberfläche den endgültigen Zustand sehen.

## Vorschlag

Der Host prüft begrenzt und unabhängig vom UI-Verkehr, ob nicht terminale Studio-Jobs mit abgelaufenem Heartbeat noch ausgeführt werden können. Die Prüfung verwendet den registrierten Job-Key, die richtige Worker-Lane und eine minimal berechtigte Sicht auf den Queue-Zustand. Temporär nicht lesbare Queue-Daten gelten als unbekannt.

Wenn der Queue-Eintrag nachweislich ungesperrt und endgültig erschöpft ist, finalisiert der Host genau einmal den Studio-Job und das Historienereignis in einer Transaktion. Die bedingte Transition prüft Instanz, Job, Versuch, Worker und Lease. Die Prüfung des Queue-Zustands muss gegen eine gleichzeitige Übernahme oder erneute Einreihung abgesichert sein. Bereits terminale Jobs und Jobs mit aktiver Ausführung bleiben beim bestehenden Pfad.

Ein dokumentierter Abbruch vor Beginn einer Ausführung kann als abgebrochen enden. Wenn ein Worker während einer begonnenen Ausführung verschwunden ist und der Ausgang offen bleibt, endet der Job als fehlgeschlagen mit einem eindeutigen Grund. Die Abbruchanfrage bleibt in der Historie sichtbar. Der Host startet solche Jobs nicht automatisch erneut, da ein externes Ziel bereits teilweise geschrieben worden sein kann. Die Plugin-Aktivierung behält ihren vorhandenen fachlichen Recovery-Pfad.

## Betriebsnachweis

Die vorhandenen Job-Details zeigen den Endstatus und Fehlergrund. Ein aggregiertes Betriebssignal unterscheidet bestätigte verwaiste Jobs, abgeschlossene Bereinigungen und eine fehlende oder nicht auswertbare Beobachtung. Der Betrieb erhält einen Alarm für anhaltende verwaiste Jobs oder den Ausfall der Kontrolle. Tenant-, Job- und Nutzerdaten bleiben aus Metriklabels und Alarmtexten heraus.

Der Staging-Nachweis beendet einen laufenden Worker während eines Jobs, prüft ausgeschöpfte Queue-Versuche, Endstatus, genau ein Historienereignis und die Entfernung aus der aktiven Liste. Ein konkurrierender frischer Claim und eine nicht erreichbare Queue werden gesondert geprüft. Messgröße ist die Zeit ab bestätigtem, nicht mehr ausführbarem Queue-Zustand bis zum Endstatus. Budget und Alarmfenster werden im Implementierungsentwurf anhand des vorhandenen Worker-Takts festgelegt.

## Umfang

Die Speicheroptimierung des Abfallabgleichs und die Freigabe eines neuerlichen Frankfurter Abgleichs werden eigenständig behandelt. Dieser Change betrifft den zentralen Abschluss und die Überwachung verwaister Jobs.

## Umsetzung und Nachweis

1. Der Standard-Worker prüft im bestehenden 60-Sekunden-Takt beide registrierten Task-Lanes. Pro aktiver Instanz und Runde prüft er höchstens 25 Kandidaten und setzt die Prüfung bei der nächsten Runde dahinter fort. Die bestehende Job-Lease läuft nach 120 Sekunden ab. Bei einer vollständigen Runde ohne Rückstau ist das Ziel, einen bestätigbaren Job innerhalb von zwei Minuten abzuschließen. Die Frist beginnt, sobald Graphile den Eintrag entsperrt hat und die Versuche ausgeschöpft sind.
2. Die instanzgebundene Studio-Transaktion sperrt zuerst den Studio-Datensatz. Eine eng begrenzte Graphile-Funktion korreliert den deterministischen Schlüssel, Tenant, Job, Queue und Task-Lane und hält die Queue-Zeilensperre bis zum Ende derselben Transaktion. Status und Historie werden über den bestehenden atomaren Übergang geschrieben. Tests prüfen fehlende, gesperrte und ausgeschöpfte Einträge, Tenant- und Lane-Grenzen, paralleles Enqueue sowie wiederholte Prüfung. Plugin-Lifecycle-Jobs behalten ihre Fachlogik.
3. Der bestehende OTEL-Pfad erfasst bestätigte Fälle, Abschlüsse, Konflikte und unbekannte Zustände. Jede Runde reserviert innerhalb des Limits bei Bedarf je eine erneute Prüfung für bekannte Abschlussfehler und unbekannte Zustände, auch während der Cursor weitere Seiten abarbeitet. Eine unbekannte Beobachtung verlängert die Zeitmarke der letzten erfolgreichen Runde nicht. Der bestehende Graphile-Readiness-Check prüft das Ausführungsrecht für die Queue-Funktion. Im Staging werden Worker-Abbruch, Endstatus, Historie, aktive Liste und Alarm getrennt geprüft.
