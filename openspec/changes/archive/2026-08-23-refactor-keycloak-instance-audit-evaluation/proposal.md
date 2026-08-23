# Change: Keycloak-Instanz-Audit in Erhebung und Bewertung trennen

## Why

Der operative Keycloak-Instanz-Audit erhebt Realm-, Client-, Rollen- und
Secret-Zustände und bewertet gleichzeitig vierzehn Befunde in einer einzigen
großen Funktion. Dadurch sind der unveränderte Auditvertrag, die
`kcadm`-Befehlsfolge und die Secret-Grenze unnötig schwer separat nachzuweisen.

## What Changes

- Die bestehende `kcadm`-Erhebung wird in einen kleinen typisierten Snapshot
  überführt.
- Eine reine Bewertungsfunktion leitet daraus dieselben vierzehn Check-IDs,
  Titel, Zusammenfassungen, Details und Statuswerte ab.
- Characterization-Tests fixieren Realm-, Login-Client-, Tenant-Admin-, Rollen-,
  `system_admin`-, Mapper- und Bootstrap-Verträge vor der Extraktion.
- Secret-Werte bleiben auf die Erhebung und reine Gleichheitsbewertung begrenzt;
  Ergebnisse, Fehler, Logs und Testevidenz enthalten keine Secret-Inhalte.
- Die `kcadm`-Befehlsfolge, temporäre Konfiguration und deren Cleanup bleiben
  unverändert.

## Impact

- Affected specs: `instance-provisioning`
- Affected code: `scripts/ops/studio-instance-audit/keycloak.ts`, neue
  zweckgebundene Snapshot-/Bewertungsmodule und Vitest-Characterization
- Affected documentation: betroffene Betriebsdokumentation zum
  Studio-Instanz-Audit
- Affected arc42 sections: `docs/architecture/05-building-block-view.md`,
  `docs/architecture/06-runtime-view.md`,
  `docs/architecture/08-cross-cutting-concepts.md`
- Security impact: Keine neue Mutation und keine neue Diagnoseoberfläche; die
  vorhandene fail-closed Status- und Secret-Semantik wird nur explizit getrennt.
