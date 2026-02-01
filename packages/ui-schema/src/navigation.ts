export interface NavChild {
  label: string;
  href: string;
}

export interface NavItem {
  label: string;
  href: string;
  children?: NavChild[];
}

export interface FooterColumn {
  title: string;
  links: Array<{ label: string; href: string }>;
}

export interface FooterData {
  columns: FooterColumn[];
  copyright: string;
  socialLinks: Array<{ platform: string; url: string; icon: string }>;
  logoUrl?: string;
}
