import type { NavItem, FooterData } from './navigation';

export interface HeaderData {
  logoUrl: string;
  logoAlt: string;
  navigation: NavItem[];
}

export interface LayoutData {
  _meta: {
    synced: string;
    source: string;
  };
  header: HeaderData;
  footer: FooterData;
}
