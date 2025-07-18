import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="pdf-sign"
export default class extends Controller {
  static targets = [
    "fileInput",
    "selectButton",
    "buttonContainer",
    "uploadContainer",
    "pdfmergeContainer",
    "previewContainer",
    "fullContainer",
    "status",
    "pdfContainer",
    "canvasWrapper",
    "preupload",
    "signatureInput",
    "signaturePreview",
    "modal"
  ]

  connect() {
    console.log("controller connect")
    this.files = []
    this.currentCanvasStates = new Map()    // pageId -> ImageData
    this.pageWrappers = new Map()           // canvas.id -> wrapper element
    this.placedSignatures = []              // [{pageNum, x, y, width, height, src}]
    this.signatureImageSrc = null           // Data URL from upload
    this.signatureImageNatural = { w: 0, h: 0 }
    this.isPlacingSignature = false         // click-to-place active?
  }

  /* ---------- File selection + PDF load ---------- */
  select() {
    this.fileInputTarget.click()
  }

  async filesSelected(event) {
    const newFiles = Array.from(event.target.files)
    this.files = [...this.files, ...newFiles]
    this.updateButtonText()
    this.fileInputTarget.value = ''

    if (newFiles.length > 0) {
      await this.loadPDF(newFiles[0])
    }
  }

