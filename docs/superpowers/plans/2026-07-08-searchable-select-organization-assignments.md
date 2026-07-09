# Searchable Select For Organization Assignments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ersetze die bisherigen nativen Zuweisungs-Dropdowns auf User- und Organisations-Detailseiten durch eine wiederverwendbare `SearchableSelect`-Komponente mit integrierter Filtereingabe.

**Architecture:** Eine kleine lokale UI-Komponente kapselt Trigger, Suchfeld, gefilterte Optionsliste und Auswahlzustand ohne neue Dependency. Die bestehenden Seiten übergeben nur label-/value-Optionen und entfernen die separaten Suchfelder, behalten aber ihre bestehende Zuweisungs- und Mutationslogik.

**Tech Stack:** React 19, TypeScript strict, Vitest, Testing Library, bestehende lokale UI-Bausteine (`Button`, `Input`, `Card`)

---

### Task 1: SearchableSelect-Komponente testgetrieben einführen

**Files:**
- Create: `apps/sva-studio-react/src/components/ui/searchable-select.tsx`
- Create: `apps/sva-studio-react/src/components/ui/searchable-select.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('filters options inside the open dropdown and selects a value', async () => {
  render(
    <SearchableSelect
      label="Organisation"
      value=""
      placeholder="Bitte wählen"
      searchPlaceholder="Suchen"
      emptyText="Keine Treffer"
      options={[
        { value: 'org-1', label: 'Musterstadt' },
        { value: 'org-2', label: 'Stadtwerke' },
      ]}
      onValueChange={onValueChange}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: 'Organisation' }));
  fireEvent.change(screen.getByPlaceholderText('Suchen'), { target: { value: 'stadtw' } });
  fireEvent.click(screen.getByRole('option', { name: 'Stadtwerke' }));

  expect(onValueChange).toHaveBeenCalledWith('org-2');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/sva-studio-react && npx vitest run src/components/ui/searchable-select.test.tsx`
Expected: FAIL because `searchable-select.tsx` does not exist yet

- [ ] **Step 3: Write minimal implementation**

```tsx
export const SearchableSelect = ({ options, value, onValueChange, ...props }: Props) => {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const filtered = options.filter((option) => option.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <Button type="button" onClick={() => setOpen((current) => !current)}>{selected?.label ?? placeholder}</Button>
      {open ? (
        <div>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} />
          {filtered.map((option) => (
            <button key={option.value} role="option" type="button" onClick={() => onValueChange(option.value)}>
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/sva-studio-react && npx vitest run src/components/ui/searchable-select.test.tsx`
Expected: PASS

### Task 2: User-Detailseite auf SearchableSelect umstellen

**Files:**
- Modify: `apps/sva-studio-react/src/routes/admin/users/-user-edit-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/users/use-user-edit-controller.ts`
- Modify: `apps/sva-studio-react/src/routes/admin/users/-user-edit-page.test.tsx`
- Modify: `apps/sva-studio-react/src/i18n/resources/de/admin/users.resources.ts`
- Modify: `apps/sva-studio-react/src/i18n/resources/en/admin/users.resources.ts`

- [ ] **Step 1: Write the failing integration expectation**

```tsx
fireEvent.click(screen.getByRole('button', { name: 'Organisation auswählen' }));
fireEvent.change(screen.getByPlaceholderText('Nach Organisationsname oder Schlüssel filtern'), {
  target: { value: 'Stadtwerke' },
});
fireEvent.click(screen.getByRole('option', { name: 'Stadtwerke (stadtwerke)' }));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/sva-studio-react && npx vitest run src/routes/admin/users/-user-edit-page.test.tsx --config vitest.routes.config.ts`
Expected: FAIL because the page still renders a native `select`

- [ ] **Step 3: Write minimal integration changes**

```tsx
<SearchableSelect
  label={t('admin.users.edit.organizations.selectLabel')}
  value={organizationAssignment.organizationId}
  placeholder={t('admin.users.edit.organizations.selectPlaceholder')}
  searchPlaceholder={t('admin.users.edit.organizations.searchPlaceholder')}
  emptyText={t('admin.users.edit.organizations.empty')}
  options={availableOrganizations.map((organization) => ({
    value: organization.id,
    label: `${organization.displayName} (${organization.organizationKey})`,
  }))}
  onValueChange={(organizationId) =>
    setOrganizationAssignment((current) => ({ ...current, organizationId }))
  }
/>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/sva-studio-react && npx vitest run src/routes/admin/users/-user-edit-page.test.tsx --config vitest.routes.config.ts`
Expected: PASS

### Task 3: Organisations-Detailseite auf SearchableSelect umstellen

**Files:**
- Modify: `apps/sva-studio-react/src/routes/admin/organizations/-organization-detail-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/organizations/-organization-detail-page.test.tsx`
- Modify: `apps/sva-studio-react/src/i18n/resources/de/admin/organizations.resources.ts`
- Modify: `apps/sva-studio-react/src/i18n/resources/en/admin/organizations.resources.ts`

- [ ] **Step 1: Write the failing integration expectation**

```tsx
fireEvent.click(screen.getByRole('button', { name: 'Account' }));
fireEvent.change(screen.getByPlaceholderText('Nach Name, E-Mail oder Kennung suchen'), {
  target: { value: 'zoe' },
});
fireEvent.click(screen.getByRole('option', { name: 'Zoe Zebra <zoe@example.org>' }));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/sva-studio-react && npx vitest run src/routes/admin/organizations/-organization-detail-page.test.tsx --config vitest.routes.config.ts`
Expected: FAIL because the page still renders separate search input plus native `select`

- [ ] **Step 3: Write minimal integration changes**

```tsx
<SearchableSelect
  label={t('admin.organizations.membershipsDialog.accountLabel')}
  value={membershipForm.accountId}
  placeholder={t('admin.organizations.membershipsDialog.accountPlaceholder')}
  searchPlaceholder={t('admin.organizations.membershipsDialog.searchPlaceholder')}
  emptyText={t('admin.organizations.membershipsDialog.emptySelection')}
  options={availableUsers.map((user) => ({ value: user.id, label: formatMembershipUserLabel(user) }))}
  onValueChange={(accountId) => setMembershipForm((current) => ({ ...current, accountId }))}
/>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/sva-studio-react && npx vitest run src/routes/admin/organizations/-organization-detail-page.test.tsx --config vitest.routes.config.ts`
Expected: PASS

### Task 4: Gemeinsame Verifikation

**Files:**
- Test: `apps/sva-studio-react/src/components/ui/searchable-select.test.tsx`
- Test: `apps/sva-studio-react/src/routes/admin/users/-user-edit-page.test.tsx`
- Test: `apps/sva-studio-react/src/routes/admin/organizations/-organization-detail-page.test.tsx`

- [ ] **Step 1: Run targeted UI verification**

Run: `cd apps/sva-studio-react && npx vitest run src/components/ui/searchable-select.test.tsx src/routes/admin/users/-user-edit-page.test.tsx src/routes/admin/organizations/-organization-detail-page.test.tsx --config vitest.routes.config.ts`
Expected: PASS

- [ ] **Step 2: Confirm no follow-up docs are needed**

Die Änderung ist eine lokale UI-Verbesserung ohne Architektur- oder API-Änderung; keine zusätzliche Architekturdoku erforderlich.
