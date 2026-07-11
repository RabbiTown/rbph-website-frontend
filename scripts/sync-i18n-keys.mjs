import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import ts from 'typescript';

const [, , sourcePath = 'i18n/locales/zh-CN.ts', targetPath = 'i18n/locales/en.ts'] = process.argv;

function localeObject(source, fileName) {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let result;

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(file) === 'defineI18nLocale' &&
      node.arguments[0] &&
      (ts.isArrowFunction(node.arguments[0]) || ts.isFunctionExpression(node.arguments[0]))
    ) {
      const body = node.arguments[0].body;
      if (ts.isParenthesizedExpression(body) && ts.isObjectLiteralExpression(body.expression)) result = body.expression;
      if (ts.isObjectLiteralExpression(body)) result = body;
    }
    if (!result) ts.forEachChild(node, visit);
  }

  visit(file);
  if (!result) throw new Error(`Could not find the locale object in ${fileName}`);
  return { file, object: result };
}

function propertyName(property, file) {
  if (!property.name) return undefined;
  if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) || ts.isNumericLiteral(property.name)) return property.name.text;
  return property.name.getText(file);
}

function childObject(property) {
  return ts.isPropertyAssignment(property) && ts.isObjectLiteralExpression(property.initializer) ? property.initializer : undefined;
}

function lineIndent(source, position) {
  const lineStart = source.lastIndexOf('\n', position - 1) + 1;
  return source.slice(lineStart, position).match(/^\s*/)?.[0] ?? '';
}

function reindent(text, sourceIndent, targetIndent) {
  const lines = text.split('\n');
  return lines.map((line, index) => (index === 0 ? targetIndent + line.trimStart() : line.startsWith(sourceIndent) ? targetIndent + line.slice(sourceIndent.length) : line)).join('\n');
}

function collectInsertions(sourceContext, targetContext, sourceObject, targetObject, insertions, path = []) {
  const targetProperties = new Map(targetObject.properties.map(property => [propertyName(property, targetContext.file), property]));
  const sourceProperties = sourceObject.properties;

  for (let index = 0; index < sourceProperties.length; index++) {
    const sourceProperty = sourceProperties[index];
    const name = propertyName(sourceProperty, sourceContext.file);
    if (!name) continue;
    const targetProperty = targetProperties.get(name);

    if (targetProperty) {
      const sourceChild = childObject(sourceProperty);
      const targetChild = childObject(targetProperty);
      if (sourceChild && targetChild) collectInsertions(sourceContext, targetContext, sourceChild, targetChild, insertions, [...path, name]);
      continue;
    }

    const nextExisting = sourceProperties.slice(index + 1).map(property => targetProperties.get(propertyName(property, sourceContext.file))).find(Boolean);
    const targetIndent = nextExisting
      ? lineIndent(targetContext.source, nextExisting.getStart(targetContext.file))
      : `${lineIndent(targetContext.source, targetObject.getStart(targetContext.file))}  `;
    const position = nextExisting ? nextExisting.getStart(targetContext.file) - targetIndent.length : targetObject.properties.end;
    const sourceIndent = lineIndent(sourceContext.source, sourceProperty.getStart(sourceContext.file));
    const propertyText = sourceContext.source.slice(sourceProperty.getStart(sourceContext.file), sourceProperty.end);
    const comma = sourceProperty === sourceProperties.at(-1) && !nextExisting ? '' : ',';
    const prefix = nextExisting ? '' : targetObject.properties.length ? '\n' : '';
    const suffix = nextExisting ? '\n' : '';
    insertions.push({ position, order: insertions.length, text: `${prefix}${reindent(propertyText, sourceIndent, targetIndent)}${comma}${suffix}`, key: [...path, name].join('.') });
  }
}

const [source, target] = await Promise.all([readFile(sourcePath, 'utf8'), readFile(targetPath, 'utf8')]);
const sourceContext = { source, ...localeObject(source, sourcePath) };
const targetContext = { source: target, ...localeObject(target, targetPath) };
const insertions = [];
collectInsertions(sourceContext, targetContext, sourceContext.object, targetContext.object, insertions);

let output = target;
for (const insertion of insertions.sort((a, b) => b.position - a.position || b.order - a.order)) {
  output = output.slice(0, insertion.position) + insertion.text + output.slice(insertion.position);
}

if (insertions.length) await writeFile(targetPath, output);
console.log(insertions.length ? `Added ${insertions.length} missing branches to ${targetPath}:\n${insertions.map(item => `- ${item.key}`).join('\n')}` : `${targetPath} already contains every key from ${sourcePath}.`);
