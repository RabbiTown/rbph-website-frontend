import { Node as TiptapNode, mergeAttributes } from '@tiptap/core';
import type { Editor, JSONContent, MarkdownParseHelpers, MarkdownRendererHelpers, MarkdownToken } from '@tiptap/core';
import type { MDCElement, MDCNode, MDCRoot } from '@nuxtjs/mdc';

type RbVueAppAttrs = {
  src?: string;
  props?: string;
};

function attrStringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function escapeMdcAttr(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', ' ');
}

function unescapeMdcAttr(value: string) {
  return value.replace(/\\(["\\])/g, '$1');
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

function parseMdcAttrs(value = ''): RbVueAppAttrs {
  const attrs: RbVueAppAttrs = {};
  const re = /([A-Za-z][\w-]*)=(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^\s}]+))/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(value))) {
    const key = match[1];
    const attrValue = unescapeMdcAttr(match[2] ?? match[3] ?? match[4] ?? '');
    if (key === 'src') attrs.src = attrValue;
    if (key === 'props') attrs.props = decodeAttr(attrValue);
  }

  return attrs;
}

function renderMdcAttrs(attrs: Record<string, unknown> | undefined) {
  const entries = [
    ['src', attrStringValue(attrs?.src)],
    ['props', encodeAttr(attrs?.props)],
  ].filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0);

  return entries.length ? `{${entries.map(([key, value]) => `${key}="${escapeMdcAttr(value)}"`).join(' ')}}` : '';
}

function updateAttrs(getPos: () => number | undefined, editor: Editor, attrs: RbVueAppAttrs) {
  const pos = getPos();
  if (typeof pos !== 'number') return;
  const node = editor.state.doc.nodeAt(pos);
  if (!node) return;
  editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs }));
}

function basename(path: string) {
  return path.split('/').filter(Boolean).at(-1) ?? path;
}

function joinAssetUrl(baseUrl: string, relativePath: string) {
  if (!relativePath) return baseUrl;
  return `${baseUrl.replace(/\/?$/, '/')}${relativePath.split('/').map(encodeURIComponent).join('/')}`;
}

