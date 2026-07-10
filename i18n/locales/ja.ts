export default defineI18nLocale(() => ({
  activityLog: {
    currencyChangedByPuzzle: (ctx: { named: (key: string) => unknown }) => {
      const puzzle = String(ctx.named('puzzle') ?? '');
      return puzzle ? `「${puzzle}」によって通貨が変動しました` : '問題によって通貨が変動しました';
    },
    cooldownSeconds: '解答送信のクールダウン：{seconds}秒',
    cooldownUntil: '{time}まで解答を送信できません',
    submissionDetail: '判定結果：{result}{consequences}{feedback}',
    consequenceGroup: '（{text}）',
    submissionPenalty: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      return actor ? `${actor} が誤答ペナルティを受けました` : '誤答ペナルティ';
    },
    currencyDetail: (ctx: { named: (key: string) => unknown }) => {
      const change = String(ctx.named('change') ?? '');
      const balance = String(ctx.named('balance') ?? '');
      return `変動：${change}${balance ? `、残高：${balance}` : ''}`;
    },
    teamCreated: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      const team = String(ctx.named('team') ?? '');
      const target = team ? `「${team}」` : 'チーム';
      return actor ? `${actor} が${target}を作成しました` : `${target}を作成しました`;
    },
    teamUpdated: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      return actor ? `${actor} がチーム情報を更新しました` : 'チーム情報を更新しました';
    },
    teamDisbanded: (ctx: { named: (key: string) => unknown }) => {
      const team = String(ctx.named('team') ?? '');
      const teamId = String(ctx.named('teamId') ?? '');
      return team ? `チーム「${team}」を解散しました` : teamId ? `チーム #${teamId} を解散しました` : 'チームを解散しました';
    },
    teamAccessChanged: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      const value = ctx.named('changes');
      const changes = Array.isArray(value) && value.length ? value.map(String).join('、') : '';
      const action = changes ? `権限を変更しました：${changes}` : 'チーム権限を変更しました';
      return actor ? `${actor} が${action}` : action;
    },
    memberJoined: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      return actor ? `${actor} がチームに参加しました` : 'チームに参加しました';
    },
    memberLeft: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      return actor ? `${actor} がチームを脱退しました` : 'チームを脱退しました';
    },
    memberKicked: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      const target = String(ctx.named('target') ?? '');
      return actor ? (target ? `${actor} が ${target} をチームから外しました` : `${actor} がメンバーを外しました`) : target ? `${target} をチームから外しました` : 'メンバーを外しました';
    },
    memberPromoted: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      const target = String(ctx.named('target') ?? '');
      return actor ? (target ? `${actor} が ${target} をリーダーに任命しました` : `${actor} がリーダーを変更しました`) : target ? `${target} をリーダーに任命しました` : 'リーダーを変更しました';
    },
    submittedAnswer: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      const puzzle = String(ctx.named('puzzle') ?? '');
      const answer = String(ctx.named('answer') ?? '');
      const suffix = answer ? ` [${answer}]` : '';
      const target = puzzle ? `「${puzzle}」` : '問題';
      return actor ? `${actor} が${target}に解答を送信しました${suffix}` : `${target}に解答を送信しました${suffix}`;
    },
    solvedPuzzle: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      const puzzle = String(ctx.named('puzzle') ?? '');
      const target = puzzle ? `「${puzzle}」` : '問題';
      return actor ? `${actor} が${target}をクリアしました` : `${target}をクリアしました`;
    },
    openedPuzzle: (ctx: { named: (key: string) => unknown }) => {
      const puzzle = String(ctx.named('puzzle') ?? '');
      return puzzle ? `問題「${puzzle}」を公開しました` : '問題を公開しました';
    },
    startedGame: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      return actor ? `${actor} がゲームを開始しました` : 'ゲームを開始しました';
    },
    unlockedHint: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      const hint = String(ctx.named('hint') ?? '');
      const puzzle = String(ctx.named('puzzle') ?? '');
      const hintTarget = hint ? `ヒント「${hint}」` : 'ヒント';
      const puzzleTarget = puzzle ? `問題「${puzzle}」の` : '';
      return actor ? `${actor} が${puzzleTarget}${hintTarget}をアンロックしました` : `${puzzleTarget}${hintTarget}をアンロックしました`;
    },
    spentHint: (ctx: { named: (key: string) => unknown }) => `${String(ctx.named('amount') ?? '')}を消費してヒントをアンロックしました`,
    wrongSubmissionPenalty: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      const puzzle = String(ctx.named('puzzle') ?? '');
      const target = puzzle ? `「${puzzle}」で` : '';
      return actor ? `${actor} が${target}誤答ペナルティを受けました` : `${target}誤答ペナルティ`;
    },
    currencyChange: (ctx: { named: (key: string) => unknown }) => `変動：${String(ctx.named('change') ?? '')}`,
    openedTicket: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      const puzzle = String(ctx.named('puzzle') ?? '');
      const ticketId = String(ctx.named('ticketId') ?? '');
      const ticket = ticketId ? ` #${ticketId}` : '';
      const target = puzzle ? `「${puzzle}」のスタッフヒント${ticket}` : `スタッフヒント${ticket}`;
      return actor ? `${actor} が${target}を開始しました` : `${target}を開始しました`;
    },
    closedTicket: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      const puzzle = String(ctx.named('puzzle') ?? '');
      const ticketId = String(ctx.named('ticketId') ?? '');
      const ticket = ticketId ? ` #${ticketId}` : '';
      const target = puzzle ? `「${puzzle}」のスタッフヒント${ticket}` : `スタッフヒント${ticket}`;
      return actor ? `${actor} が${target}を終了しました` : `${target}を終了しました`;
    },
    purchasedTicketMessage: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      const puzzle = String(ctx.named('puzzle') ?? '');
      const ticketId = String(ctx.named('ticketId') ?? '');
      const ticket = ticketId ? ` #${ticketId}` : '';
      const target = puzzle ? `「${puzzle}」のスタッフヒント${ticket}` : `スタッフヒント${ticket}`;
      return actor ? `${actor} が${target}の有料メッセージを購入しました` : `${target}の有料メッセージを購入しました`;
    },
    access: {
      teamBanned: 'チームを利用停止にしました',
      teamUnbanned: 'チームの利用停止を解除しました',
      teamLocked: 'チームをロックしました',
      teamUnlocked: 'チームのロックを解除しました',
      directMessageBanned: 'メッセージを利用停止にしました',
      directMessageUnbanned: 'メッセージの利用停止を解除しました',
      puzzleTicketBanned: 'スタッフヒントを利用停止にしました',
      puzzleTicketUnbanned: 'スタッフヒントの利用停止を解除しました',
      leaderboardBanned: 'ランキングを利用停止にしました',
      leaderboardUnbanned: 'ランキングの利用停止を解除しました',
    },
  },
  common: {
    cancel: 'キャンセル',
    confirm: '確認',
    allRead: 'すべて既読にする',
    loadMore: 'さらに読み込む',
    language: '言語',
    aiTranslationWarning: 'この言語はAIによって翻訳されているため、内容が正確でない可能性があります。',
    switchLanguageTitle: '{language}に切り替える',
    switchLanguageConfirm: '切り替える',
    loading: '読み込み中',
    noNotifications: '通知はありません',
    required: '必須項目です',
    minLength: '{min}文字以上で入力してください',
    maxLength: '{max}文字以内で入力してください',
    invalidChars: '使用できない文字が含まれています',
    staff: 'スタッフ',
    unread: '未読',
    updatedAt: '更新：{time}',
    createdAt: '作成：{time}',
    unknownStaff: '不明なスタッフ',
    multipleStaff: '複数のスタッフ',
  },
  currency: {
    fallbackName: '通貨',
    currentBalance: '{currency}：{amount}',
    growthPerMinute: '（毎分 {growth}）',
  },
  globalSync: {
    notification: {
      received: '新しい通知',
      genericReply: 'スタッフヒントまたはメッセージに返信がありました。',
      view: '通知を確認',
      replied: '{staff}の{actor}が返信しました。',
      loadFailed: '通知の詳細を取得できませんでした',
    },
    submission: {
      finishedTitle: 'チームがゲームをクリアしました！',
      finishedDescription: 'メンバーの{name}が最終問題に正解しました。[{answer}]{penalty}',
      solvedTitle: 'メンバーの{name}が問題をクリアしました！',
      submittedTitle: 'メンバーの{name}が解答を送信しました',
      resultDescription: '「{puzzle}」の判定結果：{result} [{answer}]{penalty}',
    },
    hint: {
      purchasedTitle: 'メンバーの{name}がヒントを購入しました',
      purchasedDescription: '{amount} {currency}を消費し、「{puzzle}」のヒント「{hint}」を購入しました',
      unlockedTitle: 'メンバーの{name}がヒントをアンロックしました',
      unlockedDescription: '「{puzzle}」のヒント「{hint}」をアンロックしました',
    },
    team: {
      disbandedTitle: '所属チームが解散しました',
      disbandedDescription: '新たな一歩を踏み出しましょう。',
      kickedTitle: 'チームから外されました',
      kickedDescription: '別のチームに参加するか、新しいチームを作成できます。',
      promotedTitle: 'チームリーダーに任命されました',
      promotedDescription: 'リーダー権限を利用できるようになりました。',
    },
  },
  nav: {
    home: 'ホーム',
    puzzles: '問題',
    puzzleRound: '問題エリア',
    joinGame: 'ゲームに参加',
    announcements: 'お知らせ',
    leaderboard: 'ランキング',
    profile: 'プロフィール',
    teamActivity: 'チーム履歴',
    directMessages: 'メッセージ',
    staffInbox: 'メッセージ管理',
    admin: '管理',
    logout: 'ログアウト',
    user: 'ユーザー',
    login: 'ログイン',
  },
  auth: {
    verifyHeadTitle: 'アカウント認証 - RBPH',
    email: 'メールアドレス',
    password: 'パスワード',
    login: 'ログイン',
    register: '登録',
    waitCaptcha: '認証待ち',
    showPassword: 'パスワードを表示',
    hidePassword: 'パスワードを隠す',
    goLogin: 'ログイン画面へ',
    goLoginShort: 'ログイン',
    registrationClosed: '新規登録は停止中です',
    registrationClosedDesc: '現在、新しいユーザーは登録できません。',
    invalidEmail: 'メールアドレスが正しくありません',
    passwordMin: '8文字以上で入力してください',
    passwordMax: '64文字以内で入力してください',
    passwordInvalid: '使用できない文字が含まれています',
    loginSuccess: 'ログインしました',
    loginSuccessDesc: 'まもなく移動します…',
    loginFailed: 'ログインできませんでした',
    loginBadCredentials: 'メールアドレスまたはパスワードが正しくありません。',
    registerSuccess: '登録が完了しました',
    registerSuccessDesc: 'ログイン画面へ移動します…',
    registerFailed: '登録できませんでした',
    registerClosedHint: '新規登録は停止中です。',
    registerInvalid: 'リクエストが正しくありません。',
    registerEmailTaken: 'このメールアドレスは既に使用されています。',
    verifySent: '認証メールを送信しました',
    verifySentDesc: '受信トレイと迷惑メールフォルダーをご確認ください。',
    verifySentBefore: '認証メールは送信済みです',
    verifySentBeforeDesc: '受信トレイと迷惑メールフォルダーを確認するか、運営へお問い合わせください。',
    emailVerified: 'メールアドレスを認証しました',
  },
  maintenance: {
    title: 'メンテナンス中',
    headTitle: 'メンテナンス - RBPH',
    check: '再確認',
    checkFailed: 'メンテナンス状態を確認できませんでした',
  },
  puzzleSubmit: {
    requirements: (ctx: { named: (key: string) => unknown }) => {
      const value = ctx.named('requirements');
      return Array.isArray(value) ? value.map(String).join('、') : '';
    },
    submitting: '解答を送信しています…',
    submittingDesc: 'しばらくお待ちください。',
    invalidAnswer: '解答が正しくありません。',
    duplicatedAnswer: 'この解答は既に送信済みです。',
    notAllowed: '現在、解答を送信できません。',
    newPuzzleUnlocked: '新しい問題がアンロックされました！',
    submitFailed: '送信に失敗しました [{answer}]',
    retryLater: '時間をおいて再度お試しください。',
    cooldown: '再送信まで：{time}',
    remaining: '残り送信回数：{remain}/{max}',
    remainingZero: '残り送信回数：0/{max}',
    blocked: '解答の送信条件を満たしていません',
    solved: 'チームはこの問題をクリア済みです',
    placeholder: '解答を入力',
    submit: '送信',
  },
  puzzle: {
    puzzles: '問題',
    recentSuccessfulSubmissions: '最近の正解',
  },
  submissions: {
    submitter: '送信者',
    content: '解答',
    contentHelp: 'カーソルを合わせると正規化後の解答を表示します',
    result: '結果',
    message: 'メッセージ',
    time: '日時',
    fetchFailed: '送信履歴を取得できませんでした',
    noSuccessfulSubmissions: '正解の送信履歴はありません',
    noSubmissions: '送信履歴はありません',
  },
  judge: {
    resultDisplay: '{action}：{detail}',
    error: '判定エラー',
    errorDesc: '判定中にエラーが発生しました。管理者へお問い合わせください。',
    pending: '判定中',
    pendingDesc: '長時間この状態が続く場合は管理者へお問い合わせください。',
    fail: '不正解',
    failDesc: '追加情報はありません。',
    correct: '正解',
    correctDesc: '問題をクリアしました。',
    milestone: '中間正解',
    milestoneDesc: 'この問題の中間解答です。',
    startGame: 'ゲーム開始',
    startGameDesc: 'チームがゲームを開始しました。',
    easterEgg: '隠し要素',
    easterEggDesc: '隠し要素を見つけました。',
    finishGame: 'ゲームクリア',
    finishGameDesc: '正解です。ゲームクリアおめでとうございます！',
    finishGameLabel: '正解・ゲームクリア',
    recorded: '記録済み',
    submitFailed: '送信失敗',
  },
  errors: {
    serviceUnavailable: '認証サービスを一時的に利用できません。時間をおいて再度お試しください。',
    tooManyRequests: '操作が多すぎます。時間をおいて再度お試しください。',
    captchaUnavailable: '認証サービスを一時的に利用できません。',
    captchaInvalid: '認証に失敗しました。もう一度お試しください。',
    maintenance: 'システムはメンテナンス中です。',
    notFound: '指定されたデータが見つかりません。',
    forbidden: 'この操作を行う権限がありません。',
    unauthorized: 'セッションの有効期限が切れました。再度ログインしてください。',
    internalServerError: '内部エラーが発生しました。管理者へお問い合わせください。',
    passwordChangeRequired: '先に仮パスワードを変更してください。',
  },
  dirtyToast: {
    leaveConfirm: '保存していない変更があります。このページを離れると変更は破棄されます。',
    title: '未保存の変更',
    description: '変更はまだ保存されていません。',
    reset: '元に戻す',
    apply: '適用',
  },
  activity: {
    consequenceList: (ctx: { named: (key: string) => unknown }) => {
      const value = ctx.named('consequences');
      return Array.isArray(value) ? value.map(String).join('、') : '';
    },
    title: 'チーム履歴',
    notifications: '通知',
    change: '変動',
    balance: '残高',
    reasonDetail: '理由：{reason}',
    changeDetail: '変動：{change}',
    balanceDetail: '残高：{balance}',
    teamManagement: 'チーム管理',
    loadFailed: 'チーム履歴を取得できませんでした',
    event: 'イベント',
    automaticGain: '時間経過による自動獲得',
    initialGain: '初期残高',
    noRecords: '履歴はありません',
    staff: 'スタッフ',
    currencyChangeRecords: '{currency}の履歴',
    notUpdated: '未更新',
  },
  notifications: {
    loadFailed: '通知を取得できませんでした',
    markReadFailed: '通知を既読にできませんでした',
  },
  message: {
    title: 'メッセージ',
    needHelp: 'お困りですか？',
    contact: '運営へ問い合わせる',
    sentAt: '送信：{time}',
    teamMember: 'チームメンバー',
    staffMember: 'スタッフ',
    closed: 'この会話は終了しているため、返信できません。',
    pending: '未回答のメッセージが多すぎます。スタッフからの返信をお待ちください。',
    featureClosed: '現在、メッセージ機能は利用できません。',
    featureExistingOnly: '既存の会話にのみ返信できます。',
    teamFeatureBanned: 'このチームはメッセージ機能を利用できません。',
    teamBannedWarning: 'チームは利用停止中ですが、メッセージ機能は利用できます。',
    restrictionDetails: '詳しくは{activity}をご確認ください。',
    replyPlaceholder: 'メッセージを送信',
    sendFailed: 'メッセージを送信できませんでした',
    loadFailed: '会話を取得できませんでした',
    loadEarlierFailed: '以前のメッセージを取得できませんでした',
    updateFailed: '会話を更新できませんでした',
    sentSuccess: 'メッセージを送信しました',
    sentSuccessDesc: 'スタッフからの返信をお待ちください。',
    sendBlockTeam: 'チームのメッセージ機能は無効です。',
    sendBlockPending: '未回答のメッセージが多すぎます。スタッフからの返信をお待ちください。',
    sendBlockType: 'この形式の内容は送信できません。',
    sendBlockLength: 'メッセージが長すぎます。',
    sendBlockCost: 'メッセージの料金設定が正しくありません。',
    sendBlockUnavailable: '現在、メッセージを送信できません。',
    sendBlockBanned: 'このチームはメッセージ機能を利用できません。',
    sendBlockExistingOnly: '既存の会話にのみ返信できます。',
    noAccess: 'この会話ではメッセージを送信できません。',
    notificationReply: '{actor}がメッセージに返信しました',
    notificationReplies: '{actor}が{count}件のメッセージに返信しました',
  },
  ticket: {
    title: 'スタッフヒント',
    contact: 'スタッフに質問する',
    staffMember: 'スタッフ',
    asTeam: 'チームとして',
    asStaff: 'スタッフとして',
    sendAsStaff: 'スタッフとして返信します',
    sentMessage: 'メッセージを送信しました',
    opened: 'スタッフヒントを開始しました',
    closedAction: 'スタッフヒントを終了しました',
    autoClosedSolved: '問題をクリアしたため、スタッフヒントを自動終了しました',
    currencyFallback: '通貨 #{id}',
    noAccess: 'このスタッフヒントには返信できません。',
    closed: 'このスタッフヒントは終了しているため、新しい返信はできません。',
    closedMessage: 'このスタッフヒントは終了しています。',
    pending: 'スタッフからの返信をお待ちください。',
    featureClosed: '現在、スタッフヒントは利用できません。',
    featureExistingOnly: '既存のスタッフヒントにのみ返信できます。',
    teamFeatureBanned: 'このチームはスタッフヒントを利用できません。',
    teamBannedWarning: 'チームは利用停止中ですが、スタッフヒントには返信できます。',
    teamBannedCanRequest: 'チームは利用停止中ですが、スタッフヒントは利用できます。',
    restrictionDetails: '詳しくは{activity}をご確認ください。',
    open: '対応中',
    closedState: '終了',
    unclaimed: '未担当',
    unclaim: '担当解除',
    claim: '自分が担当',
    claimConfirm: 'このスタッフヒントは{name}が担当しています。自分に変更しますか？',
    assigneeAlready: 'このスタッフヒントは{name}が担当しています。このまま返信しますか？',
    repliedByStaff: 'スタッフとして返信しました',
    repliedByTeam: '追加の質問を送信しました',
    repliedByStaffDesc: 'チームがこの返信を確認できます。',
    repliedByTeamDesc: 'スタッフからの返信をお待ちください。',
    replyPlaceholder: '追加で質問する',
    sendFailed: 'スタッフヒントへ送信できませんでした',
    loadFailed: 'スタッフヒントを取得できませんでした',
    loadEarlierFailed: '以前のメッセージを取得できませんでした',
    updateFailed: 'スタッフヒントを更新できませんでした',
    claimFailed: '担当を設定できませんでした',
    unclaimFailed: '担当を解除できませんでした',
    closeFailed: 'スタッフヒントを終了できませんでした',
    unlockFailed: 'メッセージをアンロックできませんでした',
    sentSuccess: 'スタッフヒントを開始しました',
    sentSuccessDesc: 'スタッフからの返信をお待ちください。',
    unlock: 'アンロック',
    unlockCost: 'アンロック：{cost}',
    unlockedCost: 'アンロック済み：{cost}',
    notUnlockedCost: '未アンロック：{cost}',
    unlockMessage: 'このメッセージをアンロックしますか？',
    unlockForTeam: 'このメッセージをチーム向けに無料でアンロックしますか？',
    locked: 'このメッセージはロックされています…',
    loadingEarlier: '以前のメッセージを読み込む',
    noUnlock: '無料',
    pendingOverflow: '未回答のスタッフヒントが多すぎます。返信をお待ちください。',
    staffReplyPlaceholder: 'スタッフヒントに返信',
    claimConflict: '別のスタッフが担当しています。',
    closeConfirm: '{name}が担当しています。このまま返信して終了しますか？',
    closedToast: 'スタッフヒントを終了しました',
    closedToastDesc: 'チームは引き続き履歴を確認できます。',
    unlockedToast: 'メッセージをアンロックしました',
    unlockedToastDesc: 'チームがこのメッセージを確認できるようになりました。',
    insufficientBalance: '残高が不足しています。',
    unavailableOrPurchased: 'このメッセージはまだ公開されていないか、購入済みです。',
    hostClosedTitle: 'スタッフヒントは終了しています。',
    hostClosedDesc: 'スタッフは返信できますが、チームから追加の質問はできません。',
    hostReplyDesc: 'チームの質問に必要な情報を回答してください。',
    invalidRequest: 'リクエストを処理できませんでした。',
    onlyOne: '同時に対応中にできるスタッフヒントは1件までです。',
    puzzleUnavailable: 'この問題ではまだスタッフヒントを利用できません。',
    requestFailed: 'スタッフヒントを開始できませんでした',
    requestedFor: '{team}のスタッフヒントを開始しました',
    requestedForDesc: 'チームへスタッフヒントと通知が届きます。',
    canRequest: 'スタッフヒントを利用できます。',
    canRequestFor: '{team}のスタッフヒントを開始できます。',
    canRequestForDesc: 'スタッフからのメッセージで会話を開始し、チームへ通知します。',
    temporarilyUnavailable: '現在、スタッフヒントを開始できません。',
    disabledForPuzzle: 'この問題ではスタッフヒントが有効になっていません。',
    newRequestUnavailable: '現在、新しいスタッフヒントを開始できません。',
    currentPuzzlePending: 'この問題には対応中のスタッフヒントがあります。下の会話から続けてください。',
    pendingLimit: '対応中のスタッフヒントが上限に達しています。以下のいずれかを終了してください。',
    opensAfter: 'この問題のスタッフヒントは{time}後に利用できます。',
    coolingDown: 'この問題のスタッフヒントはクールダウン中です。',
    requestPlaceholder: '質問内容を入力',
    requestForPlaceholder: '{team}のスタッフヒントを開始',
    staffView: 'スタッフ表示',
    teamView: 'チーム表示',
    ownTeamView: 'チーム表示：{team}',
    staffViewDesc: 'すべてのチームがこの問題で開始したスタッフヒントを表示します。',
    noPuzzleTickets: 'この問題のスタッフヒントはありません',
    selectTeamDesc: 'チームを検索し、スタッフヒントの状態確認や新規開始ができます。',
    teamViewOnly: '所属チームのみ表示できます。',
    selectTeam: 'チームを選択',
    puzzleSolved: 'クリア済み',
    puzzleUnsolved: '未クリア',
    puzzleLocked: '未アンロック',
    notificationReply: '{actor}がスタッフヒントに返信しました',
    notificationReplies: '{actor}がスタッフヒントに{count}件返信しました',
    sendBlockType: 'この形式の内容は送信できません。',
    sendBlockLength: 'メッセージが長すぎます。',
    sendBlockCost: 'メッセージの料金設定が正しくありません。',
    sendBlockExistingOnly: '既存のスタッフヒントにのみ返信できます。',
  },
  hints: {
    title: 'ヒント',
    noHints: 'ヒントはありません',
    noAvailable: '利用できるヒントはありません',
    hiddenTitle: 'このヒントは後で確認できるようになります。',
    getFailed: 'ヒントを取得できませんでした',
    purchaseFailed: 'ヒントを購入できませんでした',
    unlocked: 'ヒントをアンロックしました',
    purchased: 'ヒントを購入しました',
    unlock: 'アンロック',
    waitOver: 'クールダウン終了後に購入できます',
    needMore: 'あと {amount} 必要です',
    insufficientBalance: '残高が不足しています。',
    unavailableOrPurchased: 'このヒントはまだ公開されていないか、購入済みです。',
    purchaseSuccessDesc: '{amount} {currency}を消費してヒント「{title}」を購入しました',
    unlockSuccessDesc: 'ヒント「{title}」をアンロックしました',
  },
  releasePhase: {
    featureState: '{feature}：{state}',
  },
  pages: {
    changePassword: {
      headTitle: '仮パスワードの変更 - RBPH', title: '仮パスワードを変更', description: '続行するには、ご自身のパスワードを設定してください。', newPassword: '新しいパスワード', confirmPassword: '新しいパスワード（確認）', showPassword: 'パスワードを表示', hidePassword: 'パスワードを隠す', submit: '変更', logout: 'ログアウト', passwordSaved: 'パスワードを変更しました', passwordSaveFailed: 'パスワードを変更できませんでした', invalidFormat: 'パスワードの形式が正しくありません', sameAsTemp: '新しいパスワードには仮パスワードと異なるものを指定してください', notRequired: 'このアカウントではパスワードの強制変更は不要です',
    },
    transit: {
      headTitle: 'ゲームを選択 - RBPH', title: 'ゲームを選択', noGames: '公開中のゲームはありません', login: 'ログイン',
    },
    logout: {
      headTitle: 'ログアウト - RBPH', success: 'ログアウトしました', description: 'まもなく移動します…',
    },
    leaderboard: {
      title: 'ランキング', team: 'チーム', finishStatus: 'クリア状況', finished: 'クリア済み', unfinished: '未クリア', solvedCountHeader: 'クリア数', status: '状態',
      solvedCount: (ctx: { named: (key: string) => unknown }) => {
        const count = Number(ctx.named('count') ?? 0);
        return `${Number.isFinite(count) ? count : String(ctx.named('count') ?? '')}問クリア`;
      },
      noSolved: 'クリアした問題はありません', noValidTeams: '表示できるチームはありません', locked: 'ランキングは確定済みです', lockedDesc: '{time}時点のランキングです。以降の解答も有効ですが、順位には反映されません。', lockedDescShort: '以降の解答も有効ですが、順位には反映されません。', updatedAt: '更新：{time}', loadMoreFailed: 'ランキングの続きを取得できませんでした', loadFailed: 'ランキングを取得できませんでした',
    },
    info: {
      title: 'ゲーム情報', announcementsTab: 'お知らせ', phasesTab: 'スケジュール', phaseTitle: 'ゲーム期間', announcementTitle: 'お知らせ', noPhases: '公開中の期間はありません', loginToView: 'ログインするとスケジュールを確認できます', loadFailed: 'お知らせを取得できませんでした',
    },
    contentTest: {
      headTitle: 'コンテンツテスト - RBPH', title: 'コンテンツテスト',
    },
    puzzlePage: {
      puzzle: '問題', hints: 'ヒント', submissions: '送信履歴', tickets: 'スタッフヒント', unlockedAt: 'アンロック：{time}', recentSuccessfulSubmissions: '最近の正解', viewAllSubmissions: 'すべての送信履歴を表示',
    },
    staffInbox: {
      title: 'メッセージ管理', sendDm: 'チームへメッセージ', sessionSelect: '会話一覧', allTypes: 'すべての種類', allStates: 'すべての状態', allMessages: 'すべて', allAssignees: 'すべての担当者', waitingStaff: 'スタッフの返信待ち', waitingTeam: 'チームの返信待ち', handledByMe: '自分が担当', unassigned: '未担当', noMessages: 'メッセージはありません', noMatch: '条件に一致する会話はありません', selectSession: '会話を選択', selectSessionDesc: '一覧からスタッフヒントまたはメッセージを選択してください', openInInbox: '管理画面で開く', replyCurrent: '返信を入力', sendTeamDmTitle: 'チームへメッセージを送信', sendTeamDmDesc: 'チームを選択してメッセージを送信します', searchTeam: 'チーム名を検索', sendConflict: '別のスタッフが担当中です', continueAnyway: 'このまま続行', pendingReply: '返信待ち', dmPlaceholder: 'メッセージを入力', loadListFailed: 'メッセージ一覧を取得できませんでした', loadThreadFailed: '会話を取得できませんでした', loadEarlierFailed: '以前のメッセージを取得できませんでした', updateFailed: '会話を更新できませんでした', replyFailed: '返信できませんでした', sendDmFailed: 'メッセージを送信できませんでした', dmExistingOnly: '新しい会話は開始できません。このチームとの既存の会話にのみ返信できます。', conflictDescription: 'この会話は{name}が担当しています。このまま{action}しますか？', continueReply: '返信を続行', replyAndClose: '返信して終了',
    },
    profile: {
      title: 'プロフィール',
      userInfo: 'ユーザー情報',
      avatar: 'アバター',
      uid: 'UID',
      email: 'メールアドレス',
      username: 'ユーザー名',
      bio: '自己紹介',
      updateUserInfo: 'ユーザー情報を更新',
      currentPassword: '現在のパスワード',
      newPassword: '新しいパスワード',
      confirmPassword: '新しいパスワード（確認）',
      changePassword: 'パスワードを変更',
      teamId: 'チームID',
      teamName: 'チーム名',
      teamPass: 'チームパスワード',
      teamBio: 'チーム紹介',
      saveTeamInfo: 'チーム情報を更新',
      saveTeamInfoBlocked: 'チーム情報を更新できるのはリーダーのみです',
      teamInfoFailed: 'チーム情報を取得できませんでした',
      saveUserFailed: 'ユーザー情報を更新できませんでした',
      saveTeamFailed: 'チーム情報を更新できませんでした',
      teamBanned: 'このチームは参加停止処分を受けています。',
      teamPenalties: (ctx: { named: (key: string) => unknown }) => {
        const value = ctx.named('items');
        const items = Array.isArray(value) ? value.map(String).join('、') : '';
        return `チームの利用制限：${items}。`;
      },
      teamBannedWithPenalties: (ctx: { named: (key: string) => unknown }) => {
        const value = ctx.named('items');
        const items = Array.isArray(value) ? value.map(String).join('、') : '';
        return `このチームは参加停止処分を受けています。追加の利用制限：${items}。`;
      },
      noTeam: 'チームに所属していません',
      noTeamNotice: '参加するには、チームへの加入または作成が必要です。個人で参加する場合もチームを作成してください。',
      teamFormationClosed: 'チーム編成はまだ開始されていません',
      teamFormationUnavailable: '現在、チーム編成は受け付けていません。',
      teamFormationClosedDesc: '開始時刻はスケジュールで確認できます。',
      joinTeam: 'チームに参加',
      createTeam: 'チームを作成',
      disbandTeam: 'チームを解散',
      leaveTeam: 'チームを脱退',
      teamRestriction: 'チームの利用が制限されています',
      disableDirectMessage: 'メッセージ利用停止',
      disablePuzzleTicket: 'スタッフヒント利用停止',
      disableLeaderboard: 'ランキング非表示',
      teamLocked: 'ロック中',
      teamInfo: 'チーム情報',
      teamMembers: 'メンバー',
      kickMemberFailed: 'メンバーを除外できませんでした',
      promoteMemberFailed: 'リーダーを交代できませんでした',
      joinFailed: 'チームに参加できませんでした',
      createFailed: 'チームを作成できませんでした',
      disbandFailed: 'チームを解散できませんでした',
      leaveFailed: 'チームを脱退できませんでした',
      teamSaved: 'チーム情報を更新しました',
      userSaved: 'ユーザー情報を更新しました',
      joinedTeam: 'チームに参加しました',
      createdTeam: 'チームを作成しました',
      leftTeam: 'チームを脱退しました',
      disbandedTeam: 'チームを解散しました',
      passwordMismatch: '新しいパスワードが一致しません',
      promotedMember: '{name}をリーダーに設定しました',
      kickedMember: '{name}をチームから除外しました',
      teamLockedHintDisband: 'ロック中のチームは解散できません',
      teamLockedHintLeave: 'ロック中のチームからは脱退できません',
      leaveDanger: 'この操作は取り消せません。',
      passwordSaved: 'パスワードを変更しました',
      passwordSaveFailed: 'パスワードを変更できませんでした',
      invalidUserInfo: 'ユーザー情報が正しくありません。',
      passwordInvalid: 'パスワードの形式が正しくありません。',
      passwordSame: '新しいパスワードには現在のパスワードと異なるものを指定してください。',
      currentPasswordWrong: '現在のパスワードが正しくありません。',
      noTeamEditPermission: 'チーム情報を更新する権限がありません。',
      disbandUnavailable: '現在、このチームは解散できません。',
      noDisbandPermission: 'チームを解散する権限がありません。',
      leaveNotMember: 'チームから脱退できるのは所属中のメンバーのみです。',
      alreadyCaptain: 'すでにリーダーです。',
      memberLeft: 'このメンバーはすでに脱退しています。',
      noPromotePermission: 'リーダーを交代する権限がありません。',
      cannotKickSelf: '自分自身をチームから除外することはできません。',
      noKickPermission: 'メンバーを除外する権限がありません。',
      promotedMemberFallback: 'メンバーをリーダーに設定しました',
      kickedMemberFallback: 'メンバーをチームから除外しました',
      invalidTeamId: 'チームIDが正しくありません。',
      wrongTeamPassword: 'パスワードが正しくありません。',
      teamFull: 'チームの定員に達しています。',
      teamLockedContact: 'チームはロックされています。スタッフにお問い合わせください。',
      alreadyInTeam: 'すでにチームに所属しています。',
      invalidCredentials: '認証情報が正しくありません。',
      restrictionDetails: '詳しくは{activity}を確認してください。',
    },
  },
  components: {
    syncStatus: {
      connecting: {
        label: '接続中',
        title: '同期サービスに接続中',
        description: 'リアルタイムデータ接続を確立しています。',
      },
      online: {
        label: '接続済み',
        title: '同期サービスに接続しました',
        description: 'リアルタイムデータ同期は正常に動作しています。',
      },
      reconnecting: {
        label: '再接続中',
        title: '同期サービスから切断されました',
        description: '再接続を試みています。',
      },
      limited: {
        label: '接続制限',
        title: '同期接続が置き換えられました',
        description: 'このアカウントは接続数の上限に達しています。再接続すると、別のページの接続が切れることがあります。',
      },
      unsupported: {
        label: '非対応',
        title: 'このブラウザーは同期に対応していません',
        description: 'ブラウザーを更新してから、ページを開き直してください。',
      },
      reconnect: '再接続',
      buttonAria: '同期状態を表示または移動',
      transport: {
        sharedWorker: 'SharedWorker ({count})',
        directWebSocket: 'WebSocketへ直接接続',
        unset: '未設定',
      },
      debug: {
        title: 'デバッグ情報',
        state: '状態',
        transport: '接続方式',
        endpoint: 'エンドポイント',
        clientId: 'Client ID',
        stateChangedAt: '状態変更日時',
        lastClose: '直近の切断',
        closeReason: '切断理由',
        closeAt: '切断日時',
        clean: '正常',
        unclean: '異常',
        unset: '未生成',
        notProvided: '情報なし',
      },
    },
    announcement: {
      allSite: 'サイト全体',
      pinned: '固定',
      goToPuzzle: '問題を開く',
      noAnnouncements: 'お知らせはありません',
      waitForPublish: '主催者からのお知らせはまだありません',
    },
    teamMemberList: {
      captain: 'リーダー',
      you: 'あなた',
      joinedAt: '{time}に参加',
      setCaptain: 'リーダーに設定',
      confirmSetCaptain: '{name}をリーダーに設定しますか？',
      confirm: '確定',
      remove: '除外',
      confirmRemove: '{name}を除外しますか？',
      confirmRemoveDesc: 'この操作は取り消せません。',
      confirmRemoveButton: '除外する',
      lockedRemoveHint: 'メンバーを除外する前にチームのロックを解除してください',
      lastMemberRemoveHint: 'チームには1人以上のメンバーが必要です',
    },
    messageEdit: {
      markdownHint: 'Markdownに対応',
      closeWithReply: '返信して終了',
      closeTicket: '終了',
      send: '送信',
    },
    puzzleContent: {
      invalidType: '対応していないコンテンツ形式です',
    },
  },
}));
