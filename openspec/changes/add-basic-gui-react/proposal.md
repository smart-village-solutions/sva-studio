# Change: Add Basic GUI Shell in React

## Why
The CMS needs a foundational UI shell that can serve as the host application container. This shell provides the layout infrastructure (sidebar, header, content area) and integrates with the SDK registries for navigation, theming, and app configuration. Without this, plugins have no place to render and the CMS cannot function as an application.

## What Changes
- **NEW:** Basic GUI shell with React implementation (`apps/sva-studio-react/`)
- **NEW:** Root layout component combining sidebar, header, and content area
- **NEW:** Navigation registry integration for dynamic menu items
- **NEW:** Theme and language switcher in header
- **NEW:** User menu in header
- **NEW:** Framework-agnostic UI structure ready for Vue adaptation
- **BREAKING:** Rename `apps/studio/` to `apps/sva-studio-react/` to clarify framework-specific implementation

## Impact
- Affected specs: `layout`, `navigation`, `header`, `app-config`
- Affected code: `apps/studio/` → `apps/sva-studio-react/`, new SDK integrations
- Enables: Plugin system can now render routes and widgets into the shell
- Dependency: Requires `@cms/sdk`, `@cms/app-config`, `@cms/ui-contracts` packages to exist

## Implementation Order
1. Rename app folder to `sva-studio-react`
2. Implement RootLayout component with sidebar/header/content structure
3. Wire SDK registries for navigation rendering
4. Add theme and language switcher components
5. Add user menu and authentication context
6. Implement CSS module structure for framework independence
