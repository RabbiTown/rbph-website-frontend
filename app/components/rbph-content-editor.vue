<script setup lang="ts">
import TextAlign from '@tiptap/extension-text-align';
import Color from '@tiptap/extension-color';
import type { ChainedCommands, Editor } from '@tiptap/core';
import type { EditorSuggestionMenuItem } from '@nuxt/ui';

const model = defineModel<string>({ default: '' });
const attrs = useAttrs();
const mode = ref<'editor' | 'source' | 'preview'>('editor');
const currentEditor = shallowRef<Editor>();
const editorSelectionVersion = ref(0);
const root = ref<HTMLElement>();
const framedFocused = ref(false);
const contentFrame = ref<HTMLElement>();
const previewFrame = ref<HTMLElement>();
const sourceEditor = ref<{ focus: () => void }>();
const retainedContentHeight = ref(0);
let retainedContentReleaseId = 0;
type ScrollAnchor = {
  frameTop: number;
};
let retainedContentScrollAnchor: ScrollAnchor | undefined;
const tableMenu = reactive({
  visible: false,
  top: 0,
  left: 0,
});

const props = defineProps<{
  placeholder?: string;
  disabled?: boolean;
  framed?: boolean;
}>();

const emit = defineEmits<{
  focusTitle: [];
}>();

const isSourceMode = computed(() => mode.value === 'source');
const isPreviewMode = computed(() => mode.value === 'preview');
const previewContent = computed<RbContent>(() => ({
  content: model.value,
  content_type: RbContentType.Markdown,
}));
const editorExtensions = [RbphAlignBlock, RbphImageBlock, RbphTable, RbphTableRow, RbphTableHeader, RbphTableCell, RbphTextStyle, RbphUnderline, Color, TextAlign.configure({ types: ['heading', 'paragraph', 'align'] })];
const editorProps = {
  handleKeyDown: onEditorKeydown,
  handleDOMEvents: {
    mousedown: onEditorTailBlankMouseDown,
  },
  attributes: {
    autocomplete: 'on',
    autocorrect: 'on',
    autocapitalize: 'sentences',
    spellcheck: 'true',
  },
};
const blockTypeItems = [
  { kind: 'paragraph', label: '段落', icon: 'material-symbols:format-paragraph-rounded' },
  { kind: 'heading', level: 1, label: '一级标题', icon: 'material-symbols:format-h1-rounded' },
  { kind: 'heading', level: 2, label: '二级标题', icon: 'material-symbols:format-h2-rounded' },
  { kind: 'heading', level: 3, label: '三级标题', icon: 'material-symbols:format-h3-rounded' },
  { kind: 'bulletList', icon: 'material-symbols:format-list-bulleted-rounded', label: '无序列表', tooltip: { text: '无序列表' } },
  { kind: 'orderedList', icon: 'material-symbols:format-list-numbered-rounded', label: '有序列表', tooltip: { text: '有序列表' } },
  { kind: 'blockquote', icon: 'material-symbols:format-quote-rounded', label: '引用', tooltip: { text: '引用' } },
  { kind: 'codeBlock', icon: 'material-symbols:integration-instructions-rounded', label: '代码块', tooltip: { text: '代码块' } },
] as const;
type AlignEditor = Pick<Editor, 'chain' | 'isActive'> & {
  chain: () => ChainedCommands & {
    lift: (name: string) => ChainedCommands;
  };
};

function isImageNodeSelected(editor: Pick<Editor, 'state'>) {
  const selection = editor.state.selection as { node?: { type?: { name?: string } } };
  return selection.node?.type?.name === 'rbImage';
}

