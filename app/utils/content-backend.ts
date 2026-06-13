const exportFunctionPattern = /^export\s+function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/gm;
const exportConstFunctionPattern = /^export\s+const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:async\s*)?(?:function|\()/gm;

export function parseBackendExportFunctions(source: string): string[] {
  const names = new Set<string>();
  for (const pattern of [exportFunctionPattern, exportConstFunctionPattern]) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source))) {
      names.add(match[1]);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}
