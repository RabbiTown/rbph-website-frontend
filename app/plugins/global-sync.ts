import { I18nT } from 'vue-i18n';

export default defineNuxtPlugin(nuxtApp => {
  const t = nuxtApp.$i18n.t;
  const sync = useSync();
  const user = useUser(false);
  const team = useTeam(false);
  const game = useGame();
  const notificationUnread = useNotificationUnread();
  const toast = useToast();
  const currency = useCurrency().getAllCurrent();
  const releaseSync = useGameReleaseSync();
  const systemStatus = useSystemStatus();

  releaseSync.start();

  const syncEnabled = computed(() => {
    const currentUser = user.ref.value;
    const status = systemStatus.ref.value;
    return Boolean(currentUser && !currentUser.must_change_password && (!status?.maintenance_enabled || currentUser.urole >= RbUserRole.Admin));
  });

  watch(syncEnabled, enabled => (enabled ? sync.connect() : sync.disconnect()), { immediate: true });

  watch([user.ref, team.ref], (newVal, oldVal) => {
    if (oldVal && oldVal[0]?.id === newVal[0]?.id && oldVal[1]?.id !== newVal[1]?.id) {
      // team updated, while user not updated
      useGame().updateRoundState();
    }
  });

  watch([game.ref, team.ref], () => notificationUnread.refresh(), { immediate: true });

  watch(sync.online, newState => {
    if (newState) releaseSync.sync();
  });

  sync.listen(SyncMessageType.GameReleaseUpdated, ({ data }) => {
    releaseSync.notify(data.game_id, data.cursor);
  });

  sync.listen(SyncMessageType.SystemStatusUpdated, async () => {
    const status = await systemStatus.refresh(true).catch(() => undefined);
    if (!status) return;

    const currentUser = user.ref.value;
    if (status.maintenance_enabled && (currentUser?.urole ?? RbUserRole.User) < RbUserRole.Admin) {
      await navigateTo('/maintenance');
    } else if (!status.maintenance_enabled && useRoute().path === '/maintenance') {
      await navigateTo('/transit');
    }
  });

  function notificationTitle(notification: TeamNotification) {
    return notification.data.puzzle_id ? `${notification.data.puzzle_title ?? t('ticket.title')} #${notification.data.ticket_id}` : t('message.title');
  }

  function notificationTarget(gameId: number, notification: TeamNotification) {
    return notification.data.puzzle_id ? `/tickets/${notification.data.ticket_id}` : `/games/${gameId}/ticket`;
  }

  async function showNotificationToast(gameId: number, notificationId?: number | null) {
    if (!notificationId) {
      toast.add({
        title: t('globalSync.notification.received'),
        description: t('globalSync.notification.genericReply'),
        icon: 'material-symbols:notifications-outline-rounded',
        color: 'info',
        duration: 10000,
        actions: [{ label: t('globalSync.notification.view'), to: `/games/${gameId}/activity?tab=notifications` }],
      });
      return;
    }

    try {
      const { data: notification } = await useApi().get<TeamNotification>(`/games/${gameId}/notifications/${notificationId}`);
      const title = notificationTitle(notification);
      const actor = notification.actor?.nickname ?? t('common.staff');
      const isPuzzle = Boolean(notification.data.puzzle_id);
      toast.add({
        title,
        description: h(
          I18nT,
          { keypath: 'globalSync.notification.replied', tag: 'span' },
          {
            staff: () => h('span', { class: 'rounded-md bg-warning/10 px-1.5 py-0.5 text-xs font-medium text-warning' }, t('common.staff')),
            actor: () => h('span', actor),
          },
        ),
        icon: isPuzzle ? 'material-symbols:near-me-outline-rounded' : 'material-symbols:mail-outline-rounded',
        color: 'primary',
        duration: 10000,
        actions: [
          {
            icon: 'material-symbols:notifications-outline-rounded',
            label: t('globalSync.notification.view'),
            variant: 'soft',
            to: `/games/${gameId}/activity?tab=notifications`,
          },
          {
            icon: isPuzzle ? 'material-symbols:near-me-outline-rounded' : 'material-symbols:mail-outline-rounded',
            label: title,
            variant: 'soft',
            to: notificationTarget(gameId, notification),
          },
        ],
        ui: { actions: 'flex-wrap' },
      });
    } catch (error) {
      handleError(error, t('globalSync.notification.loadFailed'));
    }
  }

  sync.listen(SyncMessageType.PuzzleSubmitted, ({ data }) => {
    if (useSid().consume(data.sid)) return;

    if (data.currency?.length) {
      useCurrency().setData(data.currency);
    }

    if (user.ref.value?.id !== data.user.id) {
      const action = judgeActionConsts[data.action];
      const currencyPenaltySuffix = formatCurrencyPenaltySuffix(data.currency_penalty);
      const penaltyText = currencyPenaltySuffix ? ` ${currencyPenaltySuffix}` : '';

      if (data.action === RbJudgeAction.FinishGame) {
        toast.add({
          title: h('span', { class: `font-bold text-${action.color}` }, t('globalSync.submission.finishedTitle')),
          description: h('span', [t('globalSync.submission.finishedDescription', { name: data.user.name, answer: data.answer, penalty: penaltyText })]),
          color: 'success',
          icon: action.icon,
          duration: 10000,
        });
        useTeam().updateData();
      } else if (data.solved) {
        toast.add({
          title: t('globalSync.submission.solvedTitle', { name: data.user.name }),
          description: h(
            I18nT,
            { keypath: 'globalSync.submission.resultDescription', tag: 'span', scope: 'global' },
            {
              puzzle: () => data.puzzle.title,
              result: () => h('span', { class: `font-bold text-${action.color}` }, action.name),
              answer: () => data.answer,
              penalty: () => penaltyText,
            },
          ),
          color: 'success',
          icon: 'material-symbols:person-play-outline-rounded',
          duration: 10000,
        });
      } else {
        toast.add({
          title: t('globalSync.submission.submittedTitle', { name: data.user.name }),
          description: h(
            I18nT,
            { keypath: 'globalSync.submission.resultDescription', tag: 'span', scope: 'global' },
            {
              puzzle: () => data.puzzle.title,
              result: () => h('span', { class: `font-bold text-${action.color}` }, action.name),
              answer: () => data.answer,
              penalty: () => penaltyText,
            },
          ),
          color: action.color,
          icon: 'material-symbols:person-play-outline-rounded',
          duration: 10000,
        });
      }
    }
    if (data.unlocks && data.unlocks.length > 0) {
      toast.add({
        title: t('puzzleSubmit.newPuzzleUnlocked'),
        actions: data.unlocks.map(puzzle => {
          return {
            icon: 'material-symbols:arrow-forward-rounded',
            label: puzzle.title,
            variant: 'soft',
            to: gamePuzzleSimpleRoute(useGame().ref.value?.id, puzzle),
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
            title: t('globalSync.hint.purchasedTitle', { name: data.user.name }),
            description: t('globalSync.hint.purchasedDescription', { amount: intPrecString(data.hint.cost_amount, cur.prec), currency: cur.name, puzzle: data.puzzle.title, hint: data.hint.title }),
            color: 'success',
            icon: 'material-symbols:lock-open-right-outline-rounded',
            duration: 10000,
          });
          return;
        }
      }
      toast.add({
        title: t('globalSync.hint.unlockedTitle', { name: data.user.name }),
        description: t('globalSync.hint.unlockedDescription', { puzzle: data.puzzle.title, hint: data.hint.title }),
        color: 'success',
        icon: 'material-symbols:lock-open-right-outline-rounded',
        duration: 10000,
      });
    }
  });

  sync.listen(SyncMessageType.NotificationUpdated, ({ data }) => {
    if (data.game_id !== game.ref.value?.id || team.ref.value?.id !== data.team_id) return;
    notificationUnread.refresh();

    if (data.event === 'created') {
      showNotificationToast(data.game_id, data.notification_id);
    }
  });

  sync.listen(SyncMessageType.TeamInfoUpdated, () => {
    useTeam().updateData();
  });

  sync.listen(SyncMessageType.TeamDisbanded, () => {
    toast.add({
      title: t('globalSync.team.disbandedTitle'),
      description: t('globalSync.team.disbandedDescription'),
      color: 'error',
      icon: 'material-symbols:group-off-outline-rounded',
      duration: 10000,
    });
    useTeam().updateData();
  });

  sync.listen(SyncMessageType.TeamSelfKicked, () => {
    toast.add({
      title: t('globalSync.team.kickedTitle'),
      description: t('globalSync.team.kickedDescription'),
      color: 'warning',
      icon: 'material-symbols:person-remove-outline-rounded',
      duration: 10000,
    });
    useTeam().updateData();
  });

  sync.listen(SyncMessageType.TeamSelfPromoted, () => {
    toast.add({
      title: t('globalSync.team.promotedTitle'),
      description: t('globalSync.team.promotedDescription'),
      color: 'warning',
      icon: 'material-symbols:award-star-outline-rounded',
      duration: 10000,
    });
  });
});
