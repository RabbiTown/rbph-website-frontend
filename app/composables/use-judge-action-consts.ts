export function useJudgeActionConsts() {
  const { t } = useI18n();
  const frontend = useGameFrontendFeatures();

  return computed<Record<RbJudgeAction, JudgeActionConst>>(() => ({
    [RbJudgeAction.Error]: { name: t('judge.error'), icon: frontend.icon('judge.error', 'material-symbols:error-med-outline-rounded'), color: 'error', desc: t('judge.errorDesc') },
    [RbJudgeAction.Pending]: { name: t('judge.pending'), icon: frontend.icon('judge.pending', 'material-symbols:more-horiz'), color: 'warning', desc: t('judge.pendingDesc') },
    [RbJudgeAction.Fail]: { name: t('judge.fail'), icon: frontend.icon('judge.fail', 'material-symbols:close-rounded'), color: 'error', desc: t('judge.failDesc') },
    [RbJudgeAction.Correct]: { name: t('judge.correct'), icon: frontend.icon('judge.correct', 'material-symbols:check-rounded'), color: 'success', desc: t('judge.correctDesc') },
    [RbJudgeAction.Milestone]: { name: t('judge.milestone'), icon: frontend.icon('judge.milestone', 'material-symbols:flag-outline-rounded'), color: 'warning', desc: t('judge.milestoneDesc') },
    [RbJudgeAction.StartGame]: { name: t('judge.startGame'), icon: frontend.icon('judge.start-game', 'material-symbols:celebration-rounded'), color: 'success', desc: t('judge.startGameDesc') },
    [RbJudgeAction.EasterEgg]: { name: t('judge.easterEgg'), icon: frontend.icon('judge.easter-egg', 'material-symbols:auto-awesome-outline-rounded'), color: 'primary', desc: t('judge.easterEggDesc') },
    [RbJudgeAction.FinishGame]: { name: t('judge.finishGame'), icon: frontend.icon('judge.finish-game', 'material-symbols:auto-awesome-outline-rounded'), color: 'success', desc: t('judge.finishGameDesc') },
  }));
}
