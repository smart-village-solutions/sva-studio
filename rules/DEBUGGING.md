# Debugging

Ein praktischer Leitfaden zum Debuggen komplexer Probleme und zum effektiven Ausführen von Tests, erlernt durch die Untersuchung von Produktionsregressionen in großen Codebasen. Danke an https://github.com/TanStack/router/blob/main/DEBUGGING.md fürs Teilen.

## Schnellstart Debugging-Checkliste

Wenn du auf einen Fehlerbericht oder einen fehlschlagenden Test stößt:

1. **Zuerst reproduzieren** - Erstelle einen minimalen Testfall, der das genaue Problem demonstriert
2. **Baseline etablieren** - Führe vorhandene Tests aus, um zu sehen, was aktuell funktioniert/fehlschlägt
3. **Gezieltes Logging hinzufügen** - Füge Debug-Ausgaben an wichtigen Entscheidungspunkten ein
4. **Datenfluss verfolgen** - Folge dem Pfad von der Eingabe zur unerwarteten Ausgabe
5. **Letzte Änderungen prüfen** - Suche nach Versionsänderungen, die in Fehlerberichten erwähnt werden
6. **Hypothese testen** - Mache kleine, gezielte Änderungen und validiere jeden Schritt

## Wichtige Test-Befehle

```bash
# Run all tests for a package
npx nx test:unit @package-name

# Run specific test file
npx nx test:unit @package-name -- --run path/to/test.test.tsx

# Run tests matching a pattern
npx nx test:unit @package-name -- --run "pattern-in-test-name"

# Run with verbose output
npx nx test:unit @package-name -- --run --verbose
```

### Nützliche Test-Flags

```bash
# Run only (don't watch for changes)
--run

# Show full output including console.logs
--verbose

# Run in specific environment
--environment=jsdom
```

## Effektive Debugging-Strategien

### 1. Strategisches Logging

```javascript
// Use distinctive prefixes for easy filtering
console.log('[DEBUG useNavigate] from:', from, 'to:', to)
console.log('[DEBUG router] current location:', state.location.pathname)

// Log both input and output of functions
console.log('[DEBUG buildLocation] input:', dest)
// ... function logic ...
console.log('[DEBUG buildLocation] output:', result)
```

**Pro-Tipp:** Verwende `[DEBUG componentName]`-Präfixe, damit du Logs in den Browser-DevTools einfach filtern kannst.

### 2. Reproduktions-Test-Muster

```javascript
test('should reproduce the exact issue from bug report', async () => {
  // Set up the exact scenario described
  const router = createRouter({
    /* exact config from bug report */
  })

  // Perform the exact user actions
  await navigate({ to: '/initial-route' })
  await navigate({ to: '.', search: { param: 'value' } })

  // Assert the expected vs actual behavior
  expect(router.state.location.pathname).toBe('/expected')
  // This should fail initially, proving reproduction
})
```

### 3. Datenfluss-Nachverfolgung

```
User Action → Hook Call → Router Logic → State Update → UI Update
     ↓            ↓           ↓           ↓          ↓
  onClick()  → useNavigate() → buildLocation() → setState() → re-render
```

Füge Logging bei jedem Schritt hinzu, um zu sehen, wo der Fluss von den Erwartungen abweicht.

## Häufige Fallstricke & Lösungen

### React-Testing-Probleme

**Problem:** State-Updates nicht in Tests reflektiert

```javascript
// ❌ Bad - missing act() wrapper
fireEvent.click(button)
expect(component.state).toBe(newValue)

// ✅ Good - wrapped in act()
act(() => {
  fireEvent.click(button)
})
expect(component.state).toBe(newValue)
```

**Problem:** Async-Operationen werden nicht abgeschlossen

```javascript
// ❌ Bad - not waiting for async
const result = await someAsyncOperation()
expect(result).toBe(expected)

// ✅ Good - ensuring completion
await act(async () => {
  await someAsyncOperation()
})
expect(result).toBe(expected)
```

### React-Router-spezifische Probleme

**Context vs. Location-Verwechslung:**

- `useMatch({ strict: false })` gibt den **Route-Kontext der Komponente** zurück
- `router.state.location.pathname` gibt die **aktuelle URL** zurück
- Diese können unterschiedlich sein, wenn Komponenten von übergeordneten Routen gerendert werden

```javascript
// Component rendered by parent route "/" but URL is "/child"
const match = useMatch({ strict: false }) // Returns "/" context
const location = router.state.location.pathname // Returns "/child"
```

## Such- & Untersuchungsbefehle

### Relevanten Code finden

```bash
# Search for specific patterns in TypeScript/JavaScript files
grep -r "navigate.*to.*\." --include="*.ts" --include="*.tsx" .

# Find files related to a feature
find . -name "*navigate*" -type f

# Search with ripgrep (faster)
rg "useNavigate" --type typescript
```

