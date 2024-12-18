// @ts-types="@types/vscode"
import * as vscode from "vscode"

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.window.registerCustomEditorProvider(
    "kt3k.bwBlock",
    new BlockEdit(context),
  ))
}

class BlockEdit implements vscode.CustomTextEditorProvider {
  #uri: vscode.Uri
  static #chars = ["😸", "😹", "😺", "😻", "😼", "😽", "😾", "🙀", "😿", "🐱"]

  constructor(context: vscode.ExtensionContext) {
    this.#uri = context.extensionUri
  }

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    panel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    const { webview } = panel
    webview.options = { enableScripts: true }
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
      this.#uri,
      "out",
      "webview.js",
    ))
    const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(
      this.#uri,
      "media",
      "style.css",
    ))
    webview.html = /* html */ `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleMainUri}" rel="stylesheet" />
			</head>
			<body>
				<div class="notes"></div>
				<script src="${scriptUri}"></script>
			</body>
			</html>`
    const update = () => {
      webview.postMessage({
        type: "update",
        text: document.getText(),
        uri: document.uri.toString(),
      })
    }
    const subscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() !== document.uri.toString()) return
      update()
    })
    panel.onDidDispose(() => subscription.dispose())
    webview.onDidReceiveMessage((e) => {
      switch (e.type) {
        case "add":
          this.#addNewScratch(document)
          return

        case "delete":
          this.#deleteScratch(document, e.id)
          return
      }
    })
    update()
  }

  #addNewScratch(document: vscode.TextDocument) {
    const json = JSON.parse(document.getText())
    const chars = BlockEdit.#chars
    const c = chars[Math.floor(Math.random() * chars.length)]
    json.scratches = [
      ...(Array.isArray(json.scratches) ? json.scratches : []),
      { id: crypto.randomUUID(), text: c, created: Date.now() },
    ]
    return this.#updateTextDocument(document, json)
  }

  #deleteScratch(document: vscode.TextDocument, id: string) {
    const json = JSON.parse(document.getText())
    if (!Array.isArray(json.scratches)) {
      return
    }
    json.scratches = json.scratches.filter((note: any) => note.id !== id)
    return this.#updateTextDocument(document, json)
  }

  #updateTextDocument(document: vscode.TextDocument, json: any) {
    const edit = new vscode.WorkspaceEdit()
    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      JSON.stringify(json, null, 2),
    )
    return vscode.workspace.applyEdit(edit)
  }
}
