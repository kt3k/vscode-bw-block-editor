/// <reference no-default-lib="true"/>
/// <reference lib="esnext"/>
/// <reference lib="dom" />
/// <reference types="npm:@types/vscode-webview" />

import { BlockMap, TerrainBlock } from "@kt3k/bw/models"

const vscode = acquireVsCodeApi<{ text: string }>()

const notesContainer = document.querySelector<HTMLElement>(".notes")!

const errorContainer = document.createElement("div")
document.body.appendChild(errorContainer)
errorContainer.className = "error"
errorContainer.style.display = "none"

async function updateContent(text: string) {
  let json
  let blockMap: BlockMap
  let terrainBlock: TerrainBlock
  try {
    if (!text) {
      text = "{}"
    }
    json = JSON.parse(text)
    blockMap = new BlockMap("https://example.com", json)
    terrainBlock = new TerrainBlock(
      blockMap,
      () => Promise.resolve(new Image()),
    )
    notesContainer.innerHTML = JSON.stringify(blockMap)
    const canvas = await terrainBlock.createCanvas()
    canvas.style.left = "0"
    canvas.style.top = "0"
    canvas.style.position = "relative"
    notesContainer.appendChild(canvas)
  } catch {
    notesContainer.style.display = "none"
    errorContainer.innerText = "Error: Document is not valid json"
    errorContainer.style.display = ""
    return
  }
  notesContainer.style.display = ""
  errorContainer.style.display = "none"
}

window.addEventListener("message", (event) => {
  const message = event.data // The json data that the extension sent
  switch (message.type) {
    case "update": {
      const text = message.text
      updateContent(text)
      vscode.setState({ text })
      return
    }
  }
})

const state = vscode.getState()
if (state) {
  updateContent(state.text)
}
