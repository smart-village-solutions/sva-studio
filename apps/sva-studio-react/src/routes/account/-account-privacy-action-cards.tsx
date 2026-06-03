import type { LucideIcon } from 'lucide-react';
import { Ban, Download, FileSearch, Lock, ShieldPlus, Trash2 } from 'lucide-react';

import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { t } from '../../i18n';

type PrivacyActionCardsProps = {
  readonly disabled: boolean;
  readonly onOpenPermissionChange: () => void;
  readonly onOpenAccessDialog: () => void;
  readonly onOpenExportDialog: () => void;
  readonly onOpenObjectionDialog: () => void;
  readonly onOpenDeletionDialog: () => void;
  readonly onOpenRestrictionDialog: () => void;
};

const actionCards = [
  {
    icon: ShieldPlus,
    title: 'account.privacy.cards.permissionChange.title',
    body: 'account.privacy.cards.permissionChange.body',
    cta: 'account.privacy.cards.permissionChange.cta',
    readHandler: (props: PrivacyActionCardsProps) => props.onOpenPermissionChange,
  },
  {
    icon: FileSearch,
    title: 'account.privacy.cards.access.title',
    body: 'account.privacy.cards.access.body',
    cta: 'account.privacy.cards.access.cta',
    readHandler: (props: PrivacyActionCardsProps) => props.onOpenAccessDialog,
  },
  {
    icon: Download,
    title: 'account.privacy.cards.export.title',
    body: 'account.privacy.cards.export.body',
    cta: 'account.privacy.cards.export.cta',
    readHandler: (props: PrivacyActionCardsProps) => props.onOpenExportDialog,
  },
  {
    icon: Ban,
    title: 'account.privacy.cards.objection.title',
    body: 'account.privacy.cards.objection.body',
    cta: 'account.privacy.cards.objection.cta',
    readHandler: (props: PrivacyActionCardsProps) => props.onOpenObjectionDialog,
  },
  {
    icon: Trash2,
    title: 'account.privacy.cards.deletion.title',
    body: 'account.privacy.cards.deletion.body',
    cta: 'account.privacy.cards.deletion.cta',
    readHandler: (props: PrivacyActionCardsProps) => props.onOpenDeletionDialog,
  },
  {
    icon: Lock,
    title: 'account.privacy.cards.restriction.title',
    body: 'account.privacy.cards.restriction.body',
    cta: 'account.privacy.cards.restriction.cta',
    readHandler: (props: PrivacyActionCardsProps) => props.onOpenRestrictionDialog,
  },
] as const satisfies readonly {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly body: string;
  readonly cta: string;
  readonly readHandler: (props: PrivacyActionCardsProps) => () => void;
}[];

export const PrivacyActionCards = (props: Readonly<PrivacyActionCardsProps>) => (
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    {actionCards.map((card) => {
      const Icon = card.icon;

      return (
      <Card key={card.title} className="h-full min-h-[12.5rem]">
        <CardContent className="flex h-full flex-col gap-4 p-4">
          <article className="flex flex-1 flex-col gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/30 text-primary">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <h2 className="pt-2 text-base font-semibold leading-tight text-foreground">{t(card.title)}</h2>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t(card.body)}</p>
            </div>
          </article>
          <Button
            type="button"
            className="mt-auto w-full"
            disabled={props.disabled}
            onClick={card.readHandler(props)}
          >
            {t(card.cta)}
          </Button>
        </CardContent>
      </Card>
      );
    })}
  </div>
);
