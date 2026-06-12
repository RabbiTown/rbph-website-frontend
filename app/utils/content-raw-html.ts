import { Node as TiptapNode, mergeAttributes } from '@tiptap/core';
import type { Editor, JSONContent, MarkdownParseHelpers, MarkdownRendererHelpers, MarkdownToken } from '@tiptap/core';
import type { MDCElement, MDCNode, MDCRoot } from '@nuxtjs/mdc';

type RbRawHtmlMode = 'inline' | 'file';

type RbRawHtmlAttrs = {
  mode?: RbRawHtmlMode;
  html?: string;
  src?: string;
};

function attrStringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function normalizeRawHtmlMode(value: unknown): RbRawHtmlMode {
  return value === 'file' ? 'file' : 'inline';
}

function escapeMdcAttr(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', ' ');
}

function unescapeMdcAttr(value: string) {
  return value.replace(/\\(["\\])/g, '$1');
}

function encodeRawHtml(value: unknown) {
  return encodeURIComponent(attrStringValue(value));
}

function decodeRawHtml(value: unknown) {
  const raw = attrStringValue(value);
  if (!raw) return '';

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function parseMdcAttrs(value = ''): RbRawHtmlAttrs {
  const attrs: RbRawHtmlAttrs = {};
  const re = /([A-Za-z][\w-]*)=(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^\s}]+))/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(value))) {
    const key = match[1];
    const attrValue = unescapeMdcAttr(match[2] ?? match[3] ?? match[4] ?? '');
    if (key === 'mode') attrs.mode = normalizeRawHtmlMode(attrValue);
    if (key === 'src') attrs.src = attrValue;
    if (key === 'data') attrs.html = decodeRawHtml(attrValue);
  }

  return attrs;
}

function renderMdcAttrs(attrs: Record<string, unknown> | undefined) {
  const mode = normalizeRawHtmlMode(attrs?.mode);
  const entries = [
    ['mode', mode],
    ['src', mode === 'file' ? attrStringValue(attrs?.src) : undefined],
    ['data', mode === 'inline' ? encodeRawHtml(attrs?.html) : undefined],
  ].filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0);

  return entries.length ? `{${entries.map(([key, value]) => `${key}="${escapeMdcAttr(value)}"`).join(' ')}}` : '';
}

function updateAttrs(getPos: () => number | undefined, editor: Editor, attrs: RbRawHtmlAttrs) {
  const pos = getPos();
  if (typeof pos !== 'number') return;
  const node = editor.state.doc.nodeAt(pos);
  if (!node) return;
  editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs }));
}

function createButton(label: string) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'rounded px-2 py-1 text-xs transition hover:bg-elevated hover:text-highlighted';
  button.textContent = label;
  return button;
}

function dragMayContainAsset(event: DragEvent) {
  const types = Array.from(event.dataTransfer?.types ?? []);
  return types.includes('application/x-rbph-asset+json') || types.includes('text/uri-list') || types.includes('text/plain');
}

