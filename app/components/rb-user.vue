<script setup lang="ts">
import type { UserProps } from '@nuxt/ui';

const props = withDefaults(defineProps<UserProps & { email?: string }>(), {
  email: '',
});

const attrs = useAttrs();

const avatar = computed(() => {
  const rawAvatar = props.avatar ?? {};
  if (rawAvatar.src) return rawAvatar;

  const src = buildCravatarUrl(props.email ?? '');
  return src ? { ...rawAvatar, src } : rawAvatar;
});

const userProps = computed(() => {
  const { email: _email, avatar: _avatar, ...rest } = props;
  return { ...rest, avatar: avatar.value };
});
</script>

<template>
  <u-user v-bind="{ ...attrs, ...userProps }">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps" />
    </template>
  </u-user>
</template>
