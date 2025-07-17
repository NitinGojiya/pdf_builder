import { Controller } from "@hotwired/stimulus"

/**
 * Controller for cropping PDF pages in the browser.
 * Allows users to select a PDF, visually crop areas, and download/upload the cropped result.
 * Integrates with PDF.js for rendering and PDFLib for PDF manipulation.
 *
 * @class PdfCropController
 * @extends Controller
 *
 * @property {Array<File>} files - List of selected PDF files.
 * @property {Array<Object>} edits - List of crop edits applied to pages.
 * @property {Map<string, ImageData>} currentCanvasStates - Stores original canvas image data by canvas ID.
 * @property {number} currentViewportScale - Current scale used for rendering PDF pages.
 * @property {number} cropStartX - X coordinate where crop starts.
 * @property {number} cropStartY - Y coordinate where crop starts.
 * @property {number} cropEndX - X coordinate where crop ends.
 * @property {number} cropEndY - Y coordinate where crop ends.
 * @property {boolean} isCropping - Indicates if cropping is in progress.
 * @property {HTMLElement|null} cropRect - DOM element representing the crop selection rectangle.
 * @property {ImageData|null} selectedImageData - Image data of the selected crop area.
 * @property {boolean} isMovingSelection - Indicates if crop selection is being moved.
 * @property {string} editMode - Current edit mode ("crop").
 * @property {PDFDocumentProxy} pdfDoc - Loaded PDF document.
 * @property {number} totalPages - Number of pages in the loaded PDF.
 *
 * @method connect Initializes controller state.
 * @method select Triggers file input for PDF selection.
 * @method filesSelected Handles file input change event, loads selected PDF.
 * @method updateButtonText Updates UI button text based on selected files.
 * @method next Advances UI to post-upload state.
 * @method loadPDF Loads and renders a PDF file using PDF.js.
 * @method renderPage Renders a single PDF page to canvas.
 * @method setStatus Updates status message in the UI.
 * @method setupPageInteractions Sets up crop interactions for a canvas.
 * @method startCrop Begins crop selection on mouse down.
 * @method updateCrop Updates crop rectangle on mouse move.
 * @method finishCrop Finalizes crop selection on mouse up.
 * @method removeSelection Removes current crop selection.
 * @method enableDragMove Enables drag and double-click interactions for crop selection.
 * @method downloadEditedPDF Initiates download/upload of cropped PDF.
 * @method sendCroppedPDFToRails Sends cropped PDF to backend and handles download.
 */
export default class extends Controller {

  static targets = [
    "fullContainer",
    "status",
    "pdfContainer",
    "canvasWrapper",
    "fileInput",
    "selectButton",
    "preupload",
    "buttonContainer"
  ]

  connect() {
    this.files = []
    this.edits = []
    this.currentCanvasStates = new Map()
    this.currentViewportScale = 1.5

    this.cropStartX = 0
    this.cropStartY = 0
    this.cropEndX = 0
    this.cropEndY = 0
    this.isCropping = false
    this.cropRect = null
    this.selectedImageData = null
    this.isMovingSelection = false
    this.editMode = "crop"
  }

  select() {
    this.fileInputTarget.click()
  }

  filesSelected(event) {
    const newFiles = Array.from(event.target.files)
    if (!newFiles.length) return

    this.files = [...this.files, ...newFiles]
    this.updateButtonText()
    this.fileInputTarget.value = ''

    this.loadPDF(newFiles[0])
  }

  updateButtonText() {
    if (this.files.length === 0) {
      this.selectButtonTarget.textContent = "Select PDF files"
    } else {
      const names = this.files.map(f => f.name)
      const display = names.length > 2
        ? `${names.slice(0, 2).join(', ')} +${names.length - 2} more`
        : names.join(', ')
      this.selectButtonTarget.textContent = display
      this.buttonContainerTarget.style.visibility = 'visible'
    }
  }

  next() {
    this.preuploadTarget.classList.add("hidden")
    document.getElementById("postupload").classList.remove("hidden")
  }