function createRawHtmlNodeView(editor: Editor, getPos: () => number | undefined, attrs: RbRawHtmlAttrs) {
  const dom = document.createElement('section');
  dom.className = 'not-prose my-4 overflow-hidden rounded-md border border-default bg-elevated/40';
  dom.dataset.rbRawHtml = '';

  const header = document.createElement('div');
  header.className = 'flex items-center justify-between gap-2 border-b border-default px-3 py-2';

  const title = document.createElement('div');
  title.className = 'flex items-center gap-2 text-sm font-medium text-highlighted';
  title.textContent = 'Raw HTML';

  const modeGroup = document.createElement('div');
  modeGroup.className = 'flex shrink-0 items-center gap-1 rounded-md p-0.5';
  const inlineButton = createButton('源码');
  const fileButton = createButton('URL');
  modeGroup.append(inlineButton, fileButton);
  header.append(title, modeGroup);

  const body = document.createElement('div');
  body.className = 'p-3';

  const textarea = document.createElement('textarea');
  textarea.className = 'block min-h-48 w-full resize-y rounded-md bg-default px-3 py-2 font-mono text-sm leading-6 text-highlighted outline-none ring ring-default transition focus:ring-primary disabled:cursor-not-allowed disabled:opacity-75';
  textarea.placeholder = '<div>...</div>';
  textarea.spellcheck = false;
  textarea.draggable = false;

  const filePanel = document.createElement('div');
  filePanel.className = 'space-y-2';

  const srcInput = document.createElement('input');
  srcInput.className = 'block w-full rounded-md bg-default px-3 py-2 font-mono text-sm text-highlighted outline-none ring ring-default transition focus:ring-primary disabled:cursor-not-allowed disabled:opacity-75';
  srcInput.placeholder = '/assets/.../index.html';
  srcInput.draggable = false;

  const dropZone = document.createElement('div');
  dropZone.className = 'flex min-h-28 items-center justify-center rounded-md border border-dashed border-default bg-default/60 px-4 text-center text-sm text-muted transition';
  dropZone.textContent = '拖入已上传的 HTML/CSS/JS 资产，或在上方粘贴文件 URL。';

  filePanel.append(srcInput, dropZone);
  let renderedMode: RbRawHtmlMode | undefined;

  function stopControlDrag(event: DragEvent) {
    event.stopPropagation();
  }

  function setMode(mode: RbRawHtmlMode) {
    updateAttrs(getPos, editor, { mode });
  }

  function useAsset(data: RbAssetDragData | undefined) {
    if (!data?.url) return;
    updateAttrs(getPos, editor, { mode: 'file', src: data.url });
  }

  function render(nextAttrs: RbRawHtmlAttrs) {
    const mode = normalizeRawHtmlMode(nextAttrs.mode);

    inlineButton.className = `${createButton('').className} ${mode === 'inline' ? 'bg-primary text-inverted hover:bg-primary hover:text-inverted' : ''}`;
    fileButton.className = `${createButton('').className} ${mode === 'file' ? 'bg-primary text-inverted hover:bg-primary hover:text-inverted' : ''}`;

    if (textarea.value !== attrStringValue(nextAttrs.html)) textarea.value = attrStringValue(nextAttrs.html);
    if (srcInput.value !== attrStringValue(nextAttrs.src)) srcInput.value = attrStringValue(nextAttrs.src);

    if (renderedMode !== mode) {
      body.replaceChildren(mode === 'file' ? filePanel : textarea);
      renderedMode = mode;
    }
  }

  inlineButton.addEventListener('click', event => {
    event.preventDefault();
    setMode('inline');
  });

  fileButton.addEventListener('click', event => {
    event.preventDefault();
    setMode('file');
  });

  textarea.addEventListener('input', () => {
    updateAttrs(getPos, editor, { html: textarea.value });
  });
  textarea.addEventListener('dragstart', stopControlDrag);

  srcInput.addEventListener('input', () => {
    updateAttrs(getPos, editor, { src: srcInput.value, mode: 'file' });
  });
  srcInput.addEventListener('dragstart', stopControlDrag);

  dropZone.addEventListener('dragover', event => {
    if (!dragMayContainAsset(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    dropZone.classList.add('border-primary', 'bg-primary/5', 'text-primary');
  });

  dropZone.addEventListener('dragleave', event => {
    if (!dropZone.contains(event.relatedTarget as globalThis.Node | null)) {
      dropZone.classList.remove('border-primary', 'bg-primary/5', 'text-primary');
    }
  });

  dropZone.addEventListener('drop', event => {
    const data = getRbAssetDragData(event);
    if (!data) return;
    event.preventDefault();
    dropZone.classList.remove('border-primary', 'bg-primary/5', 'text-primary');
    useAsset(data);
  });

  render(attrs);
  dom.append(header, body);

  return {
    dom,
    update(node: { attrs: RbRawHtmlAttrs }) {
      render(node.attrs);
      return true;
    },
    stopEvent: event => {
      const target = event.target as globalThis.Node | null;
      return Boolean(target && dom.contains(target));
    },
    ignoreMutation: () => true,
  };
}

export const RbphRawHtmlBlock = TiptapNode.create({
  name: 'rbRawHtml',

  group: 'block',

  atom: true,

  isolating: true,

  draggable: false,

  addAttributes() {
    return {
      mode: { default: 'inline' },
      html: { default: '' },
      src: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'section[data-rb-raw-html]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['section', mergeAttributes({ 'data-rb-raw-html': '' }, HTMLAttributes)];
  },

  addNodeView() {
    return ({ editor, getPos, node }) => createRawHtmlNodeView(editor, getPos, node.attrs);
  },

  parseMarkdown(token: MarkdownToken, helpers: MarkdownParseHelpers) {
    return helpers.createNode('rbRawHtml', token.attributes);
  },

  renderMarkdown(node: JSONContent, _helpers: MarkdownRendererHelpers) {
    return `::rb-raw-html${renderMdcAttrs(node.attrs)}\n::`;
  },

  markdownTokenizer: {
    name: 'rbRawHtml',
    level: 'block',
    start(src: string) {
      return src.match(/^::rb-raw-html/m)?.index ?? -1;
    },
    tokenize(src: string) {
      const openingMatch = src.match(/^::rb-raw-html(?:\{([^}]*)\})?\s*\n/);
      if (!openingMatch) return undefined;

      const [openingTag, attrSource = ''] = openingMatch;
      const remaining = src.slice(openingTag.length);
      const closingMatch = remaining.match(/^::\s*$/m);
      if (!closingMatch || closingMatch.index === undefined) return undefined;

      return {
        type: 'rbRawHtml',
        raw: src.slice(0, openingTag.length + closingMatch.index + closingMatch[0].length),
        attributes: parseMdcAttrs(attrSource),
      };
    },
  },
});

export function createRbRawHtmlBlock(editor: Editor) {
  return editor
    .chain()
    .focus()
    .insertContent({
      type: 'rbRawHtml',
      attrs: {
        mode: 'inline',
        html: '<div></div>',
        src: '',
      },
    });
}

export function transformRawHtmlBlocks<T extends MDCNode | MDCRoot>(node: T): T {
  if (node.type === 'root') {
    return {
      ...node,
      children: node.children.map(transformRawHtmlBlocks),
    };
  }

  if (node.type !== 'element') return node;

  const children = node.children.map(transformRawHtmlBlocks);

  if (node.tag === 'rb-raw-html') {
    const mode = normalizeRawHtmlMode(node.props?.mode);
    return {
      ...node,
      tag: 'rbph-raw-html-renderer',
      props: {
        mode,
        src: mode === 'file' ? attrStringValue(node.props?.src) : '',
        html: mode === 'inline' ? decodeRawHtml(node.props?.data) : '',
      },
      children: [],
    } as MDCElement as T;
  }

  return {
    ...node,
    children,
  };
}
