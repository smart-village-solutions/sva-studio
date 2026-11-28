## 1. Abschluss im Host

- [x] 1.1 Den bestehenden Host-Jobpfad, Worker-Takt und die berechtigte Queue-Sicht für die unabhängige Prüfung festlegen. Abschlussbudget und Alarmfenster festhalten.
- [x] 1.2 Bedingte, transaktionale Finalisierung mit vorhandenen Jobstatus und Historienereignissen umsetzen. Plugin-Lifecycle-Recovery und konkurrierende Claims berücksichtigen.
- [x] 1.3 In PostgreSQL und Graphile den hinterlassenen Zustand eines Worker-Ausfalls, ausgeschöpfte Versuche, frische Ausführung, doppelte Prüfung und fehlenden Queue-Zugriff nachweisen.

## 2. Betrieb

- [x] 2.1 Das Betriebssignal an die bestehende Telemetrie- und Alarmierungskette anbinden.
- [ ] 2.2 In Staging den dokumentierten Worker-Ausfall vom gespeicherten Start bis Endstatus, aktiver Liste und Alarm prüfen.
- [x] 2.3 Betriebs- und Architektur-Dokumentation des bestehenden Jobpfads aktualisieren.
