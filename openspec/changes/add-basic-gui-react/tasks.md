## 1. Folder Restructuring
- [ ] 1.1 Rename `apps/studio/` to `apps/sva-studio-react/`
- [ ] 1.2 Update references in `nx.json` project configuration
- [ ] 1.3 Update tsconfig paths in `tsconfig.base.json`
- [ ] 1.4 Update all import paths in the project

## 2. Root Layout Component
- [ ] 2.1 Create `apps/sva-studio-react/src/components/layout/RootLayout.tsx`
- [ ] 2.2 Implement flex layout structure (sidebar + header + content)
- [ ] 2.3 Add Outlet for plugin routes
- [ ] 2.4 Create CSS module for layout styles (framework-agnostic)
- [ ] 2.5 Export RootLayout from layout index

## 3. Sidebar Component
- [ ] 3.1 Create `apps/sva-studio-react/src/components/sidebar/Sidebar.tsx`
- [ ] 3.2 Integrate `navigationRegistry.getItems()` from SDK
- [ ] 3.3 Implement expanded/collapsed state
- [ ] 3.4 Create `SidebarToggle.tsx` for collapse button
- [ ] 3.5 Create `SidebarNav.tsx` for recursive menu rendering
- [ ] 3.6 Style sidebar with Tailwind (using design tokens from ui-contracts)

## 4. Header Component
- [ ] 4.1 Create `apps/sva-studio-react/src/components/header/Header.tsx`
- [ ] 4.2 Create `SearchBar.tsx` component
- [ ] 4.3 Create `LanguageSelector.tsx` component (integrate with app-config)
- [ ] 4.4 Create `ThemeToggle.tsx` component (light/dark mode)
- [ ] 4.5 Create `UserMenu.tsx` component (profile, logout)
- [ ] 4.6 Style header with Tailwind

## 5. Content Area Component
- [ ] 5.1 Create `apps/sva-studio-react/src/components/layout/ContentArea.tsx`
- [ ] 5.2 Implement scrollable content container
- [ ] 5.3 Add breadcrumb support (optional)
- [ ] 5.4 Style with layout-aware CSS

## 6. Root Route Integration
- [ ] 6.1 Update `apps/sva-studio-react/src/routes/root.tsx` to use RootLayout
- [ ] 6.2 Ensure RootLayout wraps all child routes
- [ ] 6.3 Create default dashboard/home route

## 7. SDK & Dependencies
- [ ] 7.1 Ensure `@cms/sdk` exports NavigationRegistry
- [ ] 7.2 Ensure `@cms/app-config` provides theme/language config
- [ ] 7.3 Update `apps/sva-studio-react/package.json` with correct dependencies
- [ ] 7.4 Add `@cms/ui-contracts` to design token imports

## 8. Testing & Validation
- [ ] 8.1 Test sidebar toggle (expand/collapse)
- [ ] 8.2 Test navigation rendering from registry
- [ ] 8.3 Test theme switcher
- [ ] 8.4 Test language selector
- [ ] 8.5 Test responsive layout on mobile
- [ ] 8.6 Verify no framework-specific logic leaks to SDK

## 9. Documentation
- [ ] 9.1 Update README.md with new folder structure
- [ ] 9.2 Document layout component props and composition
- [ ] 9.3 Add component storybook entries (if applicable)
