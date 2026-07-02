export default defineNuxtRouteMiddleware(async to => {
  if (['/login', '/register', '/logout', '/change-password'].includes(to.path)) return;
  const user = useUser();
  if (!user.ref.value) await user.updateData();
  if (user.ref.value?.must_change_password) {
    return navigateTo(`/change-password?url=${encodeURIComponent(to.fullPath)}`);
  }
});
