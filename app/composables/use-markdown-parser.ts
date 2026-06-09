import { createMarkdownParser } from '@nuxtjs/mdc/runtime';

function normalizeCjkMarkdown(markdown: string) {
  return markdown
    .replace(/(\*{1,3}|_{1,3})([「『《（【“‘])/g, '$1\u200B$2')
    .replace(/([」』》）】”’：；，。！？、])(\*{1,3}|_{1,3})(?=\p{Script=Han})/gu, '$1\u200B$2')
    .replace(/([」』》）】”’])(\*{1,3}|_{1,3})/g, '$1\u200B$2');
}

export default function useMarkdownParser() {
  let parser: Awaited<ReturnType<typeof createMarkdownParser>>;

  const parse = async (markdown: string) => {
    if (!parser) {
      parser = await createMarkdownParser();
    }
    return parser(normalizeCjkMarkdown(markdown));
  };

  return parse;
}
