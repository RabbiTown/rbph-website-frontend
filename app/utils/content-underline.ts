import Underline from '@tiptap/extension-underline';
import type { JSONContent, MarkdownParseHelpers, MarkdownRendererHelpers, MarkdownToken } from '@tiptap/core';

export const RbphUnderline = Underline.extend({
  parseMarkdown(token: MarkdownToken, helpers: MarkdownParseHelpers) {
    return helpers.applyMark('underline', helpers.parseInline(token.tokens || []));
  },

  renderMarkdown(node: JSONContent, helpers: MarkdownRendererHelpers) {
    return `<u>${helpers.renderChildren(node.content || [], '')}</u>`;
  },

  markdownTokenizer: {
    name: 'underline',
    level: 'inline',
    start(src: string) {
      return src.indexOf('<u>');
    },
    tokenize(src: string, _tokens: MarkdownToken[], lexer: { inlineTokens: (src: string) => MarkdownToken[] }) {
      const match = src.match(/^<u>([\s\S]+?)<\/u>/);
      if (!match) return undefined;

      const content = match[1] ?? '';
      return {
        type: 'underline',
        raw: match[0],
        tokens: lexer.inlineTokens(content),
      };
    },
  },
});
