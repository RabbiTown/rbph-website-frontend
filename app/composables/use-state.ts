export async function useUser() {
  const user = useState<RbUser>('user');
  if (user.value) {
    return user;
  }

  try {
    const { data } = await useApi().get<RbUser>('/user/info');
    user.value = data;
  } catch (error) {
    if (getRbErrorCode(error) === -101) {
      navigateTo(`/login?url=${useRoute().path}`);
    }
  }

  return user;
}
