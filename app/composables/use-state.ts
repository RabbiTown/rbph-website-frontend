export async function useUser(required: boolean = true) {
  const user = useState<RbUser | undefined>('user');
  if (user.value) {
    return user;
  }

  try {
    const { data } = await useApi().get<RbUser>('/user/info');
    user.value = data;
  } catch (error) {
    if (getRbErrorCode(error) === -101 && required) {
      user.value = undefined;
      if (required) {
        navigateTo(`/login?url=${useRoute().path}`);
      }
    }
  }

  return user;
}

export async function useTeam() {
  const team = useState<RbTeam | undefined>('team');
  if (team.value) {
    return team;
  }

  const gameId = useRoute().params.id as string | undefined;
  if (gameId) {
    try {
      const { data } = await useApi().get<RbTeam>(`/games/${gameId}/teams/self`);
      team.value = data;
    } catch (error) {
      if (getRbErrorCode(error) === -104) {
        team.value = undefined;
      }
    }
  }

  return team;
}

export async function resetStates() {
  useState('user').value = undefined;
  useState('team').value = undefined;
}
