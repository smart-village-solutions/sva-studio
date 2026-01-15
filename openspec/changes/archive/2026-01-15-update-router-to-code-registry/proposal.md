# Change: Code-Route-Registry für Plugin-Routen

## Why
Das Dateibasierte Routing blockiert Erweiterungen per Package. Eine Code-basierte Route-Registry ermöglicht, Core- und Plugin-Routen programmatisch zu kombinieren.

## What Changes
- Umstellung von File-Router auf Code-Route-Registry
- Einführung eines zentralen Route-Registry-Moduls im Core
- Plugins können eigene Routen als Export bereitstellen

## Impact
- Affected specs: routing
- Affected code: apps/studio Router-Konfiguration, packages/core, packages/plugin-*
