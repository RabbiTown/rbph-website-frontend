import type { Toast } from '@nuxt/ui/runtime/composables/useToast.js';

export default defineNuxtPlugin(() => {
  const sync = useSync();
  const user = useUser(false);
  const team = useTeam(false);
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

  watch([user.ref, team.ref], (newVal, oldVal) => {
    if (oldVal && oldVal[0]?.id === newVal[0]?.id && oldVal[1]?.id !== newVal[1]?.id) {
      // team updated, while user not updated
      useGame().updateRoundState();
    }
  });

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
    if (useSid().consume(data.sid)) return;

    useCurrency().updateData();

    if (user.ref.value?.id !== data.user.id) {
      const action = judgeActionConsts[data.action];

      if (data.action === RbJudgeAction.FinishGame) {
        toast.add({
          title: h('span', { class: `font-bold text-${action.color}` }, '你的队伍已完赛！'),
          description: h('span', [`队友 ${data.user.name} 向最终谜题提交正确。 [${data.answer}]`]),
          color: 'success',
          icon: action.icon,
          duration: 10000,
        });
        useTeam().updateData();
      } else if (data.solved) {
        toast.add({
          title: `队友 ${data.user.name} 解决了谜题！`,
          description: h('span', [`【${data.puzzle.title}】提交结果：`, h('span', { class: `font-bold text-${action.color}` }, action.name), ` [${data.answer}]`]),
          color: 'success',
          icon: 'material-symbols:person-play-outline-rounded',
          duration: 10000,
        });
      } else {
        toast.add({
          title: `队友 ${data.user.name} 向谜题提交了答案`,
          description: h('span', [`【${data.puzzle.title}】提交结果：`, h('span', { class: `font-bold text-${action.color}` }, action.name), ` [${data.answer}]`]),
          color: action.color,
          icon: 'material-symbols:person-play-outline-rounded',
          duration: 10000,
        });
      }
    }
    if (data.unlocks && data.unlocks.length > 0) {
      toast.add({
        title: `解锁了新的谜题！`,
        actions: data.unlocks.map(puzzle => {
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
      useGame().updateRoundState();
    }
  });

  sync.listen(SyncMessageType.PuzzleHintUnlocked, ({ data }) => {
    if (useSid().consume(data.sid)) return;

    useCurrency().updateData();

    if (user.ref.value?.id !== data.user.id) {
      if (data.hint.cost_id) {
        const cur = currency.value[data.hint.cost_id];
        if (cur) {
          toast.add({
            title: `队友 ${data.user.name} 购买了谜题提示`,
            description: `已花费 ${intPrecString(data.hint.cost_amount, cur.prec)} ${cur?.name} 购买谜题【${data.puzzle.title}】提示【${data.hint.title}】`,
            color: 'success',
            icon: 'material-symbols:lock-open-right-outline-rounded',
            duration: 10000,
          });
          return;
        }
      }
      toast.add({
        title: `你的队友 ${data.user.name} 解锁了谜题提示`,
        description: `已解锁谜题【${data.puzzle.title}】提示【${data.hint.title}】`,
        color: 'success',
        icon: 'material-symbols:lock-open-right-outline-rounded',
        duration: 10000,
      });
    }
  });

  sync.listen(SyncMessageType.TeamInfoUpdated, () => {
    useTeam().updateData();
  });

  sync.listen(SyncMessageType.TeamDisbanded, () => {
    toast.add({
      title: '你所在的队伍已解散',
      description: '人生有梦，各自精彩。',
      color: 'error',
      icon: 'material-symbols:group-off-outline-rounded',
      duration: 10000,
    });
    useTeam().updateData();
  });

  sync.listen(SyncMessageType.TeamSelfKicked, () => {
    toast.add({
      title: '你已被移出所在队伍',
      description: '离开只是新的开始。',
      color: 'warning',
      icon: 'material-symbols:person-remove-outline-rounded',
      duration: 10000,
    });
    useTeam().updateData();
  });

  sync.listen(SyncMessageType.TeamSelfPromoted, () => {
    toast.add({
      title: '你已被设为队长',
      description: '已取得队长权限。',
      color: 'warning',
      icon: 'material-symbols:award-star-outline-rounded',
      duration: 10000,
    });
  });
});
