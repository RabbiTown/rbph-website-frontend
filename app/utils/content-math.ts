import { InputRule, Node as TiptapNode, mergeAttributes } from '@tiptap/core';
import type { Editor, InputRuleFinder, JSONContent, MarkdownParseHelpers, MarkdownRendererHelpers, MarkdownToken } from '@tiptap/core';
import type { NodeType } from '@tiptap/pm/model';
import type { MDCElement, MDCNode, MDCRoot } from '@nuxtjs/mdc';
import katex from 'katex';

type RbphMathAttrs = {
  tex?: string;
};

type MathSegment = {
  start: number;
  end: number;
  tex: string;
  delimiter: 'dollar' | 'paren';
};

const fencedCodeRe = /(`{3,}|~{3,})/;
const skipMdcBlockRe = /^\s*::(?:rb-raw-html|rb-vue-app)(?:\{[^}]*\})?\s*$/;

function attrStringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function encodeAttr(value: unknown) {
  return encodeURIComponent(attrStringValue(value));
}

function decodeAttr(value: unknown) {
  const raw = attrStringValue(value);
  if (!raw) return '';

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function escapeMdcAttr(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', ' ');
}

function mathContentFromAttrs(attrs: Record<string, unknown> | undefined) {
  return attrStringValue(attrs?.tex);
}

function updateAttrs(getPos: () => number | undefined, editor: Editor, attrs: RbphMathAttrs) {
  const pos = getPos();
  if (typeof pos !== 'number') return;
  const node = editor.state.doc.nodeAt(pos);
  if (!node) return;
  editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs }));
}

function renderKatex(dom: HTMLElement, tex: string, display: boolean) {
  dom.classList.remove('rbph-math-node-error');

  try {
    katex.render(tex, dom, {
      displayMode: display,
      throwOnError: true,
      strict: false,
      trust: false,
      output: 'html',
    });
  } catch {
    dom.textContent = tex;
    dom.classList.add('rbph-math-node-error');
  }
}

function createMathNodeView(editor: Editor, getPos: () => number | undefined, attrs: RbphMathAttrs, display: boolean) {
  const dom = document.createElement(display ? 'div' : 'span');
  dom.className = display ? 'rbph-math-node rbph-math-node-block my-4 rounded-md px-2 py-1' : 'rbph-math-node rbph-math-node-inline rounded px-1';
  dom.dataset.rbphMath = display ? 'block' : 'inline';
  dom.dataset.nodeViewWrapper = '';
  let popoverOpen = false;
  let rafId = 0;

  const popover = document.createElement('div');
  popover.className = 'fixed z-50 w-[min(28rem,calc(100vw-1.5rem))] rounded-md bg-default/95 p-2 shadow-lg ring ring-default backdrop-blur';
  popover.dataset.rbphMathPopover = '';

  const input = document.createElement(display ? 'textarea' : 'input');
  input.className = display
    ? 'block min-h-28 w-full resize-y rounded-md bg-default px-3 py-2 font-mono text-sm leading-6 text-highlighted outline-none ring ring-default transition focus:ring-primary'
    : 'block w-full rounded-md bg-default px-3 py-2 font-mono text-sm text-highlighted outline-none ring ring-default transition focus:ring-primary';
  input.spellcheck = false;
  input.draggable = false;
  if (input instanceof HTMLInputElement) input.type = 'text';
  let draftTex = attrStringValue(attrs.tex);

  popover.append(input);

  function render(nextAttrs: RbphMathAttrs) {
    const tex = attrStringValue(nextAttrs.tex);
    dom.dataset.tex = tex;

    renderKatex(dom, tex, display);
  }

  function updatePopoverPosition() {
    if (!popoverOpen) return;

    const rect = dom.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const viewportPadding = 12;
    const topCandidate = rect.bottom + 8;
    const top =
      topCandidate + popoverRect.height <= window.innerHeight - viewportPadding
        ? topCandidate
        : Math.max(viewportPadding, rect.top - popoverRect.height - 8);
    const left = Math.min(Math.max(viewportPadding, rect.left), window.innerWidth - popoverRect.width - viewportPadding);

    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
  }

  function schedulePopoverPosition() {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(updatePopoverPosition);
  }

  function openPopover() {
    if (!editor.isEditable) return;
    popoverOpen = true;
    dom.classList.add('rbph-math-node-editing');
    draftTex = attrStringValue(attrs.tex);
    input.value = draftTex;
    if (!document.body.contains(popover)) document.body.append(popover);
    updatePopoverPosition();
    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  }

  function closePopover() {
    if (!popoverOpen) return;
    popoverOpen = false;
    dom.classList.remove('rbph-math-node-editing');
    updateAttrs(getPos, editor, { tex: draftTex });
    popover.remove();
  }

  function onClickOutside(event: Event) {
    const target = event.target as globalThis.Node | null;
    if (!target || dom.contains(target) || popover.contains(target)) return;
    closePopover();
  }

  function onWindowChange() {
    schedulePopoverPosition();
  }

  dom.addEventListener('click', event => {
    if (!editor.isEditable) return;
    event.preventDefault();
    event.stopPropagation();
    const pos = getPos();
    if (typeof pos === 'number') editor.commands.setNodeSelection(pos);
    openPopover();
  });

  popover.addEventListener('mousedown', event => {
    event.stopPropagation();
  });

  popover.addEventListener('click', event => {
    event.stopPropagation();
  });

  input.addEventListener('input', () => {
    draftTex = input.value;
    render({ tex: draftTex });
    schedulePopoverPosition();
  });

  input.addEventListener('blur', () => {
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active && popover.contains(active)) return;
      closePopover();
    });
  });

  input.addEventListener('keydown', event => {
    if (event.key === 'Escape' || (event.key === 'Enter' && (event.metaKey || event.ctrlKey || !display))) {
      event.preventDefault();
      closePopover();
      editor.commands.focus();
    }
  });

  document.addEventListener('mousedown', onClickOutside);
  window.addEventListener('resize', onWindowChange);
  window.addEventListener('scroll', onWindowChange, true);

  render(attrs);

  return {
    dom,
    update(node: { attrs: RbphMathAttrs }) {
      attrs = node.attrs;
      if (popoverOpen) {
        render({ tex: draftTex });
      } else {
        render(node.attrs);
      }
      schedulePopoverPosition();
      return true;
    },
    selectNode() {
      dom.classList.add('rbph-math-node-selected');
      openPopover();
    },
    deselectNode() {
      dom.classList.remove('rbph-math-node-selected');
      closePopover();
    },
    stopEvent: event => {
      const target = event.target as globalThis.Node | null;
      return Boolean(target && popover.contains(target));
    },
    ignoreMutation: () => true,
    destroy() {
      cancelAnimationFrame(rafId);
      popover.remove();
      document.removeEventListener('mousedown', onClickOutside);
      window.removeEventListener('resize', onWindowChange);
      window.removeEventListener('scroll', onWindowChange, true);
    },
  };
}

function canUseDollarInline(src: string, start: number, end: number) {
  const next = src[start + 1] ?? '';
  const beforeClosing = src[end - 1] ?? '';
  if (!next || !beforeClosing || /\s/.test(next) || /\s/.test(beforeClosing)) return false;
  return true;
}

function isInsideCodeSpan(src: string, index: number) {
  let inCode = false;
  let tickRun = 0;

  for (let cursor = 0; cursor < index; cursor += 1) {
    if (src[cursor] !== '`') continue;

    let end = cursor + 1;
    while (src[end] === '`') end += 1;
    const runLength = end - cursor;

    if (!inCode) {
      inCode = true;
      tickRun = runLength;
    } else if (runLength === tickRun) {
      inCode = false;
      tickRun = 0;
    }

    cursor = end - 1;
  }

  return inCode;
}

