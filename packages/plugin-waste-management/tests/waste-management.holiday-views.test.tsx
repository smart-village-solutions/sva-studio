import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WasteHolidayRulesList } from '../src/waste-management.holiday-rules-list.js';
import { WasteSchedulingHolidayFormView } from '../src/waste-management.scheduling-holiday-form-view.js';

const navigateMock = vi.fn();
const holidayFormSpy = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, variables?: Record<string, string | number>) =>
    variables ? `${key}:${JSON.stringify(variables)}` : key,
}));

vi.mock('@sva/studio-ui-react', () => ({
  Button: ({
    children,
    type = 'button',
    onClick,
    disabled,
  }: React.ComponentProps<'button'>) => (
    <button type={type} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  StudioPageHeader: ({
    title,
    description,
    actions,
  }: {
    readonly title: React.ReactNode;
    readonly description?: React.ReactNode;
    readonly actions?: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      {actions}
    </div>
  ),
}));

vi.mock('../src/waste-management.holiday-rules-form.js', () => ({
  WasteHolidayRuleForm: (props: Record<string, unknown>) => {
    holidayFormSpy(props);
    return <div>holiday-rule-form</div>;
  },
}));

const createBaseSearch = () => ({
  tab: 'scheduling' as const,
  masterDataTab: 'fractions' as const,
  fractionsView: 'list' as const,
  toursView: 'list' as const,
  locationsView: 'list' as const,
  schedulingView: 'edit' as const,
  q: '',
  page: 1,
  pageSize: 25,
  status: 'all' as const,
  shiftContext: 'all' as const,
  fractionsSortBy: 'name' as const,
  fractionsSortDirection: 'asc' as const,
  regionId: undefined,
  cityId: undefined,
  wasteFractionId: undefined,
  tourId: undefined,
  schedulingEntryType: 'holiday-rule' as const,
  schedulingEntryId: 'rule-1',
  tourDateShiftId: undefined,
  globalDateShiftId: undefined,
});

const holidayRule = {
  id: 'rule-1',
  holidayName: 'Pfingstmontag',
  holidayDate: '2026-05-25',
  year: 2026,
  stateCode: 'BB',
  sourceStatus: 'default',
  configurationStatus: 'configured',
  conflictStatus: 'none',
  scope: 'holiday-only' as const,
  strategy: 'advance' as const,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('waste-management holiday views', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    holidayFormSpy.mockReset();
  });

  it('renders the holiday rule list header, empty state, and grouped rules', () => {
    const onSaveRule = vi.fn();
    const { rerender } = render(<WasteHolidayRulesList rules={[]} saving={false} onSaveRule={onSaveRule} />);

    expect(screen.getByText('scheduling.holidayRules.title')).toBeTruthy();
    expect(screen.getByText('scheduling.holidayRules.description')).toBeTruthy();
    expect(screen.getByText('scheduling.holidayRules.empty')).toBeTruthy();

    rerender(<WasteHolidayRulesList rules={[holidayRule]} saving={true} onSaveRule={onSaveRule} />);

    expect(screen.getByText('scheduling.holidayRules.yearHeading:{"value":2026}')).toBeTruthy();
    expect(screen.getByText('Pfingstmontag')).toBeTruthy();
    expect(screen.getByText('holiday-rule-form')).toBeTruthy();
    expect(holidayFormSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        rule: holidayRule,
        saving: true,
        onSave: expect.any(Function),
      })
    );
  });

  it('returns null when the shared holiday edit route references an unknown rule', () => {
    const controller = {
      overview: { holidayRules: [] },
      saving: false,
    };

    const view = render(
      <WasteSchedulingHolidayFormView controller={controller as never} search={createBaseSearch()} />
    );

    expect(view.container.firstChild).toBeNull();
    expect(holidayFormSpy).not.toHaveBeenCalled();
  });

  it('renders the holiday edit form and clears the route state on cancel', () => {
    const controller = {
      overview: { holidayRules: [holidayRule] },
      saving: false,
      setMessage: vi.fn(),
      setLastOutcome: vi.fn(),
      onSaveHolidayRule: vi.fn(),
    };

    render(<WasteSchedulingHolidayFormView controller={controller as never} search={createBaseSearch()} />);

    expect(screen.getByText('scheduling.holidayRules.editTitle')).toBeTruthy();
    expect(
      screen.getByText('scheduling.holidayRules.editDescription:{"value":"Pfingstmontag"}')
    ).toBeTruthy();
    expect(screen.getByText('scheduling.holidayRules.meta:{"value":"2026-05-25 · BB · 2026"}')).toBeTruthy();
    expect(screen.getByText('holiday-rule-form')).toBeTruthy();
    expect(holidayFormSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        rule: holidayRule,
        saving: false,
        onSave: expect.any(Function),
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'scheduling.holidayRules.cancelAction' }));

    expect(controller.setMessage).toHaveBeenCalledWith(null);
    expect(controller.setLastOutcome).toHaveBeenCalledWith(null);
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: expect.objectContaining({
        schedulingView: 'list',
        schedulingEntryType: undefined,
        schedulingEntryId: undefined,
      }),
    });
  });
});
