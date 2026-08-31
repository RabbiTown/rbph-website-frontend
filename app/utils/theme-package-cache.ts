const jsonRequests = new Map<string, Promise<unknown>>();
const textRequests = new Map<string, Promise<string>>();

function resolveThemeUrl(url: string) {
  return import.meta.client ? new URL(url, window.location.href).href : url;
}

export function fetchThemeJson<T>(url: string): Promise<T> {
  const resolvedUrl = resolveThemeUrl(url);
  let request = jsonRequests.get(resolvedUrl);
  if (!request) {
    request = fetch(resolvedUrl, { credentials: 'same-origin' }).then(async response => {
      if (!response.ok) throw new Error(`Theme resource HTTP ${response.status}: ${resolvedUrl}`);
      return await response.json() as unknown;
    });
    jsonRequests.set(resolvedUrl, request);
  }
  return request as Promise<T>;
}

export function fetchThemeText(url: string): Promise<string> {
  const resolvedUrl = resolveThemeUrl(url);
  let request = textRequests.get(resolvedUrl);
  if (!request) {
    request = fetch(resolvedUrl, { credentials: 'same-origin' }).then(async response => {
      if (!response.ok) throw new Error(`Theme resource HTTP ${response.status}: ${resolvedUrl}`);
      return await response.text();
    });
    textRequests.set(resolvedUrl, request);
  }
  return request;
}

export async function fetchThemeCss(url: string): Promise<string> {
  const resolvedUrl = resolveThemeUrl(url);
  const css = await fetchThemeText(resolvedUrl);
  const resolveReference = (reference: string) => {
    const value = reference.trim();
    if (!value || value.startsWith('#') || /^(?:data|blob):/i.test(value)) return reference;
    return new URL(value, resolvedUrl).href;
  };
  return css
    .replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (_match, quote: string, reference: string) => `url(${quote}${resolveReference(reference)}${quote})`)
    .replace(/(@import\s+)(['"])([^'"]+)\2/g, (_match, prefix: string, quote: string, reference: string) => `${prefix}${quote}${resolveReference(reference)}${quote}`);
}

export function fetchThemeManifest(url: string) {
  return fetchThemeJson<RbThemeManifest>(url);
}

export function cacheThemeManifest(url: string, manifest: RbThemeManifest) {
  jsonRequests.set(resolveThemeUrl(url), Promise.resolve(manifest));
}
