// @ts-types="@types/vscode"
import * as vscode from "vscode"
import { Buffer } from "node:buffer"
import type {
  ExtensionMessage,
  WebviewMessage,
  WebviewMessageLoadImage,
  WebviewMessageUpdate,
} from "./types.ts"

export function activate(context: vscode.ExtensionContext) {
  const subscription = vscode.window.registerCustomEditorProvider(
    "kt3k.bwBlock",
    {
      resolveCustomTextEditor(document, panel, _) {
        new BlockEditor(context.extensionUri, document, panel)
      },
    } satisfies vscode.CustomTextEditorProvider,
  )
  context.subscriptions.push(subscription)
}

class BlockEditor {
  #webview: vscode.Webview
  #document: vscode.TextDocument

  constructor(
    uri: vscode.Uri,
    document: vscode.TextDocument,
    panel: vscode.WebviewPanel,
  ) {
    this.#document = document
    const webview = this.#webview = panel.webview
    webview.options = { enableScripts: true }
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(uri, "out/webview.js"),
    )
    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(uri, "src/style.css"),
    )
    webview.html = /* html */ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link href="${styleMainUri}" rel="stylesheet" />
          <style>
            canvas {
              image-rendering: crisp-edges;
              image-rendering: pixelated
            }
          </style>
        </head>
        <body>
          <div class="cell-switch fixed left-0 top-0 px-1 bg-neutral-900 shadow shadow-neutral-600"></div>
          <div class="spacer h-10"></div>
          <div class="main-container"></div>
          <script src="${scriptUri}" type="module"></script>
        </body>
      </html>
    `
    const subscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() !== document.uri.toString()) return
      this.#updateWebview()
    })
    panel.onDidDispose(() => subscription.dispose())
    webview.onDidReceiveMessage((e: WebviewMessage) => {
      if (e.type === "loadImage") {
        this.#loadImage(e)
      } else if (e.type === "update") {
        this.#update(e)
      }
    })
    this.#updateWebview()
  }

  #postMessage(message: ExtensionMessage) {
    this.#webview.postMessage(message)
  }

  #updateWebview() {
    this.#postMessage({
      type: "update",
      text: this.#document.getText(),
      uri: this.#document.uri.toString(),
    })
  }

  #update(e: WebviewMessageUpdate) {
    const edit = new vscode.WorkspaceEdit()
    edit.replace(
      this.#document.uri,
      new vscode.Range(0, 0, this.#document.lineCount, 0),
      JSON.stringify(e.map, null, 2),
    )
    vscode.workspace.applyEdit(edit)
  }

  async #loadImage(e: WebviewMessageLoadImage) {
    const uri = vscode.Uri.parse(e.uri)
    const data = await vscode.workspace.fs.readFile(uri)
    const base64 = Buffer.from(data).toString("base64")
    const src = `data:image/png;base64,${base64}`
    this.#postMessage({ type: "loadImageResponse", text: src, id: e.id })
  }
}
