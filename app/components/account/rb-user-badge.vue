<script setup lang="ts">
import type { AvatarProps, BadgeProps } from '@nuxt/ui';

const props = withDefaults(
  defineProps<{
    user: { nickname: string; email?: string | null; avatar?: string | null };
    avatar?: AvatarProps;
    color?: BadgeProps['color'];
    variant?: BadgeProps['variant'];
    size?: BadgeProps['size'];
  }>(),
  {
    avatar: () => ({}),
    color: 'neutral',
    variant: 'soft',
    size: 'md',
  },
);

const avatar = computed<AvatarProps>(() => {
  const rawAvatar = props.avatar ?? {};
  if (rawAvatar.src) return rawAvatar;

  const src = props.user.avatar ?? '';
  return src ? { ...rawAvatar, src, alt: props.user.nickname } : { ...rawAvatar, text: props.user.nickname };
});
</script>

<template>
  <u-badge :color="color" :variant="variant" :size="size">
    <template #leading>
      <u-avatar v-bind="avatar" size="3xs" />
    </template>
    <slot>{{ user.nickname }}</slot>
  </u-badge>
</template>
