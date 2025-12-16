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
    pagination: {
      slots: { first: 'cursor-pointer', prev: 'cursor-pointer', item: 'cursor-pointer', next: 'cursor-pointer', last: 'cursor-pointer' },
    },
  },
});
