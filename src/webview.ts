/// <reference no-default-lib="true"/>
/// <reference lib="esnext"/>
/// <reference lib="dom" />
/// <reference types="npm:@types/vscode-webview" />

import { BlockMap, TerrainBlock } from "@kt3k/bw/models"

const vscode = acquireVsCodeApi<{ uri: string; text: string }>()

const notesContainer = document.querySelector<HTMLElement>(".notes")!

const errorContainer = document.createElement("div")
document.body.appendChild(errorContainer)
errorContainer.className = "error"
errorContainer.style.display = "none"

async function updateContent(uri: string, text: string) {
  try {
    const blockMap = new BlockMap(uri, JSON.parse(text))
    const terrainBlock = new TerrainBlock(blockMap, loadImage)
    const canvas = await terrainBlock.createCanvas()
    canvas.style.left = ""
    canvas.style.top = ""
    canvas.style.position = ""
    const div = document.createElement("div")
    div.innerHTML = `<div><div>${uri}</div><pre>${
      JSON.stringify(blockMap, null, 2)
    }</pre></div>`
    notesContainer.appendChild(canvas)
    notesContainer.appendChild(div)
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
      const { uri, text } = message
      updateContent(uri, text)
      vscode.setState({ uri, text })
      return
    }
    case "loadImage": {
      const image = new Image()
      image.src = message.text
      loadImageMap[message.id].resolve(image)
    }
  }
})

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const id = Math.random().toString()
    loadImageMap[id] = { resolve }
    vscode.postMessage({ type: "loadImage", uri, id })
  })
}

const loadImageMap: Record<
  string,
  { resolve: (image: HTMLImageElement) => void }
> = {}

const state = vscode.getState()
if (state) {
  updateContent(state.uri, state.text)
}
