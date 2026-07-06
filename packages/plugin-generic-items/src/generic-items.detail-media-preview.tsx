export const previewPanelClassName =
  'flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted/20';

export const MediaPreview = ({ alt, url }: Readonly<{ alt: string; url: string }>) => {
  if (url.trim().length > 0) {
    return <img alt={alt} className="h-full w-full object-cover" loading="lazy" src={url} />;
  }

  return <span className="px-4 text-center text-sm text-muted-foreground">{alt}</span>;
};
