## ADDED Requirements

### Requirement: Native macOS-Begleit-App als isolierter Workspace-Baustein

Das System SHALL die native macOS-Begleit-App unter `apps/sva-studio-macos` als von der TanStack-Start-App getrennten Workspace-Baustein führen. Nx SHALL reproduzierbare Targets für nativen Build, native Tests und statische Prüfung orchestrieren.

#### Scenario: Native App ist im Projektgraph sichtbar

- **WENN** der Nx-Projektgraph geladen wird
- **DANN** erscheint `sva-studio-macos` als eigenständige Anwendung
- **UND** besitzt sie Targets für Build, Test und statische Prüfung

#### Scenario: Native App konsumiert Studio-Funktionalität

- **WENN** die native App Nachrichten lädt
- **DANN** verwendet sie ausschließlich die versionierte HTTP-API
- **UND** importiert sie keine Quellmodule aus `apps/sva-studio-react` oder serverseitigen Workspace-Packages

#### Scenario: Native Tests werden ausgeführt

- **WENN** Swift-, WidgetKit- oder Keychain-Logik getestet wird
- **DANN** kapselt das Nx-Target die geeigneten nativen Apple-Testwerkzeuge
- **UND** bleibt Vitest der unveränderte Standard für TypeScript-Tests unter `apps`, `packages` und `scripts`
- **UND** ist die native Toolchain-Ausnahme ausdrücklich dokumentiert

### Requirement: Generatorprüfung vor nativem Sonderfall-Setup

Das System SHALL vor dem manuellen Scaffolding der nativen App den vorgeschriebenen Nx-Generator-Workflow ausführen und das manuelle Setup nur verwenden, wenn kein geeigneter Generator existiert.

#### Scenario: Kein geeigneter nativer Generator ist vorhanden

- **WENN** die Generatorprüfung keinen passenden Xcode-/WidgetKit-Generator im Workspace ergibt
- **DANN** darf die native App als dokumentierter Sonderfall manuell angelegt werden
- **UND** werden Projektgraph, Inputs, Outputs und Targetverträge explizit gepflegt
