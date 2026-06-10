import { Node as TiptapNode, mergeAttributes } from '@tiptap/core';
import type { Editor, JSONContent, MarkdownParseHelpers, MarkdownRendererHelpers, MarkdownToken } from '@tiptap/core';
import type { MDCElement, MDCNode, MDCRoot } from '@nuxtjs/mdc';

type RbImageAttrs = {
  src?: string;
  caption?: string;
  alt?: string;
  width?: number | string;
  align?: string;
  captionAlign?: string;
};

type RbImageAlign = 'left' | 'center' | 'right';

function attrStringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function normalizeImageWidth(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return 100;
  return Math.min(100, Math.max(20, Math.round(number)));
}

function normalizeImageAlign(value: unknown): RbImageAlign {
  return value === 'left' || value === 'right' ? value : 'center';
}

function alignJustifyClass(align: RbImageAlign) {
  return {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  }[align];
}

function alignTextClass(align: RbImageAlign) {
  return {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }[align];
}

function escapeMdcAttr(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', ' ');
}

function unescapeMdcAttr(value: string) {
  return value.replace(/\\(["\\])/g, '$1');
}

function parseMdcAttrs(value = ''): RbImageAttrs {
  const attrs: RbImageAttrs = {};
  const re = /([A-Za-z][\w-]*)=(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^\s}]+))/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(value))) {
    const key = match[1];
    const attrValue = unescapeMdcAttr(match[2] ?? match[3] ?? match[4] ?? '');
    if (key === 'src' || key === 'caption' || key === 'alt' || key === 'width' || key === 'align') {
      attrs[key] = attrValue;
    } else if (key === 'caption-align') {
      attrs.captionAlign = attrValue;
    }
  }

  return attrs;
}

function renderMdcAttrs(attrs: RbImageAttrs, includeCaption = true) {
  const entries = [
    ['src', attrs.src],
    ['caption', includeCaption ? attrs.caption : undefined],
    ['alt', attrs.alt],
    ['width', normalizeImageWidth(attrs.width) === 100 ? undefined : String(normalizeImageWidth(attrs.width))],
    ['align', normalizeImageAlign(attrs.align) === 'center' ? undefined : normalizeImageAlign(attrs.align)],
    ['caption-align', normalizeImageAlign(attrs.captionAlign) === 'center' ? undefined : normalizeImageAlign(attrs.captionAlign)],
  ].filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0);

  if (!entries.length) return '';
  return `{${entries.map(([key, value]) => `${key}="${escapeMdcAttr(value)}"`).join(' ')}}`;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Invalid image content'));
      }
    });
    reader.addEventListener('error', () => reject(reader.error ?? new Error('Failed to read image')));
    reader.readAsDataURL(file);
  });
}

function updateAttrs(getPos: () => number | undefined, editor: Editor, attrs: RbImageAttrs) {
  const pos = getPos();
  if (typeof pos !== 'number') return;
  const node = editor.state.doc.nodeAt(pos);
  if (!node) return;
  editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs }));
}

