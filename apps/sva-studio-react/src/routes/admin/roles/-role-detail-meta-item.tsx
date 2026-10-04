import React from 'react';

export const DetailMetaItem = ({
  label,
  value,
}: Readonly<{
  label: string;
  value: React.ReactNode;
}>) => (
  <div className="space-y-1">
    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
    <dd className="text-sm font-medium text-foreground">{value}</dd>
  </div>
);
