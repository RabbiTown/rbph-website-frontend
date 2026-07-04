<script setup lang="ts">
import { Compartment, EditorSelection, EditorState, countColumn } from '@codemirror/state';
import { EditorView, lineNumbers, placeholder as cmPlaceholder, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentLess, indentMore } from '@codemirror/commands';
import { bracketMatching, indentOnInput, syntaxHighlighting, foldGutter, HighlightStyle, indentUnit } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { tags } from '@lezer/highlight';

const model = defineModel<string>({ default: '' });

const props = defineProps<{
  placeholder?: string;
  disabled?: boolean;
  language?: 'javascript' | 'html' | 'plain';
  indent?: number;
  onSave?: () => void | Promise<void>;
  minHeight?: string;
  maxHeight?: string;
}>();

defineOptions({
  inheritAttrs: false,
});

const host = ref<HTMLElement>();
let editorView: EditorView | undefined;
let editorState: EditorState | undefined;
let resizeObserver: ResizeObserver | undefined;
let heightFrame: number | undefined;
let updatingFromOutside = false;

const contentCompartment = new Compartment();
const editableCompartment = new Compartment();
const indentCompartment = new Compartment();
const sizingCompartment = new Compartment();
const themeCompartment = new Compartment();

const syntaxTheme = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--color-primary)' },
  { tag: tags.definitionKeyword, color: 'var(--color-primary)' },
  { tag: tags.variableName, color: 'var(--color-highlighted)' },
  { tag: tags.typeName, color: 'var(--color-secondary)' },
  { tag: tags.string, color: 'var(--color-success)' },
  { tag: tags.number, color: 'var(--color-warning)' },
  { tag: tags.bool, color: 'var(--color-info)' },
  { tag: tags.null, color: 'var(--color-info)' },
  { tag: tags.comment, color: 'var(--color-dimmed)' },
  { tag: tags.propertyName, color: 'var(--color-highlighted)' },
  { tag: tags.function(tags.variableName), color: 'var(--color-secondary)' },
]);

function buildSizingExtension() {
  return EditorView.theme({
    '&': {
      height: '100%',
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--ui-bg-elevated)',
      color: 'var(--ui-text)',
    },
    '.cm-scroller': {
      height: '100%',
      minHeight: 0,
      overflow: 'auto',
      flex: '1 1 auto',
    },
    '.cm-gutters': {
      minHeight: '100%',
      backgroundColor: 'var(--ui-bg-elevated)',
      color: 'var(--ui-text-dimmed)',
      borderRight: '1px solid var(--ui-border)',
      paddingLeft: '0.25rem',
    },
    '.cm-content': {
      minHeight: '100%',
      caretColor: 'var(--ui-primary)',
      paddingTop: '0.375rem',
      paddingBottom: '0.375rem',
      paddingLeft: '0.25rem',
    },
    '.cm-line': {
      paddingLeft: '0',
      paddingRight: '0',
    },
    '.cm-placeholder': {
      color: 'var(--ui-text-dimmed)',
    },
  });
}

function buildIndentExtension() {
  const spaces = Math.max(1, Math.min(8, Math.trunc(props.indent ?? 2)));
  return [indentUnit.of(' '.repeat(spaces)), EditorState.tabSize.of(spaces)];
}

function handleTab(view: EditorView) {
  const spaces = Math.max(1, Math.min(8, Math.trunc(props.indent ?? 2)));
  const { state } = view;

  if (state.selection.ranges.some(range => !range.empty)) {
    return indentMore(view);
  }

  const changes = state.changeByRange(range => {
    const line = state.doc.lineAt(range.head);
    const linePrefix = line.text.slice(0, range.head - line.from);
    const column = countColumn(linePrefix, spaces);
    const remainder = column % spaces;
    const insert = ' '.repeat(remainder === 0 ? spaces : spaces - remainder);
    return {
      range: EditorSelection.cursor(range.head + insert.length),
      changes: { from: range.head, insert },
    };
  });

  view.dispatch(changes);
  return true;
}

function handleShiftTab(view: EditorView) {
  const { state } = view;

  if (state.selection.ranges.some(range => !range.empty)) {
    return indentLess(view);
  }

  return false;
}

function parseLength(value: string | undefined, fallback: string) {
  const input = (value ?? fallback).trim();
  const number = Number.parseFloat(input);
  if (!Number.isFinite(number)) return 0;
  if (input.endsWith('rem')) return number * Number.parseFloat(getComputedStyle(document.documentElement).fontSize || '16');
  if (input.endsWith('em')) return number * Number.parseFloat(getComputedStyle(host.value ?? document.documentElement).fontSize || '16');
  if (input.endsWith('vh')) return (number / 100) * window.innerHeight;
  if (input.endsWith('px') || /^[\d.]+$/.test(input)) return number;
  return number;
}

