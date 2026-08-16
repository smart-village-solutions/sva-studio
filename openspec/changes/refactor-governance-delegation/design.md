## Kontext

`createDelegation` entscheidet derzeit sowohl über reine Eingabe- und Policy-Regeln als auch über drei Account-Lookups, den Delegation-Insert und das Audit-Dual-Write. Die bestehende Reihenfolge ist autorisierungs- und datenintegritätsrelevant.

## Ziele / Nicht-Ziele

- Ziele: reine Entscheidungen isolieren, Komplexität senken und den bestehenden Vertrag vollständig charakterisieren.
- Nicht-Ziele: Reason Codes, Ticketpolicy, maximale Dauer, Zeitgrenzen, Rollenmodell, SQL, Audit, Transaktionen oder öffentliche APIs ändern.

## Entscheidungen

- Payload-Normalisierung und die zeitabhängige Delegationsentscheidung werden in kleinen paketinternen, frameworkfreien Funktionen gekapselt.
- Die aktuelle Zeit wird der reinen Entscheidung explizit als Millisekundenwert übergeben; der Executor bleibt Eigentümer von `Date.now()`.
- Account-Lookups bleiben sequenziell und vollständig, bevor fehlende Accounts gemeinsam als `unauthorized` bewertet werden.
- Persistenz, Audit und Logging bleiben im Executor, damit die bestehende I/O-Reihenfolge sichtbar bleibt.
- Alternative „neuer Repository-/Service-Layer“ wird verworfen, weil nur ein Konsument besteht und ein neues Interface keine Ownership reduziert.
- Alternative „Transaktion ergänzen“ wird verworfen, weil dies den bestehenden Fehler- und Persistenzvertrag verändern würde.

## Datenfluss

```text
Payload + Actor
  -> Normalisierung
  -> reine Vorentscheidung (Pflichtfelder, UUID, Ticket, Zeit)
  -> drei instanzgebundene Account-Lookups
  -> reine Account-/Self-Approval-Entscheidung
  -> Delegation-Insert
  -> Audit-Dual-Write
  -> strukturiertes Warn-Log
```

## Risiken / Abwägungen

- Veränderte Fehlerpriorität wird durch kombinatorische Negativtests und exakte Query-Zählung verhindert.
- Veränderte Zeitgrenzen werden mit fester Uhrzeit für gleich, negativ, exakt 30 Tage, überlang sowie aktiv/angefordert geprüft.
- Veränderte Datenintegrität wird durch exakte SQL-Parameter, Instanzfilter, Auditfelder und Query-Reihenfolge abgesichert.
- Queryfehler bleiben unverändert propagiert; es wird keine neue Catch- oder Transaktionsgrenze eingeführt.

## Migrationsplan

Keine Datenmigration. Die Refaktorierung ist verhaltensgleich und kann durch Zurücksetzen des Code-Commits rückgängig gemacht werden.

## Offene Fragen

Keine. Inclusive Zeitgrenzen und Fehlerprioritäten sind durch den Altcode und grüne Characterization festgelegt.
