export default defineI18nLocale(() => ({
  activityLog: {
    currencyChangedByPuzzle: (ctx: { named: (key: string) => unknown }) => {
      const puzzle = String(ctx.named('puzzle') ?? '');
      return puzzle ? `Currency changed by “${puzzle}”` : 'Currency changed for a puzzle';
    },
    cooldownSeconds: 'Submission cooldown: {seconds} seconds',
    cooldownUntil: 'Submission cooldown until {time}',
    submissionDetail: 'Submission result: {result}{consequences}{feedback}',
    consequenceGroup: ' ({text})',
    submissionPenalty: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      return actor ? `${actor} received a wrong-answer penalty` : 'Wrong-answer penalty';
    },
    currencyDetail: (ctx: { named: (key: string) => unknown }) => {
      const change = String(ctx.named('change') ?? '');
      const balance = String(ctx.named('balance') ?? '');
      return `Change: ${change}${balance ? `; balance: ${balance}` : ''}`;
    },
    teamCreated: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      const team = String(ctx.named('team') ?? '');
      const target = team ? ` “${team}”` : '';
      return actor ? `${actor} created team${target}` : `Created team${target}`;
    },
    teamUpdated: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      return actor ? `${actor} updated team info` : 'Updated team info';
    },
    teamDisbanded: (ctx: { named: (key: string) => unknown }) => {
      const team = String(ctx.named('team') ?? '');
      const teamId = String(ctx.named('teamId') ?? '');
      return team ? `Disbanded team “${team}”` : teamId ? `Disbanded team #${teamId}` : 'Disbanded team';
    },
    teamAccessChanged: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      const value = ctx.named('changes');
      const changes = Array.isArray(value) && value.length ? value.map(String).join(', ') : '';
      const action = changes ? `changed permissions: ${changes}` : 'changed team permissions';
      return actor ? `${actor} ${action}` : `${action.charAt(0).toUpperCase()}${action.slice(1)}`;
    },
    memberJoined: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      return actor ? `${actor} joined the team` : 'Joined the team';
    },
    memberLeft: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      return actor ? `${actor} left the team` : 'Left the team';
    },
    memberKicked: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      const target = String(ctx.named('target') ?? '');
      return actor ? (target ? `${actor} removed member ${target}` : `${actor} removed a member`) : target ? `Removed member ${target}` : 'Removed a member';
    },
    memberPromoted: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      const target = String(ctx.named('target') ?? '');
      return actor ? (target ? `${actor} set ${target} as captain` : `${actor} changed captain`) : target ? `Set ${target} as captain` : 'Changed captain';
    },
    submittedAnswer: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      const puzzle = String(ctx.named('puzzle') ?? '');
      const answer = String(ctx.named('answer') ?? '');
      const suffix = answer ? ` [${answer}]` : '';
      const target = puzzle ? `“${puzzle}”` : 'a puzzle';
      return actor ? `${actor} submitted an answer to ${target}${suffix}` : `Submitted an answer to ${target}${suffix}`;
    },
    solvedPuzzle: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      const puzzle = String(ctx.named('puzzle') ?? '');
      const target = puzzle ? `“${puzzle}”` : 'a puzzle';
      return actor ? `${actor} solved ${target}` : `Solved ${target}`;
    },
    openedPuzzle: (ctx: { named: (key: string) => unknown }) => {
      const puzzle = String(ctx.named('puzzle') ?? '');
      return puzzle ? `Opened puzzle “${puzzle}”` : 'Opened a puzzle';
    },
    startedGame: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      return actor ? `${actor} started the game` : 'Started the game';
    },
    unlockedHint: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      const hint = String(ctx.named('hint') ?? '');
      const puzzle = String(ctx.named('puzzle') ?? '');
      const hintTarget = hint ? `“${hint}”` : 'a hint';
      const puzzleTarget = puzzle ? ` for puzzle “${puzzle}”` : '';
      return actor ? `${actor} unlocked ${hintTarget}${puzzleTarget}` : `Unlocked ${hintTarget}${puzzleTarget}`;
    },
    spentHint: (ctx: { named: (key: string) => unknown }) => `Spent ${String(ctx.named('amount') ?? '')} to unlock hint`,
    wrongSubmissionPenalty: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      const puzzle = String(ctx.named('puzzle') ?? '');
      const target = puzzle ? ` in “${puzzle}”` : '';
      return actor ? `${actor} received a wrong-answer penalty${target}` : `Wrong-answer penalty${target}`;
    },
    currencyChange: (ctx: { named: (key: string) => unknown }) => `Change: ${String(ctx.named('change') ?? '')}`,
    openedTicket: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      const puzzle = String(ctx.named('puzzle') ?? '');
      const ticketId = String(ctx.named('ticketId') ?? '');
      const ticket = ticketId ? ` #${ticketId}` : '';
      const target = puzzle ? ` for “${puzzle}”` : '';
      return actor ? `${actor} opened ticket${ticket}${target}` : `Opened ticket${ticket}${target}`;
    },
    closedTicket: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      const puzzle = String(ctx.named('puzzle') ?? '');
      const ticketId = String(ctx.named('ticketId') ?? '');
      const ticket = ticketId ? ` #${ticketId}` : '';
      const target = puzzle ? ` for “${puzzle}”` : '';
      return actor ? `${actor} closed ticket${ticket}${target}` : `Closed ticket${ticket}${target}`;
    },
    purchasedTicketMessage: (ctx: { named: (key: string) => unknown }) => {
      const actor = String(ctx.named('actor') ?? '').trim();
      const puzzle = String(ctx.named('puzzle') ?? '');
      const ticketId = String(ctx.named('ticketId') ?? '');
      const ticket = ticketId ? ` #${ticketId}` : '';
      const target = puzzle ? ` for “${puzzle}”` : '';
      return actor ? `${actor} purchased a paid message in ticket${ticket}${target}` : `Purchased a paid message in ticket${ticket}${target}`;
    },
    access: {
      teamBanned: 'banned the team',
      teamUnbanned: 'unbanned the team',
      teamLocked: 'locked the team',
      teamUnlocked: 'unlocked the team',
      directMessageBanned: 'banned messages',
      directMessageUnbanned: 'unbanned messages',
      puzzleTicketBanned: 'banned puzzle tickets',
      puzzleTicketUnbanned: 'unbanned puzzle tickets',
      leaderboardBanned: 'banned leaderboard access',
      leaderboardUnbanned: 'unbanned leaderboard access',
    },
  },
  common: {
    cancel: 'Cancel',
    confirm: 'Confirm',
    allRead: 'Mark all as read',
    loadMore: 'Load more',
    language: 'Language',
    aiTranslationWarning: 'This language was translated by AI and may contain inaccuracies.',
    switchLanguageTitle: 'Switch to {language}',
    switchLanguageConfirm: 'Continue',
    loading: 'Loading',
    noNotifications: 'No notifications',
    required: 'This field is required',
    minLength: 'Use at least {min} characters',
    maxLength: 'Use no more than {max} characters',
    invalidChars: 'Contains invalid characters',
    staff: 'Staff',
    unread: 'Unread',
    updatedAt: 'Updated at {time}',
    createdAt: 'Created at {time}',
    unknownStaff: 'Unknown staff member',
    multipleStaff: 'Multiple staff members',
  },
  currency: {
    fallbackName: 'Currency',
    currentBalance: '{currency}: {amount}',
    growthPerMinute: '({growth}/min)',
  },
  globalSync: {
    notification: {
      received: 'New notification',
      genericReply: 'Staff replied to a ticket or message.',
      view: 'Notifications',
      replied: '{staff} {actor} replied.',
      loadFailed: 'Failed to load notification details',
    },
    submission: {
      finishedTitle: 'Your team finished the game!',
      finishedDescription: 'Your teammate {name} submitted a correct answer to the final puzzle. [{answer}]{penalty}',
      solvedTitle: 'Your teammate {name} solved a puzzle!',
      submittedTitle: 'Your teammate {name} submitted an answer',
      resultDescription: 'Result for “{puzzle}”: {result} [{answer}]{penalty}',
    },
    hint: {
      purchasedTitle: 'Your teammate {name} purchased a puzzle hint',
      purchasedDescription: 'Spent {amount} {currency} on hint “{hint}” for puzzle “{puzzle}”',
      unlockedTitle: 'Your teammate {name} unlocked a puzzle hint',
      unlockedDescription: 'Unlocked hint “{hint}” for puzzle “{puzzle}”',
    },
    team: {
      disbandedTitle: 'Your team was disbanded',
      disbandedDescription: 'Every ending is a new beginning.',
      kickedTitle: 'You were removed from your team',
      kickedDescription: 'Leaving is a new beginning.',
      promotedTitle: 'You are now the team captain',
      promotedDescription: 'You now have captain permissions.',
    },
  },
  nav: {
    home: 'Home',
    puzzles: 'Puzzles',
    puzzleRound: 'Puzzle round',
    joinGame: 'Join game',
    announcements: 'Announcements',
    leaderboard: 'Leaderboard',
    profile: 'Profile',
    teamActivity: 'Team activity',
    directMessages: 'Messages',
    staffInbox: 'Staff inbox',
    admin: 'Admin',
    logout: 'Log out',
    user: 'User',
    login: 'Log in',
  },
  auth: {
    verifyHeadTitle: 'Verify account - RBPH',
    email: 'Email',
    password: 'Password',
    login: 'Log in',
    register: 'Register',
    waitCaptcha: 'Waiting for verification',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    goLogin: 'Go to login',
    goLoginShort: 'Log in',
    registrationClosed: 'Registration closed',
    registrationClosedDesc: 'New user registration is currently closed.',
    invalidEmail: 'Invalid email',
    passwordMin: 'Use at least 8 characters',
    passwordMax: 'Use no more than 64 characters',
    passwordInvalid: 'Contains invalid characters',
    loginSuccess: 'Logged in',
    loginSuccessDesc: 'Redirecting shortly…',
    loginFailed: 'Login failed',
    loginBadCredentials: 'Incorrect email or password.',
    registerSuccess: 'Registered',
    registerSuccessDesc: 'Redirecting to the login page…',
    registerFailed: 'Registration failed',
    registerClosedHint: 'Registration is closed.',
    registerInvalid: 'Invalid request.',
    registerEmailTaken: 'Email is already in use.',
    verifySent: 'Verification email sent',
    verifySentDesc: 'Check your inbox and spam folder.',
    verifySentBefore: 'Verification email already sent',
    verifySentBeforeDesc: 'Check your inbox and spam folder, or contact the organizers.',
    emailVerified: 'Email verified',
  },
  maintenance: {
    title: 'Under maintenance',
    headTitle: 'Maintenance - RBPH',
    check: 'Check again',
    checkFailed: 'Failed to check maintenance status',
  },
  puzzleSubmit: {
    requirements: (ctx: { named: (key: string) => unknown }) => {
      const value = ctx.named('requirements');
      return Array.isArray(value) ? value.map(String).join(', ') : '';
    },
    submitting: 'Submitting answer…',
    submittingDesc: 'Please wait.',
    invalidAnswer: 'Invalid answer.',
    duplicatedAnswer: 'This answer has already been submitted.',
    notAllowed: 'Submissions are not currently allowed.',
    newPuzzleUnlocked: 'New puzzle unlocked!',
    submitFailed: 'Submission failed [{answer}]',
    retryLater: 'Please try again later.',
    cooldown: 'Submission cooldown: {time}',
    remaining: 'Submissions left: {remain}/{max}',
    remainingZero: 'Submissions left: 0/{max}',
    blocked: 'Answer submission requirements are not met',
    solved: 'Your team has solved this puzzle',
    placeholder: 'Submit answer',
    submit: 'Submit',
  },
  puzzle: {
    puzzles: 'Puzzles',
    recentSuccessfulSubmissions: 'Recent successful submissions',
  },
  submissions: {
    submitter: 'Submitter',
    content: 'Content',
    contentHelp: 'Hover to view normalized answer',
    result: 'Result',
    message: 'Message',
    time: 'Time',
    fetchFailed: 'Failed to load submissions',
    noSuccessfulSubmissions: 'No successful submissions',
    noSubmissions: 'No submissions',
  },
  judge: {
    resultDisplay: '{action}: {detail}',
    error: 'Judge error',
    errorDesc: 'An error occurred while judging. Contact an administrator.',
    pending: 'Judging',
    pendingDesc: 'Contact an administrator if this stays pending for too long.',
    fail: 'Incorrect',
    failDesc: 'No information was given.',
    correct: 'Correct',
    correctDesc: 'Puzzle solved.',
    milestone: 'Milestone',
    milestoneDesc: 'This is an intermediate answer for this puzzle.',
    startGame: 'Game started',
    startGameDesc: 'Your team has started the game.',
    easterEgg: 'Easter egg',
    easterEggDesc: 'You found an easter egg.',
    finishGame: 'Finished',
    finishGameDesc: 'Correct. Congratulations on finishing the game.',
    finishGameLabel: 'Correct, game finished',
    recorded: 'Recorded',
    submitFailed: 'Submission failed',
  },
  errors: {
    serviceUnavailable: 'Authentication service is temporarily unavailable. Try again later.',
    tooManyRequests: 'Too many requests. Try again later.',
    captchaUnavailable: 'Captcha service is temporarily unavailable.',
    captchaInvalid: 'Captcha verification failed. Try again.',
    maintenance: 'The system is under maintenance.',
    notFound: 'The requested resource does not exist.',
    forbidden: 'Permission denied.',
    unauthorized: 'Session expired. Please log in again.',
    internalServerError: 'Internal error. Contact an administrator.',
    passwordChangeRequired: 'You must change the temporary password first.',
  },
  dirtyToast: {
    leaveConfirm: 'You have unsaved changes. Leaving will discard them.',
    title: 'Unsaved changes',
    description: 'Your changes have not been saved.',
    reset: 'Reset',
    apply: 'Apply',
  },
  activity: {
    consequenceList: (ctx: { named: (key: string) => unknown }) => {
      const value = ctx.named('consequences');
      return Array.isArray(value) ? value.map(String).join(', ') : '';
    },
    title: 'Team activity',
    notifications: 'Notifications',
    change: 'Change',
    balance: 'Balance',
    reasonDetail: 'Reason: {reason}',
    changeDetail: 'Change: {change}',
    balanceDetail: 'Balance: {balance}',
    teamManagement: 'Team management',
    loadFailed: 'Failed to load team activity',
    event: 'Event',
    automaticGain: 'Automatically earned over time',
    initialGain: 'Initial balance',
    noRecords: 'No records',
    staff: 'Staff',
    currencyChangeRecords: '{currency} history',
    notUpdated: 'Not updated yet',
  },
  notifications: {
    loadFailed: 'Failed to load notifications',
    markReadFailed: 'Failed to mark notifications as read',
  },
  message: {
    title: 'Messages',
    needHelp: 'Need help?',
    contact: 'Contact the organizers',
    sentAt: 'Sent at {time}',
    teamMember: 'Team member',
    staffMember: 'Staff',
    closed: 'This conversation is closed and no longer accepts replies.',
    pending: 'You have too many unanswered messages. Please wait for staff to reply.',
    featureClosed: 'Messages are currently disabled.',
    featureExistingOnly: 'You can only reply to existing conversations.',
    teamFeatureBanned: 'This team is banned from using messages.',
    teamBannedWarning: 'The team is banned, but messages are still available.',
    restrictionDetails: 'See {activity} for details.',
    replyPlaceholder: 'Send a message',
    sendFailed: 'Failed to send message',
    loadFailed: 'Failed to load conversation',
    loadEarlierFailed: 'Failed to load earlier messages',
    updateFailed: 'Failed to update conversation',
    sentSuccess: 'Message sent',
    sentSuccessDesc: 'Please wait for a staff reply.',
    sendBlockTeam: 'Team messages are disabled.',
    sendBlockPending: 'You have too many unanswered messages. Please wait for staff to reply.',
    sendBlockType: 'This content type is invalid or not allowed.',
    sendBlockLength: 'The message is too long.',
    sendBlockCost: 'Invalid message cost.',
    sendBlockUnavailable: 'Messages are currently unavailable.',
    sendBlockBanned: 'This team is banned from using messages.',
    sendBlockExistingOnly: 'You can only reply to existing conversations.',
    noAccess: 'You cannot send messages in this conversation.',
    notificationReply: '{actor} replied to a message',
    notificationReplies: '{actor} replied to {count} messages',
  },
  ticket: {
    title: 'Ticket',
    contact: 'Ask staff for help',
    staffMember: 'Staff',
    asTeam: 'As team member',
    asStaff: 'As staff',
    sendAsStaff: 'Reply as staff',
    sentMessage: 'sent a message',
    opened: 'opened the ticket',
    closedAction: 'closed the ticket',
    autoClosedSolved: 'automatically closed the ticket after the puzzle was solved',
    currencyFallback: 'Currency #{id}',
    noAccess: 'You cannot reply to this ticket.',
    closed: 'This ticket is closed and no longer accepts replies.',
    closedMessage: 'This ticket is closed.',
    pending: 'Too many pending messages. Please wait for staff.',
    featureClosed: 'Tickets are currently disabled.',
    featureExistingOnly: 'You can only reply to existing tickets.',
    teamFeatureBanned: 'This team is banned from using tickets.',
    teamBannedWarning: 'The team is banned, but tickets are still available.',
    teamBannedCanRequest: 'The team is banned, but tickets can still be requested.',
    restrictionDetails: 'See {activity} for details.',
    open: 'Open',
    closedState: 'Closed',
    unclaimed: 'Unassigned',
    unclaim: 'Release',
    claim: 'Assign to me',
    claimConfirm: 'This ticket is assigned to {name}. Reassign it to yourself?',
    assigneeAlready: 'This ticket is assigned to {name}. Reply anyway?',
    repliedByStaff: 'Staff reply sent',
    repliedByTeam: 'Follow-up sent',
    repliedByStaffDesc: 'The team can see your reply.',
    repliedByTeamDesc: 'Please wait for a staff reply.',
    replyPlaceholder: 'Reply to ticket',
    sendFailed: 'Failed to send ticket message',
    loadFailed: 'Failed to load ticket',
    loadEarlierFailed: 'Failed to load earlier ticket messages',
    updateFailed: 'Failed to update ticket',
    claimFailed: 'Failed to assign ticket',
    unclaimFailed: 'Failed to release ticket',
    closeFailed: 'Failed to close ticket',
    unlockFailed: 'Failed to unlock message',
    sentSuccess: 'Ticket message sent',
    sentSuccessDesc: 'Please wait for a staff reply.',
    unlock: 'Unlock',
    unlockCost: 'Unlock: {cost}',
    unlockedCost: 'Unlocked: {cost}',
    notUnlockedCost: 'Locked: {cost}',
    unlockMessage: 'Unlock this message?',
    unlockForTeam: 'Unlock this message for the team for free?',
    locked: 'This message is locked…',
    loadingEarlier: 'Load earlier messages',
    noUnlock: 'Free',
    pendingOverflow: 'Too many pending messages. Please wait for staff.',
    staffReplyPlaceholder: 'Reply to ticket request',
    claimConflict: 'This ticket is assigned to another staff member.',
    closeConfirm: 'This ticket is assigned to {name}. Reply and close anyway?',
    closedToast: 'Ticket closed',
    closedToastDesc: 'The team can still view the history.',
    unlockedToast: 'Message unlocked',
    unlockedToastDesc: 'The team can now view this message.',
    insufficientBalance: 'Insufficient balance.',
    unavailableOrPurchased: 'This message is not yet available or has already been purchased.',
    hostClosedTitle: 'Ticket closed.',
    hostClosedDesc: 'Staff can still reply, but the team can no longer follow up.',
    hostReplyDesc: 'Provide the team with the help they need.',
    invalidRequest: 'Could not process the request.',
    onlyOne: 'Only one ticket may be open at a time.',
    puzzleUnavailable: 'Tickets are not yet available for this puzzle.',
    requestFailed: 'Failed to request a ticket',
    requestedFor: 'Ticket opened for {team}',
    requestedForDesc: 'The team will receive this ticket and a notification.',
    canRequest: 'You can request a ticket.',
    canRequestFor: 'You can open a ticket for {team}.',
    canRequestForDesc: 'The ticket will begin with a staff message, and the team will be notified.',
    temporarilyUnavailable: 'Tickets cannot be requested right now.',
    disabledForPuzzle: 'Tickets are not enabled for this puzzle.',
    newRequestUnavailable: 'New tickets cannot be requested right now.',
    currentPuzzlePending: 'This puzzle already has an open ticket. Continue in the conversation below.',
    pendingLimit: 'The open ticket limit has been reached. Consider closing one of these requests.',
    opensAfter: 'Tickets for this puzzle open in {time}.',
    coolingDown: 'Tickets for this puzzle are still on cooldown.',
    requestPlaceholder: 'Describe what you need help with',
    requestForPlaceholder: 'Open a ticket for {team}',
    staffView: 'Staff view',
    teamView: 'Team view',
    ownTeamView: 'Team view: {team}',
    staffViewDesc: 'Tickets opened by all teams for this puzzle are shown here.',
    noPuzzleTickets: 'No tickets for this puzzle',
    selectTeamDesc: 'Search for a team to view its ticket status and open a ticket.',
    teamViewOnly: 'You can only view your own team.',
    selectTeam: 'Select a team',
    puzzleSolved: 'Solved',
    puzzleUnsolved: 'Not solved',
    puzzleLocked: 'Puzzle locked',
    notificationReply: '{actor} replied to a ticket',
    notificationReplies: '{actor} replied to {count} ticket messages',
    sendBlockType: 'This content type is invalid or not allowed.',
    sendBlockLength: 'The message is too long.',
    sendBlockCost: 'Invalid message cost.',
    sendBlockExistingOnly: 'You can only reply to existing tickets.',
  },
  hints: {
    title: 'Hints',
    noHints: 'No hints',
    noAvailable: 'No hints available',
    hiddenTitle: 'This hint will be available later.',
    getFailed: 'Failed to load hints',
    purchaseFailed: 'Failed to purchase hint',
    unlocked: 'Hint unlocked',
    purchased: 'Hint purchased',
    unlock: 'Unlock',
    waitOver: 'Wait until the cooldown ends before purchasing',
    needMore: 'Need {amount} more',
    insufficientBalance: 'Insufficient balance.',
    unavailableOrPurchased: 'This hint is not yet available or has already been purchased.',
    purchaseSuccessDesc: 'Spent {amount} {currency} to purchase hint “{title}”',
    unlockSuccessDesc: 'Unlocked hint “{title}”',
  },
  releasePhase: {
    featureState: '{feature}: {state}',
  },
  pages: {
    changePassword: {
      headTitle: 'Change temporary password - RBPH',
      title: 'Change temporary password',
      description: 'You need to set your own password before continuing.',
      newPassword: 'New password',
      confirmPassword: 'Confirm new password',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      submit: 'Change password',
      logout: 'Log out',
      passwordSaved: 'Password updated',
      passwordSaveFailed: 'Failed to update password',
      invalidFormat: 'Invalid password format',
      sameAsTemp: 'The new password cannot match the temporary password',
      notRequired: 'This account does not require a forced password change',
    },
    transit: {
      headTitle: 'Choose game - RBPH',
      title: 'Choose game',
      noGames: 'No public games',
      login: 'Log in',
    },
    logout: {
      headTitle: 'Log out - RBPH',
      success: 'Logged out',
      description: 'Redirecting shortly…',
    },
    leaderboard: {
      title: 'Leaderboard',
      team: 'Team',
      finishStatus: 'Completion status',
      finished: 'Finished',
      unfinished: 'Unfinished',
      solvedCountHeader: 'Puzzles solved',
      status: 'Status',
      solvedCount: (ctx: { named: (key: string) => unknown }) => {
        const count = Number(ctx.named('count') ?? 0);
        return count === 1 ? '1 solve' : `${Number.isFinite(count) ? count : String(ctx.named('count') ?? '')} solves`;
      },
      noSolved: 'No solves yet',
      noValidTeams: 'No valid teams',
      locked: 'Leaderboard locked',
      lockedDesc: 'This is a snapshot from {time}. Later submissions remain valid but will not change this ranking.',
      lockedDescShort: 'Later submissions remain valid, but will not change this ranking.',
      updatedAt: 'Updated at {time}',
      loadMoreFailed: 'Failed to load more leaderboard teams',
      loadFailed: 'Failed to load leaderboard data',
    },
    info: {
      title: 'Game info',
      announcementsTab: 'Announcements',
      phasesTab: 'Schedule',
      phaseTitle: 'Phase',
      announcementTitle: 'Announcement',
      noPhases: 'No public phases',
      loginToView: 'Log in to view phases',
      loadFailed: 'Failed to load announcements',
    },
    contentTest: {
      headTitle: 'Content test - RBPH',
      title: 'Content test',
    },
    puzzlePage: {
      puzzle: 'Puzzle',
      hints: 'Hints',
      submissions: 'Submissions',
      tickets: 'Tickets',
      unlockedAt: 'Unlocked at {time}',
      recentSuccessfulSubmissions: 'Recent successful submissions',
      viewAllSubmissions: 'View all submissions',
    },
    staffInbox: {
      title: 'Staff inbox',
      sendDm: 'Send team message',
      sessionSelect: 'Conversations',
      allTypes: 'All types',
      allStates: 'All states',
      allMessages: 'All messages',
      allAssignees: 'All assignees',
      waitingStaff: 'Awaiting staff',
      waitingTeam: 'Awaiting team',
      handledByMe: 'Assigned to me',
      unassigned: 'Unassigned',
      noMessages: 'No messages',
      noMatch: 'No matching conversations',
      selectSession: 'Select a conversation',
      selectSessionDesc: 'Choose a ticket or message from the list',
      openInInbox: 'Open in inbox',
      replyCurrent: 'Write a reply',
      sendTeamDmTitle: 'Send team message',
      sendTeamDmDesc: 'Choose a team and send a message',
      searchTeam: 'Search team name',
      sendConflict: 'Assigned to another staff member',
      continueAnyway: 'Continue anyway',
      pendingReply: 'Awaiting reply',
      dmPlaceholder: 'Enter a message',
      loadListFailed: 'Failed to load message list',
      loadThreadFailed: 'Failed to load conversation',
      loadEarlierFailed: 'Failed to load earlier messages',
      updateFailed: 'Failed to update conversation',
      replyFailed: 'Failed to reply',
      sendDmFailed: 'Failed to send message',
      dmExistingOnly: 'New conversations are disabled. You can only reply to existing conversations with this team.',
      conflictDescription: 'This conversation is assigned to {name}. Do you still want to {action}?',
      continueReply: 'continue replying',
      replyAndClose: 'reply and close',
    },
    profile: {
      title: 'Profile',
      userInfo: 'User info',
      avatar: 'Avatar',
      uid: 'UID',
      email: 'Email',
      username: 'Username',
      bio: 'Bio',
      updateUserInfo: 'Update user info',
      currentPassword: 'Current password',
      newPassword: 'New password',
      confirmPassword: 'Confirm password',
      changePassword: 'Change password',
      teamId: 'Team ID',
      teamName: 'Team name',
      teamPass: 'Team password',
      teamBio: 'Team bio',
      saveTeamInfo: 'Update team info',
      saveTeamInfoBlocked: 'Only the captain can update team info',
      teamInfoFailed: 'Failed to load team info',
      saveUserFailed: 'Failed to update user info',
      saveTeamFailed: 'Failed to update team info',
      teamBanned: 'The team is banned.',
      teamPenalties: (ctx: { named: (key: string) => unknown }) => {
        const value = ctx.named('items');
        const items = Array.isArray(value) ? value.map(String).join(', ') : '';
        return `Team restrictions: ${items}.`;
      },
      teamBannedWithPenalties: (ctx: { named: (key: string) => unknown }) => {
        const value = ctx.named('items');
        const items = Array.isArray(value) ? value.map(String).join(', ') : '';
        return `The team is banned. Additional restrictions: ${items}.`;
      },
      noTeam: 'You are not in a team',
      noTeamNotice: 'Join or create a team before playing. Solo players must also create a team.',
      teamFormationClosed: 'Team formation is not open yet',
      teamFormationUnavailable: 'Team formation is not currently open.',
      teamFormationClosedDesc: 'Check the schedule for the opening time.',
      joinTeam: 'Join team',
      createTeam: 'Create team',
      disbandTeam: 'Disband team',
      leaveTeam: 'Leave team',
      teamRestriction: 'Team is restricted',
      disableDirectMessage: 'messages disabled',
      disablePuzzleTicket: 'puzzle tickets disabled',
      disableLeaderboard: 'leaderboard access disabled',
      teamLocked: 'Locked',
      teamInfo: 'Team info',
      teamMembers: 'Team members',
      kickMemberFailed: 'Failed to remove member',
      promoteMemberFailed: 'Failed to transfer captaincy',
      joinFailed: 'Failed to join team',
      createFailed: 'Failed to create team',
      disbandFailed: 'Failed to disband team',
      leaveFailed: 'Failed to leave team',
      teamSaved: 'Team info updated',
      userSaved: 'User info updated',
      joinedTeam: 'Joined team',
      createdTeam: 'Created team',
      leftTeam: 'Left team',
      disbandedTeam: 'Disbanded team',
      passwordMismatch: 'The new passwords do not match',
      promotedMember: 'Set {name} as captain',
      kickedMember: 'Removed {name} from the team',
      teamLockedHintDisband: 'The team is locked and cannot be disbanded',
      teamLockedHintLeave: 'You cannot leave a locked team',
      leaveDanger: 'This action cannot be undone.',
      passwordSaved: 'Password changed',
      passwordSaveFailed: 'Failed to change password',
      invalidUserInfo: 'Invalid user information.',
      passwordInvalid: 'Invalid password format.',
      passwordSame: 'The new password cannot be the same as the current password.',
      currentPasswordWrong: 'The current password is incorrect.',
      noTeamEditPermission: 'You do not have permission to update team information.',
      disbandUnavailable: 'The team cannot currently be disbanded.',
      noDisbandPermission: 'You do not have permission to disband the team.',
      leaveNotMember: 'Only current team members can leave the team.',
      alreadyCaptain: 'You are already the captain!',
      memberLeft: 'The member has left the team.',
      noPromotePermission: 'You do not have permission to transfer captaincy.',
      cannotKickSelf: 'You cannot remove yourself from the team!',
      noKickPermission: 'You do not have permission to remove members.',
      promotedMemberFallback: 'Set the member as captain',
      kickedMemberFallback: 'Removed the member from the team',
      invalidTeamId: 'Invalid team ID.',
      wrongTeamPassword: 'Incorrect password.',
      teamFull: 'The team is full.',
      teamLockedContact: 'The team is locked. Contact staff.',
      alreadyInTeam: 'You are already in a team.',
      invalidCredentials: 'Invalid credentials.',
      restrictionDetails: 'See {activity} for details.',
    },
  },
  components: {
    syncStatus: {
      connecting: {
        label: 'Connecting',
        title: 'Connecting to sync service',
        description: 'Establishing a real-time data connection.',
      },
      online: {
        label: 'Connected',
        title: 'Sync service connected',
        description: 'Real-time data sync is working normally.',
      },
      reconnecting: {
        label: 'Reconnecting',
        title: 'Sync service disconnected',
        description: 'Trying to reconnect.',
      },
      limited: {
        label: 'Limited',
        title: 'Sync connection replaced',
        description: 'This account has reached its connection limit. Reconnecting may disconnect another open page.',
      },
      unsupported: {
        label: 'Unsupported',
        title: 'Sync is not supported by this browser',
        description: 'Please update your browser and reopen the page.',
      },
      reconnect: 'Reconnect',
      buttonAria: 'View or move sync status',
      transport: {
        sharedWorker: 'SharedWorker ({count})',
        directWebSocket: 'Direct WebSocket',
        unset: 'Unset',
      },
      debug: {
        title: 'Debug info',
        state: 'State',
        transport: 'Transport',
        endpoint: 'Endpoint',
        clientId: 'Client ID',
        stateChangedAt: 'Changed at',
        lastClose: 'Last disconnection',
        closeReason: 'Close reason',
        closeAt: 'Close time',
        clean: 'clean',
        unclean: 'unclean',
        unset: 'Not generated yet',
        notProvided: 'Not provided',
      },
    },
    announcement: {
      allSite: 'Site-wide',
      pinned: 'Pinned',
      goToPuzzle: 'Go to puzzle',
      noAnnouncements: 'No announcements',
      waitForPublish: 'The organizers have not posted any announcements yet',
    },
    teamMemberList: {
      captain: 'Captain',
      you: 'You',
      joinedAt: 'Joined at {time}',
      setCaptain: 'Set as captain',
      confirmSetCaptain: 'Set {name} as captain?',
      confirm: 'Confirm',
      remove: 'Remove',
      confirmRemove: 'Remove {name}?',
      confirmRemoveDesc: 'This action cannot be undone.',
      confirmRemoveButton: 'Confirm removal',
      lockedRemoveHint: 'Unlock the team before removing members',
      lastMemberRemoveHint: 'A team must have at least one member',
    },
    messageEdit: {
      markdownHint: 'Markdown supported',
      closeWithReply: 'Reply and close',
      closeTicket: 'Close',
      send: 'Send',
    },
    puzzleContent: {
      invalidType: 'Invalid content type',
    },
  },
}));