function createImageNodeView(editor: Editor, getPos: () => number | undefined, attrs: RbImageAttrs) {
  const dom = document.createElement('figure');
  dom.className = 'not-prose my-6 transition-colors';
  dom.draggable = false;

  const imageWrap = document.createElement('div');
  imageWrap.className = 'flex min-h-40 items-center';
  imageWrap.draggable = false;

  const imageBox = document.createElement('div');
  imageBox.className = 'group/image max-w-full rounded-md';
  imageBox.draggable = false;

  const imageSurface = document.createElement('div');
  imageSurface.className = 'relative rounded-md';
  imageSurface.contentEditable = 'false';
  imageSurface.draggable = false;

  const imageFrame = document.createElement('div');
  imageFrame.className = 'relative w-full rounded-md';
  imageFrame.draggable = false;

  const img = document.createElement('img');
  img.className = 'block h-auto w-full rounded-md';
  img.draggable = false;

  const placeholder = document.createElement('div');
  placeholder.className = 'flex min-h-40 w-full items-center justify-center rounded-md border border-dashed border-default bg-muted/30 text-sm text-muted';
  placeholder.textContent = '拖入图片';

  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'absolute -bottom-2 -right-2 z-10 flex size-5 cursor-nwse-resize items-center justify-center rounded-full bg-primary text-inverted opacity-0 shadow-md ring ring-primary/20 transition-opacity group-hover/image:opacity-100';
  resizeHandle.draggable = false;

  const resizeHandleIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  resizeHandleIcon.setAttribute('viewBox', '0 0 24 24');
  resizeHandleIcon.setAttribute('aria-hidden', 'true');
  resizeHandleIcon.setAttribute('style', 'transform: scaleX(-1)');
  resizeHandleIcon.classList.add('size-3.5');

  const resizeHandlePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  resizeHandlePath.setAttribute('fill', 'currentColor');
  resizeHandlePath.setAttribute('d', 'M5 19v-6h2v2.6L15.6 7H13V5h6v6h-2V8.4L8.4 17H11v2H5Z');
  resizeHandleIcon.append(resizeHandlePath);
  resizeHandle.append(resizeHandleIcon);

  const caption = document.createElement('figcaption');
  caption.className = 'mt-2 min-h-6 w-full px-1 py-1 text-center text-sm text-muted outline-none focus-within:text-default [&>*:first-child]:mt-0 [&>*:last-child]:mb-0';
  caption.dataset.placeholder = 'Caption';

  let renderedAlign = normalizeImageAlign(attrs.align);
  let renderedWidth = normalizeImageWidth(attrs.width);

  function showImageDropTarget() {
    imageSurface.classList.add('ring-2', 'ring-primary');
    placeholder.classList.add('border-primary', 'bg-primary/5');
  }

  function hideImageDropTarget() {
    imageSurface.classList.remove('ring-2', 'ring-primary');
    placeholder.classList.remove('border-primary', 'bg-primary/5');
  }

  function dragHasImageFile(event: DragEvent) {
    const types = Array.from(event.dataTransfer?.types ?? []);
    return types.includes('Files');
  }

  function render(nextAttrs: RbImageAttrs) {
    const src = attrStringValue(nextAttrs.src);
    const align = normalizeImageAlign(nextAttrs.align);
    const captionAlign = normalizeImageAlign(nextAttrs.captionAlign);
    const width = normalizeImageWidth(nextAttrs.width);

    renderedAlign = align;
    renderedWidth = width;
    imageWrap.className = `flex min-h-40 items-center ${alignJustifyClass(align)}`;
    caption.className = `mt-2 min-h-6 w-full px-1 py-1 ${alignTextClass(captionAlign)} text-sm text-muted outline-none focus-within:text-default [&>*:first-child]:mt-0 [&>*:last-child]:mb-0`;
    imageBox.style.width = `${width}%`;

    if (src) {
      if (img.src !== src) {
        img.src = src;
      }
      img.alt = attrStringValue(nextAttrs.alt);
      if (img.parentElement !== imageFrame || resizeHandle.parentElement !== imageFrame) {
        imageFrame.replaceChildren(img, resizeHandle);
      }
      if (imageFrame.parentElement !== imageSurface) {
        imageSurface.replaceChildren(imageFrame);
      }
    } else {
      if (placeholder.parentElement !== imageSurface) {
        imageSurface.replaceChildren(placeholder);
      }
    }

    if (imageSurface.parentElement !== imageBox || caption.parentElement !== imageBox) {
      imageBox.replaceChildren(imageSurface, caption);
    }

    if (imageBox.parentElement !== imageWrap) {
      imageWrap.replaceChildren(imageBox);
    }
  }

  async function useFile(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return;
    const src = await fileToDataUrl(file);
    const currentPos = getPos();
    const currentNode = typeof currentPos === 'number' ? editor.state.doc.nodeAt(currentPos) : undefined;
    updateAttrs(getPos, editor, {
      src,
      alt: attrStringValue(currentNode?.attrs.alt) || file.name,
    });
  }

  dom.addEventListener('dragover', event => {
    if (!dragHasImageFile(event)) return;
    event.preventDefault();
    showImageDropTarget();
  });

  dom.addEventListener('dragleave', event => {
    if (!dragHasImageFile(event)) return;
    if (!dom.contains(event.relatedTarget as globalThis.Node | null)) {
      hideImageDropTarget();
    }
  });

  dom.addEventListener('drop', event => {
    if (!dragHasImageFile(event)) return;
    event.preventDefault();
    hideImageDropTarget();
    void useFile(event.dataTransfer?.files.item(0) ?? undefined);
  });

  resizeHandle.addEventListener('mousedown', event => {
    event.preventDefault();
    event.stopPropagation();
  });

  imageSurface.addEventListener('mousedown', event => {
    if (resizeHandle.contains(event.target as globalThis.Node | null)) return;
    event.preventDefault();
  });

  imageSurface.addEventListener('click', event => {
    if (resizeHandle.contains(event.target as globalThis.Node | null)) return;
    const pos = getPos();
    if (typeof pos !== 'number') return;
    editor.commands.setNodeSelection(pos);
    editor.view.focus();
  });

  resizeHandle.addEventListener('pointerdown', event => {
    event.preventDefault();
    event.stopPropagation();
    resizeHandle.style.opacity = '1';

    let startX = event.clientX;
    let startWidth = renderedWidth;
    const wrapWidth = imageBox.getBoundingClientRect().width || imageWrap.getBoundingClientRect().width;
    if (!wrapWidth) return;
    resizeHandle.setPointerCapture(event.pointerId);

    const onPointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const delta = moveEvent.clientX - startX;
      const factor = renderedAlign === 'center' ? 2 : 1;
      const nextWidth = startWidth + factor * delta / wrapWidth * 100;
      const clampedWidth = normalizeImageWidth(nextWidth);
      updateAttrs(getPos, editor, { width: clampedWidth });

      if (clampedWidth !== Math.round(nextWidth)) {
        startX = moveEvent.clientX;
        startWidth = clampedWidth;
      }
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      if (resizeHandle.hasPointerCapture(upEvent.pointerId)) {
        resizeHandle.releasePointerCapture(upEvent.pointerId);
      }
      resizeHandle.style.removeProperty('opacity');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  });

  render(attrs);
  dom.append(imageWrap);

  return {
    dom,
    contentDOM: caption,
    update(node: { attrs: RbImageAttrs }) {
      render(node.attrs);
      return true;
    },
    stopEvent: event => {
      const target = event.target as globalThis.Node | null;
      if (!target || !dom.contains(target)) return false;
      if (resizeHandle.contains(target)) return true;
      if (event instanceof DragEvent && dragHasImageFile(event)) return true;
      return false;
    },
    ignoreMutation: mutation => !caption.contains(mutation.target),
  };
}

