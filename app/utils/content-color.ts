import { Node as TiptapNode, mergeAttributes } from '@tiptap/core';
import { TextStyle } from '@tiptap/extension-text-style';
import type { JSONContent, MarkdownParseHelpers, MarkdownRendererHelpers, MarkdownToken } from '@tiptap/core';
import type { MDCElement, MDCNode, MDCRoot } from '@nuxtjs/mdc';

export const rbTextColors = [
  { label: '默认', value: null, class: '', swatch: 'bg-highlighted' },
  { label: '红色', value: '#ef4444', class: 'text-red-500', swatch: 'bg-red-500' },
  { label: '橙色', value: '#f97316', class: 'text-orange-500', swatch: 'bg-orange-500' },
  { label: '黄色', value: '#eab308', class: 'text-yellow-500', swatch: 'bg-yellow-500' },
  { label: '绿色', value: '#22c55e', class: 'text-green-500', swatch: 'bg-green-500' },
  { label: '蓝色', value: '#3b82f6', class: 'text-blue-500', swatch: 'bg-blue-500' },
  { label: '紫色', value: '#a855f7', class: 'text-purple-500', swatch: 'bg-purple-500' },
] as const;

export const rbTextColorPalette = [
  {
    label: '基础',
    colors: [
      { label: '黑色', value: '#111827' },
      { label: '灰色', value: '#6b7280' },
      { label: '红色', value: '#ef4444' },
      { label: '橙色', value: '#f97316' },
      { label: '黄色', value: '#eab308' },
      { label: '绿色', value: '#22c55e' },
      { label: '青色', value: '#06b6d4' },
      { label: '蓝色', value: '#3b82f6' },
      { label: '紫色', value: '#a855f7' },
      { label: '粉色', value: '#ec4899' },
    ],
  },
  {
    label: '柔和',
    colors: [
      { label: '浅红', value: '#fca5a5' },
      { label: '浅橙', value: '#fdba74' },
      { label: '浅黄', value: '#fde047' },
      { label: '浅绿', value: '#86efac' },
      { label: '浅青', value: '#67e8f9' },
      { label: '浅蓝', value: '#93c5fd' },
      { label: '浅紫', value: '#c4b5fd' },
      { label: '浅粉', value: '#f9a8d4' },
    ],
  },
  {
    label: '深色',
    colors: [
      { label: '深红', value: '#b91c1c' },
      { label: '深橙', value: '#c2410c' },
      { label: '深黄', value: '#a16207' },
      { label: '深绿', value: '#15803d' },
      { label: '深青', value: '#0e7490' },
      { label: '深蓝', value: '#1d4ed8' },
      { label: '深紫', value: '#7e22ce' },
      { label: '深粉', value: '#be185d' },
    ],
  },
] as const;

