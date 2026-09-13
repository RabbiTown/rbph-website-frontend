import { RbConfirmModal, RbDirtyToastContent } from '#components';

type DirtyToastStatus = 'idle' | 'confirming-reset' | 'resetting' | 'applying';

interface DirtyToastOptions {
  title?: string;
  description?: string;
  leaveConfirmMessage?: string;
  guardOnLeave?: boolean;
  apply: () => void | Promise<void>;
  applyPending?: () => boolean;
  reset: () => void | Promise<void>;
}

export function useDirtyToast() {
  const toast = useToast();
  const { t } = useI18n();
  const overlay = useOverlay();
  let resetConfirmation: { close: () => void } | undefined;
  let current: Toast | undefined;
  let currentOptions: DirtyToastOptions | undefined;
  let syncingDirtyToast = false;
  const status = ref<DirtyToastStatus>('idle');

  function closeResetConfirmation() {
    resetConfirmation?.close();
    resetConfirmation = undefined;
  }

  function confirmReset() {
    if (!currentOptions || resetConfirmation || status.value !== 'idle') return;

    const options = currentOptions;
    const confirmation = overlay.create(RbConfirmModal, { destroyOnClose: true });
    resetConfirmation = confirmation;
    status.value = 'confirming-reset';
    confirmation.open({
      title: t('dirtyToast.resetConfirmTitle'),
      description: t('dirtyToast.resetConfirmDescription'),
      confirmLabel: t('dirtyToast.reset'),
      confirmColor: 'warning',
      confirmIcon: 'material-symbols:warning-outline-rounded',
      'onUpdate:open': open => {
        if (open || resetConfirmation !== confirmation) return;
        resetConfirmation = undefined;
        if (status.value === 'confirming-reset') status.value = 'idle';
      },
      onConfirm: async () => {
        if (resetConfirmation !== confirmation) return;
        status.value = 'resetting';
        closeResetConfirmation();
        try {
          await options.reset();
        } finally {
          if (current && currentOptions === options && status.value === 'resetting') status.value = 'idle';
        }
      },
    });
  }

  async function apply() {
    if (!current || !currentOptions || status.value !== 'idle') return;

    const options = currentOptions;
    closeResetConfirmation();
    status.value = 'applying';
    try {
      await options.apply();
      if (options.applyPending?.()) {
        await new Promise<void>(resolve => {
          const stop = watch([status, options.applyPending!], ([currentStatus, pending]) => {
            if (currentStatus === 'applying' && pending) return;
            stop();
            resolve();
          });
        });
      }
    } finally {
      if (current && currentOptions === options && status.value === 'applying') status.value = 'idle';
    }
  }

  function isGuardEnabled() {
    return Boolean(current && currentOptions?.guardOnLeave);
  }

  function onBeforeUnload(event: BeforeUnloadEvent) {
    if (!isGuardEnabled()) return;

    event.preventDefault();
    event.returnValue = '';
  }

  function confirmLeave() {
    if (!isGuardEnabled()) return true;

    const confirmed = window.confirm(currentOptions?.leaveConfirmMessage ?? t('dirtyToast.leaveConfirm'));
    if (confirmed) {
      currentOptions?.reset();
      clear();
    }

    return confirmed;
  }

  onMounted(() => {
    window.addEventListener('beforeunload', onBeforeUnload);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', onBeforeUnload);
    clear();
  });

  onBeforeRouteLeave(() => confirmLeave());
  onBeforeRouteUpdate(() => confirmLeave());

  watch(
    () => toast.toasts.value.map(item => item.id),
    () => {
      if (syncingDirtyToast || !current || !currentOptions) return;

      const index = toast.toasts.value.findIndex(item => item.id === current?.id);
      if (index === -1) {
        show(currentOptions, true);
        return;
      }

      const lastIndex = toast.toasts.value.length - 1;
      if (index === lastIndex) return;

      syncingDirtyToast = true;
      const [dirtyToast] = toast.toasts.value.splice(index, 1);
      if (dirtyToast) {
        toast.toasts.value = [...toast.toasts.value, dirtyToast];
        current = dirtyToast;
      }

      nextTick(() => {
        syncingDirtyToast = false;
      });
    },
    { flush: 'post' },
  );

  function show(options: DirtyToastOptions, forceAdd = false) {
    currentOptions = options;

    const toastData: Partial<Toast> = {
      title: () => h(RbDirtyToastContent, {
        title: options.title ?? t('dirtyToast.title'),
        description: options.description ?? t('dirtyToast.description'),
        status: status.value,
        resetLabel: t('dirtyToast.reset'),
        applyLabel: t('dirtyToast.apply'),
        onReset: confirmReset,
        onApply: apply,
      }),
      icon: 'material-symbols:edit-note-outline-rounded',
      color: 'warning',
      duration: Infinity,
      close: false,
    };

    if (!forceAdd && current && toast.toasts.value.find(item => item.id === current?.id)) {
      toast.update(current.id, toastData);
    } else {
      current = toast.add(toastData);
    }
  }

  function clear() {
    closeResetConfirmation();
    if (current) toast.remove(current.id);
    current = undefined;
    currentOptions = undefined;
    status.value = 'idle';
  }

  return {
    show,
    clear,
  };
}
