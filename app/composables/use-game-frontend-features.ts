export function useGameFrontendFeatures() {
  const iconOverrides = useState<Record<string, string>>('game-frontend-icon-overrides', () => ({}));

  return {
    iconOverrides: readonly(iconOverrides),
    icon(key: string, fallback: string) {
      return iconOverrides.value[key] ?? fallback;
    },
    replaceIconOverrides(value: Record<string, string>) {
      iconOverrides.value = value;
    },
  };
}
