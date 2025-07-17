import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [
    "text",
    "fullContainer",
    "status",
    "editor",
    "canvas",
    "preupload",
    "fileInput",
    "selectButton",
    "buttonContainer",
    "changesContainer"
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
  selectedColor = "#000000"
  edits = []
  currentCanvasStates = new Map()
  isResizing = false
  currentEditIndex = null
  initialMouseX = 0
  initialMouseY = 0
  initialWidth = 0
  initialHeight = 0
  initialRadius = 0
  resizeHandle = null
  currentCanvasForResize = null
  isDragging = false
  draggedEditIndex = null
  draggedEditInitialX = 0
  draggedEditInitialY = 0

  async connect() {
    this.files = []
    if (this.editableValue) {
      this.setupEditorControls()
    }
    await this.loadPDF()
  }

  select() {
    this.fileInputTarget.click();
  }

  receiveFiles(files) {
    this.files = files
  }

  filesSelected(event) {
    const newFiles = Array.from(event.target.files);
    this.files = [...this.files, ...newFiles];
    this.updateButtonText();
    this.fileInputTarget.value = '';

    if (this.files.length > 0) {
      const file = this.files[0];
      const reader = new FileReader();

      reader.onload = async (e) => {
        const arrayBuffer = e.target.result;
        this.pdfData = new Uint8Array(arrayBuffer);
        console.log("PDF data loaded into Uint8Array");
        await this.loadPDF();
      };

      reader.onerror = (e) => {
        console.error("FileReader error:", e);
        this.setStatus(`Error reading file: ${e.message}`, "text-red-500");
      };

      reader.readAsArrayBuffer(file);
    }
  }

  updateButtonText() {
    if (this.files.length === 0) {
      this.selectButtonTarget.textContent = "Select PDF files";
    } else {
      const names = this.files.map(f => f.name);
      const display = names.length > 2
        ? `${names.slice(0, 2).join(', ')} +${names.length - 2} more`
        : names.join(', ');
      this.selectButtonTarget.textContent = display;
      this.buttonContainerTarget.style.visibility = 'visible';
    }
  }

  next() {
    this.preuploadTarget.classList.add("hidden");
    document.getElementById("postupload").classList.remove("hidden");
    document.getElementById("edit-icon").classList.remove("hidden")
  }

  async loadPDF() {
    try {
      this.setStatus("Loading PDF...")

      let loadingTask;
      if (this.pdfData) {
        loadingTask = pdfjsLib.getDocument({ data: this.pdfData });
      } else if (this.urlValue) {
        loadingTask = pdfjsLib.getDocument({ url: this.urlValue });
      } else {
        this.setStatus("No PDF source found.", "text-red-500");
        return;
      }

      const pdf = await loadingTask.promise;
      this.setStatus(`Loaded PDF with ${pdf.numPages} pages`)
      this.fullContainerTarget.innerHTML = ""

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        await this.renderPage(pdf, pageNumber)
      }

      this.setStatus("PDF rendering complete")
    } catch (error) {
      this.setStatus(`Error: ${error.message}`, "text-red-500")
      console.error("Error loading PDF:", error);
    }
  }

  async renderPage(pdf, pageNumber) {
    const page = await pdf.getPage(pageNumber)
    this.currentPage = page

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

    // Save initial canvas state after rendering PDF
    this.saveCanvasState(canvas);

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
      <div id="edit-icon"
  class="editor-controls hidden fixed left-0 top-1/2 transform -translate-y-1/2 w-auto max-w-xs px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 bg-white py-4 rounded-lg shadow-lg z-50">

  <div class="flex flex-col gap-2 justify-center items-stretch">
    <label class="flex items-center gap-2">
      <input type="color" id="color-picker"
            value="#000000"
            data-action="input->pdf-edit#updateSelectedColor"
            class="w-10 h-8 cursor-pointer border rounded" />
      <span class="text-sm text-gray-600 hidden sm:inline">Color</span>
    </label>

    <button data-action="click->pdf-edit#toggleFullscreen"
            class="bg-blue-500 text-white text-sm px-3 py-1.5 rounded hover:bg-blue-600 transition">
      <i class="fa-solid fa-maximize"></i>
    </button>
    <button data-action="click->pdf-edit#setTextMode"
            class="bg-green-500 text-white text-sm px-3 py-1.5 rounded hover:bg-green-600 transition">
      <i class="fa-solid fa-font"></i>
    </button>
    <button data-action="click->pdf-edit#setImageMode"
            class="bg-yellow-500 text-white text-sm px-3 py-1.5 rounded hover:bg-yellow-600 transition">
      <i class="fa-solid fa-image"></i>
    </button>
    <button data-action="click->pdf-edit#setRectangleMode"
            class="bg-purple-500 text-white text-sm px-3 py-1.5 rounded hover:bg-purple-600 transition">
      <i class="fa-solid fa-square"></i>
    </button>
    <button data-action="click->pdf-edit#setCircleMode"
            class="bg-purple-500 text-white text-sm px-3 py-1.5 rounded hover:bg-purple-600 transition">
      <i class="fa-solid fa-circle"></i>
    </button>
    <button data-action="click->pdf-edit#setTriangleMode"
            class="bg-purple-500 text-white text-sm px-3 py-1.5 rounded hover:bg-purple-600 transition">
      <i class="fa-solid fa-triangle-exclamation"></i>
    </button>
    <button data-action="click->pdf-edit#undoLastEdit"
            class="bg-gray-500 text-white text-sm px-3 py-1.5 rounded hover:bg-gray-600 transition">
      <i class="fa-solid fa-delete-left"></i>
    </button>

  </div>
</div>
    `;
  }

  updateSelectedColor(event) {
    this.selectedColor = event.target.value;
    this.setStatus(`Color selected: ${this.selectedColor}`);
  }

  setupPageInteractions(wrapper) {
    const canvas = wrapper.querySelector("canvas")
    canvas.addEventListener("click", e => {
      if (this.editMode && this.editMode !== 'resize' && this.editMode !== 'drag') {
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
        this.editMode = null;
      }
    })

    canvas.addEventListener("mousedown", this.startInteraction.bind(this));
  }

  startInteraction(e) {
    if (this.isResizing || this.isDragging || e.button !== 0) return;

    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    for (let i = this.edits.length - 1; i >= 0; i--) {
      const edit = this.edits[i];
      if (edit.canvasId === canvas.id) {
        if (this.isPointInEdit(mouseX, mouseY, edit, canvas.getContext("2d"))) {
          this.isDragging = true;
          this.draggedEditIndex = i;
          this.draggedEditInitialX = edit.x;
          this.draggedEditInitialY = edit.y;
          this.initialMouseX = mouseX;
          this.initialMouseY = mouseY;

          document.addEventListener("mousemove", this.performDrag.bind(this));
          document.addEventListener("mouseup", this.endDrag.bind(this), { once: true });
          e.preventDefault();
          e.stopPropagation();
          this.setStatus(`Dragging ${edit.type} on page ${edit.page}.`);
          return;
        }
      }
    }
  }

  isPointInEdit(x, y, edit, ctx) {
    switch (edit.type) {
      case "text":
        const fontSize = parseInt(edit.font || "16px Arial");
        const textWidth = ctx.measureText(edit.content).width;
        const textHeight = fontSize;
        return x >= edit.x && x <= edit.x + textWidth &&
          y >= edit.y - textHeight && y <= edit.y;

      case "image":
      case "shape":
        if (edit.shape === "rectangle" || edit.shape === "triangle") {
          return x >= edit.x && x <= edit.x + edit.width &&
            y >= edit.y && y <= edit.y + edit.height;
        } else if (edit.shape === "circle") {
          const dx = x - edit.x;
          const dy = y - edit.y;
          return (dx * dx + dy * dy) <= (edit.radius * edit.radius);
        }
        break;
    }
    return false;
  }

  performDrag(e) {
    if (!this.isDragging || this.draggedEditIndex === null) return;

    const edit = this.edits[this.draggedEditIndex];
    const canvas = document.getElementById(edit.canvasId);
    const rect = canvas.getBoundingClientRect();
    const currentMouseX = e.clientX - rect.left;
    const currentMouseY = e.clientY - rect.top;

    const dx = currentMouseX - this.initialMouseX;
    const dy = currentMouseY - this.initialMouseY;

    edit.x = this.draggedEditInitialX + dx;
    edit.y = this.draggedEditInitialY + dy;

    this.redrawCanvasEdit(edit);
  }

  endDrag() {
    this.isDragging = false;
    this.draggedEditIndex = null;
    document.removeEventListener("mousemove", this.performDrag.bind(this));
    this.setStatus("Drag complete.");
    this.renderEditSummary();
  }

  toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen
    if (this.isFullscreen) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
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
      if (!text) {
        dialog.close();
        return;
      }

      this.recordEdit({
        type: "text",
        page: canvas.closest("[data-page-number]").dataset.pageNumber,
        content: text,
        x,
        y,
        font: "16px Arial",
        color: this.selectedColor,
        canvasId: canvas.id
      })

      dialog.close()
      dialog.removeEventListener("close", submit)
      this.textTarget.value = '';
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
        this.recordEdit({
          type: "image",
          page: canvas.closest("[data-page-number]").dataset.pageNumber,
          x,
          y,
          width: 100,
          height: 100,
          imageData: event.target.result,
          canvasId: canvas.id
        })
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  addRectangle(canvas, x, y) {
    this.recordEdit({
      type: "shape",
      shape: "rectangle",
      page: canvas.closest("[data-page-number]").dataset.pageNumber,
      x,
      y,
      width: 50,
      height: 50,
      color: this.selectedColor,
      canvasId: canvas.id
    })
  }

  addCircle(canvas, x, y) {
    this.recordEdit({
      type: "shape",
      shape: "circle",
      page: canvas.closest("[data-page-number]").dataset.pageNumber,
      x,
      y,
      radius: 25,
      color: this.selectedColor,
      canvasId: canvas.id
    })
  }

  addTriangle(canvas, x, y) {
    this.recordEdit({
      type: "shape",
      shape: "triangle",
      page: canvas.closest("[data-page-number]").dataset.pageNumber,
      x,
      y,
      width: 50,
      height: 50,
      color: this.selectedColor,
      canvasId: canvas.id
    })
  }

  recordEdit(edit) {
    const canvas = document.getElementById(edit.canvasId);

    // Save state BEFORE applying edit
    this.saveCanvasState(canvas);

    // Apply the edit to canvas
    this.applyEditToCanvas(edit);

    this.edits.push(edit);
    this.setStatus(`Edit added on page ${edit.page}`);
    this.renderEditSummary();
  }

  // NEW: Apply edits to canvas without saving state
  applyEditToCanvas(edit) {
    const canvas = document.getElementById(edit.canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    switch(edit.type) {
      case "text":
        ctx.font = edit.font || "16px Arial";
        ctx.fillStyle = edit.color || "#000000";
        ctx.fillText(edit.content, edit.x, edit.y);
        break;

      case "image":
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, edit.x, edit.y, edit.width, edit.height);
        };
        img.src = edit.imageData;
        break;

      case "shape":
        ctx.fillStyle = edit.color || "#000000";
        switch(edit.shape) {
          case "rectangle":
            ctx.fillRect(edit.x, edit.y, edit.width, edit.height);
            break;
          case "circle":
            ctx.beginPath();
            ctx.arc(edit.x, edit.y, edit.radius, 0, Math.PI * 2);
            ctx.fill();
            break;
          case "triangle":
            ctx.beginPath();
            ctx.moveTo(edit.x, edit.y);
            ctx.lineTo(edit.x + edit.width, edit.y);
            ctx.lineTo(edit.x + edit.width / 2, edit.y - edit.height);
            ctx.closePath();
            ctx.fill();
            break;
        }
        break;
    }
  }

  renderEditSummary() {
    if (!this.hasChangesContainerTarget) return;

    this.changesContainerTarget.innerHTML = "";

    this.edits.forEach((edit, index) => {
      const div = document.createElement("div");
      div.className = "bg-white shadow p-2 mb-2 rounded text-sm  flex items-center justify-start gap-1";
      div.dataset.editIndex = index;

      const label = document.createElement("p");
      label.className = "font-semibold";
      label.innerHTML = `<i class="fa-solid fa-pen-fancy mr-1"></i> ${index + 1}: ${edit.type} on Page ${edit.page}`;
      div.appendChild(label);

      if (edit.type === "text") {
        const detail = document.createElement("p");
        detail.textContent = `Text: "${edit.content}" `;
        detail.className = "text-sm text-gray-700 truncate w-full";
        div.appendChild(detail);

        const fontInput = document.createElement("input");
        fontInput.type = "number";
        fontInput.value = parseInt(edit.font || "16");
        fontInput.className = "border text-xs w-16 p-1 mt-1";
        fontInput.addEventListener("change", () => {
          edit.font = `${fontInput.value}px Arial`;
          this.redrawCanvasEdit(edit);
        });
        div.appendChild(fontInput);
      }

      if (edit.type === "image" || (edit.type === "shape" && (edit.shape === "rectangle" || edit.shape === "triangle"))) {
        const widthInput = document.createElement("input");
        widthInput.type = "number";
        widthInput.value = Math.round(edit.width);
        widthInput.className = "border text-xs w-16 p-1 mt-1 mr-1";
        widthInput.addEventListener("change", () => {
          edit.width = parseInt(widthInput.value);
          this.redrawCanvasEdit(edit);
        });

        const heightInput = document.createElement("input");
        heightInput.type = "number";
        heightInput.value = Math.round(edit.height);
        heightInput.className = "border text-xs w-16 p-1 mt-1";
        heightInput.addEventListener("change", () => {
          edit.height = parseInt(heightInput.value);
          this.redrawCanvasEdit(edit);
        });

        div.appendChild(widthInput);
        div.appendChild(heightInput);
      }

      if (edit.type === "shape" && edit.shape === "circle") {
        const radiusInput = document.createElement("input");
        radiusInput.type = "number";
        radiusInput.value = Math.round(edit.radius);
        radiusInput.className = "border text-xs w-16 p-1 mt-1";
        radiusInput.addEventListener("change", () => {
          edit.radius = parseInt(radiusInput.value);
          this.redrawCanvasEdit(edit);
        });
        div.appendChild(radiusInput);
      }

      if (edit.type === "image" || edit.type === "shape") {
        const resizeBtn = document.createElement("button");
        resizeBtn.className = "mt-2 text-xl text-green-500 underline ml-2 cursor-pointer";
        resizeBtn.innerHTML = `<i class="fa-solid fa-expand"></i>`;
        resizeBtn.addEventListener("click", () => {
          this.activateResizeMode(index);
        });
        div.appendChild(resizeBtn);
      }

      const undoBtn = document.createElement("button");
      undoBtn.className = "mt-2 text-xl text-red-600 underline ml-2 cursor-pointer";
      undoBtn.innerHTML = `<i class="fa-solid fa-trash"></i>`;
      undoBtn.addEventListener("click", () => {
        this.undoSpecificEdit(index);
      });
      div.appendChild(undoBtn);

      this.changesContainerTarget.appendChild(div);
    });
  }

  activateResizeMode(editIndex) {
    this.editMode = 'resize';
    this.currentEditIndex = editIndex;
    const edit = this.edits[editIndex];
    this.setStatus(`Resizing ${edit.type} on page ${edit.page}. Click and drag the handle to resize.`, "text-orange-500");

    const canvas = document.getElementById(edit.canvasId);
    if (!canvas) return;

    this.addResizeHandle(canvas, edit);

    if (this.resizeHandle) {
      this.resizeHandle.addEventListener("mousedown", this.startResize.bind(this));
    }
    this.currentCanvasForResize = canvas;
  }

  addResizeHandle(canvas, edit) {
    if (this.resizeHandle && this.resizeHandle.parentNode) {
      this.resizeHandle.parentNode.removeChild(this.resizeHandle);
      this.resizeHandle = null;
    }

    const handle = document.createElement("div");
    handle.className = "absolute bg-blue-500 w-4 h-4 rounded-full border-2 border-white cursor-nwse-resize z-50";
    handle.style.position = "absolute";
    handle.style.background = "blue";
    handle.style.width = "10px";
    handle.style.height = "10px";
    handle.style.borderRadius = "50%";
    handle.style.border = "2px solid white";
    handle.style.cursor = "nwse-resize";
    handle.style.zIndex = "100";

    let handleX, handleY;
    if (edit.type === "image" || edit.shape === "rectangle" || edit.shape === "triangle") {
      handleX = edit.x + edit.width;
      handleY = edit.y + edit.height;
    } else if (edit.shape === "circle") {
      handleX = edit.x + edit.radius;
      handleY = edit.y + edit.radius;
    } else if (edit.type === "text") {
      this.setStatus("Text resizing is done via the font size input.", "text-yellow-500");
      this.editMode = null;
      return;
    }

    const parentWrapper = canvas.parentNode;
    handle.style.left = `${handleX - handle.offsetWidth / 2}px`;
    handle.style.top = `${handleY - handle.offsetHeight / 2}px`;

    parentWrapper.appendChild(handle);
    this.resizeHandle = handle;
  }

  startResize(e) {
    e.preventDefault();
    e.stopPropagation();

    const edit = this.edits[this.currentEditIndex];
    if (!edit || this.editMode !== 'resize') return;

    const canvas = this.currentCanvasForResize;
    const rect = canvas.getBoundingClientRect();
    this.initialMouseX = e.clientX - rect.left;
    this.initialMouseY = e.clientY - rect.top;

    if (edit.type === "image" || edit.shape === "rectangle" || edit.shape === "triangle") {
      this.initialWidth = edit.width;
      this.initialHeight = edit.height;
    } else if (edit.shape === "circle") {
      this.initialRadius = edit.radius;
    }

    this.isResizing = true;
    document.addEventListener("mousemove", this.performResize.bind(this));
    document.addEventListener("mouseup", this.endResize.bind(this), { once: true });
  }

  performResize(e) {
    if (!this.isResizing || this.currentEditIndex === null) return;

    const edit = this.edits[this.currentEditIndex];
    const canvas = this.currentCanvasForResize;
    const rect = canvas.getBoundingClientRect();
    const currentMouseX = e.clientX - rect.left;
    const currentMouseY = e.clientY - rect.top;

    const dx = currentMouseX - this.initialMouseX;
    const dy = currentMouseY - this.initialMouseY;

    if (edit.type === "image" || edit.shape === "rectangle" || edit.shape === "triangle") {
      edit.width = Math.max(10, this.initialWidth + dx);
      edit.height = Math.max(10, this.initialHeight + dy);
    } else if (edit.shape === "circle") {
      edit.radius = Math.max(5, this.initialRadius + Math.max(dx, dy) / 2);
    }

    this.redrawCanvasEdit(edit);
    this.updateResizeHandlePosition(canvas, edit);
  }

  updateResizeHandlePosition(canvas, edit) {
    if (!this.resizeHandle) return;

    let handleX, handleY;
    if (edit.type === "image" || edit.shape === "rectangle" || edit.shape === "triangle") {
      handleX = edit.x + edit.width;
      handleY = edit.y + edit.height;
    } else if (edit.shape === "circle") {
      handleX = edit.x + edit.radius;
      handleY = edit.y + edit.radius;
    }

    const parentWrapper = canvas.parentNode;
    this.resizeHandle.style.left = `${handleX - this.resizeHandle.offsetWidth / 2}px`;
    this.resizeHandle.style.top = `${handleY - this.resizeHandle.offsetHeight / 2}px`;
  }

  endResize() {
    this.isResizing = false;
    this.currentEditIndex = null;
    document.removeEventListener("mousemove", this.performResize.bind(this));

    if (this.resizeHandle && this.resizeHandle.parentNode) {
      this.resizeHandle.parentNode.removeChild(this.resizeHandle);
      this.resizeHandle = null;
    }
    this.currentCanvasForResize = null;
    this.editMode = null;
    this.setStatus("Resize complete.");
    this.renderEditSummary();
  }

  undoSpecificEdit(index) {
    const [removed] = this.edits.splice(index, 1);
    const canvas = document.getElementById(removed.canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const stateStack = this.currentCanvasStates.get(removed.canvasId);
    const img = new Image();

    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      this.reapplyEdits(canvas);
      this.renderEditSummary();
      this.setStatus(`Removed edit on page ${removed.page}`, "text-yellow-500");
    };

    if (stateStack && stateStack.length) {
      img.src = stateStack.pop();
    } else {
      this.setStatus("No saved state to revert to", "text-yellow-500");
    }
  }

  // Save canvas state to stack
  saveCanvasState(canvas) {
    const data = canvas.toDataURL("image/png");
    if (!this.currentCanvasStates.has(canvas.id)) {
      this.currentCanvasStates.set(canvas.id, []);
    }
    this.currentCanvasStates.get(canvas.id).push(data);
  }

  undoLastEdit() {
    if (!this.edits.length) {
      return this.setStatus("No edits to undo", "text-yellow-500");
    }

    const lastEdit = this.edits.pop();
    const canvas = document.getElementById(lastEdit.canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const stateStack = this.currentCanvasStates.get(lastEdit.canvasId);
    const img = new Image();

    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      this.reapplyEdits(canvas);
      this.renderEditSummary();
      this.setStatus(`Undid edit on page ${lastEdit.page}`);
    };

    if (stateStack && stateStack.length) {
      img.src = stateStack.pop();
    } else {
      this.setStatus("No saved state to revert to", "text-yellow-500");
    }
  }

  reapplyEdits(canvas) {
    const ctx = canvas.getContext("2d");
    const canvasId = canvas.id;

    this.edits
      .filter(e => e.canvasId === canvasId)
      .forEach(edit => {
        this.applyEditToCanvas(edit);
      });
  }

  redrawCanvasEdit(edit) {
    const canvas = document.getElementById(edit.canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      this.reapplyEdits(canvas);
      this.setStatus(`Updated edit on page ${edit.page}`, "text-green-500");
    };

    const stateStack = this.currentCanvasStates.get(canvas.id);
    if (stateStack && stateStack.length > 0) {
      img.src = stateStack[stateStack.length - 1];
    }
  }

  saveEdits() {
    this.fullContainerTarget.querySelectorAll("[data-page-number]").forEach(page => {
      const canvas = page.querySelector("canvas");
      this.saveCanvasState(canvas);
    });
    this.setStatus(`Saved ${this.edits.length} edits`, "text-green-500");
  }

  async downloadEditedPDF() {
    try {
      this.setStatus("Preparing PDF for upload...", "text-blue-500");

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF();

      const canvases = [...document.querySelectorAll("canvas[id^='full-']")];

      for (let i = 0; i < canvases.length; i++) {
        const canvas = canvases[i];
        if (!canvas) continue;

        if (i > 0) pdf.addPage();

        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;

        const widthMM = (canvasWidth * 25.4) / 96;
        const heightMM = (canvasHeight * 25.4) / 96;

        pdf.addImage(imgData, 'JPEG', 0, 0, widthMM, heightMM);
      }

      const pdfBlob = pdf.output('blob');

      const formData = new FormData();
      formData.append("file", pdfBlob, "edited-document.pdf");
      formData.append("original_file", this.files[0]);
      const loader = document.getElementById("fullscreen-loader");
      loader.style.display = "flex";

      fetch('/convert_pdf_edit', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
        },
        body: formData
      })
        .then(response => {
          if (!response.ok) throw new Error("pdf convert failed");
          return response.blob();
        })
        .then(converted => {
          const url = URL.createObjectURL(converted);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'edit_pdf.pdf';
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.location.href = '/pdf_edit';
        })
        .catch(error => {
          console.error("pdf convert error:", error);
          alert("An error occurred while converting.");
        })
        .finally(() => {
          loader.style.display = "none";
        });
    } catch (error) {
      console.error("Upload failed:", error);
      this.setStatus(`Upload failed: ${error.message}`, "text-red-500");
    }
  }

  setStatus(msg, cls = "text-blue-500") {
    if (this.hasStatusTarget) {
      this.statusTarget.textContent = msg;
      this.statusTarget.className = cls;
    }
  }
}