function setEditorHeight() {
  if (!host.value || !editorView) return;

  const minHeight = parseLength(props.minHeight, '18rem');
  const maxHeight = parseLength(props.maxHeight, '42rem') || Number.POSITIVE_INFINITY;
  const contentHeight = Math.max(editorView.scrollDOM.scrollHeight, editorView.contentDOM.scrollHeight);
  const nextHeight = Math.max(minHeight, Math.min(maxHeight, contentHeight));

  host.value.style.height = `${nextHeight}px`;
  host.value.style.minHeight = `${minHeight}px`;
  if (Number.isFinite(maxHeight)) {
    host.value.style.maxHeight = `${maxHeight}px`;
  } else {
    host.value.style.maxHeight = '';
  }
}

function scheduleHeightSync() {
  if (heightFrame !== undefined) return;
  heightFrame = window.requestAnimationFrame(() => {
    heightFrame = undefined;
    setEditorHeight();
  });
}

function languageExtension() {
  if (props.language === 'html') return html();
  if (props.language === 'plain') return [];
  return javascript({ typescript: false, jsx: false });
}

function buildExtensions() {
  return [
    lineNumbers(),
    foldGutter(),
    history(),
    indentOnInput(),
    bracketMatching(),
    syntaxHighlighting(syntaxTheme),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    contentCompartment.of(languageExtension()),
    editableCompartment.of(EditorView.editable.of(!props.disabled)),
    indentCompartment.of(buildIndentExtension()),
    sizingCompartment.of(buildSizingExtension()),
    themeCompartment.of(
      EditorView.theme({
        '.cm-focused': {
          outline: 'none',
        },
        '.cm-editor': {
          backgroundColor: 'var(--ui-bg-elevated)',
        },
        '.cm-selectionBackground, .cm-content ::selection': {
          backgroundColor: 'color-mix(in srgb, var(--ui-primary) 22%, transparent)',
        },
      }),
    ),
    cmPlaceholder(props.placeholder ?? ''),
    EditorView.lineWrapping,
    EditorView.updateListener.of(update => {
      if (!update.docChanged || updatingFromOutside) return;
      model.value = update.state.doc.toString();
      scheduleHeightSync();
    }),
    EditorView.domEventHandlers({
      dragover(event) {
        if (props.disabled) return false;
        event.preventDefault();
        return false;
      },
      keydown(event, view) {
        if (props.disabled) return false;
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
          event.preventDefault();
          void props.onSave?.();
          return true;
        }
        if (event.key === 'Tab' && event.shiftKey) {
          event.preventDefault();
          return handleShiftTab(view);
        }
        if (event.key === 'Tab' && !event.shiftKey) {
          event.preventDefault();
          return handleTab(view);
        }
        return false;
      },
    }),
  ];
}

function createEditor() {
  if (!host.value || editorView) return;

  editorState = EditorState.create({
    doc: model.value,
    extensions: buildExtensions(),
  });

  editorView = new EditorView({
    state: editorState,
    parent: host.value,
  });

  setEditorHeight();
  resizeObserver = new ResizeObserver(() => scheduleHeightSync());
  resizeObserver.observe(host.value);
}

function syncState(nextValue: string) {
  if (!editorView) return;
  const current = editorView.state.doc.toString();
  if (current === nextValue) return;

  updatingFromOutside = true;
  editorView.dispatch({
    changes: { from: 0, to: current.length, insert: nextValue },
  });
  updatingFromOutside = false;
}

watch(
  model,
  value => {
    syncState(value);
  },
  { immediate: true },
);

watch(
  () => [props.disabled, props.language, props.placeholder] as const,
  () => {
    if (!editorView) return;

    editorView.dispatch({
      effects: [
        editableCompartment.reconfigure(EditorView.editable.of(!props.disabled)),
        contentCompartment.reconfigure(languageExtension()),
        indentCompartment.reconfigure(buildIndentExtension()),
        sizingCompartment.reconfigure(buildSizingExtension()),
        themeCompartment.reconfigure(
          EditorView.theme({
            '.cm-focused': {
              outline: 'none',
            },
          }),
        ),
      ],
    });
    scheduleHeightSync();
  },
);

watch(
  () => [props.minHeight, props.maxHeight] as const,
  () => {
    scheduleHeightSync();
  },
);

onMounted(() => {
  createEditor();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = undefined;
  if (heightFrame !== undefined) {
    window.cancelAnimationFrame(heightFrame);
    heightFrame = undefined;
  }
  editorView?.destroy();
  editorView = undefined;
  editorState = undefined;
});

function focus() {
  editorView?.focus();
}

defineExpose({ focus });
</script>

<template>
  <div ref="host" class="overflow-hidden rounded-md bg-elevated/60 ring ring-default" :style="{ minHeight: props.minHeight ?? '18rem', maxHeight: props.maxHeight ?? '42rem' }" />
</template>
