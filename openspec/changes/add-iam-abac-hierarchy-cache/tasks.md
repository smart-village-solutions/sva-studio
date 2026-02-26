# Tasks: add-iam-abac-hierarchy-cache

## 1. Policy-Modell erweitern

- [ ] 1.1 ABAC-Attribute und Evaluationsregeln definieren
- [ ] 1.2 Hierarchische Vererbung modellieren (Org/Geo)
- [ ] 1.3 Einschränkungsregeln untergeordneter Ebenen absichern

## 2. Cache-Strategie

- [ ] 2.1 Snapshot-Modell pro User/Org-Kontext implementieren
- [ ] 2.2 Invalidation-Events spezifizieren und umsetzen
- [ ] 2.3 Fallback- und Recompute-Pfade absichern

## 3. Qualität

- [ ] 3.1 Last-/Performancetests für `authorize` ergänzen
- [ ] 3.2 Konsistenztests Cache vs. DB ergänzen
- [ ] 3.3 Failure-Mode-Tests (stale cache, event loss) ergänzen