function findDollarInline(src: string, from = 0): MathSegment | undefined {
  for (let start = src.indexOf('$', from); start !== -1; start = src.indexOf('$', start + 1)) {
    if (src[start + 1] === '$') continue;
    if (start > 0 && src[start - 1] === '$') continue;
    if (start > 0 && src[start - 1] === '\\') continue;
    if (isInsideCodeSpan(src, start)) continue;

    for (let end = src.indexOf('$', start + 1); end !== -1; end = src.indexOf('$', end + 1)) {
      if (src[end - 1] === '\\' || src[end + 1] === '$') continue;

      const tex = src.slice(start + 1, end);
      if (tex.includes('$')) break;
      if (!canUseDollarInline(src, start, end)) break;
      if (!tex.includes('\n') && tex.trim()) {
        return { start, end: end + 1, tex: tex.trim(), delimiter: 'dollar' };
      }
      break;
    }
  }

  return undefined;
}

function findDelimitedInline(src: string, open: string, close: string, from = 0): MathSegment | undefined {
  for (let start = src.indexOf(open, from); start !== -1; start = src.indexOf(open, start + open.length)) {
    if (isInsideCodeSpan(src, start)) continue;

    const end = src.indexOf(close, start + open.length);
    if (end === -1) return undefined;

    const tex = src.slice(start + open.length, end);
    if (!tex.includes('\n') && tex.trim()) {
      return { start, end: end + close.length, tex: tex.trim(), delimiter: 'paren' };
    }
  }

  return undefined;
}

