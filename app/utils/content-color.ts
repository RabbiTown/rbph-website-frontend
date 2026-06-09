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

function parseColorStyle(value: unknown) {
  if (typeof value !== 'string') return null;
  return normalizeTextColor(value.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i)?.[1]?.trim());
}

function renderStyleAttribute(color: RbTextColor) {
  return color ? `{style="color: ${color}"}` : '';
}

function renderTextStyleContent(node: JSONContent, helpers: MarkdownRendererHelpers) {
  if (typeof node.text === 'string') return node.text;
  return helpers.renderChildren(node.content || [], '');
}

export const RbphTextStyle = TextStyle.extend({
  parseMarkdown(token: MarkdownToken, helpers: MarkdownParseHelpers) {
    return {
      mark: 'textStyle',
      attrs: { color: parseColorStyle(token.attributes?.style) },
      content: helpers.parseInline(token.tokens || []),
    };
  },

  renderMarkdown(node: JSONContent, helpers: MarkdownRendererHelpers) {
    const color = normalizeTextColor(node.attrs?.color);
    const content = renderTextStyleContent(node, helpers);
    return color ? `[${content}]${renderStyleAttribute(color)}` : content;
  },

  markdownTokenizer: {
    name: 'textStyle',
    level: 'inline',
    start(src: string) {
      return src.match(/\[[^\]]+\]\{style=/)?.index ?? -1;
    },
    tokenize(src: string, _tokens: MarkdownToken[], lexer: { inlineTokens: (src: string) => MarkdownToken[] }) {
      const match = src.match(/^\[([^\]]+)\]\{style=(?:"([^"]+)"|'([^']+)'|([^}]+))\}/);
      if (!match) return undefined;

      const [, content = '', doubleQuotedStyle, singleQuotedStyle, unquotedStyle] = match;
      const style = doubleQuotedStyle ?? singleQuotedStyle ?? unquotedStyle ?? '';

      return {
        type: 'textStyle',
        raw: match[0],
        attributes: { style },
        tokens: lexer.inlineTokens(content),
      };
    },
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

  if (node.tag === 'span' && node.props?.style) {
    const props = colorProps(parseColorStyle(node.props.style));
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
