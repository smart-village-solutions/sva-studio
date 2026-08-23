## 1. Vertrag charakterisieren

- [x] 1.1 Realm-fehlt und vollständigen Erfolgsfall mit allen vierzehn Check-
      Ergebnissen vor der Extraktion fixieren.
- [x] 1.2 Login-URL-/Secret-Abweichungen, Tenant-Admin-Flags/-Secret/-Rollen,
      `system_admin`-Skip sowie optionale Mapper-/Bootstrap-Hinweise charakterisieren.
- [x] 1.3 `kcadm`-Befehlsfolge, temporäres Config-Cleanup und Abwesenheit von
      Secret-Inhalten in Ergebnissen nachweisen.

## 2. Erhebung und Bewertung trennen

- [x] 2.1 Einen kleinen typisierten Snapshot für die bereits erhobenen Fakten
      einführen.
- [x] 2.2 Die vierzehn unveränderten Befunde rein aus Snapshot, Ziel und
      erwarteten Secrets ableiten.
- [x] 2.3 Den Realm-fehlt-Frühpfad sowie `kcadm`-Aufrufe und Cleanup unverändert
      erhalten.

## 3. Dokumentation

- [x] 3.1 Relevante deutsche Betriebsdokumentation um die read-only Erhebungs-
      und Bewertungsgrenze ergänzen.
- [x] 3.2 Betroffene arc42-Baustein-, Laufzeit- und Security-Sichten aktualisieren.

## 4. Verifikation

- [x] 4.1 Fokussierte Unit-Tests und Skript-Typecheck ausführen.
- [x] 4.2 Complexity-Gate und Fallow-Vorher-/Nachher-Vergleich ohne Suppression
      ausführen.
- [x] 4.3 File-Placement und OpenSpec strict ausführen.
- [x] 4.4 `pnpm test:pr` vor dem Push ausführen und jeden ausgelassenen breiten
      Gate-Pfad transparent dokumentieren.
