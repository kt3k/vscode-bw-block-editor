/// <reference no-default-lib="true"/>
/// <reference lib="esnext"/>
/// <reference lib="dom" />
/// <reference path="../node_modules/@types/vscode-webview/index.d.ts" />

const vscode = acquireVsCodeApi<{ text: string }>()

const notesContainer = document.querySelector<HTMLElement>(".notes")!

const addButtonContainer = document.querySelector(".add-button")!
addButtonContainer.querySelector("button")!.addEventListener("click", () => {
  vscode.postMessage({
    type: "add",
  })
})

const errorContainer = document.createElement("div")
document.body.appendChild(errorContainer)
errorContainer.className = "error"
errorContainer.style.display = "none"

function updateContent(/** @type {string} */ text: string) {
  let json
  try {
    if (!text) {
      text = "{}"
    }
    json = JSON.parse(text)
  } catch {
    notesContainer.style.display = "none"
    errorContainer.innerText = "Error: Document is not valid json"
    errorContainer.style.display = ""
    return
  }
  notesContainer.style.display = ""
  errorContainer.style.display = "none"

  notesContainer.innerHTML = ""
  for (const note of json.scratches || []) {
    const element = document.createElement("div")
    element.className = "note"
    notesContainer.appendChild(element)

    const text = document.createElement("div")
    text.className = "text"
    const textContent = document.createElement("span")
    textContent.innerText = note.text
    text.appendChild(textContent)
    element.appendChild(text)

    const created = document.createElement("div")
    created.className = "created"
    created.innerText = new Date(note.created).toUTCString()
    element.appendChild(created)

    const deleteButton = document.createElement("button")
    deleteButton.className = "delete-button"
    deleteButton.addEventListener("click", () => {
      vscode.postMessage({ type: "delete", id: note.id })
    })
    element.appendChild(deleteButton)
  }

  notesContainer.appendChild(addButtonContainer)
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
