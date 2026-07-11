import { createMarkdownParser } from '@nuxtjs/mdc/runtime';

export function normalizeCjkMarkdown(markdown: string) {
  return markdown
    .replace(/(\*{1,3}|_{1,3})([「『《（【“‘])/g, '$1\u200B$2')
    .replace(/([」』》）】”’：；，。！？、])(\*{1,3}|_{1,3})(?=\p{Script=Han})/gu, '$1\u200B$2')
    .replace(/([」』》）】”’])(\*{1,3}|_{1,3})/g, '$1\u200B$2');
}

function emptyParagraphMarkers(blankLineCount: number) {
  const paragraphCount = Math.ceil((blankLineCount - 1) / 2);
  return Array.from({ length: Math.max(paragraphCount, 0) }, () => '<span data-rb-empty-paragraph>&nbsp;</span>');
}

function isSerializedEmptyParagraphLine(line: string) {
  return /^(?:&nbsp;?|\u00A0)\s*$/.test(line.trim());
}

export function preserveMarkdownEmptyParagraphs(markdown: string) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const output: string[] = [];
  let blankLineCount = 0;
  let inFence = false;
  let fenceMarker = '';

  function flushBlankLines(nextHasContent: boolean) {
    if (blankLineCount === 0) return;

    const previousHasContent = output.length > 0;
    if (!previousHasContent || !nextHasContent) {
      blankLineCount = 0;
      return;
    }
    const markers = emptyParagraphMarkers(blankLineCount);

    if (previousHasContent) output.push('');
    markers.forEach((marker, index) => {
      output.push(marker);
      if (nextHasContent || index < markers.length - 1) output.push('');
    });
    blankLineCount = 0;
  }

  for (const line of lines) {
    const fenceMatch = line.match(/^(\s{0,3})(`{3,}|~{3,})/);
    if (fenceMatch) {
      flushBlankLines(true);
      const marker = fenceMatch[2]?.[0] ?? '`';
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (marker === fenceMarker) {
        inFence = false;
        fenceMarker = '';
      }
      output.push(line);
      continue;
    }

    if (!inFence && (!line.trim() || isSerializedEmptyParagraphLine(line))) {
      blankLineCount += 1;
      continue;
    }

    flushBlankLines(true);
    output.push(line);
  }

  flushBlankLines(false);
  return output.join('\n');
}

export default function useMarkdownParser() {
  let parser: Awaited<ReturnType<typeof createMarkdownParser>>;

  const parse = async (markdown: string) => {
    if (!parser) {
      parser = await createMarkdownParser();
    }
    return parser(preserveMarkdownEmptyParagraphs(normalizeCjkMarkdown(markdown)));
  };

  return parse;
}