function findNextInlineMath(src: string, from = 0) {
  return [findDollarInline(src, from), findDelimitedInline(src, '\\(', '\\)', from)].filter(Boolean).sort((a, b) => a.start - b.start)[0];
}

function findDollarInlineInput(text: string) {
  const match = /\$([^$\s](?:[^$\n]*[^$\s])?)\$$/.exec(text);
  if (!match?.[1]) return null;

  const start = text.length - match[0].length;
  if (start > 0 && text[start - 1] === '$') return null;

  return {
    index: start,
    text: match[0],
    replaceWith: match[1],
  };
}

function inlineMathInputRule(type: NodeType, find: InputRuleFinder, getTex: (match: RegExpMatchArray) => string | undefined) {
  return new InputRule({
    find,
    handler: ({ state, range, match }) => {
      const tex = getTex(match)?.trim();
      if (!tex) return;

      const resolved = state.doc.resolve(range.from);
      if (!resolved.parent.canReplaceWith(resolved.index(), resolved.index(), type)) return;

      state.tr.replaceWith(range.from, range.to, type.create({ tex })).scrollIntoView();
    },
  });
}

function dollarBlockToMdc(src: string) {
  const match = src.match(/^\s{0,3}\$\$\s*\n([\s\S]*?)\n\s{0,3}\$\$\s*$/);
  if (!match) return undefined;
  const tex = match[1]?.trim();
  return tex ? `::rbph-math{tex="${escapeMdcAttr(encodeAttr(tex))}" display="true"}\n::` : undefined;
}

function matchDollarBlock(src: string) {
  return src.match(/^(\s{0,3}\$\$\s*\n([\s\S]*?)\n\s{0,3}\$\$\s*)/);
}

function matchBracketBlock(src: string) {
  return src.match(/^(\s{0,3}\\\[\s*\n([\s\S]*?)\n\s{0,3}\\\]\s*)/);
}

function matchSingleLineDollarBlock(src: string) {
  return src.match(/^(\s{0,3}\$\$\s*([^\n]+?)\s*\$\$\s*)/);
}

function matchSingleLineBracketBlock(src: string) {
  return src.match(/^(\s{0,3}\\\[\s*([^\n]+?)\s*\\\]\s*)/);
}

function bracketBlockToMdc(src: string) {
  const match = src.match(/^\s{0,3}\\\[\s*\n([\s\S]*?)\n\s{0,3}\\\]\s*$/);
  if (!match) return undefined;
  const tex = match[1]?.trim();
  return tex ? `::rbph-math{tex="${escapeMdcAttr(encodeAttr(tex))}" display="true"}\n::` : undefined;
}

