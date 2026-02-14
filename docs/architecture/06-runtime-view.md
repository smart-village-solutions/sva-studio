# 06 Laufzeitsicht

## Zweck

Dieser Abschnitt beschreibt kritische Laufzeitszenarien und Interaktionen.

## Mindestinhalte

- Mindestens 3 kritische End-to-End-Szenarien
- Sequenz der beteiligten Bausteine pro Szenario
- Fehler- und Ausnahmeverhalten fuer kritische Flows

## Aktueller Stand

### Szenario 1: App-Start + Route-Komposition

1. App laedt `getRouter()` in `apps/sva-studio-react/src/router.tsx`
2. Core- und Plugin-Route-Factories werden zusammengefuehrt
3. `buildRouteTree(...)` erzeugt den Runtime-RouteTree
4. Router wird mit RouteTree und Kontext erstellt

Fehlerpfad:

- Fehlerhafte Route-Factory oder falscher Import kann Build/Runtime brechen.

### Szenario 2: Plugin-Route-Navigation

1. Eine Plugin-Route wird in `packages/plugin-example/src/routes.tsx` definiert
2. Die Route-Factory wird beim Router-Build registriert
3. Navigation auf `/plugins/example` rendert die Plugin-Komponente

Fehlerpfad:

- Bei fehlerhafter Factory-Signatur wird die Route nicht korrekt gebaut.

### Szenario 3: Server Function innerhalb der App

1. Client triggert eine Aktion in einer Demo-Route
2. `createServerFn` verarbeitet den Request serverseitig
3. Ergebnis wird an den Client zurueckgegeben und in der UI gerendert

Fehlerpfad:

- Ungueltige Eingaben liefern einen Fallback-Wert statt Hard-Fail.

Referenzen:

- `apps/sva-studio-react/src/router.tsx`
- `apps/sva-studio-react/src/routes/-core-routes.tsx`
- `packages/core/src/routing/registry.ts`
- `packages/plugin-example/src/routes.tsx`