  receiveFiles(files) {
    this.files = files
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
    if (!file || file.type !== "application/pdf") return

    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer })
    this.pdfDoc = await loadingTask.promise

    this.totalPages = this.pdfDoc.numPages
    this.fullContainerTarget.innerHTML = "" // Clear old previews
    this.pageWrappers.clear()

    for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
      await this.renderPage(pageNum)
    }

    // Re-apply any existing signatures (e.g., after reload)
    this.redrawAllSignatures()
  }

  async renderPage(pageNum) {
    const page = await this.pdfDoc.getPage(pageNum)
    const scale = 1.5
    const viewport = page.getViewport({ scale })
    this.currentViewportScale = scale

    // Wrapper
    const wrapper = document.createElement("div")
    wrapper.classList.add("relative", "mb-4")
    wrapper.dataset.pageNum = pageNum

    // Label
    const label = document.createElement("p")
    label.textContent = `Page ${pageNum}`
    label.classList.add("text-sm", "mb-1")
    wrapper.appendChild(label)

    // Canvas
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
    this.pageWrappers.set(canvas.id, wrapper)

    this.setupPageInteractions(canvas, wrapper, pageNum)
  }

  /* ---------- Page interaction + signature placement ---------- */
  setupPageInteractions(canvas, wrapper, pageNum) {
    canvas.addEventListener("click", (event) => {
      const { offsetX, offsetY } = event

      if (this.isPlacingSignature && this.signatureImageSrc) {
        this.placeSignatureOnPage({ canvas, wrapper, pageNum, x: offsetX, y: offsetY })
      } else {
        console.log(`Canvas ${canvas.id} clicked at`, offsetX, offsetY)
      }
    })
  }

  /**
   * Place signature at click location (canvas pixel coords).
   * Creates an absolutely positioned <img> inside wrapper.
   */
  placeSignatureOnPage({ canvas, wrapper, pageNum, x, y }) {
  const pageW = canvas.width
  const desiredWidth = pageW * 0.25
  const ratio = this.signatureImageNatural.h > 0
    ? this.signatureImageNatural.h / this.signatureImageNatural.w
    : 0.25
  const desiredHeight = desiredWidth * ratio

  const canvasRectTop = canvas.offsetTop
  const canvasRectLeft = canvas.offsetLeft

  const imgWrapper = document.createElement("div")
  imgWrapper.classList.add("absolute", "cursor-move")
  imgWrapper.style.left = `${canvasRectLeft + x - desiredWidth / 2}px`
  imgWrapper.style.top = `${canvasRectTop + y - desiredHeight / 2}px`
  imgWrapper.style.width = `${desiredWidth}px`
  imgWrapper.style.height = `${desiredHeight}px`
  imgWrapper.style.position = "absolute"

  const img = document.createElement("img")
  img.src = this.signatureImageSrc
  img.draggable = false
  img.classList.add("rounded-sm", "drop-shadow-md", "select-none", "bg-white/0")
  img.style.width = "100%"
  img.style.height = "100%"
  img.style.display = "block"
  imgWrapper.appendChild(img)

  // Add resize handle
  const handle = document.createElement("div")
  handle.classList.add("absolute", "bottom-0", "right-0", "w-4", "h-4", "bg-blue-500", "cursor-se-resize", "rounded-full", "shadow")
  handle.style.touchAction = "none"
  imgWrapper.appendChild(handle)

  this.makeDraggable(imgWrapper, wrapper)
  this.makeResizable(imgWrapper, handle, ratio)

  wrapper.appendChild(imgWrapper)

  this.placedSignatures.push({
    pageNum,
    x: x - desiredWidth / 2,
    y: y - desiredHeight / 2,
    width: desiredWidth,
    height: desiredHeight,
    src: this.signatureImageSrc,
  })

  this.isPlacingSignature = false
  this.updateStatusMessage("Signature placed. Click 'Create Sign' to place another.")
}


  /**
   * Make an absolutely-positioned element draggable inside its wrapper.
   */
  makeDraggable(el, wrapper) {
    let dragging = false
    let startX, startY, origLeft, origTop

    const onDown = (e) => {
      e.preventDefault()
      dragging = true
      const point = this._pointer(e)
      startX = point.x
      startY = point.y
      origLeft = parseFloat(el.style.left)
      origTop = parseFloat(el.style.top)
      document.addEventListener("pointermove", onMove)
      document.addEventListener("pointerup", onUp)
    }



    const onMove = (e) => {
      if (!dragging) return
      const point = this._pointer(e)
      const dx = point.x - startX
      const dy = point.y - startY
      el.style.left = `${origLeft + dx}px`
      el.style.top = `${origTop + dy}px`
    }

    const onUp = () => {
      if (!dragging) return
      dragging = false
      document.removeEventListener("pointermove", onMove)
      document.removeEventListener("pointerup", onUp)
    }

    el.addEventListener("pointerdown", onDown)
  }

  makeResizable(wrapperEl, handleEl, aspectRatio) {
  let resizing = false
  let startX, startY, startWidth, startHeight

  const onDown = (e) => {
    e.preventDefault()
    resizing = true
    const point = this._pointer(e)
    startX = point.x
    startY = point.y
    startWidth = wrapperEl.offsetWidth
    startHeight = wrapperEl.offsetHeight

    document.addEventListener("pointermove", onMove)
    document.addEventListener("pointerup", onUp)
  }

  const onMove = (e) => {
    if (!resizing) return
    const point = this._pointer(e)
    const dx = point.x - startX
    let newWidth = Math.max(30, startWidth + dx)
    let newHeight = newWidth * aspectRatio

    wrapperEl.style.width = `${newWidth}px`
    wrapperEl.style.height = `${newHeight}px`
  }

  const onUp = () => {
    if (!resizing) return
    resizing = false
    document.removeEventListener("pointermove", onMove)
    document.removeEventListener("pointerup", onUp)
  }

  handleEl.addEventListener("pointerdown", onDown)
}

  _pointer(e) {
    if (e.touches && e.touches.length) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    return { x: e.clientX, y: e.clientY }
  }

  /* ---------- Signature upload + placement mode ---------- */
  openSignModal() {
    const modal = document.getElementById("my_modal_1")
    if (modal) modal.showModal()
  }

  handleSignatureUpload(event) {
    const file = event.target.files[0]
    if (!file || !file.type.startsWith("image/")) return

    // Optional size check
    // if (file.size > 5 * 1024 * 1024) { alert("File too large (max 5MB)"); return }

    const reader = new FileReader()
    reader.onload = (e) => {
      const dataURL = e.target.result

      // Save for later placements
      this.signatureImageSrc = dataURL

      // Determine natural dimensions
      const tmpImg = new Image()
      tmpImg.onload = () => {
        this.signatureImageNatural = { w: tmpImg.naturalWidth, h: tmpImg.naturalHeight }
      }
      tmpImg.src = dataURL

      // Show preview in sidebar
      const previewImg = document.createElement("img")
      previewImg.src = dataURL
      previewImg.classList.add("max-w-xs", "mt-4", "rounded", "shadow")
      previewImg.title = "Click to place on PDF"

      // When user clicks preview -> enter placement mode
      previewImg.addEventListener("click", () => {
        this.isPlacingSignature = true
        this.updateStatusMessage("Click anywhere on a PDF page to place your signature.")
      })

      this.signaturePreviewTarget.innerHTML = ""
      this.signaturePreviewTarget.appendChild(previewImg)

      // Close modal
      this.modalTarget.close()

      // Auto-enter placement mode (optional; comment out if you prefer manual)
      this.isPlacingSignature = true
      this.updateStatusMessage("Click a page to place your signature.")
    }
    reader.readAsDataURL(file)
  }

  /* ---------- Status messaging ---------- */
  updateStatusMessage(msg) {
    if (!this.hasStatusTarget) return
    this.statusTarget.textContent = msg
  }

  /* ---------- Redraw signatures after a re-render (optional) ---------- */
  redrawAllSignatures() {
    if (!this.placedSignatures.length) return

    // We redraw by simulating placement using stored coords (top-left).
    this.placedSignatures.forEach(sig => {
      const canvas = document.getElementById(`full-${sig.pageNum}`)
      if (!canvas) return
      const wrapper = this.pageWrappers.get(canvas.id)
      if (!wrapper) return

      const img = document.createElement("img")
      img.src = sig.src
      img.width = sig.width
      img.height = sig.height
      img.classList.add(
        "absolute",
        "cursor-move",
        "select-none",
        "drop-shadow-md",
        "rounded-sm",
        "bg-white/0"
      )
      img.style.left = `${canvas.offsetLeft + sig.x}px`
      img.style.top = `${canvas.offsetTop + sig.y}px`
      this.makeDraggable(img, wrapper)
      wrapper.appendChild(img)
    })
  }

  /* ---------- TODO: Export edited PDF ---------- */
  // Placeholder: merge canvas bitmaps + placed overlays into a downloadable PDF.
  // Implementing this for real requires drawing onto offscreen canvases or using pdf-lib.
