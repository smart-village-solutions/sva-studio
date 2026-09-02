import type { KeyboardEvent } from 'react';

const getOptionButtons = (listbox: HTMLDivElement | null): HTMLButtonElement[] =>
  Array.from(listbox?.querySelectorAll<HTMLButtonElement>('button[role="option"]') ?? []);

export const focusBoundaryOption = (listbox: HTMLDivElement | null, last: boolean): void => {
  const options = getOptionButtons(listbox);
  options[last ? options.length - 1 : 0]?.focus();
};

const moveOptionFocus = (event: KeyboardEvent<HTMLDivElement>): void => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const options = getOptionButtons(event.currentTarget);
  const currentIndex = options.indexOf(document.activeElement as HTMLButtonElement);
  if (currentIndex < 0 || options.length === 0) return;
  event.preventDefault();
  const offset = event.key === 'ArrowDown' ? 1 : -1;
  options[(currentIndex + offset + options.length) % options.length]?.focus();
};

export const handleListboxKeyDown = (
  event: KeyboardEvent<HTMLDivElement>,
  onClose: () => void
): void => {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    onClose();
    return;
  }
  moveOptionFocus(event);
};
