import { Node as TiptapNode, mergeAttributes } from '@tiptap/core';
import type { Editor, JSONContent, MarkdownParseHelpers, MarkdownRendererHelpers, MarkdownToken, RenderContext } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { h, reactive, render as renderVue } from 'vue';
import type { AppContext } from 'vue';
import RbphMdcComponentPreview from '~/components/rbph-mdc-component-preview.vue';

const handledMdcBlockNames = new Set(['align', 'rb-image', 'rb-raw-html', 'rb-vue-app', 'rb-table', 'rbph-math']);
const plainMdcComponentColonEscape = '\uE000';

function attrStringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function normalizeComponentName(value: unknown) {
  const name = attrStringValue(value).trim();
  return /^[A-Za-z][\w.-]*$/.test(name) ? name : 'component';
}

type MdcComponentMatch = {
  raw: string;
  name: string;
};

type EditorWithAppContext = Editor & {
  appContext?: AppContext | null;
};

function renderedNodeText(node: JSONContent | undefined) {
  if (!node) return '';
  if (node.type === 'text') return attrStringValue(node.text);
  if (Array.isArray(node.content)) return node.content.map(renderedNodeText).join('');
  return '';
}

function needsSpaceBeforeInlineMdc(context: RenderContext) {
  if (!context.previousNode) return false;
  const previousText = renderedNodeText(context.previousNode);
  if (!previousText) return true;
  return previousText.length > 0 && !/\s$/.test(previousText);
}

function needsSpaceBeforeMdcNode(nodeBefore: { isText?: boolean; text?: string | null } | null) {
  if (!nodeBefore) return false;
  if (!nodeBefore.isText) return true;
  return Boolean(nodeBefore.text && !/\s$/.test(nodeBefore.text));
}

function readBracedBlock(src: string, start: number) {
  if (src[start] !== '{') return undefined;

  let quote: string | undefined;
  for (let index = start + 1; index < src.length; index += 1) {
    const char = src[index];
    if (char === '\\') {
      index += 1;
      continue;
    }

    if (quote) {
      if (char === quote) quote = undefined;
      continue;
    }

    if (char === '"' || char === '\'') {
      quote = char;
      continue;
    }

    if (char === '}') return src.slice(start, index + 1);
  }

  return undefined;
}

function findClosingBracket(src: string, start: number) {
  let depth = 1;
  for (let index = start; index < src.length; index += 1) {
    const char = src[index];
    if (char === '\\') {
      index += 1;
      continue;
    }

    if (char === '\n') return -1;
    if (char === '[') depth += 1;
    if (char !== ']') continue;

    depth -= 1;
    if (depth === 0) return index;
  }

  return -1;
}

function lineEndIndex(src: string, start: number) {
  const end = src.indexOf('\n', start);
  return end === -1 ? src.length : end + 1;
}