const editorHandlers = {
  rbAlign: {
    canExecute: () => true,
    execute: (editor: AlignEditor & Editor, item: { align?: string }) => {
      const align = item.align === 'center' || item.align === 'right' ? item.align : 'left';
      const chain = editor.chain().focus();

      if (isImageNodeSelected(editor)) {
        return chain.updateAttributes('rbImage', { align });
      }

      if (editor.isActive('rbImage')) {
        return chain.updateAttributes('rbImage', { captionAlign: align });
      }

      if (align === 'left') {
        return chain.lift('align').setTextAlign('left');
      }

      if (editor.isActive('align')) {
        return chain.updateAttributes('align', { textAlign: align }).setTextAlign(align);
      }

      return chain.wrapIn('align', { textAlign: align }).setTextAlign(align);
    },
    isActive: (editor: Pick<Editor, 'getAttributes' | 'isActive'>, item: { align?: string }) => {
      const align = item.align === 'center' || item.align === 'right' ? item.align : 'left';
      if (editor.isActive('rbImage')) {
        const attrs = editor.getAttributes('rbImage');
        const activeAlign = isImageNodeSelected(editor) ? attrs.align : attrs.captionAlign;
        return align === (typeof activeAlign === 'string' ? activeAlign : 'center');
      }
      return align === 'left' ? !editor.isActive('align') : editor.isActive('align', { textAlign: align });
    },
  },
  rbImage: {
    canExecute: () => true,
    execute: (editor: Editor) => createRbImageBlock(editor),
    isActive: (editor: Editor) => editor.isActive('rbImage'),
  },
  rbTable: {
    canExecute: () => true,
    execute: (editor: Editor) => insertRbTable(editor),
    isActive: (editor: Editor) => editor.isActive('table'),
  },
};

function trackEditor(editor: Editor) {
  currentEditor.value = editor;
  return false;
}

function refreshEditorSelection() {
  editorSelectionVersion.value += 1;
  updateTableMenu();
}

function findCurrentTableCell(editor: Editor) {
  const selectedCell = editor.view.dom.querySelector('.selectedCell');
  if (selectedCell instanceof HTMLElement) return selectedCell;

  const domAtSelection = editor.view.domAtPos(editor.state.selection.from).node;
  const element = domAtSelection instanceof Element ? domAtSelection : domAtSelection.parentElement;
  const cell = element?.closest('td, th');
  return cell instanceof HTMLElement ? cell : undefined;
}

function updateTableMenu() {
  const editor = currentEditor.value;
  const frame = contentFrame.value;
  if (!editor || !frame || mode.value !== 'editor' || !editor.isActive('table')) {
    tableMenu.visible = false;
    return;
  }

  const cell = findCurrentTableCell(editor);
  if (!cell) {
    tableMenu.visible = false;
    return;
  }

  const frameRect = frame.getBoundingClientRect();
  const cellRect = cell.getBoundingClientRect();
  tableMenu.visible = true;
  tableMenu.top = cellRect.top - frameRect.top + frame.scrollTop - 6;
  tableMenu.left = cellRect.right - frameRect.left + frame.scrollLeft;
}

function currentBlockType(editor: Editor) {
  void editorSelectionVersion.value;

  if (editor.isActive('heading', { level: 1 })) return blockTypeItems[1];
  if (editor.isActive('heading', { level: 2 })) return blockTypeItems[2];
  if (editor.isActive('heading', { level: 3 })) return blockTypeItems[3];
  if (editor.isActive('bulletList')) return blockTypeItems[4];
  if (editor.isActive('orderedList')) return blockTypeItems[5];
  if (editor.isActive('blockquote')) return blockTypeItems[6];
  if (editor.isActive('codeBlock')) return blockTypeItems[7];
  return blockTypeItems[0];
}

function currentTextColor(editor: Editor) {
  void editorSelectionVersion.value;

  return normalizeTextColor(editor.getAttributes('textStyle').color);
}

function syncEditorMarkdown() {
  if (mode.value !== 'editor' || !currentEditor.value) return;

  try {
    model.value = currentEditor.value.getMarkdown();
  } catch {
    model.value = currentEditor.value.getText();
  }
}

function captureScrollAnchor(): ScrollAnchor | undefined {
  if (!contentFrame.value || !import.meta.client) return undefined;

  const frameTop = contentFrame.value.getBoundingClientRect().top;
  return {
    frameTop: frameTop < 72 ? 72 : frameTop,
  };
}

function restoreScrollAnchor(anchor: ScrollAnchor | undefined) {
  if (!anchor || !contentFrame.value || !import.meta.client) return;

  const currentTop = contentFrame.value.getBoundingClientRect().top;
  const delta = currentTop - anchor.frameTop;
  if (Math.abs(delta) < 1) return;

  window.scrollBy({ top: delta, behavior: 'instant' });
}