async sendSignedPDFToRails() {
  if (!this.files.length || !this.placedSignatures.length) {
    alert("No PDF loaded or no signatures placed.");
    return;
  }

  const { PDFDocument } = window.PDFLib;

  const arrayBuffer = await this.files[0].arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);

  for (const sig of this.placedSignatures) {
    const page = pdfDoc.getPage(sig.pageNum - 1);

    const imageBytes = await fetch(sig.src).then(res => res.arrayBuffer());

    let embeddedImage;
    if (sig.src.startsWith("data:image/png")) {
      embeddedImage = await pdfDoc.embedPng(imageBytes);
    } else if (
      sig.src.startsWith("data:image/jpeg") ||
      sig.src.startsWith("data:image/jpg") ||
      sig.src.startsWith("data:image/webp")
    ) {
      embeddedImage = await pdfDoc.embedJpg(imageBytes);
    } else {
      alert("Unsupported image format for one of the signatures.");
      continue;
    }

    const canvas = document.getElementById(`full-${sig.pageNum}`);
    const scale = this.currentViewportScale || 1.5;
    const pdfWidth = page.getWidth();
    const pdfHeight = page.getHeight();

    const xRatio = pdfWidth / canvas.width;
    const yRatio = pdfHeight / canvas.height;

    const pdfX = sig.x * xRatio;
    const pdfY = pdfHeight - (sig.y + sig.height) * yRatio;
    const pdfW = sig.width * xRatio;
    const pdfH = sig.height * yRatio;

    page.drawImage(embeddedImage, {
      x: pdfX,
      y: pdfY,
      width: pdfW,
      height: pdfH,
    });
  }

  const finalPdfBytes = await pdfDoc.save();
  const signedBlob = new Blob([finalPdfBytes], { type: "application/pdf" });

  const formData = new FormData();
  formData.append("signed_pdf", signedBlob, "signed.pdf");
  formData.append("original_pdf", this.files[0]);

  const loader = document.getElementById("fullscreen-loader");
  loader.style.display = "flex";

  fetch("/convert_pdf_sign", {
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
      link.download = "final_signed.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      window.location.href = "/pdf_sign"; // Adjust to your route
    })
    .catch((error) => {
      console.error("PDF send/download error:", error);
      alert("Something went wrong.");
    })
    .finally(() => {
      loader.style.display = "none";
    });
}



}
