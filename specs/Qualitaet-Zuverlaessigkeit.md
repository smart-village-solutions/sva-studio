# Qualität und Zuverlässigkeit

Die Qualität und Zuverlässigkeit von CMS 2.0 sind fundamentale Anforderungen, die die Basis für einen stabilen und performanten Betrieb bilden.

---

## Performance

Inhalte und Redaktionsprozesse sollen schnell und ohne wahrnehmbare Verzögerungen ausgeführt werden.

**Messkriterium:**
- Antwortzeiten im Backend ≤ 500 ms bei 95 % aller Anfragen
- Seitenaufbau im Frontend ≤ 2 Sekunden

---

## Verfügbarkeit und Ausfallsicherheit

Das System soll hochverfügbar sein und Redundanzen bieten, sodass auch bei Störungen ein stabiler Betrieb gewährleistet ist.

**Messkriterium:**
- Jahresverfügbarkeit ≥ 99,5 %
- Recovery Time Objective (RTO) < 4 Stunden

---

## Zuverlässigkeit

Fehler in der Verarbeitung müssen minimiert und klar behandelt werden.

**Messkriterium:**
- Keine ungefangenen Exceptions im Produktivbetrieb
- Dokumentierte Fehlerbehandlung mit Logs

---

## Skalierbarkeit

Das System muss für kleine Gemeinden wie auch für große Landkreise performant laufen.

**Messkriterium:**
- Unterstützt ≥ 1.000 gleichzeitige Nutzer\:innen
- Verarbeitet ≥ 500.000 Inhaltsobjekte ohne Performanceeinbruch
