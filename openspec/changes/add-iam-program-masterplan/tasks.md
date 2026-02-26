# Tasks: add-iam-program-masterplan

## 1. Programmrahmen definieren

- [ ] 1.1 Child-Change-Liste finalisieren (IDs, Scope, Reihenfolge)
- [ ] 1.2 Abhängigkeiten und Schnittstellen zwischen Child-Changes dokumentieren
- [ ] 1.3 Exit-Kriterien pro Child-Change festlegen
- [ ] 1.4 Entscheidungs-Checkliste in `decision-checklist.md` vollständig ausfüllen und freigeben

## 2. Bestehenden IAM-Change einordnen

- [ ] 2.1 `setup-iam-identity-auth` als Child A klassifizieren
- [ ] 2.2 Scope-Bereinigung durchführen (alles außerhalb Child A auslagern)
- [ ] 2.3 Offene Punkte in Child-A-Backlog übernehmen

## 3. Child-Changes vorbereiten (Proposal-ready)

- [ ] 3.1 `add-iam-core-data-layer` anlegen
- [ ] 3.2 `add-iam-authorization-rbac-v1` anlegen
- [ ] 3.3 `add-iam-abac-hierarchy-cache` anlegen
- [ ] 3.4 `add-iam-governance-workflows` anlegen

## 4. Architektur- und Qualitätsbezug absichern

- [ ] 4.1 arc42-Abschnitte je Child-Change referenzieren
- [ ] 4.2 Sicherheits- und Compliance-Anforderungen je Child-Change als Kriterien verankern
- [ ] 4.3 Performance-Ziel (`authorize` < 50 ms) als messbares Kriterium verankern

## 5. Review-Gates

- [ ] 5.1 Master-Change reviewen und freigeben
- [ ] 5.2 Child-Changes einzeln reviewen und freigeben
- [ ] 5.3 Implementierung erst nach Freigabe des jeweiligen Child-Changes starten
