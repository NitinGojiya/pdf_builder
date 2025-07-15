import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [
    "text",
    "thumbnailContainer",
    "fullContainer",
    "status",
    "editor",
    "canvas"
  ]

  static values = {
    url: String,
    thumbnailScale: { type: Number, default: 0.3 },
    fullScale: { type: Number, default: 1.5 },
    editable: { type: Boolean, default: false }
  }

  currentPage = null
  editMode = null
  isFullscreen = false
  edits = []
  currentCanvasStates = new Map()

  async connect() {
    if (this.editableValue) {
      this.setupEditorControls()
    }
    await this.loadPDF()
  }

  async loadPDF() {
    try {
      this.setStatus("Loading PDF...")
      const loadingTask = pdfjsLib.getDocument(this.urlValue || "http://127.0.0.1:3000/test.pdf")
      const pdf = await loadingTask.promise
      this.setStatus(`Loaded PDF with ${pdf.numPages} pages`)

      this.thumbnailContainerTarget.innerHTML = ""
      this.fullContainerTarget.innerHTML = ""

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        await this.renderPage(pdf, pageNumber)
      }

      this.setStatus("PDF rendering complete")
    } catch (error) {
      this.setStatus(`Error: ${error.message}`, "text-red-500")
    }
  }

  async renderPage(pdf, pageNumber) {
    const page = await pdf.getPage(pageNumber)
    this.currentPage = page

    await this.renderPageToTarget(page, this.thumbnailScaleValue, this.thumbnailContainerTarget, `thumb-${pageNumber}`)

    const fullWrapper = document.createElement("div")
    fullWrapper.className = "relative"
    fullWrapper.dataset.pageNumber = pageNumber

    await this.renderPageToTarget(page, this.fullScaleValue, fullWrapper, `full-${pageNumber}`)

    this.fullContainerTarget.appendChild(fullWrapper)

    if (this.editableValue) this.setupPageInteractions(fullWrapper)
  }

  async renderPageToTarget(page, scale, target, id) {
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement("canvas")
    canvas.id = id
    const ctx = canvas.getContext("2d")

    canvas.height = viewport.height
    canvas.width = viewport.width

    await page.render({ canvasContext: ctx, viewport }).promise

    const wrapper = document.createElement("div")
    wrapper.className = "pdf-page flex flex-col items-center mb-4"
    wrapper.dataset.pageNumber = page.pageNumber

    canvas.className = "border border-gray-200 shadow-sm"
    wrapper.appendChild(canvas)

    const label = document.createElement("p")
    label.className = "text-sm text-gray-500 mt-2"
    label.textContent = `Page ${page.pageNumber}`
    wrapper.appendChild(label)

    target.appendChild(wrapper)
  }

  setupEditorControls() {
    this.element.innerHTML += `
      <div class="editor-controls fixed top-[100px] left-1/2 transform -translate-x-1/2 bg-white p-4 rounded-lg shadow-lg z-50">
        <button data-action="click->pdf-edit#toggleFullscreen" class="bg-blue-500 text-white p-2 rounded">Fullscreen</button>
        <button data-action="click->pdf-edit#setTextMode" class="bg-green-500 text-white p-2 rounded">Add Text</button>
        <button data-action="click->pdf-edit#setImageMode" class="bg-yellow-500 text-white p-2 rounded">Add Image</button>
        <button data-action="click->pdf-edit#setRectangleMode" class="bg-purple-500 text-white p-2 rounded"><i class="fa-solid fa-square"></i> Rectangle</button>
        <button data-action="click->pdf-edit#setCircleMode" class="bg-purple-500 text-white p-2 rounded"><i class="fa-solid fa-circle"></i> Circle</button>
        <button data-action="click->pdf-edit#setTriangleMode" class="bg-purple-500 text-white p-2 rounded"><i class="fa-solid fa-play"></i> Triangle</button>
        <button data-action="click->pdf-edit#undoLastEdit" class="bg-gray-500 text-white p-2 rounded">Undo</button>
        <button data-action="click->pdf-edit#saveEdits" class="bg-red-500 text-white p-2 rounded">Save</button>
      </div>`
  }

  setupPageInteractions(wrapper) {
    const canvas = wrapper.querySelector("canvas")
    canvas.addEventListener("click", e => {
      if (!this.editMode) return
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      switch (this.editMode) {
      case 'text':
        this.addTextElement(canvas, x, y)
        break
      case 'image':
        this.addImageElement(canvas, x, y)
        break
      case 'rectangle':
        this.addRectangle(canvas, x, y)
        break
      case 'circle':
        this.addCircle(canvas, x, y)
        break
      case 'triangle':
        this.addTriangle(canvas, x, y)
        break
    }

    })
  }

  toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen
    if (this.isFullscreen) {
      document.documentElement.requestFullscreen()
      this.editorTarget.classList.add("fixed", "inset-0", "bg-white", "z-40")
    } else {
      document.exitFullscreen()
      this.editorTarget.classList.remove("fixed", "inset-0", "bg-white", "z-40")
    }
  }

  setTextMode() {
    this.editMode = 'text'
    this.setStatus("Click to add text")
  }

  setImageMode() {
    this.editMode = 'image'
    this.setStatus("Click to add image")
  }

 setRectangleMode() {
    this.editMode = 'rectangle'
    this.setStatus("Click on canvas to add rectangle")
  }

  setCircleMode() {
    this.editMode = 'circle'
    this.setStatus("Click on canvas to add circle")
  }

  setTriangleMode() {
    this.editMode = 'triangle'
    this.setStatus("Click on canvas to add triangle")
  }


  addTextElement(canvas, x, y) {
    const dialog = document.getElementById("my_modal_1")
    if (!dialog) return
    dialog.showModal()

    const submit = () => {
      const text = this.textTarget.value
      if (!text) return dialog.close()

      const ctx = canvas.getContext("2d")
      ctx.font = "16px Arial"
      ctx.fillStyle = "#000"
      ctx.fillText(text, x, y)
      dialog.close()

      this.recordEdit({
        type: "text", page: canvas.closest("[data-page-number]").dataset.pageNumber, content: text, x, y, font: ctx.font, color: ctx.fillStyle, canvasId: canvas.id
      })
      dialog.removeEventListener("close", submit)
    }
    dialog.addEventListener("close", submit)
  }

  addImageElement(canvas, x, y) {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.onchange = e => {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = event => {
        const img = new Image()
        img.onload = () => {
          const ctx = canvas.getContext("2d")
          ctx.drawImage(img, x, y, 100, 100)
          this.recordEdit({
            type: "image", page: canvas.closest("[data-page-number]").dataset.pageNumber, x, y, width: 100, height: 100, imageData: event.target.result, canvasId: canvas.id
          })
        }
        img.src = event.target.result
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  addRectangle(canvas, x, y) {
  const ctx = canvas.getContext("2d")
  ctx.fillStyle = "#000"
  ctx.fillRect(x, y, 50, 50)

  this.recordEdit({
      type: "shape",
      shape: "rectangle",
      page: canvas.closest("[data-page-number]").dataset.pageNumber,
      x,
      y,
      width: 50,
      height: 50,
      color: ctx.fillStyle,
      canvasId: canvas.id
    })
  }

  addCircle(canvas, x, y) {
    const ctx = canvas.getContext("2d")
    ctx.fillStyle = "#000"
    ctx.beginPath()
    ctx.arc(x, y, 25, 0, Math.PI * 2)
    ctx.fill()

    this.recordEdit({
      type: "shape",
      shape: "circle",
      page: canvas.closest("[data-page-number]").dataset.pageNumber,
      x,
      y,
      radius: 25,
      color: ctx.fillStyle,
      canvasId: canvas.id
    })
  }

  addTriangle(canvas, x, y) {
    const ctx = canvas.getContext("2d")
    ctx.fillStyle = "#000"
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 50, y)
    ctx.lineTo(x + 25, y - 50)
    ctx.closePath()
    ctx.fill()

    this.recordEdit({
      type: "shape",
      shape: "triangle",
      page: canvas.closest("[data-page-number]").dataset.pageNumber,
      x,
      y,
      width: 50,
      height: 50,
      color: ctx.fillStyle,
      canvasId: canvas.id
    })
  }


  recordEdit(edit) {
    if (!this.currentCanvasStates.has(edit.canvasId)) {
      const canvas = document.getElementById(edit.canvasId)
      this.saveCanvasState(canvas)
    }
    this.edits.push(edit)
    this.setStatus(`Edit added on page ${edit.page}`)
  }

  saveCanvasState(canvas) {
    const data = canvas.toDataURL("image/png")
    this.currentCanvasStates.set(canvas.id, data)
  }

  undoLastEdit() {
    if (!this.edits.length) return this.setStatus("No edits to undo", "text-yellow-500")
    const last = this.edits.pop()
    const canvas = document.getElementById(last.canvasId)
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    const img = new Image()
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      this.reapplyEdits(canvas)
    }
    img.src = this.currentCanvasStates.get(last.canvasId)
    this.setStatus(`Undid edit on page ${last.page}`)
  }

  reapplyEdits(canvas) {
  const ctx = canvas.getContext("2d")
  const canvasId = canvas.id

  this.edits
    .filter(e => e.canvasId === canvasId)
    .forEach(edit => {
      ctx.fillStyle = edit.color

      if (edit.type === "text") {
        ctx.font = edit.font
        ctx.fillText(edit.content, edit.x, edit.y)

      } else if (edit.type === "image") {
        const img = new Image()
        img.src = edit.imageData
        img.onload = () => {
          ctx.drawImage(img, edit.x, edit.y, edit.width, edit.height)
        }

      } else if (edit.type === "shape") {
        switch (edit.shape) {
          case "rectangle":
            ctx.fillRect(edit.x, edit.y, edit.width, edit.height)
            break

          case "circle":
            ctx.beginPath()
            ctx.arc(edit.x + edit.radius, edit.y + edit.radius, edit.radius, 0, 2 * Math.PI)
            ctx.fill()
            break

          case "triangle":
            ctx.beginPath()
            ctx.moveTo(edit.x, edit.y)
            ctx.lineTo(edit.x + 50, edit.y)
            ctx.lineTo(edit.x + 25, edit.y - 50)
            ctx.closePath()
            ctx.fill()
            break
        }
      }
    })
}


  saveEdits() {
    this.fullContainerTarget.querySelectorAll("[data-page-number]").forEach(page => {
      const canvas = page.querySelector("canvas")
      this.saveCanvasState(canvas)
    })
    this.setStatus(`Saved ${this.edits.length} edits`, "text-green-500")
  }

  setStatus(msg, cls = "text-blue-500") {
    if (this.hasStatusTarget) {
      this.statusTarget.textContent = msg
      this.statusTarget.className = cls
    }
  }
}
