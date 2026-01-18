export interface NavigationItem {
  id: string;
  label: string;
  icon?: string;
  route?: string;
  children?: NavigationItem[];
  requiredCapability?: string;
}

export interface NavigationRegistry {
  getItems(): NavigationItem[];
  registerItem(item: NavigationItem): void;
}

// Demo implementation for PoC
class NavigationRegistryImpl implements NavigationRegistry {
  private items: NavigationItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: '🏠',
      route: '/',
    },
    {
      id: 'content',
      label: 'Inhalte',
      icon: '📝',
      children: [
        {
          id: 'pages',
          label: 'Seiten',
          route: '/pages',
        },
        {
          id: 'news',
          label: 'Nachrichten',
          route: '/news',
        },
      ],
    },
    {
      id: 'settings',
      label: 'Einstellungen',
      icon: '⚙️',
      route: '/settings',
    },
  ];

  getItems(): NavigationItem[] {
    return this.items;
  }

  registerItem(item: NavigationItem): void {
    this.items.push(item);
  }
}

export const navigationRegistry = new NavigationRegistryImpl();