export const rbTextColorGrid = [
  { label: '灰色 300', value: '#d1d5db' },
  { label: '红色 300', value: '#fca5a5' },
  { label: '橙色 300', value: '#fdba74' },
  { label: '黄色 300', value: '#fde047' },
  { label: '青柠 300', value: '#bef264' },
  { label: '绿色 300', value: '#86efac' },
  { label: '青色 300', value: '#67e8f9' },
  { label: '蓝色 300', value: '#93c5fd' },
  { label: '紫色 300', value: '#c4b5fd' },
  { label: '粉色 300', value: '#f9a8d4' },
  { label: '灰色 400', value: '#9ca3af' },
  { label: '红色 400', value: '#f87171' },
  { label: '橙色 400', value: '#fb923c' },
  { label: '黄色 400', value: '#facc15' },
  { label: '青柠 400', value: '#a3e635' },
  { label: '绿色 400', value: '#4ade80' },
  { label: '青色 400', value: '#22d3ee' },
  { label: '蓝色 400', value: '#60a5fa' },
  { label: '紫色 400', value: '#a78bfa' },
  { label: '粉色 400', value: '#f472b6' },
  { label: '灰色 500', value: '#6b7280' },
  { label: '红色 500', value: '#ef4444' },
  { label: '橙色 500', value: '#f97316' },
  { label: '黄色 500', value: '#eab308' },
  { label: '青柠 500', value: '#84cc16' },
  { label: '绿色 500', value: '#22c55e' },
  { label: '青色 500', value: '#06b6d4' },
  { label: '蓝色 500', value: '#3b82f6' },
  { label: '紫色 500', value: '#8b5cf6' },
  { label: '粉色 500', value: '#ec4899' },
  { label: '灰色 600', value: '#4b5563' },
  { label: '红色 600', value: '#dc2626' },
  { label: '橙色 600', value: '#ea580c' },
  { label: '黄色 600', value: '#ca8a04' },
  { label: '青柠 600', value: '#65a30d' },
  { label: '绿色 600', value: '#16a34a' },
  { label: '青色 600', value: '#0891b2' },
  { label: '蓝色 600', value: '#2563eb' },
  { label: '紫色 600', value: '#7c3aed' },
  { label: '粉色 600', value: '#db2777' },
  { label: '灰色 700', value: '#374151' },
  { label: '红色 700', value: '#b91c1c' },
  { label: '橙色 700', value: '#c2410c' },
  { label: '黄色 700', value: '#a16207' },
  { label: '青柠 700', value: '#4d7c0f' },
  { label: '绿色 700', value: '#15803d' },
  { label: '青色 700', value: '#0e7490' },
  { label: '蓝色 700', value: '#1d4ed8' },
  { label: '紫色 700', value: '#6d28d9' },
  { label: '粉色 700', value: '#be185d' },
] as const;

export type RbTextColor = string | null;

function normalizeColorChannel(value: string) {
  const channel = value.trim();
  if (channel.endsWith('%')) {
    const percent = Number(channel.slice(0, -1));
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null;
    return Math.round(percent * 2.55);
  }

  const number = Number(channel);
  if (!Number.isFinite(number) || number < 0 || number > 255) return null;
  return Math.round(number);
}

function rgbToHex(value: string) {
  const match = value.match(/^rgba?\(\s*(.+?)\s*\)$/);
  if (!match?.[1]) return null;

  const channels = match[1]
    .replace(/\s*\/\s*[^,)\s]+$/, '')
    .split(match[1].includes(',') ? ',' : /\s+/)
    .map(item => item.trim())
    .filter(Boolean);

  if (channels.length < 3) return null;

  const rgb = channels.slice(0, 3).map(normalizeColorChannel);
  if (rgb.some(channel => channel === null)) return null;

  return `#${rgb.map(channel => channel!.toString(16).padStart(2, '0')).join('')}`;
}

export function normalizeTextColor(value: unknown): RbTextColor {
  if (typeof value !== 'string') return null;
  const color = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }
  if (/^#[0-9a-f]{6}$/.test(color)) return color;
  return rgbToHex(color);
}

function colorProps(value: unknown) {
  const color = normalizeTextColor(value);
  const preset = rbTextColors.find(item => item.value === color);
  if (preset?.class) return { class: preset.class };
  if (color) return { style: `color: ${color}` };
  return {};
}

function normalizeMdcClass(value: unknown) {
  const classNames = Array.isArray(value) ? value.filter(item => typeof item === 'string').join(' ') : value;
  if (typeof classNames !== 'string') return null;
  const classes = classNames
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return classes.length ? classes.join(' ') : null;
}

function normalizeMdcId(value: unknown) {
  if (typeof value !== 'string') return null;
  const id = value.trim();
  return id && !/\s/.test(id) ? id : null;
}

function normalizeMdcStyle(value: unknown) {
  if (typeof value !== 'string') return null;
  const style = value
    .trim()
    .replace(/\s*;\s*/g, '; ')
    .replace(/;\s*$/, '');
  return style || null;
}

function parseColorStyle(value: unknown) {
  if (typeof value !== 'string') return null;
  return normalizeTextColor(value.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i)?.[1]?.trim());
}

