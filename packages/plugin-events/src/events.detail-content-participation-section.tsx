import { useEffect } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Checkbox, StudioDetailCard, StudioField } from '@sva/studio-ui-react';

import type { EventsDetailFormValues } from './events.detail-form.js';
import {
  ContentInput,
  type EventsContentTranslator as Translator,
} from './events.detail-content-section-fields.js';
import { isValidMaximumAttendees } from './events.validation.js';

const dirty = { shouldDirty: true } as const;
const registrationId = 'event-registration-required';
export const EVENT_MAXIMUM_ATTENDEES_FIELD_ID = 'event-maximum-attendees';

const isValidLimitInput = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length === 0 || isValidMaximumAttendees(Number(trimmed));
};

export function EventsParticipationSection({ pt }: Readonly<{ pt: Translator }>) {
  const {
    control,
    clearErrors,
    formState: { errors },
    setValue,
  } = useFormContext<EventsDetailFormValues>();
  const registrationRequired = useWatch({ control, name: 'content.registrationRequired' }) ?? false;
  const maximumAttendees = useWatch({ control, name: 'content.maximumAttendees' }) ?? '';
  const limitError = errors.content?.maximumAttendees;
  const limitValid = isValidLimitInput(maximumAttendees);

  useEffect(() => {
    if (limitValid) clearErrors('content.maximumAttendees');
  }, [clearErrors, limitValid]);

  return (
    <StudioDetailCard
      title={pt('participation.title')}
      description={pt('participation.description')}
    >
      <StudioField
        id={registrationId}
        label={pt('fields.registrationRequired')}
        description={pt('fields.registrationRequiredHelp')}
        controlProps={{
          id: registrationId,
          'aria-describedby': `${registrationId}-description`,
        }}
      >
        <Checkbox
          id={registrationId}
          checked={registrationRequired}
          onChange={(event) =>
            setValue('content.registrationRequired', event.target.checked, dirty)
          }
        />
      </StudioField>
      <ContentInput
        id={EVENT_MAXIMUM_ATTENDEES_FIELD_ID}
        label={pt('fields.maximumAttendees')}
        description={pt('fields.maximumAttendeesHelp')}
        type="number"
        value={maximumAttendees}
        ariaInvalid={limitError ? true : undefined}
        error={limitError ? pt('validation.maximumAttendees') : undefined}
        onChange={(value) => setValue('content.maximumAttendees', value, dirty)}
      />
    </StudioDetailCard>
  );
}
