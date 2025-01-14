/// <reference no-default-lib="true"/>
/// <reference lib="esnext"/>
/// <reference lib="dom" />
/// <reference types="npm:@types/vscode-webview" />

import { BlockMap, TerrainBlock } from "@kt3k/bw/models"
import { floorN } from "@kt3k/bw/util/math"
import { memoizedLoading } from "@kt3k/bw/util/memo"
import { CanvasLayer } from "@kt3k/bw/util/canvas-layer"
import { type Context, GroupSignal, mount, register, Signal } from "@kt3k/cell"
import type { ExtensionMessage } from "./types.ts"

const vscode = acquireVsCodeApi<{ uri: string; text: string }>()

const blockMapSource = new GroupSignal({ uri: "", text: "" })
const terrainBlock = new Signal<TerrainBlock | null>(null)
let prevTerrainBlock: TerrainBlock | null = null
const selectedCell = new Signal<number | null>(null)

blockMapSource.subscribe(({ uri, text }) => {
  if (uri === "" || text === "") {
    terrainBlock.update(null)
    return
  }
  terrainBlock.update(
    new TerrainBlock(new BlockMap(uri, JSON.parse(text)), loadImage),
  )
})

function MainContainer({ subscribe, el }: Context) {
  subscribe(terrainBlock, async (terrainBlock) => {
    const prev = prevTerrainBlock
    prevTerrainBlock = terrainBlock
    if (terrainBlock === null) return

    if (prev === null) {
      const canvas = await terrainBlock.createCanvas()
      canvas.style.left = ""
      canvas.style.top = ""
      canvas.style.position = ""
      canvas.classList.add("terrain-block-canvas")
      el.innerHTML = ""
      el.appendChild(canvas)
      mount("terrain-block-canvas", el)
      return
    }

    // TODO(kt3k): compute diff, and apply diff
  })
}

function TerrainBlockCellsContainer({ on, el, subscribe }: Context) {
  subscribe(terrainBlock, async (terrainBlock) => {
    if (terrainBlock === null) return
    const cells = await Promise.all(terrainBlock.cells.map(async (cell) => {
      let canvas = el.querySelector<HTMLCanvasElement>(
        'canvas[name="' + cell.name + '"]',
      )
      if (canvas) {
        return canvas
      }
      canvas = document.createElement("canvas")
      canvas.width = 16
      canvas.height = 16
      canvas.classList.add("border", "inline-block", "m-2")
      canvas.setAttribute("name", cell.name)
      if (cell.color) {
        canvas.style.backgroundColor = cell.color
      }
      if (cell.href) {
        const img = await loadImage(cell.href)
        const ctx = canvas.getContext("2d")!
        ctx.drawImage(img, 0, 0, 16, 16)
      }
      el.appendChild(canvas)
    }))
    if (cells.length > 0 && selectedCell.get() === null) {
      selectedCell.update(0)
    }
  })
  subscribe(selectedCell, (index) => {
    const children = Array.from(el.children)
    children.forEach((child, i) => {
      if (i === index) {
        child.classList.add("border-white")
        child.classList.remove("border-black")
      } else {
        child.classList.add("border-black")
        child.classList.remove("border-white")
      }
    })
  })
  on("click", (e) => {
    const index = Array.from(el.children).indexOf(e.target as HTMLElement)
    if (index >= 0) {
      selectedCell.update(index)
    }
  })
}

function TerrainBlockCanvas({ on, el }: Context<HTMLCanvasElement>) {
  const canvasLayer = new CanvasLayer(el)

  on("click", async (e) => {
    const { left, top } = el.getBoundingClientRect()
    const x = floorN(e.clientX - left, 16)
    const y = floorN(e.clientY - top, 16)
    const i = x / 16
    const j = y / 16
    const block = terrainBlock.get()
    if (block === null) return
    const cell = block.cells[selectedCell.get()!]
    canvasLayer.ctx.clearRect(x, y, 16, 16)
    if (cell.href) {
      canvasLayer.ctx.drawImage(await loadImage(cell.href), x, y, 16, 16)
    } else {
      canvasLayer.drawRect(x, y, 16, 16, cell.color || "black")
    }
    const b = terrainBlock.get()!.clone()
    b.update(i, j, cell.name)
    terrainBlock.update(b)
  })
}

register(MainContainer, "main-container")
register(TerrainBlockCanvas, "terrain-block-canvas")
register(TerrainBlockCellsContainer, "terrain-block-cells")

function loadImage_(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const id = Math.random().toString()
    loadImageMap[id] = { resolve }
    vscode.postMessage({ type: "loadImage", uri, id })
  })
}

const loadImage = memoizedLoading(loadImage_)

const loadImageMap: Record<
  string,
  { resolve: (image: HTMLImageElement) => void }
> = {}

window.addEventListener("message", (event: MessageEvent<ExtensionMessage>) => {
  const message = event.data // The json data that the extension sent
  switch (message.type) {
    case "update": {
      const { uri, text } = message
      blockMapSource.update({ uri, text })
      vscode.setState({ uri, text })
      return
    }
    case "loadImageResponse": {
      const image = new Image()
      image.src = message.text
      loadImageMap[message.id].resolve(image)
      return
    }
  }
})

const state = vscode.getState()
if (state) {
  blockMapSource.update(state)
}