function removeColorStyle(value: unknown) {
  const style = normalizeMdcStyle(value);
  if (!style) return null;
  return normalizeMdcStyle(
    style
      .split(';')
      .map(item => item.trim())
      .filter(item => item && !/^color\s*:/i.test(item))
      .join('; '),
  );
}

function renderStyleForTextStyle(attrs: Record<string, unknown> | undefined) {
  const color = normalizeTextColor(attrs?.color);
  const baseStyle = removeColorStyle(attrs?.mdcStyle);
  if (color) return [baseStyle, `color: ${color}`].filter(Boolean).join('; ');
  return baseStyle;
}

function escapeMdcAttributeValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function canUseMdcClassShortcut(value: string) {
  return /^[^\s.#{}]+$/.test(value);
}

function canUseMdcIdShortcut(value: string) {
  return /^[^\s.#{}]+$/.test(value);
}

function parseMdcSpanAttributes(attrString = '') {
  const classes: string[] = [];
  let id: string | null = null;
  let style: string | null = null;

  const attrPattern = /(?:^|\s)([A-Za-z_:][\w:.-]*)=(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^\s}]+))|(?:^|\s)\.([^\s.#}]+)|(?:^|\s)#([^\s.#}]+)/g;
  for (const match of attrString.matchAll(attrPattern)) {
    const [, key, doubleQuotedValue, singleQuotedValue, unquotedValue, classShortcut, idShortcut] = match;

    if (classShortcut) {
      classes.push(classShortcut);
      continue;
    }

    if (idShortcut) {
      id = idShortcut;
      continue;
    }

    const value = (doubleQuotedValue ?? singleQuotedValue ?? unquotedValue ?? '').replace(/\\(["'\\])/g, '$1');
    if (key === 'style') {
      style = normalizeMdcStyle(value);
    } else if (key === 'class') {
      const className = normalizeMdcClass(value);
      if (className) classes.push(...className.split(/\s+/));
    } else if (key === 'id') {
      id = normalizeMdcId(value);
    }
  }

  return {
    class: normalizeMdcClass(classes.join(' ')),
    id,
    style,
  };
}

function renderMdcSpanAttributes(attrs: { class?: unknown; id?: unknown; style?: unknown }) {
  const parts: string[] = [];
  const style = normalizeMdcStyle(attrs.style);
  const className = normalizeMdcClass(attrs.class);
  const id = normalizeMdcId(attrs.id);

  if (style) {
    parts.push(`style="${escapeMdcAttributeValue(style)}"`);
  }

  if (className) {
    const classes = className.split(/\s+/);
    if (classes.every(canUseMdcClassShortcut)) {
      parts.push(...classes.map(item => `.${item}`));
    } else {
      parts.push(`class="${escapeMdcAttributeValue(className)}"`);
    }
  }

  if (id) {
    parts.push(canUseMdcIdShortcut(id) ? `#${id}` : `id="${escapeMdcAttributeValue(id)}"`);
  }

  return parts.length ? `{${parts.join(' ')}}` : '';
}

function readMdcAttributeBlock(src: string, start: number) {
  if (src[start] !== '{') return undefined;

  let quote: string | null = null;
  for (let attrEnd = start + 1; attrEnd < src.length; attrEnd += 1) {
    const attrChar = src[attrEnd];
    if (attrChar === '\\') {
      attrEnd += 1;
      continue;
    }

    if (quote) {
      if (attrChar === quote) quote = null;
      continue;
    }

    if (attrChar === '"' || attrChar === '\'') {
      quote = attrChar;
      continue;
    }

    if (attrChar !== '}') continue;

    const attributes = parseMdcSpanAttributes(src.slice(start + 1, attrEnd));
    if (!attributes.style && !attributes.class && !attributes.id) return undefined;

    return {
      raw: src.slice(start, attrEnd + 1),
      attributes,
    };
  }

  return undefined;
}

function findClosingSquareBracket(src: string, start: number) {
  for (let index = start; index < src.length; index += 1) {
    const char = src[index];
    if (char === '\\') {
      index += 1;
      continue;
    }

    if (char === '\n') return -1;
    if (char === ']') return index;
  }

  return -1;
}

function findMdcBracketSpanClose(src: string, start: number) {
  for (let index = start; index < src.length; index += 1) {
    const char = src[index];
    if (char === '\\') {
      index += 1;
      continue;
    }

    if (char === '\n') return -1;
    if (char !== ']') continue;

    if (src[index + 1] === '{' && readMdcAttributeBlock(src, index + 1)) return index;
    if (src[index + 1] === '(') {
      const hrefClose = findClosingParen(src, index + 2);
      if (hrefClose === -1) return -1;
      index = hrefClose;
      continue;
    }

    return -1;
  }

  return -1;
}

function findClosingParen(src: string, start: number) {
  let depth = 0;

  for (let index = start; index < src.length; index += 1) {
    const char = src[index];
    if (char === '\\') {
      index += 1;
      continue;
    }

    if (char === '\n') return -1;
    if (char === '(') {
      depth += 1;
      continue;
    }

    if (char === ')') {
      if (depth === 0) return index;
      depth -= 1;
    }
  }

  return -1;
}

function readMdcBracketSpanBase(src: string) {
  if (!src.startsWith('[') || src.startsWith('![')) return undefined;

  const close = findMdcBracketSpanClose(src, 1);
  if (close === -1 || src[close + 1] !== '{') return undefined;
  const attr = readMdcAttributeBlock(src, close + 1);
  if (!attr) return undefined;

  return {
    raw: src.slice(0, close + 1),
    content: src.slice(1, close),
    attr,
  };
}

function readMdcLinkBase(src: string) {
  if (!src.startsWith('[') || src.startsWith('![')) return undefined;

  const textClose = findClosingSquareBracket(src, 1);
  if (textClose === -1 || src[textClose + 1] !== '(') return undefined;
  const hrefClose = findClosingParen(src, textClose + 2);
  if (hrefClose === -1 || src[hrefClose + 1] !== '{') return undefined;
  const attr = readMdcAttributeBlock(src, hrefClose + 1);
  if (!attr) return undefined;

  return {
    raw: src.slice(0, hrefClose + 1),
    content: src.slice(0, hrefClose + 1),
    attr,
  };
}

function readMdcCodeBase(src: string) {
  if (src[0] !== '`') return undefined;

  let tickEnd = 1;
  while (src[tickEnd] === '`') tickEnd += 1;
  const marker = '`'.repeat(tickEnd);

  for (let index = tickEnd; index < src.length; index += 1) {
    if (src[index] === '\n') return undefined;
    if (!src.startsWith(marker, index)) continue;
    const end = index + marker.length;
    if (src[end] !== '{') return undefined;
    const attr = readMdcAttributeBlock(src, end);
    if (!attr) return undefined;

    return {
      raw: src.slice(0, end),
      content: src.slice(0, end),
      attr,
    };
  }

  return undefined;
}

function readMdcDelimitedBase(src: string, delimiter: '*' | '_' | '**' | '__') {
  if (!src.startsWith(delimiter)) return undefined;

  const start = delimiter.length;
  for (let index = start; index < src.length; index += 1) {
    if (src[index] === '\\') {
      index += 1;
      continue;
    }

    if (src[index] === '\n') return undefined;
    if (!src.startsWith(delimiter, index)) continue;

    const end = index + delimiter.length;
    if (src[end] !== '{') return undefined;
    const attr = readMdcAttributeBlock(src, end);
    if (!attr) return undefined;

    return {
      raw: src.slice(0, end),
      content: src.slice(0, end),
      attr,
    };
  }

  return undefined;
}

function readMdcAttributedInlineToken(src: string) {
  const match =
    readMdcBracketSpanBase(src)
    ?? readMdcLinkBase(src)
    ?? readMdcCodeBase(src)
    ?? readMdcDelimitedBase(src, '**')
    ?? readMdcDelimitedBase(src, '__')
    ?? readMdcDelimitedBase(src, '*')
    ?? readMdcDelimitedBase(src, '_');

  if (!match) return undefined;

  return {
    raw: match.raw + match.attr.raw,
    content: match.content,
    attributes: match.attr.attributes,
  };
}

function readMdcSpanToken(src: string) {
  const match = readMdcBracketSpanBase(src);
  if (!match) return undefined;

  return {
    raw: match.raw + match.attr.raw,
    content: match.content,
    attributes: match.attr.attributes,
  };
}

function canUseMdcAttributeSuffix(content: string) {
  if (/^`+[^`\n][\s\S]*`+$/.test(content)) return true;
  if (/^\*\*[^*\n](?:[^*\n]|\*(?!\*))*[^*\n]\*\*$/.test(content)) return true;
  if (/^__[^_\n](?:[^_\n]|_(?!_))*[^_\n]__$/.test(content)) return true;
  if (/^\*[^*\n](?:[^*\n])*\*$/.test(content)) return true;
  if (/^_[^_\n](?:[^_\n])*_$/.test(content)) return true;
  if (/^\[[^\]\n]+]\([^\n)]+\)$/.test(content)) return true;
  return false;
}

function renderMdcAttributedContent(content: string, attrs: { class?: unknown; id?: unknown; style?: unknown }) {
  const renderedAttrs = renderMdcSpanAttributes(attrs);
  if (!renderedAttrs) return content;
  if (canUseMdcAttributeSuffix(content)) return `${content}${renderedAttrs}`;
  return `[${content}]${renderedAttrs}`;
}

function readMdcSpanOrAttributedToken(src: string) {
  const match = readMdcAttributedInlineToken(src);
  if (match) return match;

  return readMdcSpanToken(src);
}

function findMdcAttributedInlineStart(src: string) {
  let cursor = 0;

  while (cursor < src.length) {
    const candidates = ['[', '`', '*', '_']
      .map(item => src.indexOf(item, cursor))
      .filter(index => index !== -1);

    if (!candidates.length) return -1;

    const index = Math.min(...candidates);
    if (readMdcSpanOrAttributedToken(src.slice(index))) return index;
    cursor = index + 1;
  }

  return -1;
}

function renderTextStyleContent(node: JSONContent, helpers: MarkdownRendererHelpers) {
  if (typeof node.text === 'string') return node.text;
  return helpers.renderChildren(node.content || [], '');
}

export const RbphMdcInline = TiptapNode.create({
  name: 'mdcInline',

  group: 'inline',

  inline: true,

  content: 'inline*',

  addAttributes() {
    return {
      mdcStyle: {
        default: null,
        parseHTML: element => normalizeMdcStyle(element.getAttribute('style')),
        renderHTML: attributes => {
          const style = normalizeMdcStyle(attributes.mdcStyle);
          return style ? { style } : {};
        },
      },
      mdcClass: {
        default: null,
        parseHTML: element => normalizeMdcClass(element.getAttribute('class')),
        renderHTML: attributes => {
          const className = normalizeMdcClass(attributes.mdcClass);
          return className ? { class: className } : {};
        },
      },
      mdcId: {
        default: null,
        parseHTML: element => normalizeMdcId(element.getAttribute('id')),
        renderHTML: attributes => {
          const id = normalizeMdcId(attributes.mdcId);
          return id ? { id } : {};
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-rb-mdc-inline]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-rb-mdc-inline': '' }, HTMLAttributes), 0];
  },

  parseMarkdown(token: MarkdownToken, helpers: MarkdownParseHelpers) {
    const style = normalizeMdcStyle(token.attributes?.style);
    return helpers.createNode(
      'mdcInline',
      {
        mdcStyle: style,
        mdcClass: normalizeMdcClass(token.attributes?.class),
        mdcId: normalizeMdcId(token.attributes?.id),
      },
      helpers.parseInline(token.tokens || []),
    );
  },

  renderMarkdown(node: JSONContent, helpers: MarkdownRendererHelpers) {
    const style = normalizeMdcStyle(node.attrs?.mdcStyle);
    const mdcClass = normalizeMdcClass(node.attrs?.mdcClass);
    const mdcId = normalizeMdcId(node.attrs?.mdcId);
    const content = renderTextStyleContent(node, helpers);
    return renderMdcAttributedContent(content, { style, class: mdcClass, id: mdcId });
  },

  markdownTokenizer: {
    name: 'mdcInline',
    level: 'inline',
    start(src: string) {
      return findMdcAttributedInlineStart(src);
    },
    tokenize(src: string, _tokens: MarkdownToken[], lexer: { inlineTokens: (src: string) => MarkdownToken[] }) {
      const match = readMdcSpanOrAttributedToken(src);
      if (!match) return undefined;

      return {
        type: 'mdcInline',
        raw: match.raw,
        attributes: match.attributes,
        tokens: lexer.inlineTokens(match.content),
      };
    },
  },
});

export const RbphTextStyle = TextStyle.extend({
  parseHTML() {
    return [
      {
        tag: 'span',
        consuming: false,
        getAttrs: element => {
          const htmlElement = element as HTMLElement;
          return htmlElement.hasAttribute('style') || htmlElement.hasAttribute('class') || htmlElement.hasAttribute('id') ? {} : false;
        },
      },
    ];
  },

  addAttributes() {
    return {
      ...(this.parent?.() ?? {}),
      mdcStyle: {
        default: null,
        parseHTML: element => normalizeMdcStyle(element.getAttribute('style')),
        renderHTML: attributes => {
          const style = normalizeMdcStyle(attributes.mdcStyle);
          return style ? { style } : {};
        },
      },
      mdcClass: {
        default: null,
        parseHTML: element => normalizeMdcClass(element.getAttribute('class')),
        renderHTML: attributes => {
          const className = normalizeMdcClass(attributes.mdcClass);
          return className ? { class: className } : {};
        },
      },
      mdcId: {
        default: null,
        parseHTML: element => normalizeMdcId(element.getAttribute('id')),
        renderHTML: attributes => {
          const id = normalizeMdcId(attributes.mdcId);
          return id ? { id } : {};
        },
      },
    };
  },

  parseMarkdown(token: MarkdownToken, helpers: MarkdownParseHelpers) {
    const style = normalizeMdcStyle(token.attributes?.style);
    return {
      mark: 'textStyle',
      attrs: {
        color: parseColorStyle(style),
        mdcStyle: style,
        mdcClass: normalizeMdcClass(token.attributes?.class),
        mdcId: normalizeMdcId(token.attributes?.id),
      },
      content: helpers.parseInline(token.tokens || []),
    };
  },

  renderMarkdown(node: JSONContent, helpers: MarkdownRendererHelpers) {
    const style = renderStyleForTextStyle(node.attrs);
    const mdcClass = normalizeMdcClass(node.attrs?.mdcClass);
    const mdcId = normalizeMdcId(node.attrs?.mdcId);
    const content = renderTextStyleContent(node, helpers);
    return style || mdcClass || mdcId ? `[${content}]${renderMdcSpanAttributes({ style, class: mdcClass, id: mdcId })}` : content;
  },
});

export function transformColorSpans<T extends MDCNode | MDCRoot>(node: T): T {
  if (node.type === 'root') {
    return {
      ...node,
      children: node.children.map(transformColorSpans),
    };
  }

  if (node.type !== 'element') return node;

  const children = node.children.map(transformColorSpans);

  if (node.tag === 'span') {
    const className = normalizeMdcClass(node.props?.class ?? node.props?.className);
    const id = normalizeMdcId(node.props?.id);
    const style = normalizeMdcStyle(node.props?.style);
    const parsedColor = parseColorStyle(style);
    const props = {
      ...(className ? { class: className } : {}),
      ...(id ? { id } : {}),
      ...(style ? { style } : {}),
      ...(!className && style ? colorProps(parsedColor) : {}),
    };

    return {
      ...node,
      props,
      children,
    } as MDCElement as T;
  }

  return {
    ...node,
    children,
  };
}
