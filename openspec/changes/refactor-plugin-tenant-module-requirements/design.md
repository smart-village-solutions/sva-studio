# Design: Deklarative Tenant-Modulvoraussetzungen

## Bestehender Pfad

- `PluginDefinition` und die SDK-Registry bilden bereits den validierten
  Descriptor-Beitrag und Snapshot. Der Vertrag kennt noch keine
  Tenant-Modulvoraussetzungen.
- `service-module-mutations-sync.ts` enthält die feste Zuordnung
  `news`/`events`/`poi` → `categories`.
- Assign, Bootstrap und Revoke enthalten eigene Waste-Provisionierungsaufrufe.
- `InstanceRegistryRepository` führt Waste-Provisionierungsoperationen neben
  generischen Instanz- und IAM-Operationen. Die Waste-Serverfassade wird auch
  von `waste-management-runtime` für Statusanzeige und Retry verwendet.
- Das bereits implementierte Plugin-Tenant-Lifecycle besitzt den
  Provision-/Reconcile-/Suspend-Vertrag, persistenten Operationspfad und die
  erforderliche Readiness-Evidenz.

## Entscheidungen

1. Voraussetzungen sind direkte Modul-IDs am vorhandenen `PluginDefinition`,
   keine zweite Installations- oder Dependency-Manager-Schicht. Die
   Instance-Registry löst sie gegen die verfügbaren Modul-IAM-Beiträge auf;
   ein fehlendes Ziel verhindert die jeweilige Tenant-Mutation, nicht die
   Veröffentlichung des hostweiten Plugin-Snapshots. Transitive
   Abhängigkeiten sind nicht Teil dieses Changes.
2. Assign und Bootstrap prüfen alle direkten Voraussetzungen sowie bestehende
   Zuweisungen und Aktivierungsrichtlinien vor der ersten Persistenzmutation.
   Sie ergänzen fehlende Voraussetzungen. Revoke weist den Entzug ab, solange
   ein anderes zugewiesenes Modul das Ziel benötigt oder dessen
   Aktivierungsrichtlinie den Entzug verbietet.
3. Die Registry nutzt nach der Aktivierungsänderung den bestehenden
   Plugin-Tenant-Lifecycle. Dessen Wake-up-, Claim-, Generation-, Fehler- und
   Readiness-Garantien bleiben durch den vorhandenen Vertrag bestimmt; dieser
   Change ergänzt dafür keine eigene Orchestrierung.
4. Waste-spezifische Status-/Retry-Consumer verbleiben an ihrer vorhandenen
   engen Serverfassade. `iam.instance_waste_provisioning` und vorhandene
   Fachdaten werden in diesem Change nicht gelöscht oder migriert. Entfernt
   werden nur Waste-Methoden aus dem allgemeinen Registry-Vertrag, soweit der
   Host-Lifecycle sie ersetzt.

## Gültigkeit und Fehlerverhalten

- Vor Assign/Bootstrap werden direkte Voraussetzungen und
  Aktivierungsrichtlinien des Ziel-Tenants geprüft. Ein nicht verfügbares
  Ziel oder widersprüchlicher Zustand bricht die Mutation vor dem ersten
  Persistenz-, IAM-, Audit- oder Lifecycle-Write ab.
- Vor Revoke wird geprüft, ob ein anderes noch zugewiesenes Modul das
  Zielmodul benötigt oder ob `required`-Semantik den Entzug verbietet.

## Geplante direkte Nachweise

| Behauptung | Führender Nachweis |
| --- | --- |
| Fehlende Voraussetzung verhindert Assign/Bootstrap vor dem ersten Write | Gezielte Mutationstests mit Write-/Audit-Negativassertions |
| Revoke erhält benötigte Voraussetzungen und bestehende Aktivierungsrichtlinien | Gezielte Mutationstests für direkte Voraussetzungen, `required` und historische Zuweisungen |
| Waste wird über den bestehenden Plugin-Tenant-Lifecycle ausgelöst; Status und Retry bleiben verfügbar | Registry-/Fassadentests; bestehender Lifecycle-Contract bleibt führender Nachweis |
| Der generische Repositoryvertrag hat keine Waste-Provisionierungsaktionen | Typ-/Unit-Tests der Repository-Fassade und `pnpm check:server-runtime` |

## Reviewgrenze

Kein Datenbankschema- oder Migrationsumbau ist vorgesehen. Ergibt die
Consumerprüfung, dass der bestehende Waste-Status nicht ohne Datenmigration
entfernt werden kann, bleibt er über die bestehende plugin-spezifische
Fassade erhalten; die generische Registry darf ihn trotzdem nicht als
Lifecycle-Ersatz aufrufen.
