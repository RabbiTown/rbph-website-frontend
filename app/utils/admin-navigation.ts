import type { NavigationMenuItem } from '@nuxt/ui';

const gameSections = [
  { section: '', value: 'dashboard', label: 'admin.common.basicSettings', icon: 'material-symbols:space-dashboard-outline-rounded' },
  { section: 'features', value: 'features', label: 'admin.common.gameFeatures', icon: 'material-symbols:tune-rounded' },
  { section: 'puzzles', value: 'puzzles', label: 'admin.common.puzzleManagement', icon: 'material-symbols:extension-outline-rounded' },
  { section: 'teams', value: 'teams', label: 'admin.common.teamManagement', icon: 'material-symbols:groups-2-outline-rounded' },
  { section: 'announcements', value: 'announcements', label: 'admin.common.gameAnnouncements', icon: 'material-symbols:campaign-outline-rounded' },
  { section: 'frontend', value: 'frontend', label: 'admin.frontend.title', icon: 'material-symbols:palette-outline' },
] as const;

export function adminTabPath(path: string): string | undefined {
  const normalized = path.replace(/\/$/, '');
  for (const section of ['users', 'announcements', 'logs', 'settings']) {
    const target = `/admin/${section}`;
    if (normalized === target || normalized.startsWith(`${target}/`)) return target;
  }
  const match = normalized.match(/^\/admin\/games\/(\d+)(?:\/([^/]+)(?:\/.*)?)?$/);
  if (!match) return;
  const [, gameId, section = ''] = match;
  const target = section === 'rounds' ? 'puzzles' : section;
  if (!gameSections.some(item => item.section === target)) return;
  return `/admin/games/${gameId}${target ? `/${target}` : ''}`;
}

export function buildAdminGameNavigation(gameId: number, path: string, t: (key: string) => string): NavigationMenuItem[] {
  const activeTab = adminTabPath(path);
  return gameSections.map(item => {
    const to = `/admin/games/${gameId}${item.section ? `/${item.section}` : ''}`;
    return {
      value: `admin-game-${item.value}`,
      label: t(item.label),
      icon: item.icon,
      to,
      exact: item.section === '',
      active: activeTab === to,
    };
  });
}

export function resolveAdminGameSelection(path: string, gameIds: number[], currentId?: number, rememberedId?: number): number | undefined {
  const routeId = path.match(/^\/admin\/games\/(\d+)(?:\/|$)/)?.[1];
  if (routeId !== undefined) {
    const id = Number(routeId);
    return gameIds.includes(id) ? id : undefined;
  }
  for (const id of [currentId, rememberedId]) {
    if (id !== undefined && gameIds.includes(id)) return id;
  }
  return gameIds[0];
}
