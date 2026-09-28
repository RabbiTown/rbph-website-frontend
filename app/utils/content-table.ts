import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import type { Editor, JSONContent, MarkdownParseHelpers, MarkdownRendererHelpers, MarkdownToken } from '@tiptap/core';
import type { MDCElement, MDCNode, MDCParserResult, MDCRoot } from '@nuxtjs/mdc';
import { decodeRbTableData, encodeRbTableData, isTableAlign, normalizeTableData } from './content-table-codec';
import type { RbTableCellData, RbTableData } from './content-table-codec';

function parseRbTableDataAttribute(attrString = '') {
  const data = attrString
    .match(/(?:^|\s)data=(?:"([^"]*)"|'([^']*)'|([^\s}]+))/)
    ?.slice(1)
    .find(value => value !== undefined);
  return data;
}

function renderRbTableAttributes(data: RbTableData) {
  return `{data="${encodeRbTableData(data)}"}`;
}

function renderCellText(cell: JSONContent, helpers: MarkdownRendererHelpers) {
  return helpers.renderChildren(cell.content ?? [], '\n\n');
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

function cellDataToNode(cell: RbTableCellData, tokens: MarkdownToken[], helpers: MarkdownParseHelpers, type = 'tableCell'): JSONContent {
  const content = (helpers.parseBlockChildren ?? helpers.parseChildren)(tokens);
  return {
    type,
    attrs: {
      colspan: 1,
      rowspan: 1,
      colwidth: null,
      ...(isTableAlign(cell.align) ? { align: cell.align } : {}),
    },
    content: content.length ? content : [{ type: 'paragraph' }],
  };
}

function tableDataToNode(data: RbTableData, cellTokens: MarkdownToken[][][], helpers: MarkdownParseHelpers) {
  return {
    type: 'table',
    content: (data.rows ?? []).map((row, rowIndex) => ({
      type: 'tableRow',
      content: row.map((cell, cellIndex) => cellDataToNode(cell, cellTokens[rowIndex]?.[cellIndex] ?? [], helpers, data.header && rowIndex === 0 ? 'tableHeader' : 'tableCell')),
    })),
  };
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
    if (token.invalidData) {
      return helpers.createNode('mdcComponent', { name: 'rb-table', raw: token.raw });
    }
    const data = normalizeTableData((token as MarkdownToken & { data?: unknown }).data);
    return helpers.createNode('table', undefined, tableDataToNode(data, token.cellTokens ?? [], helpers).content);
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
    tokenize(src: string, _tokens: MarkdownToken[], lexer: { blockTokens: (src: string) => MarkdownToken[] }) {
      const openingMatch = src.match(/^::rb-table(?:\{([^}]*)\})?[ \t]*\n/);
      if (!openingMatch) return undefined;

      const [openingTag, attrString = ''] = openingMatch;
      const remaining = src.slice(openingTag.length);
      const closingMatch = remaining.match(/^::[ \t]*$/m);
      if (!closingMatch || closingMatch.index === undefined) return undefined;

      const raw = src.slice(0, openingTag.length + closingMatch.index + closingMatch[0].length);
      let data: RbTableData;
      try {
        data = decodeRbTableData(parseRbTableDataAttribute(attrString));
      } catch {
        return { type: 'rbTable', raw, invalidData: true };
      }

      return {
        type: 'rbTable',
        raw,
        data,
        cellTokens: (data.rows ?? []).map(row => row.map(cell => lexer.blockTokens(cell.text))),
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

export async function transformTableBlocks<T extends MDCNode | MDCRoot>(node: T, parseMarkdown: (markdown: string) => Promise<MDCParserResult>): Promise<T> {
  if (node.type === 'root') {
    return {
      ...node,
      children: await Promise.all(node.children.map(child => transformTableBlocks(child, parseMarkdown))),
    };
  }

  if (node.type !== 'element') return node;

  const children = await Promise.all(node.children.map(child => transformTableBlocks(child, parseMarkdown)));

  if (node.tag === 'rb-table') {
    const rawJson = collectMdcText(node).trim();
    let data: RbTableData;
    try {
      data = decodeRbTableData(node.props?.data);
    } catch {
      // Preserve the encoded source instead of turning an unreadable table into an empty one.
      const attrs = Object.entries(node.props ?? {})
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(' ');
      return {
        type: 'element',
        tag: 'pre',
        props: {},
        children: [{ type: 'text', value: `::rb-table{${attrs}}\n${rawJson ? `${rawJson}\n` : ''}::` }],
      } as MDCElement as T;
    }
    const header = data.header === true;
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
                children: [await tableRowToMdc(rows[0], true, parseMarkdown)],
              },
            ]
          : []),
        {
          type: 'element',
          tag: 'tbody',
          props: {},
          children: await Promise.all(rows.slice(header ? 1 : 0).map(row => tableRowToMdc(row, false, parseMarkdown))),
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

async function tableRowToMdc(row: RbTableCellData[], header: boolean, parseMarkdown: (markdown: string) => Promise<MDCParserResult>): Promise<MDCElement> {
  return {
    type: 'element',
    tag: 'tr',
    props: {},
    children: await Promise.all(
      row.map(async cell => ({
        type: 'element' as const,
        tag: header ? 'th' : 'td',
        props: {
          class: `${header ? 'bg-elevated font-semibold' : 'bg-default'} border border-default px-2.5 py-2 align-top`,
          ...(isTableAlign(cell.align) ? { style: `text-align: ${cell.align}` } : {}),
        },
        children: cell.text ? (await transformTableBlocks((await parseMarkdown(cell.text)).body, parseMarkdown)).children : [],
      })),
    ),
  };
}
