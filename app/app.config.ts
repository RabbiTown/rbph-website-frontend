export default defineAppConfig({
  ui: {
    colors: {
      primary: 'pink',
      secondary: 'gray',
    },
    input: {
      slots: {
        base: ['py-2'],
      },
    },
    textarea: {
      variants: {
        size: {
          md: { base: 'text-sm/5' },
          lg: { base: 'text-sm/5' },
        },
      },
    },
    pagination: {
      slots: { first: 'cursor-pointer', prev: 'cursor-pointer', item: 'cursor-pointer', next: 'cursor-pointer', last: 'cursor-pointer' },
    },
    collapsible: {
      slots: {
        content: 'px-px',
      },
    },
  },
});
