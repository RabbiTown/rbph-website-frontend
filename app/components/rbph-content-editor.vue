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
const contentFrame = ref<HTMLElement>();
const sourceEditor = ref<{ focus: () => void }>();
const retainedContentHeight = ref(0);

defineProps<{
  placeholder?: string;
  disabled?: boolean;
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
const editorExtensions = [RbphAlignBlock, RbphImageBlock, RbphTextStyle, RbphUnderline, Color, TextAlign.configure({ types: ['heading', 'paragraph', 'align'] })];
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
};

function trackEditor(editor: Editor) {
  currentEditor.value = editor;
  return false;
}

function refreshEditorSelection() {
  editorSelectionVersion.value += 1;
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
  { type: 'separator' },
  { type: 'label', label: '对齐' },
  { kind: 'rbAlign', align: 'left', label: '左对齐', aliases: ['left', 'alignleft'], icon: 'material-symbols:format-align-left-rounded' },
  { kind: 'rbAlign', align: 'center', label: '居中', aliases: ['center', 'aligncenter'], icon: 'material-symbols:format-align-center-rounded' },
  { kind: 'rbAlign', align: 'right', label: '右对齐', aliases: ['right', 'alignright'], icon: 'material-symbols:format-align-right-rounded' },
] satisfies EditorSuggestionMenuItem[];

function setMode(value: typeof mode.value) {
  retainedContentHeight.value = contentFrame.value?.offsetHeight ?? retainedContentHeight.value;
  syncEditorMarkdown();
  mode.value = value;

  requestAnimationFrame(() => {
    retainedContentHeight.value = contentFrame.value?.offsetHeight ?? 0;
  });
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

defineExpose({ focus });
</script>

<template>
  <div class="relative">
    <div class="pointer-events-none sticky top-4 z-20 h-0">
      <div class="pointer-events-auto ms-auto flex w-max -translate-y-8 items-center gap-1 rounded-md bg-default/95 p-1 shadow-sm ring ring-default backdrop-blur">
        <u-button icon="material-symbols:edit-note-outline-rounded" color="neutral" :variant="mode === 'editor' ? 'soft' : 'ghost'" size="sm" :disabled="disabled" label="编辑器" @click="setMode('editor')" />
        <u-button icon="material-symbols:code-blocks-outline-rounded" color="neutral" :variant="isSourceMode ? 'soft' : 'ghost'" size="sm" :disabled="disabled" label="源代码" @click="setMode('source')" />
        <u-button icon="material-symbols:visibility-outline-rounded" color="neutral" :variant="isPreviewMode ? 'soft' : 'ghost'" size="sm" label="预览" @click="setMode('preview')" />
      </div>
    </div>

    <div ref="contentFrame" :style="{ minHeight: retainedContentHeight ? `${retainedContentHeight}px` : undefined }">
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
        :editor-props="{ handleKeyDown: onEditorKeydown }"
        :ui="{
          content: 'ps-3',
          base: 'py-3',
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
          <u-editor-drag-handle v-if="mode === 'editor'" :editor="editor" />
          <u-editor-suggestion-menu v-if="mode === 'editor'" :editor="editor" :items="suggestionItems" :filter-fields="['label', 'aliases']" />
        </template>
      </u-editor>

      <rbph-markdown-source-editor v-if="isSourceMode" ref="sourceEditor" v-model="model" v-bind="attrs" :placeholder="placeholder" :disabled="disabled" @focus-title="emit('focusTitle')" />
      <div v-else-if="isPreviewMode" class="px-4 py-3 sm:px-5">
        <rbph-content :content="previewContent" />
      </div>
    </div>
  </div>
</template>
