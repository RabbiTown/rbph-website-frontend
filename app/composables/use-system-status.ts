export interface SystemStatus {
  registration_open: boolean;
  require_email_verification: boolean;
  maintenance_enabled: boolean;
  maintenance_message?: string;
}

let updatePromise: Promise<void> | null = null;

export function useSystemStatus() {
  const state = useState<SystemStatus | undefined>('system-status');

  async function refresh(force = false) {
    if (updatePromise) {
      await updatePromise;
      if (!force) return state.value;
    }
    if (state.value && !force) return state.value;

    async function update() {
      const { data } = await useApi().get<SystemStatus>('/system/status');
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