function matchMdcComponentOpening(line: string) {
  const match = line.match(/^::([A-Za-z][\w.-]*)(?:[ \t{].*)?$/);
  if (!match?.[1] || handledMdcBlockNames.has(match[1])) return undefined;
  return match[1];
}

function readMdcComponentBlock(src: string): MdcComponentMatch | undefined {
  const firstLineEnd = lineEndIndex(src, 0);
  const firstLine = src.slice(0, firstLineEnd).trimEnd();
  const name = matchMdcComponentOpening(firstLine);
  if (!name) return undefined;

  let cursor = firstLineEnd;
  let depth = 1;
  let inFence: string | undefined;

  while (cursor < src.length) {
    const nextLineEnd = lineEndIndex(src, cursor);
    const line = src.slice(cursor, nextLineEnd);
    const trimmed = line.trim();

    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
    if (fenceMatch?.[1]) {
      const marker = fenceMatch[1][0]?.repeat(fenceMatch[1].length);
      if (!inFence) {
        inFence = marker;
      } else if (marker === inFence) {
        inFence = undefined;
      }
      cursor = nextLineEnd;
      continue;
    }

    if (!inFence) {
      if (/^::\s*$/.test(trimmed)) {
        depth -= 1;
        if (depth === 0) {
          return {
            raw: src.slice(0, nextLineEnd).trimEnd(),
            name,
          };
        }
      } else if (matchMdcComponentOpening(trimmed)) {
        depth += 1;
      }
    }

    cursor = nextLineEnd;
  }

  return undefined;
}

function findMdcComponentBlockStart(src: string) {
  const match = src.match(/^::[A-Za-z]/m);
  if (!match || match.index === undefined) return -1;
  return match.index;
}

function readMdcComponentInline(src: string): MdcComponentMatch | undefined {
  const nameMatch = src.match(/^:([A-Za-z][\w.-]*)/);
  const name = nameMatch?.[1];
  if (!name || src[1] === ':') return undefined;

  let cursor = nameMatch[0].length;
  const attrs = readBracedBlock(src, cursor);
  if (attrs) cursor += attrs.length;

  if (src[cursor] === '[') {
    const close = findClosingBracket(src, cursor + 1);
    if (close === -1) return undefined;
    return {
      raw: src.slice(0, close + 1),
      name,
    };
  }

  if (!attrs) return undefined;

  return {
    raw: src.slice(0, cursor),
    name,
  };
}

function canStartMdcComponentInline(src: string, index: number) {
  return index === 0 || /\s/.test(src[index - 1] ?? '');
}

function findMdcComponentInlineStart(src: string) {
  let cursor = 0;
  while (cursor < src.length) {
    const index = src.indexOf(':', cursor);
    if (index === -1) return -1;
    if (canStartMdcComponentInline(src, index) && readMdcComponentInline(src.slice(index))) return index;
    cursor = index + 1;
  }

  return -1;
}

function escapePlainMdcComponentInlineText(text: string) {
  let result = '';
  let cursor = 0;

  while (cursor < text.length) {
    const index = text.indexOf(':', cursor);
    if (index === -1) {
      result += text.slice(cursor);
      break;
    }

    result += text.slice(cursor, index);
    if (canStartMdcComponentInline(text, index) && readMdcComponentInline(text.slice(index))) {
      result += plainMdcComponentColonEscape;
    } else {
      result += text[index];
    }
    cursor = index + 1;
  }

  return result;
}

function escapePlainMdcComponentText(text: string, canStartBlock: boolean) {
  const inlineEscaped = escapePlainMdcComponentInlineText(text);
  if (!canStartBlock) return inlineEscaped;

  const firstLineEnd = lineEndIndex(inlineEscaped, 0);
  const firstLine = inlineEscaped.slice(0, firstLineEnd).trimEnd();
  return matchMdcComponentOpening(firstLine) ? `${plainMdcComponentColonEscape}${plainMdcComponentColonEscape}${inlineEscaped.slice(2)}` : inlineEscaped;
}

function hasRenderableTextBefore(nodes: JSONContent[] | undefined, index: number) {
  return Boolean(nodes?.slice(0, index).some(node => renderedNodeText(node)));
}

export function escapePlainMdcComponentTextNodesForMarkdown<T extends JSONContent>(node: T, parentNode?: JSONContent, index = 0): T {
  if (node.type === 'text') {
    const text = attrStringValue(node.text);
    const canStartBlock = parentNode?.type === 'paragraph' && !hasRenderableTextBefore(parentNode.content, index);
    const escaped = escapePlainMdcComponentText(text, canStartBlock);
    return escaped === text ? node : { ...node, text: escaped };
  }

  if (!Array.isArray(node.content)) return node;

  return {
    ...node,
    content: node.content.map((child, childIndex) => escapePlainMdcComponentTextNodesForMarkdown(child, node, childIndex)),
  };
}

export function restorePlainMdcComponentMarkdownEscapes(markdown: string) {
  return markdown.replaceAll(plainMdcComponentColonEscape, '\\:');
}

function createMdcComponentNodeView(editor: Editor, attrs: Record<string, unknown>, inline: boolean) {
  const dom = document.createElement(inline ? 'span' : 'section');
  dom.className = inline ? 'rbph-mdc-component-node rbph-mdc-component-node-inline rounded-md transition' : 'rbph-mdc-component-node rbph-mdc-component-node-block my-4 rounded-md transition';
  dom.dataset.rbMdcComponent = '';
  dom.dataset.nodeViewWrapper = '';
  dom.contentEditable = 'false';

  const state = reactive({
    raw: attrStringValue(attrs.raw),
    inline,
  });

  function renderAttrs(nextAttrs: Record<string, unknown>) {
    state.raw = attrStringValue(nextAttrs.raw);
  }

  const vnode = h(RbphMdcComponentPreview, state);
  vnode.appContext = (editor as EditorWithAppContext).appContext ?? null;
  renderVue(vnode, dom);
  renderAttrs(attrs);

  return {
    dom,
    update(node: { attrs: Record<string, unknown> }) {
      renderAttrs(node.attrs);
      return true;
    },
    selectNode() {
      dom.classList.add('rbph-mdc-component-selected');
    },
    deselectNode() {
      dom.classList.remove('rbph-mdc-component-selected');
    },
    stopEvent: () => false,
    ignoreMutation: () => true,
    destroy() {
      renderVue(null, dom);
    },
  };
}

export const RbphMdcComponentBlock = TiptapNode.create({
  name: 'mdcComponent',

  group: 'block',

  atom: true,

  isolating: true,

  selectable: true,

  addAttributes() {
    return {
      raw: { default: '' },
      name: { default: 'component' },
    };
  },

  parseHTML() {
    return [{ tag: 'section[data-rb-mdc-component]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['section', mergeAttributes({ 'data-rb-mdc-component': '' }, HTMLAttributes)];
  },

  addNodeView() {
    return ({ editor, node }) => createMdcComponentNodeView(editor, node.attrs, false);
  },

  parseMarkdown(token: MarkdownToken, helpers: MarkdownParseHelpers) {
    return helpers.createNode('mdcComponent', {
      raw: attrStringValue(token.raw).trimEnd(),
      name: normalizeComponentName(token.name),
    });
  },

  renderMarkdown(node: JSONContent, _helpers: MarkdownRendererHelpers) {
    return attrStringValue(node.attrs?.raw).trimEnd();
  },

  markdownTokenizer: {
    name: 'mdcComponent',
    level: 'block',
    start(src: string) {
      return findMdcComponentBlockStart(src);
    },
    tokenize(src: string) {
      const match = readMdcComponentBlock(src);
      if (!match) return undefined;

      return {
        type: 'mdcComponent',
        raw: match.raw,
        name: match.name,
      };
    },
  },
});

export const RbphMdcComponentInline = TiptapNode.create({
  name: 'mdcComponentInline',

  group: 'inline',

  inline: true,

  atom: true,

  isolating: true,

  selectable: true,

  addAttributes() {
    return {
      raw: { default: '' },
      name: { default: 'component' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-rb-mdc-component-inline]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-rb-mdc-component-inline': '' }, HTMLAttributes)];
  },

  addNodeView() {
    return ({ editor, node }) => createMdcComponentNodeView(editor, node.attrs, true);
  },

  addProseMirrorPlugins() {
    const nodeTypeName = this.name;

    return [
      new Plugin({
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some(transaction => transaction.docChanged)) return null;

          const insertPositions: number[] = [];
          newState.doc.descendants((node, pos) => {
            if (node.type.name !== nodeTypeName) return;
            const nodeBefore = newState.doc.resolve(pos).nodeBefore;
            if (needsSpaceBeforeMdcNode(nodeBefore)) {
              insertPositions.push(pos);
            }
          });

          if (!insertPositions.length) return null;

          const tr = newState.tr;
          insertPositions.sort((a, b) => b - a).forEach(pos => tr.insertText(' ', pos));
          return tr;
        },
      }),
    ];
  },

  parseMarkdown(token: MarkdownToken, helpers: MarkdownParseHelpers) {
    return helpers.createNode('mdcComponentInline', {
      raw: attrStringValue(token.raw),
      name: normalizeComponentName(token.name),
    });
  },

  renderMarkdown(node: JSONContent, _helpers: MarkdownRendererHelpers, context: RenderContext) {
    const raw = attrStringValue(node.attrs?.raw);
    return `${needsSpaceBeforeInlineMdc(context) ? ' ' : ''}${raw}`;
  },

  markdownTokenizer: {
    name: 'mdcComponentInline',
    level: 'inline',
    start(src: string) {
      return findMdcComponentInlineStart(src);
    },
    tokenize(src: string) {
      const match = readMdcComponentInline(src);
      if (!match) return undefined;

      return {
        type: 'mdcComponentInline',
        raw: match.raw,
        name: match.name,
      };
    },
  },
});
