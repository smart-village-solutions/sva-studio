import { useId, useState } from 'react';
import {
  isWasteReminderEmailAddress,
  type WasteEmailSubscriptionStatus,
  type WasteEmailSubscriptionSummary,
} from '@sva/waste-management-contracts';
import { Button, Input, Select, StudioField } from '@sva/studio-ui-react';

import type { EmailMonitoringTranslate } from './waste-management.email-monitoring.columns.js';
import { WastePanelTableTopBar } from './waste-management.table-frame.js';

export type EmailMonitoringSelection = {
  page: number;
  status: WasteEmailSubscriptionStatus | '';
  searchEmail: string;
  searchVersion: number;
  selected: WasteEmailSubscriptionSummary | null;
  deliveryPage: number;
  refresh: number;
};

const EmailSearchForm = ({
  pt,
  draftEmail,
  setDraftEmail,
  invalidDraft,
  setInvalidDraft,
  onSubmit,
  onEdit,
}: {
  pt: EmailMonitoringTranslate;
  draftEmail: string;
  setDraftEmail: (value: string) => void;
  invalidDraft: boolean;
  setInvalidDraft: (invalid: boolean) => void;
  onSubmit: (email: string) => void;
  onEdit: () => void;
}) => {
  const emailId = useId();
  return (
    <form
      className="flex max-w-full flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const email = draftEmail.trim();
        if (email.length > 254 || !isWasteReminderEmailAddress(email)) {
          setInvalidDraft(true);
          return;
        }
        onSubmit(email);
      }}
    >
      <StudioField
        id={emailId}
        label={pt('emailMonitoring.emailSearch.label')}
        error={
          invalidDraft ? (
            <span role="status">{pt('emailMonitoring.emailSearch.invalid')}</span>
          ) : undefined
        }
      >
        <Input
          id={emailId}
          type="text"
          inputMode="email"
          value={draftEmail}
          required
          maxLength={254}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={invalidDraft || undefined}
          aria-describedby={invalidDraft ? `${emailId}-error` : undefined}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setDraftEmail(value);
            setInvalidDraft(false);
            onEdit();
          }}
        />
      </StudioField>
      <Button type="submit" variant="secondary" disabled={!draftEmail.trim()}>
        {pt('emailMonitoring.emailSearch.submit')}
      </Button>
    </form>
  );
};

const updateEmailSearch = (
  selection: EmailMonitoringSelection,
  searchEmail: string
): EmailMonitoringSelection => ({
  ...selection,
  searchEmail,
  searchVersion: selection.searchVersion + 1,
  status: '',
  page: 1,
  selected: null,
  deliveryPage: 1,
});

export const MonitoringControls = ({
  pt,
  selection,
  onChange,
}: {
  pt: EmailMonitoringTranslate;
  selection: EmailMonitoringSelection;
  onChange: (selection: EmailMonitoringSelection) => void;
}) => {
  const [draftEmail, setDraftEmail] = useState('');
  const [invalidDraft, setInvalidDraft] = useState(false);
  const status = selection.searchEmail ? 'active' : selection.status;
  const changeStatus = (status: EmailMonitoringSelection['status']) =>
    onChange({ ...selection, status, page: 1, selected: null, deliveryPage: 1 });
  const changeSearch = (email: string) => onChange(updateEmailSearch(selection, email));
  return (
    <WastePanelTableTopBar
      activeFilters={
        <>
          {status ? <span>{pt(`emailMonitoring.states.${status}`)}</span> : null}
          {selection.searchEmail ? <span>{pt('emailMonitoring.emailSearch.applied')}</span> : null}
        </>
      }
      actions={
        <Button
          type="button"
          variant="secondary"
          onClick={() => onChange({ ...selection, refresh: selection.refresh + 1 })}
        >
          {pt('emailMonitoring.refresh')}
        </Button>
      }
    >
      <EmailSearchForm
        pt={pt}
        draftEmail={draftEmail}
        setDraftEmail={setDraftEmail}
        invalidDraft={invalidDraft}
        setInvalidDraft={setInvalidDraft}
        onSubmit={changeSearch}
        onEdit={() => {
          if (selection.searchEmail) changeSearch('');
        }}
      />
      <label className="space-y-2 text-sm font-medium">
        {pt('emailMonitoring.statusFilter')}
        <Select
          value={status}
          disabled={Boolean(selection.searchEmail)}
          onChange={(event) =>
            changeStatus(event.currentTarget.value as EmailMonitoringSelection['status'])
          }
        >
          <option value="">{pt('emailMonitoring.all')}</option>
          {(['pending', 'active', 'unsubscribed', 'expired'] as const).map((value) => (
            <option key={value} value={value}>
              {pt(`emailMonitoring.states.${value}`)}
            </option>
          ))}
        </Select>
      </label>
      <Button
        type="button"
        variant="tertiary"
        disabled={!status && !draftEmail}
        onClick={() => {
          setDraftEmail('');
          setInvalidDraft(false);
          changeSearch('');
        }}
      >
        {pt('filters.reset')}
      </Button>
    </WastePanelTableTopBar>
  );
};