### Git-Untersuchung

```bash
# Find when a specific line was changed
git blame path/to/file.ts

# See recent changes to a file
git log --oneline -10 path/to/file.ts

# Search commit messages
git log --grep="navigation" --oneline
```

## Testing Best Practices

### Test-Struktur

```javascript
describe('Feature', () => {
  beforeEach(() => {
    // Reset state for each test
    cleanup()
    history = createBrowserHistory()
  })

  test('should handle specific scenario', async () => {
    // Arrange - set up the test conditions
    const router = createRouter(config)

    // Act - perform the action being tested
    await act(async () => {
      navigate({ to: '/target' })
    })

    // Assert - verify the results
    expect(router.state.location.pathname).toBe('/target')
  })
})
```

### Mehrfache Assertions

```javascript
test('navigation should update both path and search', async () => {
  await navigate({ to: '/page', search: { q: 'test' } })

  // Test multiple aspects
  expect(router.state.location.pathname).toBe('/page')
  expect(router.state.location.search).toEqual({ q: 'test' })
  expect(router.state.matches).toHaveLength(2)
})
```

## Architektur-Untersuchungsprozess

### 1. System kartieren

```
User Input → Component → Hook → Core Logic → State → UI
```

Identifiziere jede Schicht und wofür sie verantwortlich ist.

### 2. Abweichungspunkt finden

Verwende Logging, um genau zu identifizieren, wo das erwartete Verhalten abweicht:

```javascript
console.log('Input received:', input)
// ... processing ...
console.log('After step 1:', intermediate)
// ... more processing ...
console.log('Final output:', output) // Is this what we expected?
```

### 3. Annahmen überprüfen

Häufige falsche Annahmen:

- "Dieser Hook gibt die aktuelle Route zurück" (könnte den Komponenten-Kontext zurückgeben)
- "State-Updates sind synchron" (oft asynchron in React)
- "Das hat vorher funktioniert" (prüfe, ob Tests diesen Fall tatsächlich abdeckten)

## Regressions-Untersuchung

### Versionsvergleich

```bash
# Check what changed between versions
git diff v1.120.13..v1.121.34 -- packages/react-router/

# Look for specific changes
git log v1.120.13..v1.121.34 --oneline --grep="navigate"
```

### Probleme eingrenzen

```bash
# Start bisect to find breaking commit
git bisect start
git bisect bad HEAD
git bisect good v1.120.13

# Test each commit until you find the breaking change
```

## Wann stoppen & überdenken

**Höre auf, Code zu ändern, wenn:**

- Dein Fix mehrere existierende Tests zerstört
- Du fundamentale Annahmen änderst
- Die Lösung sich hacky oder übermäßig komplex anfühlt

**Erwäge stattdessen:**

- Eine neue API hinzuzufügen, anstatt bestehendes Verhalten zu ändern
- Das aktuelle Verhalten zu dokumentieren, wenn es tatsächlich korrekt ist
- Einen gezielteren Fix für den spezifischen Anwendungsfall zu erstellen

## Fortgeschrittene Debugging-Techniken

### React DevTools

- Inspiziere den Komponentenbaum, um den Render-Kontext zu verstehen
- Prüfe Props und State auf jeder Ebene
- Verwende den Profiler, um Performance-Probleme zu identifizieren

### Browser DevTools

```javascript
// Add global debugging helpers
window.debugRouter = router
window.debugState = () => console.log(router.state)

// Use conditional breakpoints
if (router.state.location.pathname === '/problematic-route') {
  debugger
}
```

### Test-Isolation

```javascript
// Run only one test to isolate issues
test.only('this specific failing test', () => {
  // ...
})

// Skip problematic tests temporarily
test.skip('temporarily disabled', () => {
  // ...
})
```

## Wichtigste Erkenntnisse

1. **Reproduktion schlägt Theorie** - Ein fehlschlagender Test, der das Problem demonstriert, ist mehr wert als das Problem theoretisch zu verstehen

2. **Bestehende Tests sind Schutz** - Wenn dein Fix viele existierende Tests zerstört, änderst du wahrscheinlich das Falsche

3. **Kontext ist wichtig** - Besonders in React ist es entscheidend zu verstehen, wo Komponenten gerendert werden und auf welchen Kontext sie Zugriff haben

4. **Kleine Änderungen, häufige Validierung** - Mache kleine, gezielte Änderungen und teste jede einzelne, anstatt große Refactorings

5. **Manchmal lautet die Antwort "ändere es nicht"** - Nicht jedes gemeldete Problem benötigt eine Code-Änderung; manchmal ist Dokumentation oder eine neue API die richtige Lösung

---

_Dieser Leitfaden wurde entwickelt während der Untersuchung einer Navigations-Regression in TanStack Router, bei der `navigate({ to: "." })` unerwartet zur Root umgeleitet hat, anstatt auf der aktuellen Route zu bleiben._
