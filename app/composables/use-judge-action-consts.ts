export function useJudgeActionConsts() {
  const { t } = useI18n();

  return computed<Record<RbJudgeAction, JudgeActionConst>>(() => ({
    [RbJudgeAction.Error]: { name: t('judge.error'), icon: 'material-symbols:error-med-outline-rounded', color: 'error', desc: t('judge.errorDesc') },
    [RbJudgeAction.Pending]: { name: t('judge.pending'), icon: 'material-symbols:more-horiz', color: 'warning', desc: t('judge.pendingDesc') },
    [RbJudgeAction.Fail]: { name: t('judge.fail'), icon: 'material-symbols:close-rounded', color: 'error', desc: t('judge.failDesc') },
    [RbJudgeAction.Correct]: { name: t('judge.correct'), icon: 'material-symbols:check-rounded', color: 'success', desc: t('judge.correctDesc') },
    [RbJudgeAction.Milestone]: { name: t('judge.milestone'), icon: 'material-symbols:flag-outline-rounded', color: 'warning', desc: t('judge.milestoneDesc') },
    [RbJudgeAction.StartGame]: { name: t('judge.startGame'), icon: 'material-symbols:celebration-rounded', color: 'success', desc: t('judge.startGameDesc') },
    [RbJudgeAction.EasterEgg]: { name: t('judge.easterEgg'), icon: 'material-symbols:auto-awesome-outline-rounded', color: 'primary', desc: t('judge.easterEggDesc') },
    [RbJudgeAction.FinishGame]: { name: t('judge.finishGame'), icon: 'material-symbols:auto-awesome-outline-rounded', color: 'success', desc: t('judge.finishGameDesc') },
  }));
}
