import React from 'react';

import { t } from '../i18n';
import { STUDIO_BRANDING_PROFILES, type StudioBranding } from '../lib/studio-branding';

const StudioBrandingContext = React.createContext<StudioBranding>('sva-studio');

export const StudioBrandingProvider = ({
  branding,
  children,
}: Readonly<{
  branding: StudioBranding;
  children: React.ReactNode;
}>) => <StudioBrandingContext.Provider value={branding}>{children}</StudioBrandingContext.Provider>;

export const useStudioBranding = () => {
  const branding = React.useContext(StudioBrandingContext);
  const profile = STUDIO_BRANDING_PROFILES[branding];

  return {
    branding,
    profile,
    appName: t(profile.appNameKey),
  } as const;
};
