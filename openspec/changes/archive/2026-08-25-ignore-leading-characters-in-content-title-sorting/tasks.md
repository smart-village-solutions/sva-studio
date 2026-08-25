## 1. Spezifikation

- [x] 1.1 Bestehenden Inhaltslisten-Sortiervertrag um die Normalisierung führender Zeichen ergänzen
- [x] 1.2 Technische Abgrenzung und Rückrollbarkeit dokumentieren
- [x] 1.3 OpenSpec-Change fachlich prüfen und zur Implementierung freigeben

## 2. Implementierung

- [x] 2.1 Festen serverseitigen Sortierausdruck für Inhaltstitel anpassen
- [x] 2.2 Gerade und typografische Anführungszeichen, Leerraum, weitere führende Symbole, Umlaute, Ziffern und interne Bindestriche mit Regressionstests abdecken
- [x] 2.3 Auf- und absteigende globale Sortierung sowie `ID asc` als Tie-Breaker bestätigen

## 3. Validierung und Dokumentation

- [x] 3.1 Betroffene Unit- und Server-Runtime-/Type-Gates ausführen
- [x] 3.2 Prüfen und dokumentieren, dass keine arc42- oder DB-Schema-Aktualisierung erforderlich ist
- [x] 3.3 Changelog-Eintrag für PR #1139 ergänzen
