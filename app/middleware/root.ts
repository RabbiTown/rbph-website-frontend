export default defineNuxtRouteMiddleware(async () => {
  const user = useUser();
  await user.waitUpdate();

  if (!user.ref.value) return navigateToLogin();
  if (user.ref.value.urole !== RbUserRole.Root) {
    return abortNavigation(createError({ statusCode: 403, statusMessage: 'No Man Echoes' }));
  }
});
