import { RbConfirmModal } from '#components';

interface DirtyToastOptions {
  title?: string;
  description?: string;
  leaveConfirmMessage?: string;
  guardOnLeave?: boolean;
  apply: () => void | Promise<void>;
  reset: () => void;
}

export function useDirtyToast() {
  const toast = useToast();
  const { t } = useI18n();
  const overlay = useOverlay();
  let resetConfirmation: { close: () => void } | undefined;
  let current: Toast | undefined;
  let currentOptions: DirtyToastOptions | undefined;
  let syncingDirtyToast = false;

  function closeResetConfirmation() {
    resetConfirmation?.close();
    resetConfirmation = undefined;
  }

  function confirmReset() {
    if (!currentOptions || resetConfirmation) return;

    const confirmation = overlay.create(RbConfirmModal, { destroyOnClose: true });
    resetConfirmation = confirmation;
    confirmation.open({
      title: t('dirtyToast.resetConfirmTitle'),
      description: t('dirtyToast.resetConfirmDescription'),
      confirmLabel: t('dirtyToast.reset'),
      confirmColor: 'warning',
      confirmIcon: 'material-symbols:warning-outline-rounded',
      'onUpdate:open': open => {
        if (!open && resetConfirmation === confirmation) resetConfirmation = undefined;
      },
      onConfirm: () => {
        if (resetConfirmation !== confirmation) return;
        closeResetConfirmation();
        currentOptions?.reset();
      },
    });
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
      title: options.title ?? t('dirtyToast.title'),
      description: options.description ?? t('dirtyToast.description'),
      icon: 'material-symbols:edit-note-outline-rounded',
      color: 'warning',
      duration: Infinity,
      close: false,
      orientation: 'horizontal',
      actions: [
        {
          label: t('dirtyToast.reset'),
          icon: 'material-symbols:restart-alt-rounded',
          color: 'neutral',
          variant: 'soft',
          onClick: confirmReset,
        },
        {
          label: t('dirtyToast.apply'),
          icon: 'material-symbols:check-rounded',
          color: 'primary',
          variant: 'solid',
          onClick: async () => {
            closeResetConfirmation();
            await options.apply();
            window.setTimeout(() => {
              if (currentOptions !== options) return;
              current = undefined;
              show(options, true);
            }, 0);
          },
        },
      ],
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
  }

  return {
    show,
    clear,
  };
}
