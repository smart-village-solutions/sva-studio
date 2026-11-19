import { formatDateTimeInEditorTimeZone } from '@sva/plugin-sdk';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  StudioTableValueAction,
} from '@sva/studio-ui-react';

import type { Translator } from './categories.page-support.js';
import type { CategoryManagementItem } from './categories.types.js';

const detailEntries = (category: CategoryManagementItem, pt: Translator) => {
  const unavailable = pt('values.notAvailable');
  return [
    ['id', pt('fields.id'), category.id],
    ['icon', pt('fields.icon'), category.iconName ?? unavailable],
    ['email', pt('fields.email'), category.email ?? unavailable],
    [
      'createdAt',
      pt('fields.createdAt'),
      formatDateTimeInEditorTimeZone(category.createdAt) ?? unavailable,
    ],
    [
      'updatedAt',
      pt('fields.updatedAt'),
      formatDateTimeInEditorTimeZone(category.updatedAt) ?? unavailable,
    ],
  ] as const;
};

/**
 * Read-only metadata that is intentionally kept out of the primary table.
 * The category name is the dialog trigger, so the table gains no extra action column width
 * and focus returns to the name when the dialog closes.
 */
export function CategoryDetailsDialog({
  category,
  pt,
}: Readonly<{
  category: CategoryManagementItem;
  pt: Translator;
}>) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <StudioTableValueAction
          emphasis="primary"
          aria-label={pt('detailsDialog.trigger', { name: category.name })}
        >
          {category.name}
        </StudioTableValueAction>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pt('detailsDialog.title', { name: category.name })}</DialogTitle>
          <DialogDescription>{pt('detailsDialog.description')}</DialogDescription>
        </DialogHeader>
        <dl className="grid gap-4 py-4 text-sm sm:grid-cols-2">
          {detailEntries(category, pt).map(([key, label, value]) => (
            <div key={key} className="min-w-0">
              <dt className="font-medium text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-words text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              {pt('actions.close')}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