function releaseRetainedContentHeight(releaseId = retainedContentReleaseId) {
  if (releaseId !== retainedContentReleaseId) return;

  retainedContentHeight.value = 0;
  requestAnimationFrame(() => {
    restoreScrollAnchor(retainedContentScrollAnchor);
  });
}

const toolbarItems = [
  [
    {
      icon: 'material-symbols:format-paragraph-rounded',
      slot: 'blockType',
      items: blockTypeItems,
    },
  ],
  [
    { kind: 'mark', mark: 'bold', icon: 'material-symbols:format-bold-rounded', 'aria-label': '加粗', tooltip: { text: '加粗' } },
    { kind: 'mark', mark: 'italic', icon: 'material-symbols:format-italic-rounded', 'aria-label': '斜体', tooltip: { text: '斜体' } },
    { kind: 'mark', mark: 'underline', icon: 'material-symbols:format-underlined-rounded', 'aria-label': '下划线', tooltip: { text: '下划线' } },
    { kind: 'mark', mark: 'strike', icon: 'material-symbols:format-strikethrough-rounded', 'aria-label': '删除线', tooltip: { text: '删除线' } },
    { kind: 'mark', mark: 'code', icon: 'material-symbols:code-rounded', 'aria-label': '行内代码', tooltip: { text: '行内代码' } },
    { icon: 'material-symbols:link-rounded', 'aria-label': '链接', tooltip: { text: '链接' }, slot: 'link' },
    {
      icon: 'material-symbols:format-color-text-rounded',
      'aria-label': '文字颜色',
      tooltip: { text: '文字颜色' },
      slot: 'textColor',
    },
  ],
  [
    { kind: 'rbAlign', align: 'left', icon: 'material-symbols:format-align-left-rounded', 'aria-label': '左对齐', tooltip: { text: '左对齐' } },
    { kind: 'rbAlign', align: 'center', icon: 'material-symbols:format-align-center-rounded', 'aria-label': '居中', tooltip: { text: '居中' } },
    { kind: 'rbAlign', align: 'right', icon: 'material-symbols:format-align-right-rounded', 'aria-label': '右对齐', tooltip: { text: '右对齐' } },
  ],
  [{ kind: 'clearFormatting', icon: 'material-symbols:format-clear-rounded', 'aria-label': '清除格式', tooltip: { text: '清除格式' } }],
];

const suggestionItems = [
  { type: 'label', label: '基础块' },
  { kind: 'paragraph', label: '段落', aliases: ['paragraph', 'para', 'p'], icon: 'material-symbols:format-paragraph-rounded' },
  { kind: 'heading', level: 1, label: '一级标题', aliases: ['heading', 'heading1', 'h1'], icon: 'material-symbols:title-rounded' },
  { kind: 'heading', level: 2, label: '二级标题', aliases: ['heading2', 'h2'], icon: 'material-symbols:title-rounded' },
  { kind: 'heading', level: 3, label: '三级标题', aliases: ['heading3', 'h3'], icon: 'material-symbols:title-rounded' },
  { type: 'separator' },
  { type: 'label', label: '内容' },
  { kind: 'bulletList', label: '无序列表', aliases: ['bullet', 'bulletlist', 'ul', 'list'], icon: 'material-symbols:format-list-bulleted-rounded' },
  { kind: 'orderedList', label: '有序列表', aliases: ['ordered', 'orderedlist', 'ol', 'numberedlist'], icon: 'material-symbols:format-list-numbered-rounded' },
  { kind: 'blockquote', label: '引用', aliases: ['quote', 'blockquote'], icon: 'material-symbols:format-quote-rounded' },
  { kind: 'codeBlock', label: '代码块', aliases: ['code', 'codeblock'], icon: 'material-symbols:integration-instructions-rounded' },
  { kind: 'horizontalRule', label: '分割线', aliases: ['hr', 'divider', 'separator', 'rule'], icon: 'material-symbols:horizontal-rule-rounded' },
  { kind: 'rbImage', label: '图片', aliases: ['image', 'img', 'picture'], icon: 'material-symbols:image-outline-rounded' },
  { kind: 'rbTable', label: '表格', aliases: ['table', 'grid'], icon: 'material-symbols:grid-on-outline' },
  { type: 'separator' },
  { type: 'label', label: '对齐' },
  { kind: 'rbAlign', align: 'left', label: '左对齐', aliases: ['left', 'alignleft'], icon: 'material-symbols:format-align-left-rounded' },
  { kind: 'rbAlign', align: 'center', label: '居中', aliases: ['center', 'aligncenter'], icon: 'material-symbols:format-align-center-rounded' },
  { kind: 'rbAlign', align: 'right', label: '右对齐', aliases: ['right', 'alignright'], icon: 'material-symbols:format-align-right-rounded' },
] satisfies EditorSuggestionMenuItem[];

