<script setup lang="ts">
definePageMeta({
  layout: 'game',
});

const api = useApi();
const route = useRoute();

const round_id = computed(() => route.params.id as string);

const round = ref<RbRoundUserData | undefined>();

const okSubmissionsComp = useTemplateRef('ok-submissions');
const submitResultComp = useTemplateRef('submit-result');

watch(
  round_id,
  async new_id => {
    round.value = undefined;
    try {
      const { data } = await api.get<RbRoundUserData>(`/rounds/${new_id}`);
      round.value = data;

      if (data.data.game_id) {
        updateGameState(data.data.game_id.toString());
      }
    } catch (error) {
      showError(error instanceof Error ? error : String(error));
    }
  },
  { immediate: true }
);

function onSubmitSuccess(result: RbJudgeResult, answer: string) {
  if (result.action > 0) {
    okSubmissionsComp.value?.updateData();
  }
  submitResultComp.value?.updateSuccess(result, answer);
}
</script>

<template>
  <div v-if="round">
    <div class="py-6">
      <span class="text-3xl font-bold">
        {{ round?.data.title }}
      </span>
    </div>

    <u-card variant="soft">
      <rbph-content :content="round?.data" />

      <template v-if="round.puzzles.length > 0">
        <u-separator icon="material-symbols:extension-outline-rounded" class="mt-6 mb-2" />
        <div class="text-3xl font-bold text-center">谜题</div>
        <div class="flex justify-center gap-2 mt-4">
          <rbph-puzzle-card v-for="puzzle in round.puzzles" :key="puzzle.id" class="max-w-7/12 w-full" :puzzle="puzzle" />
        </div>
      </template>
    </u-card>

    <template v-if="round.data.puzzle">
      <u-separator class="my-6" :ui="{ container: 'w-full', border: 'md:w-3/12 w-0' }">
        <rbph-submitter class="w-full" :puzzle="round.data.puzzle" @submit-success="onSubmitSuccess" @submit-fail="submitResultComp?.updateFail" />
      </u-separator>
      <rbph-submit-result ref="submit-result" />

      <div class="mt-6 w-full" variant="soft">
        <div class="text-lg font-bold mb-4">最近成功提交</div>
        <rbph-submissions ref="ok-submissions" :puzzle-id="round.data.puzzle" :only-ok="true" />
      </div>
    </template>
  </div>
  <div v-else class="py-6">
    <u-skeleton class="h-24 w-full" />
  </div>
</template>
