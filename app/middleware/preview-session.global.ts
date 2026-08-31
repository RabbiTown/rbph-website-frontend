function previewRevision(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return;
  const revision = Number(raw);
  return Number.isSafeInteger(revision) && revision > 0 ? String(revision) : undefined;
}

function isPlayerLayout(layout: unknown) {
  return layout === 'game' || layout === 'game-full';
}

export default defineNuxtRouteMiddleware((to, from) => {
  const exiting = useState('frontend-preview-exiting', () => false);
  if (exiting.value) {
    exiting.value = false;
    return;
  }
  if (!isPlayerLayout(to.meta.layout) || to.query.preview !== undefined) return;
  const preview = previewRevision(from.query.preview);
  if (!preview) return;
  return navigateTo({ path: to.path, query: { ...to.query, preview }, hash: to.hash }, { replace: true });
});