export const RbphImageBlock = TiptapNode.create({
  name: 'rbImage',

  group: 'block',

  content: 'inline*',

  isolating: true,

  draggable: false,

  addAttributes() {
    return {
      src: { default: '' },
      alt: { default: '' },
      width: { default: 100 },
      align: { default: 'center' },
      captionAlign: { default: 'center' },
    };
  },

  parseHTML() {
    return [{ tag: 'figure[data-rb-image]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const src = attrStringValue(HTMLAttributes.src);
    const align = normalizeImageAlign(HTMLAttributes.align);
    const captionAlign = normalizeImageAlign(HTMLAttributes.captionAlign);
    const width = normalizeImageWidth(HTMLAttributes.width);
    return [
      'figure',
      mergeAttributes({ 'data-rb-image': '', 'data-align': align, 'data-caption-align': captionAlign, 'data-width': String(width) }, HTMLAttributes),
      ['div', { style: `display: flex; justify-content: ${align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center'}` }, ['div', { style: `width: ${width}%` }, ['div', { contenteditable: 'false' }, ['img', { src, alt: attrStringValue(HTMLAttributes.alt), style: 'width: 100%' }]], ['figcaption', { style: `text-align: ${captionAlign}` }, 0]]],
    ];
  },

  addNodeView() {
    return ({ editor, getPos, node }) => createImageNodeView(editor, getPos, node.attrs);
  },

  parseMarkdown(token: MarkdownToken, helpers: MarkdownParseHelpers) {
    const attrs = { ...(token.attributes ?? {}) };
    const legacyCaption = attrStringValue(attrs.caption);
    delete attrs.caption;

    const content = helpers.parseInline(token.tokens || []);
    return helpers.createNode('rbImage', attrs, content.length ? content : legacyCaption ? [{ type: 'text', text: legacyCaption }] : []);
  },

  renderMarkdown(node: JSONContent, helpers: MarkdownRendererHelpers) {
    const caption = helpers.renderChildren(node.content || [], '');
    return caption ? `::rb-image${renderMdcAttrs(node.attrs ?? {}, false)}\n${caption}\n::` : `::rb-image${renderMdcAttrs(node.attrs ?? {}, false)}\n::`;
  },

  markdownTokenizer: {
    name: 'rbImage',
    level: 'block',
    start(src: string) {
      return src.match(/^::rb-image/m)?.index ?? -1;
    },
    tokenize(src: string, _tokens: MarkdownToken[], lexer: { inlineTokens: (src: string) => MarkdownToken[] }) {
      const openingMatch = src.match(/^::rb-image(?:\{([^}]*)\})?\s*\n/);
      if (!openingMatch) return undefined;

      const [openingTag, attrSource = ''] = openingMatch;
      const remaining = src.slice(openingTag.length);
      const closingMatch = remaining.match(/^::\s*$/m);
      if (!closingMatch || closingMatch.index === undefined) return undefined;

      const raw = src.slice(0, openingTag.length + closingMatch.index + closingMatch[0].length);
      const caption = remaining.slice(0, closingMatch.index).trim();
      return {
        type: 'rbImage',
        raw,
        attributes: parseMdcAttrs(attrSource),
        tokens: caption ? lexer.inlineTokens(caption) : [],
      };
    },
  },
});

export function createRbImageBlock(editor: Editor) {
  return editor.chain().focus().insertContent({ type: 'rbImage', attrs: { src: '', alt: '', width: 100, align: 'center', captionAlign: 'center' } });
}

export function transformImageBlocks<T extends MDCNode | MDCRoot>(node: T): T {
  if (node.type === 'root') {
    return {
      ...node,
      children: node.children.map(transformImageBlocks),
    };
  }

  if (node.type !== 'element') return node;

  const children = node.children.map(transformImageBlocks);

  if (node.tag === 'rb-image') {
    const src = attrStringValue(node.props?.src);
    const legacyCaption = attrStringValue(node.props?.caption);
    const captionChildren = children.length ? children : legacyCaption ? [{ type: 'text' as const, value: legacyCaption }] : [];
    const alt = legacyCaption || attrStringValue(node.props?.alt);
    const width = normalizeImageWidth(node.props?.width);
    const align = normalizeImageAlign(node.props?.align);
    const captionAlign = normalizeImageAlign(node.props?.['caption-align']);

    return {
      ...node,
      tag: 'figure',
      props: {
        class: `my-6 flex ${alignJustifyClass(align)}`,
        'data-rb-image': '',
        'data-align': align,
        'data-caption-align': captionAlign,
        'data-width': String(width),
      },
      children: src
        ? [
            {
              type: 'element',
              tag: 'div',
              props: { class: 'max-w-full', style: `width: ${width}%` },
              children: [
                { type: 'element', tag: 'img', props: { src, alt, class: 'w-full max-w-full rounded-md' }, children: [] },
                ...(captionChildren.length ? [{ type: 'element' as const, tag: 'figcaption', props: { class: `mt-2 ${alignTextClass(captionAlign)} text-sm text-muted` }, children: captionChildren }] : []),
              ],
            },
          ]
        : [],
    } as MDCElement as T;
  }

  return {
    ...node,
    children,
  };
}
