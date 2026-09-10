// Match desktop typography across input controls on every screen size.
const inputFontSizes = {
  xs: { base: 'text-xs/4' },
  sm: { base: 'text-xs/4' },
  md: { base: 'text-sm/5' },
  lg: { base: 'text-sm/5' },
};

export default defineAppConfig({
  ui: {
    colors: {
      primary: 'pink',
      secondary: 'gray',
    },
    input: {
      variants: { size: inputFontSizes },
      slots: {
        base: ['py-2'],
      },
    },
    textarea: { variants: { size: inputFontSizes } },
    inputMenu: { variants: { size: inputFontSizes } },
    inputTags: { variants: { size: inputFontSizes } },
    inputDate: { variants: { size: inputFontSizes } },
    inputTime: { variants: { size: inputFontSizes } },
    pinInput: { variants: { size: inputFontSizes } },
    inputNumber: {
      variants: {
        size: {
          xs: inputFontSizes.xs.base,
          sm: inputFontSizes.sm.base,
          md: inputFontSizes.md.base,
          lg: inputFontSizes.lg.base,
        },
      },
    },
    toaster: {
      slots: {
        viewport: 'rb-toast-viewport',
      },
    },
    dashboardPanel: {
      slots: {
        body: 'rb-toast-scroll-body',
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