function singleLineBlockToMdc(src: string) {
  const dollarMatch = src.match(/^\s{0,3}\$\$\s*([\s\S]*?)\s*\$\$\s*$/);
  if (dollarMatch?.[1]?.trim()) return `::rbph-math{tex="${escapeMdcAttr(encodeAttr(dollarMatch[1].trim()))}" display="true"}\n::`;

  const bracketMatch = src.match(/^\s{0,3}\\\[\s*([\s\S]*?)\s*\\\]\s*$/);
  if (bracketMatch?.[1]?.trim()) return `::rbph-math{tex="${escapeMdcAttr(encodeAttr(bracketMatch[1].trim()))}" display="true"}\n::`;

  return undefined;
}

function matchMathBlock(src: string) {
  const dollarBlock = matchDollarBlock(src);
  if (dollarBlock?.[2]?.trim()) return { raw: dollarBlock[1], tex: dollarBlock[2].trim() };

  const bracketBlock = matchBracketBlock(src);
  if (bracketBlock?.[2]?.trim()) return { raw: bracketBlock[1], tex: bracketBlock[2].trim() };

  const singleLineDollarBlock = matchSingleLineDollarBlock(src);
  if (singleLineDollarBlock?.[2]?.trim()) return { raw: singleLineDollarBlock[1], tex: singleLineDollarBlock[2].trim() };

  const singleLineBracketBlock = matchSingleLineBracketBlock(src);
  if (singleLineBracketBlock?.[2]?.trim()) return { raw: singleLineBracketBlock[1], tex: singleLineBracketBlock[2].trim() };

  return undefined;
}

function transformParagraphMath(paragraph: string) {
  return dollarBlockToMdc(paragraph) ?? bracketBlockToMdc(paragraph) ?? singleLineBlockToMdc(paragraph) ?? paragraph;
}

