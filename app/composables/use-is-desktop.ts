const desktopMinWidths = {
  sm: 640,
  lg: 1024,
} as const;

export function useIsDesktop(breakpoint: keyof typeof desktopMinWidths = 'sm') {
  return useMediaQuery(`(min-width: ${desktopMinWidths[breakpoint]}px)`);
}
