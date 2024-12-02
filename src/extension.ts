import * as vscode from "vscode"

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.window.registerCustomEditorProvider(
    "kt3k.bwBlock",
    new BlockEdit(context),
  ))
}

class BlockEdit implements vscode.CustomTextEditorProvider {
  #context: vscode.ExtensionContext

  static #scratchCharacters = [
    "😸",
    "😹",
    "😺",
    "😻",
    "😼",
    "😽",
    "😾",
    "🙀",
    "😿",
    "🐱",
  ]

  constructor(context: vscode.ExtensionContext) {
    this.#context = context
  }

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    const { webview } = webviewPanel
    webview.options = {
      enableScripts: true,
    }
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
      this.#context.extensionUri,
      "media",
      "webview.js",
    ))

    const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(
      this.#context.extensionUri,
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
				<title>Cat Scratch</title>
			</head>
			<body>
				<div class="notes">
					<div class="add-button">
						<button>Scratch!</button>
					</div>
				</div>
				<script src="${scriptUri}"></script>
			</body>
			</html>`

    function updateWebview() {
      webview.postMessage({
        type: "update",
        text: document.getText(),
      })
    }

    const changeDocumentSubscription = vscode.workspace
      .onDidChangeTextDocument(
        (e) => {
          if (e.document.uri.toString() === document.uri.toString()) {
            updateWebview()
          }
        },
      )

    // Make sure we get rid of the listener when our editor is closed.
    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose()
    })

    // Receive message from the webview.
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

    updateWebview()
  }

  #addNewScratch(document: vscode.TextDocument) {
    const json = this.#getDocumentAsJson(document)
    const character = BlockEdit
      .#scratchCharacters[
        Math.floor(
          Math.random() *
            BlockEdit.#scratchCharacters.length,
        )
      ]
    json.scratches = [
      ...(Array.isArray(json.scratches) ? json.scratches : []),
      {
        id: crypto.randomUUID(),
        text: character,
        created: Date.now(),
      },
    ]

    return this.#updateTextDocument(document, json)
  }

  #deleteScratch(document: vscode.TextDocument, id: string) {
    const json = this.#getDocumentAsJson(document)
    if (!Array.isArray(json.scratches)) {
      return
    }

    json.scratches = json.scratches.filter((note: any) => note.id !== id)

    return this.#updateTextDocument(document, json)
  }

  #getDocumentAsJson(document: vscode.TextDocument): any {
    const text = document.getText()
    if (text.trim().length === 0) {
      return {}
    }

    try {
      return JSON.parse(text)
    } catch {
      throw new Error(
        "Could not get document as json. Content is not valid json",
      )
    }
  }

  #updateTextDocument(document: vscode.TextDocument, json: any) {
    const edit = new vscode.WorkspaceEdit()

    // Just replace the entire document every time for this example extension.
    // A more complete extension should compute minimal edits instead.
    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      JSON.stringify(json, null, 2),
    )

    return vscode.workspace.applyEdit(edit)
  }
}
