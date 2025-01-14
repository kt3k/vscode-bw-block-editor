export type ExtensionMessage = {
  type: "update"
  uri: string
  text: string
} | {
  type: "loadImageResponse"
  id: string
  text: string
}
export type WebviewMessage = {
  type: "loadImage"
  id: string
  uri: string
}
