import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import type { Editor, JSONContent, MarkdownParseHelpers, MarkdownRendererHelpers, MarkdownToken } from '@tiptap/core';
import type { MDCElement, MDCNode, MDCRoot } from '@nuxtjs/mdc';

type RbTableCellData = {
  text: string;
  align?: 'left' | 'center' | 'right';
};

type RbTableData = {
  header?: boolean;
  rows?: RbTableCellData[][];
};

function isTableAlign(value: unknown): value is RbTableCellData['align'] {
  return value === 'left' || value === 'center' || value === 'right';
}

function normalizeTableCellText(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function normalizeTableData(value: unknown): RbTableData {
  if (!value || typeof value !== 'object') return { header: false, rows: [] };

  const raw = value as { header?: unknown; rows?: unknown };
  const rows = Array.isArray(raw.rows)
    ? raw.rows.map(row =>
        Array.isArray(row)
          ? row.map(cell => {
              if (cell && typeof cell === 'object') {
                const rawCell = cell as { text?: unknown; align?: unknown };
                return {
                  text: normalizeTableCellText(rawCell.text),
                  ...(isTableAlign(rawCell.align) ? { align: rawCell.align } : {}),
                };
              }

              return { text: normalizeTableCellText(cell) };
            })
          : [],
      )
    : [];

  return {
    header: raw.header === true,
    rows,
  };
}

function parseRbTableAttributes(attrString = '') {
  const header = attrString
    .match(/(?:^|\s)header=(?:"([^"]+)"|'([^']+)'|([^\s}]+))/)
    ?.slice(1)
    .find(Boolean);
  const data = attrString
    .match(/(?:^|\s)data=(?:"([^"]*)"|'([^']*)'|([^\s}]+))/)
    ?.slice(1)
    .find(value => value !== undefined);
  return { header: header === 'true', data };
}

function encodeRbTableData(data: RbTableData) {
  return encodeURIComponent(JSON.stringify(data));
}

function decodeRbTableData(value: unknown) {
  if (typeof value !== 'string' || !value) return undefined;

  try {
    return parseRbTableJson(decodeURIComponent(value));
  } catch {
    return parseRbTableJson(value);
  }
}

function renderRbTableAttributes(data: RbTableData) {
  return `{data="${encodeRbTableData(data)}"}`;
}

function renderCellText(cell: JSONContent, helpers: MarkdownRendererHelpers) {
  if (!cell.content?.length) return '';

  return cell.content
    .map(child => {
      if ((child.type === 'paragraph' || child.type === 'heading') && !child.content?.length) return '';
      return helpers.renderChildren(child);
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

function tableNodeToData(node: JSONContent, helpers: MarkdownRendererHelpers): RbTableData {
  const rows =
    node.content?.map(row => {
      return (
        row.content?.map(cell => ({
          text: renderCellText(cell, helpers),
          ...(isTableAlign(cell.attrs?.align) ? { align: cell.attrs.align } : {}),
        })) ?? []
      );
    }) ?? [];

  return {
    header: Boolean(node.content?.[0]?.content?.some(cell => cell.type === 'tableHeader')),
    rows,
  };
}

function cellDataToNode(cell: RbTableCellData, type = 'tableCell'): JSONContent {
  const text = normalizeTableCellText(cell.text);
  return {
    type,
    attrs: {
      colspan: 1,
      rowspan: 1,
      colwidth: null,
      ...(isTableAlign(cell.align) ? { align: cell.align } : {}),
    },
    content: [
      {
        type: 'paragraph',
        ...(text ? { content: [{ type: 'text', text }] } : {}),
      },
    ],
  };
}

function tableDataToNode(data: RbTableData) {
  return {
    type: 'table',
    content: (data.rows ?? []).map((row, rowIndex) => ({
      type: 'tableRow',
      content: row.map(cell => cellDataToNode(cell, data.header && rowIndex === 0 ? 'tableHeader' : 'tableCell')),
    })),
  };
}

function parseRbTableJson(rawContent: string) {
  try {
    return normalizeTableData(JSON.parse(rawContent.trim() || '{}'));
  } catch {
    return { header: false, rows: [] };
  }
}

function parseRbTableContent(rawContent: string, encodedData?: string) {
  return decodeRbTableData(encodedData) ?? parseRbTableJson(rawContent);
}

export const RbphTable = Table.configure({
  resizable: true,
  lastColumnResizable: false,
  HTMLAttributes: {
    class: 'rbph-table',
  },
}).extend({
  markdownTokenName: 'rbTable',

  parseMarkdown(token: MarkdownToken, helpers: MarkdownParseHelpers) {
    return helpers.createNode('table', undefined, tableDataToNode(normalizeTableData((token as MarkdownToken & { data?: unknown }).data)).content);
  },

  renderMarkdown(node: JSONContent, helpers: MarkdownRendererHelpers) {
    const data = tableNodeToData(node, helpers);
    return `::rb-table${renderRbTableAttributes(data)}\n::`;
  },

  markdownTokenizer: {
    name: 'rbTable',
    level: 'block',
    start(src: string) {
      return src.match(/^::rb-table/m)?.index ?? -1;
    },
    tokenize(src: string) {
      const openingMatch = src.match(/^::rb-table(?:\{([^}]*)\})?[ \t]*\n/);
      if (!openingMatch) return undefined;

      const [openingTag, attrString = ''] = openingMatch;
      const remaining = src.slice(openingTag.length);
      const closingMatch = remaining.match(/^::[ \t]*$/m);
      if (!closingMatch || closingMatch.index === undefined) return undefined;

      const rawContent = remaining.slice(0, closingMatch.index);
      const raw = src.slice(0, openingTag.length + closingMatch.index + closingMatch[0].length);
      const attrs = parseRbTableAttributes(attrString);
      const data = parseRbTableContent(rawContent, attrs.data);

      return {
        type: 'rbTable',
        raw,
        data: {
          ...data,
          header: attrs.header || data.header === true,
        },
      };
    },
  },
});

export const RbphTableRow = TableRow;
export const RbphTableCell = TableCell;
export const RbphTableHeader = TableHeader;

export function insertRbTable(editor: Editor) {
  return editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: false });
}

export function addRbTableRow(editor: Editor) {
  return editor.chain().focus().addRowAfter().run();
}

export function deleteRbTableRow(editor: Editor) {
  return editor.chain().focus().deleteRow().run();
}

export function addRbTableColumn(editor: Editor) {
  return editor.chain().focus().addColumnAfter().run();
}

export function deleteRbTableColumn(editor: Editor) {
  return editor.chain().focus().deleteColumn().run();
}

export function deleteRbTable(editor: Editor) {
  return editor.chain().focus().deleteTable().run();
}

export function transformTableBlocks<T extends MDCNode | MDCRoot>(node: T): T {
  if (node.type === 'root') {
    return {
      ...node,
      children: node.children.map(transformTableBlocks),
    };
  }

  if (node.type !== 'element') return node;

  const children = node.children.map(transformTableBlocks);

  if (node.tag === 'rb-table') {
    const rawJson = collectMdcText(node).trim();
    const data = decodeRbTableData(node.props?.data) ?? (rawJson ? parseRbTableJson(rawJson) : normalizeTableData(node.props));
    const header = node.props?.header === 'true' || data.header === true;
    const rows = data.rows ?? [];

    return {
      ...node,
      tag: 'table',
      props: { class: 'my-4 w-full table-fixed border-collapse border border-default' },
      children: [
        ...(header && rows[0]
          ? [
              {
                type: 'element' as const,
                tag: 'thead',
                props: {},
                children: [tableRowToMdc(rows[0], true)],
              },
            ]
          : []),
        {
          type: 'element',
          tag: 'tbody',
          props: {},
          children: rows.slice(header ? 1 : 0).map(row => tableRowToMdc(row, false)),
        },
      ],
    } as MDCElement as T;
  }

  return {
    ...node,
    children,
  };
}

function collectMdcText(node: MDCNode | MDCRoot): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'element' || node.type === 'root') {
    return node.children.map(collectMdcText).join('\n');
  }
  return '';
}

function tableRowToMdc(row: RbTableCellData[], header: boolean): MDCElement {
  return {
    type: 'element',
    tag: 'tr',
    props: {},
    children: row.map(cell => ({
      type: 'element' as const,
      tag: header ? 'th' : 'td',
      props: {
        class: `${header ? 'bg-elevated font-semibold' : 'bg-default'} border border-default px-2.5 py-2 align-top`,
        ...(isTableAlign(cell.align) ? { style: `text-align: ${cell.align}` } : {}),
      },
      children: cell.text ? [{ type: 'text' as const, value: cell.text }] : [],
    })),
  };
}
