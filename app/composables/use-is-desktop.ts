export function useIsDesktop() {
  // Keep the desktop layout boundary aligned with Tailwind's sm breakpoint.
  return useMediaQuery('(min-width: 640px)');
}
