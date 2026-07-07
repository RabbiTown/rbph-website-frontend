export default defineNuxtRouteMiddleware(async to => {
  const status = useSystemStatus();

  if (!status.ref.value) return;

  if (!status.ref.value.maintenance_enabled) {
    if (to.path === '/maintenance') return navigateTo('/transit');
    return;
  }

  if (['/login', '/logout', '/maintenance'].includes(to.path)) return;

  const user = useUser();
  await user.waitUpdate();
  if ((user.ref.value?.urole ?? RbUserRole.User) >= RbUserRole.Admin) return;

  return navigateTo('/maintenance');
});