  async loadPDF(file) {
    if (!file || file.type !== "application/pdf") {
      this.setStatus("Invalid PDF file", "text-red-500")
      return
    }

    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer })
    this.pdfDoc = await loadingTask.promise

    this.totalPages = this.pdfDoc.numPages
    this.fullContainerTarget.innerHTML = ""

    for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
      await this.renderPage(pageNum)
    }

    this.setStatus(`Loaded ${this.totalPages} pages`, "text-green-500")
  }

  async renderPage(pageNum) {
    const page = await this.pdfDoc.getPage(pageNum)
    const scale = 1.5
    const viewport = page.getViewport({ scale })
    this.currentViewportScale = scale

    const wrapper = document.createElement("div")
    wrapper.classList.add("relative", "mb-4")

    const canvas = document.createElement("canvas")
    canvas.id = `full-${pageNum}`
    canvas.width = viewport.width
    canvas.height = viewport.height
    canvas.classList.add("border", "shadow", "cursor-crosshair")

    wrapper.appendChild(canvas)
    this.fullContainerTarget.appendChild(wrapper)

    const context = canvas.getContext("2d")
    await page.render({ canvasContext: context, viewport }).promise

    this.currentCanvasStates.set(canvas.id, context.getImageData(0, 0, canvas.width, canvas.height))
    this.setupPageInteractions(canvas)
  }

  setStatus(msg, cls = "") {
    this.statusTarget.innerText = msg
    this.statusTarget.className = cls
  }

  setupPageInteractions(canvas) {
    canvas.addEventListener("mousedown", e => {
      if (this.editMode === "crop") this.startCrop(e, canvas)
    })

    canvas.addEventListener("mousemove", e => {
      if (this.editMode === "crop" && this.isCropping) this.updateCrop(e, canvas)
    })

    canvas.addEventListener("mouseup", e => {
      if (this.editMode === "crop" && this.isCropping) this.finishCrop(e, canvas)
    })
  }

  startCrop(e, canvas) {
    if (this.cropRect) {
      this.setStatus("A selection already exists. Remove it first.", "text-yellow-500")
      return
    }

    const parent = canvas.parentNode.getBoundingClientRect()
    this.cropStartX = e.clientX - parent.left
    this.cropStartY = e.clientY - parent.top
    this.isCropping = true

    this.cropRect = document.createElement("div")
    this.cropRect.className = "absolute border-2 border-dotted border-blue-500 backdrop-blur-sm z-50 rounded-md"

    Object.assign(this.cropRect.style, {
      position: "absolute",
      left: `${this.cropStartX}px`,
      top: `${this.cropStartY}px`,
      width: "0px",
      height: "0px",
      pointerEvents: "none"
    })

    // Add remove button (×)
    const removeBtn = document.createElement("button")
    removeBtn.innerText = "×"
    removeBtn.className = "absolute -top-2 -right-2 bg-red-600 text-white w-6 h-6 rounded-full text-xs flex items-center justify-center z-50 shadow-md"
    removeBtn.addEventListener("click", () => this.removeSelection())

    this.cropRect.appendChild(removeBtn)
    canvas.parentNode.appendChild(this.cropRect)
  }

  updateCrop(e, canvas) {
    const parent = canvas.parentNode.getBoundingClientRect()
    this.cropEndX = e.clientX - parent.left
    this.cropEndY = e.clientY - parent.top

    const x = Math.min(this.cropStartX, this.cropEndX)
    const y = Math.min(this.cropStartY, this.cropEndY)
    const width = Math.abs(this.cropEndX - this.cropStartX)
    const height = Math.abs(this.cropEndY - this.cropStartY)

    Object.assign(this.cropRect.style, {
      left: `${x}px`,
      top: `${y}px`,
      width: `${width}px`,
      height: `${height}px`
    })
  }

  finishCrop(e, canvas) {
    this.isCropping = false
    if (!this.cropRect) return

    const cropX = Math.min(this.cropStartX, this.cropEndX)
    const cropY = Math.min(this.cropStartY, this.cropEndY)
    const cropWidth = Math.abs(this.cropEndX - this.cropStartX)
    const cropHeight = Math.abs(this.cropEndY - this.cropStartY)

    if (cropWidth < 10 || cropHeight < 10) {
      this.setStatus("Selection too small", "text-yellow-500")
      this.removeSelection()
      return
    }

    const ctx = canvas.getContext("2d")
    const fullImageData = this.currentCanvasStates.get(canvas.id)

    const tempCanvas = document.createElement("canvas")
    tempCanvas.width = canvas.width
    tempCanvas.height = canvas.height
    const tempCtx = tempCanvas.getContext("2d")
    tempCtx.putImageData(fullImageData, 0, 0)

    ctx.filter = "blur(3px)"
    ctx.drawImage(tempCanvas, 0, 0)
    ctx.filter = "none"
    ctx.putImageData(fullImageData, 0, 0, cropX, cropY, cropWidth, cropHeight)

    this.selectedImageData = ctx.getImageData(cropX, cropY, cropWidth, cropHeight)

    this.cropRect.style.pointerEvents = "auto"
    this.cropRect.style.cursor = "move"

    this.enableDragMove(canvas, canvas.id, cropX, cropY, cropWidth, cropHeight)
    this.setStatus("Area kept sharp. Drag or double-click to apply.", "text-blue-500")
  }

  removeSelection() {
    if (this.cropRect) {
      this.cropRect.remove()
      this.cropRect = null
      this.selectedImageData = null
      this.setStatus("Selection removed", "text-gray-500")
    }
  }

  enableDragMove(canvas, canvasId, x, y, w, h) {
    const selection = this.cropRect
    let offsetX = 0, offsetY = 0

    const onMouseDown = (e) => {
      e.preventDefault()
      this.isMovingSelection = true
      const rect = selection.getBoundingClientRect()
      offsetX = e.clientX - rect.left
      offsetY = e.clientY - rect.top
    }

    const onMouseMove = (e) => {
      if (!this.isMovingSelection) return
      const parentRect = canvas.parentNode.getBoundingClientRect()
      const newX = e.clientX - parentRect.left - offsetX
      const newY = e.clientY - parentRect.top - offsetY
      selection.style.left = `${newX}px`
      selection.style.top = `${newY}px`
    }

    const onMouseUp = () => {
      this.isMovingSelection = false
    }

    const onDoubleClick = () => {
      const finalX = parseInt(selection.style.left)
      const finalY = parseInt(selection.style.top)
      const finalWidth = parseInt(selection.style.width)
      const finalHeight = parseInt(selection.style.height)

      const tempCanvas = document.createElement("canvas")
      tempCanvas.width = finalWidth
      tempCanvas.height = finalHeight
      const tempCtx = tempCanvas.getContext("2d")
      tempCtx.putImageData(this.selectedImageData, 0, 0)
      const resizedImage = tempCtx.getImageData(0, 0, finalWidth, finalHeight)

      const ctx = canvas.getContext("2d")
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.putImageData(resizedImage, finalX, finalY)

      const pageNum = parseInt(canvas.id.split("-")[1])
      this.edits = this.edits.filter(e => e.page !== pageNum)
      this.edits.push({
        page: pageNum,
        x: finalX,
        y: finalY,
        width: finalWidth,
        height: finalHeight,
        imageData: resizedImage
      })

      selection.remove()
      this.cropRect = null
      this.setStatus("Selection applied", "text-green-500")
    }

    selection.addEventListener("mousedown", onMouseDown)
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    selection.addEventListener("dblclick", onDoubleClick)
  }

  downloadEditedPDF() {
    this.sendCroppedPDFToRails()
  }


  async sendCroppedPDFToRails() {
    const { PDFDocument } = window.PDFLib;

    // Create a new blank PDF (this will only include cropped parts)
    const newPdfDoc = await PDFDocument.create();

    for (const edit of this.edits) {
      // Create a canvas from the cropped image data
      const canvas = document.createElement("canvas");
      canvas.width = edit.width;
      canvas.height = edit.height;
      const ctx = canvas.getContext("2d");
      ctx.putImageData(edit.imageData, 0, 0);

      // Convert canvas to PNG
      const pngDataUrl = canvas.toDataURL("image/png");
      const pngBytes = await fetch(pngDataUrl).then(res => res.arrayBuffer());
      const pngImage = await newPdfDoc.embedPng(pngBytes);

      // Create a new page sized exactly to the crop
      const page = newPdfDoc.addPage([edit.width, edit.height]);

      // Draw image to fill the entire page
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: edit.width,
        height: edit.height
      });
    }

    const finalPdfBytes = await newPdfDoc.save();
    const blob = new Blob([finalPdfBytes], { type: "application/pdf" });

    // Optional: open a preview tab before upload
    // const debugUrl = URL.createObjectURL(blob);
    // window.open(debugUrl, "_blank");

    // Send to backend
    const formData = new FormData();
    formData.append("cropped_pdf", blob, "cropped.pdf");
    formData.append("original_pdf", this.files[0])
    const loader = document.getElementById("fullscreen-loader");
    loader.style.display = "flex";

    fetch("/convert_pdf_crop", {
      method: "POST",
      headers: {
        "X-CSRF-Token": document.querySelector("meta[name='csrf-token']").content
      },
      body: formData
    })
      .then((response) => {
        if (!response.ok) throw new Error("PDF response failed");
        return response.blob();
      })
      .then((downloadedPdfBlob) => {
        const url = URL.createObjectURL(downloadedPdfBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "final_cropped.pdf";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        window.location.href = "/pdf_crop"
      })
      .catch((error) => {
        console.error("PDF download error:", error);
        alert("Something went wrong.");
      })
      .finally(() => {
        loader.style.display = "none";
      });
  }
}
