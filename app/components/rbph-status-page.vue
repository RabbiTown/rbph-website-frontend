<script setup lang="ts">
defineProps<{
  icon: string;
  title: string;
  message?: string;
}>();
</script>

<template>
  <main class="relative isolate flex w-full overflow-hidden bg-red-500 px-6 py-10 text-white sm:px-10">
    <div aria-hidden="true" class="absolute -left-16 top-[18%] h-px w-72 rotate-[-35deg] bg-white/35 sm:w-[28rem]" />
    <div aria-hidden="true" class="absolute -right-24 bottom-[22%] h-px w-80 rotate-[-35deg] bg-white/35 sm:w-[32rem]" />
    <div class="relative mx-auto flex min-h-0 w-full max-w-5xl flex-col items-center gap-8 pb-12">
      <div class="flex flex-1 flex-col items-center justify-center text-center">
        <div class="mb-7 grid size-20 place-items-center border-2 border-white/90 [clip-path:polygon(18%_0,100%_0,100%_82%,82%_100%,0_100%,0_18%)] sm:size-24">
          <u-icon :name="icon" class="size-11 text-white sm:size-14" />
        </div>
        <h1 class="max-w-full text-5xl font-black leading-none tracking-normal text-white sm:text-7xl">{{ title }}</h1>
        <div class="my-7 h-1 w-16 bg-white sm:mt-9 sm:mb-4" />
        <p v-if="message" class="max-w-2xl whitespace-pre-wrap text-base font-medium leading-7 text-white/90 sm:text-lg sm:leading-8">
          {{ message }}
        </p>
      </div>

      <div v-if="$slots.actions" class="flex flex-col items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
    <div class="absolute bottom-4 right-4 sm:bottom-6 sm:right-6">
      <rb-language-switcher inverted />
    </div>
  </main>
</template>
