import { marked } from 'marked';

export function useMarkdown() {
  const render = (content: string): Promise<string> => {
    return marked.parse(content, { async: true }) as Promise<string>;
  };

  return {
    render,
  };
}
