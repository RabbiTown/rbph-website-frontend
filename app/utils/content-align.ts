import { Node, mergeAttributes } from '@tiptap/core';
import type { JSONContent, MarkdownParseHelpers, MarkdownRendererHelpers, MarkdownToken } from '@tiptap/core';
import type { MDCElement, MDCNode, MDCRoot } from '@nuxtjs/mdc';

const alignments = ['left', 'center', 'right'] as const;

export type RbTextAlign = (typeof alignments)[number];

function isTextAlign(value: unknown): value is RbTextAlign {
  return typeof value === 'string' && alignments.includes(value as RbTextAlign);
}

function normalizeTextAlign(value: unknown): RbTextAlign {
  return isTextAlign(value) ? value : 'left';
}

function alignClass(value: RbTextAlign) {
  return {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }[value];
}

function parseMdcAlignAttributes(attrString = '') {
  const textAlign = normalizeTextAlign(attrString.match(/(?:^|\s)textAlign=(?:"([^"]+)"|'([^']+)'|([^\s}]+))/)?.slice(1).find(Boolean));
  return { textAlign };
}

function renderMdcAlignAttributes(attrs: Record<string, unknown> | undefined) {
  const textAlign = normalizeTextAlign(attrs?.textAlign);
  return textAlign === 'left' ? '' : `{textAlign="${textAlign}"}`;
}

export const RbphAlignBlock = Node.create({
  name: 'align',

  group: 'block',

  content: 'block+',

  defining: true,

  addAttributes() {
    return {
      textAlign: {
        default: 'left',
        parseHTML: element => normalizeTextAlign(element.getAttribute('data-text-align') ?? element.style.textAlign),
        renderHTML: attributes => {
          const textAlign = normalizeTextAlign(attributes.textAlign);
          return {
            'data-text-align': textAlign,
            style: `text-align: ${textAlign}`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-text-align]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes), 0];
  },

  parseMarkdown: (token: MarkdownToken, helpers: MarkdownParseHelpers) => {
    return helpers.createNode('align', token.attributes, helpers.parseChildren(token.tokens || []));
  },

  renderMarkdown: (node: JSONContent, helpers: MarkdownRendererHelpers) => {
    const renderedContent = helpers.renderChildren(node.content || [], '\n\n');
    return `::align${renderMdcAlignAttributes(node.attrs)}\n${renderedContent}\n::`;
  },

  markdownTokenizer: {
    name: 'align',
    level: 'block',
    start(src: string) {
      return src.match(/^::align/m)?.index ?? -1;
    },
    tokenize(src: string, _tokens: MarkdownToken[], lexer: { blockTokens: (src: string) => MarkdownToken[]; inlineTokens: (src: string) => MarkdownToken[] }) {
      const openingMatch = src.match(/^::align(?:\{([^}]*)\})?\s*\n/);
      if (!openingMatch) return undefined;

      const [openingTag, attrString = ''] = openingMatch;
      const remaining = src.slice(openingTag.length);
      const closingMatch = remaining.match(/^::\s*$/m);
      if (!closingMatch || closingMatch.index === undefined) return undefined;

      const rawContent = remaining.slice(0, closingMatch.index);
      const fullMatch = src.slice(0, openingTag.length + closingMatch.index + closingMatch[0].length);
      const tokens = lexer.blockTokens(rawContent);

      tokens.forEach(token => {
        if (token.text && (!token.tokens || token.tokens.length === 0)) {
          token.tokens = lexer.inlineTokens(token.text);
        }
      });

      return {
        type: 'align',
        raw: fullMatch,
        attributes: parseMdcAlignAttributes(attrString),
        tokens,
      };
    },
  },
});

export function transformAlignBlocks<T extends MDCNode | MDCRoot>(node: T): T {
  if (node.type === 'root') {
    return {
      ...node,
      children: node.children.map(transformAlignBlocks),
    };
  }

  if (node.type !== 'element') return node;

  const children = node.children.map(transformAlignBlocks);

  if (node.tag === 'align') {
    const textAlign = normalizeTextAlign(node.props?.textAlign ?? node.props?.['text-align']);
    return {
      ...node,
      tag: 'div',
      props: {
        class: alignClass(textAlign),
        'data-text-align': textAlign,
      },
      children,
    } as MDCElement as T;
  }

  if (node.tag === 'div' && node.props?.['data-text-align']) {
    const textAlign = normalizeTextAlign(node.props['data-text-align']);
    return {
      ...node,
      props: {
        ...node.props,
        class: alignClass(textAlign),
        'data-text-align': textAlign,
      },
      children,
    };
  }

  return {
    ...node,
    children,
  };
}
