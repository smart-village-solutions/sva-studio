import React from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  StudioConfirmDialog,
  StudioFormSummary,
} from '@sva/studio-ui-react';

import {
  useCategoryEditorController,
  type CategoryEditorProps,
} from './categories.editor-controller.js';
import {
  CategoryDataTypeField,
  CategoryIdentityFields,
  CategoryOptionalFields,
} from './categories.editor-fields.js';

export function CategoryEditor(props: CategoryEditorProps) {
  const state = useCategoryEditorController(props);
  const fields = {
    draft: state.draft,
    errors: state.fieldErrors,
    pending: state.pending,
    pt: props.pt,
    update: state.update,
    control: state.control,
  };
  return (
    <>
      <Dialog open onOpenChange={(open) => !open && !state.pending && props.onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <form noValidate onSubmit={state.submit}>
            <DialogHeader>
              <DialogTitle>
                {props.category ? props.pt('form.editTitle') : props.pt('form.createTitle')}
              </DialogTitle>
              <DialogDescription>{props.pt('form.description')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <CategoryIdentityFields
                {...fields}
                categories={props.categories}
                excluded={state.excluded}
              />
              <CategoryOptionalFields {...fields} />
              <CategoryDataTypeField {...fields} options={state.options} />
              {state.error ? (
                <StudioFormSummary kind="error">{state.error}</StudioFormSummary>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                disabled={state.pending}
                onClick={props.onClose}
              >
                {props.pt('actions.cancel')}
              </Button>
              <Button type="submit" disabled={state.pending}>
                {state.pending ? props.pt('actions.saving') : props.pt('actions.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <StudioConfirmDialog
        open={state.confirmationDraft !== null}
        title={props.pt('cascadeDialog.title')}
        description={props.pt('cascadeDialog.description', { count: state.descendants.size })}
        confirmLabel={props.pt('cascadeDialog.confirm')}
        cancelLabel={props.pt('actions.cancel')}
        confirmDisabled={state.pending}
        cancelDisabled={state.pending}
        onCancel={state.cancelConfirmation}
        onConfirm={state.confirm}
      />
    </>
  );
}
