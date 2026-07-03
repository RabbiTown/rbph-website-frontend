let updatePromise: Promise<void> | null = null;

export function useAuthConfig() {
  const state = useState<AuthPreflightConfig | undefined>('auth-config');

  async function refresh(force = false) {
    if (updatePromise) {
      await updatePromise;
      if (!force) return state.value;
    }
    if (state.value && !force) return state.value;

    async function update() {
      const { data } = await useApi().get<AuthPreflightConfig>('/auth/pre-auth');
      state.value = data;
    }

    const promise = update();
    updatePromise = promise;
    try {
      await promise;
    } finally {
      if (updatePromise === promise) updatePromise = null;
    }
    return state.value;
  }

  return { ref: state, refresh };
}
