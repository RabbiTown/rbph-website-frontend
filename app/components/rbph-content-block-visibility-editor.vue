<script setup lang="ts">
const model = defineModel<string>({ required: true });
const props = defineProps<{
  gameId: number;
  currentPuzzleId?: number;
  disabled?: boolean;
}>();

const puzzles = ref<UnlockPuzzleOptionData[]>([]);
const rounds = ref<UnlockRoundOptionData[]>([]);
const loading = ref(false);
const gate = ref<UnlockGateNode>(parseUnlockGate(model.value));
let updatingModel = false;

function updateModel() {
  updatingModel = true;
  model.value = serializeUnlockGate(gate.value);
  nextTick(() => {
    updatingModel = false;
  });
}

watch(model, value => {
  if (!updatingModel) gate.value = parseUnlockGate(value);
});

async function loadOptions() {
  loading.value = true;
  try {
    const [puzzleResponse, roundResponse] = await Promise.all([
      useApi().get<{ puzzles: AdminPuzzleData[] }>(`/admin/puzzles?game_id=${props.gameId}`),
      useApi().get<{ rounds: AdminRoundData[] }>(`/admin/rounds?game_id=${props.gameId}`),
    ]);
    puzzles.value = [...puzzleResponse.data.puzzles].sort((a, b) => {
      if (a.id === props.currentPuzzleId) return -1;
      if (b.id === props.currentPuzzleId) return 1;
      return 0;
    });
    rounds.value = roundResponse.data.rounds;
  } finally {
    loading.value = false;
  }
}

watch([() => props.gameId, () => props.currentPuzzleId], loadOptions, { immediate: true });
</script>

<template>
  <rbph-unlock-condition-editor
    v-model="gate"
    :puzzles="puzzles"
    :rounds="rounds"
    :disabled="disabled"
    :loading="loading"
    @change="updateModel"
  />
</template>
