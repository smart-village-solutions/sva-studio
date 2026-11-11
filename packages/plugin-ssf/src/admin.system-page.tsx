/** Root administration keeps installation and template persistence distinct. */
import { SsfSystemContentV2Page } from './admin.content-v2-page.js';
export const SsfSystemConfigurationPage = () => (
  <SsfSystemContentV2Page page="installation-overview" />
);
export const SsfSystemDefaultsPage = () => <SsfSystemContentV2Page page="default-configuration" />;
export const SsfSystemContentPage = () => <SsfSystemContentV2Page page="default-content" />;
