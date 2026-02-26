# Tasks: add-iam-program-masterplan

## 1. Programmrahmen definieren

- [x] 1.1 Child-Change-Liste finalisieren (IDs, Scope, Reihenfolge)
- [x] 1.2 Abhängigkeiten und Schnittstellen zwischen Child-Changes dokumentieren
- [x] 1.3 Exit-Kriterien pro Child-Change festlegen
- [x] 1.4 Entscheidungs-Checkliste in `decision-checklist.md` vollständig ausfüllen und freigeben
- [x] 1.5 Kanonischen Mandanten-Scope `instanceId` festlegen (inkl. Instanz→Organisation-Modell)

## 2. Bestehenden IAM-Change einordnen

- [ ] 2.1 `setup-iam-identity-auth` als Child A klassifizieren
- [ ] 2.2 Scope-Bereinigung durchführen (alles außerhalb Child A auslagern)
- [ ] 2.3 Offene Punkte in Child-A-Backlog übernehmen

## 3. Child-Changes vorbereiten (Proposal-ready)

- [x] 3.1 `add-iam-core-data-layer` anlegen
- [x] 3.2 `add-iam-authorization-rbac-v1` anlegen
- [x] 3.3 `add-iam-abac-hierarchy-cache` anlegen
- [x] 3.4 `add-iam-governance-workflows` anlegen

## 4. Architektur- und Qualitätsbezug absichern

- [x] 4.1 arc42-Abschnitte je Child-Change referenzieren
- [x] 4.2 Sicherheits- und Compliance-Anforderungen je Child-Change als Kriterien verankern
- [x] 4.3 Performance-Ziel (`authorize` < 50 ms) als messbares Kriterium verankern

## 5. Review-Gates

- [ ] 5.1 Master-Change reviewen und freigeben
- [ ] 5.2 Child-Changes einzeln reviewen und freigeben
- [ ] 5.3 Implementierung erst nach Freigabe des jeweiligen Child-Changes starten