export function resolveVueAppManifestUrl(data: RbAssetDragData | undefined) {
  if (!data?.url) return undefined;

  const cleanUrl = data.url.split(/[?#]/)[0] ?? data.url;
  if (basename(cleanUrl) === 'rbph-vue-app.json') return data.url;
  if (data.kind === 'file') return undefined;

  const files = data.files ?? [];
  const manifest = files.find(file => file.relativePath === 'rbph-vue-app.json') ?? files.find(file => basename(file.relativePath) === 'rbph-vue-app.json');
  if (manifest) return joinAssetUrl(data.url, manifest.relativePath);

  return undefined;
}

function createVueAppNodeView(editor: Editor, getPos: () => number | undefined, attrs: RbVueAppAttrs) {
  const dom = document.createElement('section');
  dom.className = 'not-prose my-4 overflow-hidden rounded-md border border-default bg-elevated/40';
  dom.dataset.rbVueApp = '';
  dom.dataset.nodeViewWrapper = '';

  const header = document.createElement('div');
  header.className = 'flex items-center justify-between gap-2 border-b border-default px-3 py-2';

  const title = document.createElement('div');
  title.className = 'text-sm font-medium text-highlighted';
  title.textContent = 'Vue SFC';

  header.append(title);

  const body = document.createElement('div');
  body.className = 'space-y-3 p-3';

  const srcInputFrame = document.createElement('div');
  srcInputFrame.className = 'relative';

  const srcInput = document.createElement('input');
  srcInput.className = 'block w-full rounded-md bg-default px-3 py-2 font-mono text-sm text-highlighted outline-none ring ring-default transition focus:ring-primary disabled:cursor-not-allowed disabled:opacity-75';
  srcInput.placeholder = '/assets/.../rbph-vue-app.json';
  srcInput.draggable = false;

  const srcInputOverlay = document.createElement('div');
  srcInputOverlay.className =
    'pointer-events-none absolute inset-0 flex items-center justify-center rounded-md border border-dashed border-primary bg-primary/5 px-3 text-center text-xs font-medium text-primary opacity-0 transition duration-150 ease-out';
  srcInputOverlay.textContent = '拖入 Vue SFC 资产组';

  const propsInput = document.createElement('textarea');
  propsInput.className = 'block min-h-28 w-full resize-y rounded-md bg-default px-3 py-2 font-mono text-sm leading-6 text-highlighted outline-none ring ring-default transition focus:ring-primary disabled:cursor-not-allowed disabled:opacity-75';
  propsInput.placeholder = 'rbph.props (JSON)';
  propsInput.spellcheck = false;
  propsInput.draggable = false;

  srcInputFrame.append(srcInput, srcInputOverlay);
  body.append(srcInputFrame, propsInput);
  let globalAssetDragActive = false;

  function stopControlDrag(event: DragEvent) {
    event.stopPropagation();
  }

  function useAsset(data: RbAssetDragData | undefined) {
    const manifestUrl = resolveVueAppManifestUrl(data);
    if (!manifestUrl) return false;
    updateAttrs(getPos, editor, { src: manifestUrl });
    return true;
  }

  function setAssetOverlayState(active: boolean, canDrop = false) {
    srcInputOverlay.textContent = canDrop ? '释放以使用该 Vue SFC 资产组' : '拖入 Vue SFC 资产组';
    srcInputOverlay.classList.toggle('opacity-0', !active);
    srcInputOverlay.classList.toggle('opacity-100', active);
    srcInputOverlay.classList.toggle('bg-primary/5', !canDrop);
    srcInputOverlay.classList.toggle('bg-primary/10', canDrop);
    srcInput.classList.toggle('opacity-0', active);
    srcInput.classList.toggle('ring-primary', canDrop);
  }

  function isEventOverSrcInput(event: DragEvent) {
    const target = event.target as globalThis.Node | null;
    return Boolean(target && srcInputFrame.contains(target));
  }

  function onGlobalAssetDrag(event: DragEvent) {
    if (!hasRbAssetDragData(event)) return;
    globalAssetDragActive = true;
    setAssetOverlayState(true, isEventOverSrcInput(event));
  }

  function onGlobalAssetDragLeave(event: DragEvent) {
    if (!hasRbAssetDragData(event)) return;
    const outsideViewport = event.clientX <= 0 || event.clientY <= 0 || event.clientX >= window.innerWidth || event.clientY >= window.innerHeight;
    if (event.relatedTarget || !outsideViewport) return;
    globalAssetDragActive = false;
    setAssetOverlayState(false);
  }

  function onGlobalAssetDragEnd() {
    globalAssetDragActive = false;
    setAssetOverlayState(false);
  }

  function render(nextAttrs: RbVueAppAttrs) {
    if (srcInput.value !== attrStringValue(nextAttrs.src)) srcInput.value = attrStringValue(nextAttrs.src);
    if (propsInput.value !== attrStringValue(nextAttrs.props)) propsInput.value = attrStringValue(nextAttrs.props);
  }

  srcInput.addEventListener('input', () => {
    updateAttrs(getPos, editor, { src: srcInput.value });
  });
  srcInput.addEventListener('dragstart', stopControlDrag);

  propsInput.addEventListener('input', () => {
    updateAttrs(getPos, editor, { props: propsInput.value });
  });
  propsInput.addEventListener('dragstart', stopControlDrag);

  dom.addEventListener('dragenter', event => {
    if (!hasRbAssetDragData(event)) return;
    globalAssetDragActive = true;
    setAssetOverlayState(true);
  });

  dom.addEventListener('dragleave', event => {
    if (!dom.contains(event.relatedTarget as globalThis.Node | null)) setAssetOverlayState(globalAssetDragActive);
  });

  dom.addEventListener('drop', event => {
    if (!hasRbAssetDragData(event)) return;
    event.preventDefault();
    event.stopPropagation();
    globalAssetDragActive = false;
    setAssetOverlayState(false);
  });

  srcInputFrame.addEventListener('dragenter', event => {
    if (!hasRbAssetDragData(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    globalAssetDragActive = true;
    setAssetOverlayState(true, true);
  });

  srcInputFrame.addEventListener('dragover', event => {
    if (!hasRbAssetDragData(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    globalAssetDragActive = true;
    setAssetOverlayState(true, true);
  });

  srcInputFrame.addEventListener('dragleave', event => {
    if (srcInputFrame.contains(event.relatedTarget as globalThis.Node | null)) return;
    setAssetOverlayState(globalAssetDragActive);
  });

  srcInputFrame.addEventListener('drop', event => {
    if (!hasRbAssetDragData(event)) return;
    event.preventDefault();
    event.stopPropagation();
    globalAssetDragActive = false;
    setAssetOverlayState(false);
    const data = getRbAssetDragData(event);
    if (!data) return;
    useAsset(data);
  });

  render(attrs);
  dom.append(header, body);
  window.addEventListener('dragstart', onGlobalAssetDrag);
  window.addEventListener('dragenter', onGlobalAssetDrag);
  window.addEventListener('dragover', onGlobalAssetDrag);
  window.addEventListener('dragleave', onGlobalAssetDragLeave);
  window.addEventListener('drop', onGlobalAssetDragEnd);
  window.addEventListener('dragend', onGlobalAssetDragEnd);

  return {
    dom,
    update(node: { attrs: RbVueAppAttrs }) {
      render(node.attrs);
      return true;
    },
    stopEvent: event => {
      const target = event.target as globalThis.Node | null;
      return Boolean(target && dom.contains(target));
    },
    ignoreMutation: () => true,
    destroy() {
      window.removeEventListener('dragstart', onGlobalAssetDrag);
      window.removeEventListener('dragenter', onGlobalAssetDrag);
      window.removeEventListener('dragover', onGlobalAssetDrag);
      window.removeEventListener('dragleave', onGlobalAssetDragLeave);
      window.removeEventListener('drop', onGlobalAssetDragEnd);
      window.removeEventListener('dragend', onGlobalAssetDragEnd);
    },
  };
}

export const RbphVueAppBlock = TiptapNode.create({
  name: 'rbVueApp',

  group: 'block',

  atom: true,

  isolating: true,

  draggable: false,

  addAttributes() {
    return {
      src: { default: '' },
      props: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'section[data-rb-vue-app]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['section', mergeAttributes({ 'data-rb-vue-app': '' }, HTMLAttributes)];
  },

  addNodeView() {
    return ({ editor, getPos, node }) => createVueAppNodeView(editor, getPos, node.attrs);
  },

  parseMarkdown(token: MarkdownToken, helpers: MarkdownParseHelpers) {
    return helpers.createNode('rbVueApp', token.attributes);
  },

  renderMarkdown(node: JSONContent, _helpers: MarkdownRendererHelpers) {
    return `::rb-vue-app${renderMdcAttrs(node.attrs)}\n::`;
  },

  markdownTokenizer: {
    name: 'rbVueApp',
    level: 'block',
    start(src: string) {
      return src.match(/^::rb-vue-app/m)?.index ?? -1;
    },
    tokenize(src: string) {
      const openingMatch = src.match(/^::rb-vue-app(?:\{([^}]*)\})?\s*\n/);
      if (!openingMatch) return undefined;

      const [openingTag, attrSource = ''] = openingMatch;
      const remaining = src.slice(openingTag.length);
      const closingMatch = remaining.match(/^::\s*$/m);
      if (!closingMatch || closingMatch.index === undefined) return undefined;

      return {
        type: 'rbVueApp',
        raw: src.slice(0, openingTag.length + closingMatch.index + closingMatch[0].length),
        attributes: parseMdcAttrs(attrSource),
      };
    },
  },
});

export function createRbVueAppBlock(editor: Editor, attrs: RbVueAppAttrs = {}) {
  return editor
    .chain()
    .focus()
    .insertContent({
      type: 'rbVueApp',
      attrs: {
        src: attrs.src ?? '',
        props: attrs.props ?? '',
      },
    });
}

export function rbVueAppContentFromAsset(data: RbAssetDragData | undefined) {
  const src = resolveVueAppManifestUrl(data);
  if (!src) return undefined;
  return {
    type: 'rbVueApp',
    attrs: {
      src,
      props: '',
    },
  };
}

export function transformVueAppBlocks<T extends MDCNode | MDCRoot>(node: T): T {
  if (node.type === 'root') {
    return {
      ...node,
      children: node.children.map(transformVueAppBlocks),
    };
  }

  if (node.type !== 'element') return node;

  const children = node.children.map(transformVueAppBlocks);

  if (node.tag === 'rb-vue-app') {
    return {
      ...node,
      tag: 'rbph-vue-app-renderer',
      props: {
        src: attrStringValue(node.props?.src),
        props: decodeAttr(node.props?.props),
      },
      children: [],
    } as MDCElement as T;
  }

  return {
    ...node,
    children,
  };
}
