import { Button, Input, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';

const ContactRow = ({
  labels,
  index,
  contact,
  canRemove,
  onRemove,
}: Readonly<{
  labels: Record<string, string>;
  index: number;
  contact: GenericItemsDetailFormValues['contacts'][number];
  canRemove: boolean;
  onRemove: () => void;
}>) => {
  const { setValue } = useFormContext<GenericItemsDetailFormValues>();
  return (
    <div className="space-y-4 rounded-xl border border-border/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{labels.contactItem}</p>
        {canRemove ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => onRemove()}>
            {labels.remove}
          </Button>
        ) : null}
      </div>
      <StudioFieldGroup columns={2}>
        <StudioField id={`generic-item-contact-first-name-${index}`} label={labels.firstName}>
          <Input
            id={`generic-item-contact-first-name-${index}`}
            value={contact.firstName}
            onChange={(event) =>
              setValue(`contacts.${index}.firstName`, event.target.value, {
                shouldDirty: true,
              })
            }
          />
        </StudioField>
        <StudioField id={`generic-item-contact-last-name-${index}`} label={labels.lastName}>
          <Input
            id={`generic-item-contact-last-name-${index}`}
            value={contact.lastName}
            onChange={(event) =>
              setValue(`contacts.${index}.lastName`, event.target.value, {
                shouldDirty: true,
              })
            }
          />
        </StudioField>
      </StudioFieldGroup>
      <StudioFieldGroup columns={2}>
        <StudioField id={`generic-item-contact-email-${index}`} label={labels.email}>
          <Input
            id={`generic-item-contact-email-${index}`}
            value={contact.email}
            onChange={(event) =>
              setValue(`contacts.${index}.email`, event.target.value, { shouldDirty: true })
            }
          />
        </StudioField>
        <StudioField id={`generic-item-contact-phone-${index}`} label={labels.phone}>
          <Input
            id={`generic-item-contact-phone-${index}`}
            value={contact.phone}
            onChange={(event) =>
              setValue(`contacts.${index}.phone`, event.target.value, { shouldDirty: true })
            }
          />
        </StudioField>
      </StudioFieldGroup>
    </div>
  );
};

export const GenericItemsContentContacts = ({
  labels,
}: Readonly<{ labels: Record<string, string> }>) => {
  const { control } = useFormContext<GenericItemsDetailFormValues>();
  const contactsArray = useFieldArray({ control, name: 'contacts' });
  const contacts = useWatch({ control, name: 'contacts' }) ?? [];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{labels.contacts}</p>
          <p className="text-sm text-muted-foreground">{labels.contactsHelp}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() =>
            contactsArray.append({
              firstName: '',
              lastName: '',
              email: '',
              phone: '',
              fax: '',
              webUrls: [],
            })
          }
        >
          {labels.addContact}
        </Button>
      </div>
      {contacts.map((contact, index) => (
        <ContactRow
          key={contactsArray.fields[index]?.id ?? `fallback-contact-${index}`}
          labels={labels}
          index={index}
          contact={contact}
          canRemove={contacts.length > 1}
          onRemove={() => contactsArray.remove(index)}
        />
      ))}
    </div>
  );
};
