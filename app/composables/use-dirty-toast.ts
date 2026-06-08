import type { Toast } from '@nuxt/ui/runtime/composables/useToast.js';

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

  function show(options: DirtyToastOptions) {
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
          onClick: () => options.apply(),
        },
      ],
    };

    if (current && toast.toasts.value.find(item => item.id === current?.id)) {
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
