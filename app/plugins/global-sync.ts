import type { Toast } from '@nuxt/ui/runtime/composables/useToast.js';

export default defineNuxtPlugin(() => {
  const sync = useSync();
  const user = useUser(false);
  const toast = useToast();
  const currency = useCurrency().getAllCurrent();

  let curToast: Toast | undefined = undefined;

  watch(
    user.ref,
    () => {
      if (user.ref.value) {
        if (curToast) toast.remove(curToast.id);
        curToast = toast.add({
          title: '连接同步服务中…',
          description: '请耐心等待',
          color: 'warning',
          icon: 'material-symbols:more-horiz',
          duration: Infinity,
        });

        sync.connect();
      } else {
        sync.disconnect();
      }
    },
    { immediate: true }
  );

  watch(sync.online, newState => {
    let toastData: Omit<Partial<Toast>, 'id'> | undefined = undefined;
    if (newState) {
      toastData = {
        title: '已连接至同步服务',
        description: '数据已同步，欢迎回来。',
        icon: 'material-symbols:sync-rounded',
        color: 'success',
        duration: 3000,
      };
    } else if (user.ref.value) {
      toastData = {
        title: '从同步服务断开',
        description: '正在积极重连中…',
        icon: 'material-symbols:sync-disabled-rounded',
        color: 'warning',
        duration: Infinity,
      };
    }
    if (toastData) {
      if (curToast && toast.toasts.value.find(x => x.id === curToast?.id)) {
        toast.update(curToast.id, toastData);
      } else {
        curToast = toast.add(toastData);
      }
    }
  });

  sync.listen(SyncMessageType.PuzzleSubmitted, ({ data }) => {
    if (user.ref.value?.id !== data.user.id) {
      const action = judgeActionConsts[data.action];
      toast.add({
        title: `队友 ${data.user.name} 向谜题提交了答案`,
        description: `【${data.puzzle.title}】提交结果：${action.name} [${data.answer}]`,
        color: action.color,
        icon: 'material-symbols:person-play-outline-rounded',
        duration: 10000,
      });
    }
  });

  sync.listen(SyncMessageType.PuzzleHintUnlocked, ({ data }) => {
    if (user.ref.value?.id !== data.user.id) {
      if (data.hint.cost_id) {
        const cur = currency.value[data.hint.cost_id];
        console.log(currency.value, data.hint.cost_id);
        console.log(data);
        if (cur) {
          toast.add({
            title: `队友 ${data.user.name} 购买了谜题提示`,
            description: `已花费 ${intPrecString(data.hint.cost_amount, cur.prec)} ${cur?.name} 购买谜题【${data.puzzle.title}】提示【${data.hint.title}】`,
            color: 'success',
            icon: 'i-material-symbols:lock-open-right-outline-rounded',
            duration: 10000,
          });
          return;
        }
      }
      toast.add({
        title: `你的队友 ${data.user.name} 解锁了谜题提示`,
        description: `已解锁谜题【${data.puzzle.title}】提示【${data.hint.title}】`,
        color: 'success',
        icon: 'i-material-symbols:lock-open-right-outline-rounded',
        duration: 10000,
      });
    }
  });

  sync.listen(SyncMessageType.PuzzleUnlocked, ({ data }) => {
    if (data.puzzles.length > 0) {
      toast.add({
        title: `解锁了新的谜题！`,
        actions: data.puzzles.map(puzzle => {
          return {
            icon: 'material-symbols:arrow-forward-rounded',
            label: puzzle.title,
            variant: 'soft',
            to: `/puzzles/${puzzle.id}`,
          };
        }),
        color: 'success',
        icon: 'material-symbols:extension-outline-rounded',
        duration: 10000,
        ui: { actions: 'flex-wrap' },
      });
    }
  });
});
