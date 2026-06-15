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
  let current: Toast | undefined;
  let currentOptions: DirtyToastOptions | undefined;
  let syncingDirtyToast = false;

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

    const confirmed = window.confirm(currentOptions?.leaveConfirmMessage ?? '修改尚未保存，离开后将放弃这些修改。');
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
      title: options.title ?? '已修改数据',
      description: options.description ?? '修改尚未保存。',
      icon: 'material-symbols:edit-note-outline-rounded',
      color: 'warning',
      duration: Infinity,
      close: false,
      orientation: 'horizontal',
      actions: [
        {
          label: '重置',
          icon: 'material-symbols:restart-alt-rounded',
          color: 'neutral',
          variant: 'soft',
          onClick: () => options.reset(),
        },
        {
          label: '应用',
          icon: 'material-symbols:check-rounded',
          color: 'primary',
          variant: 'solid',
          onClick: async () => {
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
    if (current) toast.remove(current.id);
    current = undefined;
    currentOptions = undefined;
  }

  return {
    show,
    clear,
  };
}