function setMode(value: typeof mode.value) {
  if (value === mode.value) return;

  const scrollAnchor = captureScrollAnchor();
  const previousHeight = contentFrame.value?.offsetHeight ?? 0;

  retainedContentHeight.value = previousHeight;
  retainedContentScrollAnchor = scrollAnchor;
  syncEditorMarkdown();
  mode.value = value;
  tableMenu.visible = false;

  const releaseId = ++retainedContentReleaseId;
  requestAnimationFrame(() => {
    restoreScrollAnchor(scrollAnchor);
  });

  if (value !== 'preview') {
    nextTick(() => {
      releaseRetainedContentHeight(releaseId);
    });
  } else if (props.framed) {
    nextTick(() => {
      previewFrame.value?.focus();
    });
  }
}

function setEditorTextColor(editor: Editor, color: RbTextColor) {
  const chain = editor.chain().focus();
  if (color) {
    chain.setColor(color).run();
  } else {
    chain.unsetColor().run();
  }
  refreshEditorSelection();
}

function currentLinkHref(editor: Editor) {
  void editorSelectionVersion.value;
  const href = editor.getAttributes('link').href;
  return typeof href === 'string' ? href : '';
}

function setEditorLink(editor: Editor, href: string) {
  editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  refreshEditorSelection();
}

function unsetEditorLink(editor: Editor) {
  editor.chain().focus().extendMarkRange('link').unsetLink().run();
  refreshEditorSelection();
}

function runTableAction(action: (editor: Editor) => boolean) {
  const editor = currentEditor.value;
  if (!editor) return;
  action(editor);
  nextTick(updateTableMenu);
}

function isEditorSelectionOnFirstLine(editor: Editor) {
  const { from } = editor.state.selection;
  const currentCoords = editor.view.coordsAtPos(from);
  const firstTextPosition = Math.min(1, editor.state.doc.content.size);
  const firstCoords = editor.view.coordsAtPos(firstTextPosition);

  return currentCoords.top <= firstCoords.top + 4;
}

function onEditorKeydown(_view: unknown, event: KeyboardEvent) {
  if (event.key !== 'ArrowUp' || !currentEditor.value || !isEditorSelectionOnFirstLine(currentEditor.value)) {
    return false;
  }

  event.preventDefault();
  emit('focusTitle');
  return true;
}

function onEditorTailBlankMouseDown(view: { dom: HTMLElement }, event: MouseEvent) {
  if (event.target !== view.dom) return false;

  const lastBlock = Array.from(view.dom.children).at(-1);
  if (!(lastBlock instanceof HTMLElement)) return false;

  if (event.clientY <= lastBlock.getBoundingClientRect().bottom) return false;

  event.preventDefault();
  currentEditor.value?.chain().focus('end').run();
  return true;
}

async function focus() {
  if (mode.value === 'preview') {
    setMode('editor');
    await nextTick();
  }

  if (mode.value === 'source') {
    sourceEditor.value?.focus();
    return;
  }

  currentEditor.value?.chain().focus('start').run();
}

function onRootFocusIn() {
  if (!props.framed) return;
  framedFocused.value = true;
}

function onRootFocusOut() {
  if (!props.framed) return;

  requestAnimationFrame(() => {
    const active = document.activeElement;
    framedFocused.value = Boolean(active && root.value?.contains(active));
  });
}

defineExpose({ focus });
</script>

