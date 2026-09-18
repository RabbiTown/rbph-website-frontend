<script setup lang="ts">
type PuzzleSubpage = 'puzzle' | 'hints' | 'submissions' | 'tickets';

const props = withDefaults(
  defineProps<{
    page: PuzzleSubpage;
    titleContext?: 'game' | 'round';
  }>(),
  {
    titleContext: 'game',
  },
);

const { t } = useI18n();
const { puzzle } = usePuzzleContext();
const game = useGame().ref;

const subpageTitle = computed(() => {
  switch (props.page) {
    case 'hints':
      return t('pages.puzzlePage.hints');
    case 'submissions':
      return t('pages.puzzlePage.submissions');
    case 'tickets':
      return t('pages.puzzlePage.tickets');
    default:
      return undefined;
  }
});

useHead({
  titleTemplate: computed(() => {
    const contextTitle = props.titleContext === 'round' ? puzzle.value?.data.round.title : game.value?.title;
    return buildTitleParts([
      { text: puzzle.value?.data.title, end: subpageTitle.value ? ' @ ' : undefined },
      { text: subpageTitle.value },
      { text: contextTitle, sep: ' - ' },
    ]);
  }),
});
</script>

<template>
  <rbph-puzzle-page :page="page" />
</template>
