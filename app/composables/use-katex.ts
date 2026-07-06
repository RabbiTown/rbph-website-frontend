import katex from 'katex';

export default function useKatex() {
  function renderToString(tex: string, displayMode = false) {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: true,
      strict: false,
      trust: false,
      output: 'html',
    });
  }

  return {
    renderToString,
  };
}