function transformMathParagraphs(markdown: string) {
  const lines = markdown.split('\n');
  const out: string[] = [];
  let paragraph: string[] = [];
  let inFence = false;
  let fenceMarker = '';
  let inSkippedMdcBlock = false;

  function flushParagraph() {
    if (!paragraph.length) return;
    out.push(transformParagraphMath(paragraph.join('\n')));
    paragraph = [];
  }

  for (const line of lines) {
    const fenceMatch = line.match(fencedCodeRe);
    if (fenceMatch && line.trimStart().startsWith(fenceMatch[1])) {
      flushParagraph();
      if (!inFence) {
        inFence = true;
        fenceMarker = fenceMatch[1][0] ?? '`';
      } else if (line.trimStart().startsWith(fenceMarker.repeat(3))) {
        inFence = false;
        fenceMarker = '';
      }
      out.push(line);
      continue;
    }

    if (inFence) {
      out.push(line);
      continue;
    }

    if (inSkippedMdcBlock) {
      out.push(line);
      if (/^\s*::\s*$/.test(line)) inSkippedMdcBlock = false;
      continue;
    }

    if (skipMdcBlockRe.test(line)) {
      flushParagraph();
      inSkippedMdcBlock = true;
      out.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      out.push(line);
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  return out.join('\n');
}

export function transformMarkdownMath(markdown: string) {
  return transformMathParagraphs(markdown);
}

function inlineMathTextNodes(value: string): MDCNode[] {
  const children: MDCNode[] = [];
  let cursor = 0;
  let segment = findNextInlineMath(value, cursor);

  while (segment) {
    if (segment.start > cursor) {
      children.push({
        type: 'text',
        value: value.slice(cursor, segment.start),
      });
    }

    children.push({
      type: 'element',
      tag: 'rbph-katex-renderer',
      props: {
        tex: segment.tex,
        display: false,
      },
      children: [],
    } as MDCElement);

    cursor = segment.end;
    segment = findNextInlineMath(value, cursor);
  }

  if (cursor < value.length) {
    children.push({
      type: 'text',
      value: value.slice(cursor),
    });
  }

  return children.length ? children : [{ type: 'text', value }];
}

export const RbphMathInline = TiptapNode.create({
  name: 'mathInline',

  group: 'inline',

  inline: true,

  atom: true,

  addAttributes() {
    return {
      tex: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-rbph-math="inline"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-rbph-math': 'inline' }, HTMLAttributes)];
  },

  addNodeView() {
    return ({ editor, getPos, node }) => createMathNodeView(editor, getPos, node.attrs, false);
  },

  parseMarkdown(token: MarkdownToken, helpers: MarkdownParseHelpers) {
    return helpers.createNode('mathInline', { tex: token.tex });
  },

  renderMarkdown(node: JSONContent, _helpers: MarkdownRendererHelpers) {
    return `$${mathContentFromAttrs(node.attrs)}$`;
  },

  markdownTokenizer: {
    name: 'mathInline',
    level: 'inline',
    start(src: string) {
      const dollar = src.indexOf('$');
      const paren = src.indexOf('\\(');
      if (dollar === -1) return paren;
      if (paren === -1) return dollar;
      return Math.min(dollar, paren);
    },
    tokenize(src: string) {
      const segment = findNextInlineMath(src);
      if (!segment || segment.start !== 0) return undefined;
      return {
        type: 'mathInline',
        raw: src.slice(segment.start, segment.end),
        tex: segment.tex,
      };
    },
  },

  addInputRules() {
    return [
      inlineMathInputRule(this.type, findDollarInlineInput, match => match[1]),
    ];
  },
});

export const RbphMathBlock = TiptapNode.create({
  name: 'mathBlock',

  group: 'block',

  atom: true,

  isolating: true,

  addAttributes() {
    return {
      tex: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-rbph-math="block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-rbph-math': 'block' }, HTMLAttributes)];
  },

  addNodeView() {
    return ({ editor, getPos, node }) => createMathNodeView(editor, getPos, node.attrs, true);
  },

  parseMarkdown(token: MarkdownToken, helpers: MarkdownParseHelpers) {
    return helpers.createNode('mathBlock', { tex: token.tex });
  },

  renderMarkdown(node: JSONContent, _helpers: MarkdownRendererHelpers) {
    return `$$\n${mathContentFromAttrs(node.attrs)}\n$$`;
  },

  markdownTokenizer: {
    name: 'mathBlock',
    level: 'block',
    start(src: string) {
      const dollar = src.search(/^\s{0,3}\$\$/m);
      const bracket = src.search(/^\s{0,3}\\\[/m);
      if (dollar === -1) return bracket;
      if (bracket === -1) return dollar;
      return Math.min(dollar, bracket);
    },
    tokenize(src: string) {
      const block = matchMathBlock(src);
      if (!block) return undefined;
      return {
        type: 'mathBlock',
        raw: block.raw,
        tex: block.tex,
      };
    },
  },
});

export function createRbphMathInline(editor: Editor) {
  return editor
    .chain()
    .focus()
    .insertContent({
      type: 'mathInline',
      attrs: {
        tex: 'x^2',
      },
    });
}

export function createRbphMathBlock(editor: Editor) {
  return editor
    .chain()
    .focus()
    .insertContent({
      type: 'mathBlock',
      attrs: {
        tex: 'x^2 + y^2 = z^2',
      },
    });
}

export function transformMathNodes<T extends MDCNode | MDCRoot>(node: T): T {
  if (node.type === 'root') {
    return {
      ...node,
      children: node.children.flatMap(child => {
        const transformed = transformMathNodes(child);
        return transformed.type === 'text' ? inlineMathTextNodes(transformed.value) : [transformed];
      }),
    };
  }

  if (node.type === 'text') {
    return node;
  }

  if (node.type !== 'element') return node;

  if (['code', 'pre', 'rb-raw-html', 'rb-vue-app', 'rbph-raw-html-renderer', 'rbph-vue-app-renderer'].includes(node.tag)) return node;

  const children = node.children.flatMap(child => {
    const transformed = transformMathNodes(child);
    return transformed.type === 'text' ? inlineMathTextNodes(transformed.value) : [transformed];
  });

  if (node.tag === 'rbph-math') {
    return {
      ...node,
      tag: 'rbph-katex-renderer',
      props: {
        tex: decodeAttr(node.props?.tex),
        display: node.props?.display === true || node.props?.display === 'true',
      },
      children: [],
    } as MDCElement as T;
  }

  return {
    ...node,
    children,
  };
}
