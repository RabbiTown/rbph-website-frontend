export function useNotificationUnread() {
  const count = useState<number>('notification-unread', () => 0);
  const dmCount = useState<number>('notification-unread-dm', () => 0);

  async function refresh() {
    const gameId = useGame().ref.value?.id;
    if (!gameId || !useTeam(false).ref.value) {
      count.value = 0;
      dmCount.value = 0;
      return;
    }
    try {
      const { data } = await useApi().get<NotificationUnreadResponse>(`/games/${gameId}/notifications/unread`);
      count.value = data.count;
      dmCount.value = data.dm_count;
    } catch (error) {
      handleError(error, '获取未读通知数量失败');
    }
  }

  return { count, dmCount, refresh };
}