<template>
  <div ref="root" class="rbph-content-editor relative" :class="{ 'rbph-content-editor-framed rounded-md border border-default bg-default shadow-xs transition focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15': props.framed }" @focusin="onRootFocusIn" @focusout="onRootFocusOut">
    <div v-if="!props.framed || framedFocused" class="pointer-events-none z-20 h-0" :class="props.framed ? 'absolute inset-x-0 top-0' : 'sticky top-4'">
      <div class="pointer-events-auto ms-auto flex w-max items-center gap-1 rounded-md bg-default/95 p-1 shadow-sm ring ring-default backdrop-blur" :class="props.framed ? '-translate-y-[calc(100%+0.25rem)] me-0' : '-translate-y-8'">
        <u-button icon="material-symbols:edit-note-outline-rounded" color="neutral" :variant="mode === 'editor' ? 'soft' : 'ghost'" size="sm" :disabled="disabled" label="编辑器" @click="setMode('editor')" />
        <u-button icon="material-symbols:code-blocks-outline-rounded" color="neutral" :variant="isSourceMode ? 'soft' : 'ghost'" size="sm" :disabled="disabled" label="源代码" @click="setMode('source')" />
        <u-button icon="material-symbols:visibility-outline-rounded" color="neutral" :variant="isPreviewMode ? 'soft' : 'ghost'" size="sm" label="预览" @click="setMode('preview')" />
      </div>
    </div>

    <div ref="contentFrame" class="relative" :style="{ minHeight: retainedContentHeight ? `${retainedContentHeight}px` : undefined }">
      <u-editor
        v-if="mode === 'editor'"
        v-model="model"
        v-bind="attrs"
        content-type="markdown"
        :placeholder="placeholder"
        :disabled="disabled"
        :image="false"
        :starter-kit="{ underline: false }"
        :extensions="editorExtensions"
        :handlers="editorHandlers"
        class="min-h-0"
        :editor-props="editorProps"
        :ui="{
          content: props.framed ? '' : 'ps-3',
          base: props.framed ? 'min-h-56 px-3 py-3' : 'py-3',
        }"
        :on-selection-update="refreshEditorSelection"
      >
        <template #default="{ editor }">
          <span v-if="trackEditor(editor)" />
          <u-editor-toolbar v-if="mode === 'editor'" layout="bubble" :editor="editor" :items="toolbarItems">
            <template #blockType="{ item, isActive, isDisabled, onClick }">
              <u-dropdown-menu :items="[item.items.map(child => ({ ...child, active: isActive(child), disabled: isDisabled(child), onSelect: event => onClick(event, child) }))]" :modal="false" size="sm">
                <u-button color="neutral" variant="ghost" size="sm" :icon="currentBlockType(editor).icon" :aria-label="currentBlockType(editor).label" :disabled="isDisabled(item)" @click="onClick($event, item)" />
              </u-dropdown-menu>
            </template>

            <template #link="{ item, isDisabled }">
              <u-popover :content="{ side: 'top', align: 'center', sideOffset: 8 }" :ui="{ content: 'p-0' }">
                <u-button color="neutral" variant="ghost" size="sm" square :active="editor.isActive('link')" :disabled="isDisabled(item)" :aria-label="item['aria-label']" icon="material-symbols:link-rounded" />

                <template #content="{ close }">
                  <rb-link-editor-panel
                    :href="currentLinkHref(editor)"
                    @apply="
                      href => {
                        setEditorLink(editor, href);
                        close();
                      }
                    "
                    @remove="
                      () => {
                        unsetEditorLink(editor);
                        close();
                      }
                    "
                  />
                </template>
              </u-popover>
            </template>

            <template #textColor="{ item, isActive, isDisabled }">
              <u-popover :content="{ side: 'top', align: 'center', sideOffset: 8 }" :ui="{ content: 'p-0' }">
                <u-button color="neutral" variant="ghost" size="sm" square :active="isActive(item)" :disabled="isDisabled(item)" :aria-label="item['aria-label']" :ui="{ base: 'gap-0' }" @click="onClick($event, item)">
                  <rb-icon-format-color :color="currentTextColor(editor)" />
                </u-button>

                <template #content="{ close }">
                  <rb-color-picker-panel
                    :model-value="currentTextColor(editor)"
                    @update="
                      (value, shouldClose) => {
                        setEditorTextColor(editor, value);
                        if (shouldClose) close();
                      }
                    "
                  />
                </template>
              </u-popover>
            </template>
          </u-editor-toolbar>
          <u-editor-drag-handle v-if="mode === 'editor' && !props.framed" :editor="editor" />
          <u-editor-suggestion-menu v-if="mode === 'editor'" :editor="editor" :items="suggestionItems" :filter-fields="['label', 'aliases']" />
        </template>
      </u-editor>

      <div
        v-if="tableMenu.visible && mode === 'editor'"
        class="absolute z-30 flex -translate-x-full -translate-y-full items-center gap-0.5 rounded-md bg-default/95 p-1 shadow-sm ring ring-default backdrop-blur"
        :style="{ top: `${tableMenu.top}px`, left: `${tableMenu.left}px` }"
        @mousedown.prevent
      >
        <u-tooltip text="下方添加行">
          <u-button color="neutral" variant="ghost" size="xs" square icon="material-symbols:playlist-add-rounded" :disabled="disabled" @click="runTableAction(addRbTableRow)" />
        </u-tooltip>
        <u-tooltip text="删除行">
          <u-button color="neutral" variant="ghost" size="xs" square icon="material-symbols:playlist-remove-rounded" :disabled="disabled" @click="runTableAction(deleteRbTableRow)" />
        </u-tooltip>
        <u-separator orientation="vertical" class="mx-0.5 h-5" />
        <u-tooltip text="右侧添加列">
          <u-button color="neutral" variant="ghost" size="xs" square icon="material-symbols:add-column-right-outline-rounded" :disabled="disabled" @click="runTableAction(addRbTableColumn)" />
        </u-tooltip>
        <u-tooltip text="删除列">
          <u-button color="neutral" variant="ghost" size="xs" square icon="material-symbols:delete-outline-rounded" :disabled="disabled" @click="runTableAction(deleteRbTableColumn)" />
        </u-tooltip>
        <u-separator orientation="vertical" class="mx-0.5 h-5" />
        <u-tooltip text="删除表格">
          <u-button color="error" variant="ghost" size="xs" square icon="material-symbols:table-rows-narrow-rounded" :disabled="disabled" @click="runTableAction(deleteRbTable)" />
        </u-tooltip>
      </div>

      <rbph-markdown-source-editor v-if="isSourceMode" ref="sourceEditor" v-model="model" v-bind="attrs" :placeholder="placeholder" :disabled="disabled" :framed="props.framed" :class="props.framed ? 'min-h-56' : ''" @focus-title="emit('focusTitle')" />
      <div v-else-if="isPreviewMode" ref="previewFrame" class="px-4 py-3 sm:px-5 outline-none" :class="props.framed ? 'min-h-56' : ''" :tabindex="props.framed ? 0 : undefined">
        <rbph-content :content="previewContent" @rendered="releaseRetainedContentHeight()" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.rbph-content-editor :deep(.ProseMirror) {
  padding-bottom: 50vh;
}

.rbph-content-editor-framed :deep(.ProseMirror) {
  min-height: 14rem;
  padding-bottom: 1rem;
}

.rbph-content-editor :deep(.ProseMirror table) {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  margin-block: 1rem;
  border: 1px solid var(--ui-border, rgb(209 213 219));
  overflow: hidden;
}

.rbph-content-editor :deep(.ProseMirror th),
.rbph-content-editor :deep(.ProseMirror td) {
  min-width: 6rem;
  border: 1px solid var(--ui-border, rgb(209 213 219));
  padding: 0.5rem 0.625rem;
  vertical-align: top;
  background: var(--ui-bg);
}

.rbph-content-editor :deep(.ProseMirror th) {
  background: var(--ui-bg-elevated);
  font-weight: 600;
}

.rbph-content-editor :deep(.ProseMirror .selectedCell::after) {
  background: var(--ui-primary);
  opacity: 0.12;
}

.rbph-content-editor :deep(.ProseMirror table p) {
  margin: 0;
}
</style>
