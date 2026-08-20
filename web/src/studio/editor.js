import { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap
} from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  syntaxHighlighting,
  defaultHighlightStyle
} from "@codemirror/language";
import { detectLanguage } from "./languages.js";

function languageForFile(fileName) {
  const name = fileName.toLowerCase();

  if (name.endsWith(".html") || name.endsWith(".htm")) {
    return html();
  }

  if (name.endsWith(".css")) {
    return css();
  }

  if (name.endsWith(".py") || name.endsWith(".pyw")) {
    return python();
  }

  // CodeMirror's JavaScript mode supports TypeScript syntax when enabled.
  return javascript({
    typescript: name.endsWith(".ts") || name.endsWith(".tsx")
  });
}

export class EditorService {
  constructor({
    mountEl,
    onChange,
    onCursorChange
  }) {
    this.mountEl = mountEl;
    this.onChange = onChange;
    this.onCursorChange = onCursorChange;

    this.view = null;
    this.currentFile = null;
    this.language = null;
    this.loadingFile = false;
  }

  mount(fileName, content) {
    this.destroy();
    this.currentFile = fileName;
    this.language = detectLanguage(fileName);

    const state = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap
        ]),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        syntaxHighlighting(
          defaultHighlightStyle,
          { fallback: true }
        ),
        oneDark,
        languageForFile(fileName),
        EditorView.updateListener.of(update => {
          if (update.docChanged && !this.loadingFile) {
            this.onChange?.(
              update.state.doc.toString()
            );
          }

          if (update.selectionSet || update.docChanged) {
            this.updateCursor();
          }
        }),
        EditorView.theme({
          "&": {
            height: "100%",
            fontSize: "14px",
            backgroundColor: "#07090e"
          },
          ".cm-scroller": {
            fontFamily:
              '"JetBrains Mono", "Fira Code", "SFMono-Regular", Consolas, monospace',
            overflow: "auto",
            WebkitOverflowScrolling: "touch"
          },
          ".cm-content": {
            padding: "12px 0",
            minHeight: "100%",
            caretColor: "#ffffff"
          },
          ".cm-gutters": {
            backgroundColor: "#080b10",
            borderRight: "1px solid rgba(255, 255, 255, 0.08)",
            color: "#6c768a"
          },
          ".cm-activeLine": {
            backgroundColor: "rgba(255, 255, 255, 0.035)"
          },
          ".cm-activeLineGutter": {
            backgroundColor: "rgba(124, 92, 255, 0.12)"
          }
        })
      ]
    });

    this.view = new EditorView({
      state,
      parent: this.mountEl
    });

    this.updateCursor();
    this.focus();
  }

  loadFile(fileName, content) {
    this.currentFile = fileName;
    this.language = detectLanguage(fileName);

    if (!this.view) {
      this.mount(fileName, content);
      return;
    }

    this.loadingFile = true;

    this.view.dispatch({
      changes: {
        from: 0,
        to: this.view.state.doc.length,
        insert: content
      },
      selection: { anchor: 0 },
      userEvent: "select.change"
    });

    this.loadingFile = false;
    this.updateCursor();
    this.focus();
  }

  getValue() {
    return this.view?.state.doc.toString() ?? "";
  }

  focus() {
    this.view?.focus();
  }

  updateCursor() {
    if (!this.view) return;

    const position = this.view.state.selection.main.head;
    const textBeforeCursor = this.view.state.doc.toString().slice(0, position);
    const lines = textBeforeCursor.split("\n");

    this.onCursorChange?.({
      line: lines.length,
      column: lines[lines.length - 1].length + 1
    });
  }

  destroy() {
    if (this.view) {
      this.view.destroy();
      this.view = null;
    }
  }
}
