/// <reference no-default-lib="true"/>
/// <reference lib="esnext"/>
/// <reference lib="dom" />
/// <reference types="npm:@types/vscode-webview" />

import { BlockMap, TerrainBlock } from "@kt3k/bw/models"
import { WeakValueMap } from "@kt3k/weak-value-map"
import { type Context, mount, register, Signal } from "@kt3k/cell"

const vscode = acquireVsCodeApi<{ uri: string; text: string }>()

const terrainBlock = new Signal<TerrainBlock | null>(null)

function Notes({ subscribe, el }: Context) {
  subscribe(terrainBlock, async (terrainBlock) => {
    if (terrainBlock === null) return
    const canvas = await terrainBlock.createCanvas()
    canvas.style.left = ""
    canvas.style.top = ""
    canvas.style.position = ""
    el.appendChild(canvas)
  })
}

register(Notes, "notes")

function loadImage_(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const id = Math.random().toString()
    loadImageMap[id] = { resolve }
    vscode.postMessage({ type: "loadImage", uri, id })
  })
}

function memoizedLoading<K, A extends WeakKey>(
  fn: (key: K) => Promise<A>,
): (key: K) => Promise<A> {
  const weakValueMap = new WeakValueMap<K, Promise<A>>()
  const weakKeyMap = new WeakMap<A, Promise<A>>()
  return (key: K) => {
    const cache = weakValueMap.get(key)
    if (cache) {
      return cache
    }
    const promise = fn(key)
    // Cache the promise by the key
    weakValueMap.set(key, promise)
    promise.then((value) => {
      // Create a weak map from the asest to the loading promise.
      // This prevents the promise from being garbage collected
      // as long as the asset is being used
      weakKeyMap.set(value, promise)
    })
    return promise
  }
}

const loadImage = memoizedLoading(loadImage_)

const loadImageMap: Record<
  string,
  { resolve: (image: HTMLImageElement) => void }
> = {}

window.addEventListener("message", (event) => {
  const message = event.data // The json data that the extension sent
  switch (message.type) {
    case "update": {
      const { uri, text } = message
      const blockMap = new BlockMap(uri, JSON.parse(text))
      terrainBlock.update(new TerrainBlock(blockMap, loadImage))
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

const state = vscode.getState()
if (state) {
  const blockMap = new BlockMap(state.uri, JSON.parse(state.text))
  terrainBlock.update(new TerrainBlock(blockMap, loadImage))
}
