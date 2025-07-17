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
  editMode = null // Can be 'text', 'image', 'rectangle', 'circle', 'triangle', 'resize', 'drag'
  isFullscreen = false
  selectedColor = "#000000" // default black
  edits = [] // Stores all edits made to the PDF
  currentCanvasStates = new Map() // Stores base canvas states before edits for undo functionality
  isResizing = false
  currentEditIndex = null // Index of the edit currently being resized
  initialMouseX = 0
  initialMouseY = 0
  initialWidth = 0
  initialHeight = 0
  initialRadius = 0
  resizeHandle = null
  currentCanvasForResize = null // Reference to the canvas element being resized

  // Drag functionality variables
  isDragging = false
  draggedEditIndex = null // Index of the edit currently being dragged
  draggedEditInitialX = 0 // Initial X position of the dragged edit
  draggedEditInitialY = 0 // Initial Y position of the dragged edit

  async connect() {
    this.files = []
    if (this.editableValue) {
      this.setupEditorControls()
    }
    await this.loadPDF()
  }

  // Handles file selection via the hidden input
  select() {
    this.fileInputTarget.click();
  }
  receiveFiles(files) {
    // Handle the received files here
    this.files = files
  }
  // Processes selected files and loads the first PDF
  filesSelected(event) {
    const newFiles = Array.from(event.target.files);
    this.files = [...this.files, ...newFiles];
    this.updateButtonText();
    this.fileInputTarget.value = ''; // Clear input to allow selecting same file again

    if (this.files.length > 0) {
      const file = this.files[0];
      const reader = new FileReader();

      reader.onload = async (e) => {
        const arrayBuffer = e.target.result;
        this.pdfData = new Uint8Array(arrayBuffer); // Store PDF data as Uint8Array
        console.log("PDF data loaded into Uint8Array");
        await this.loadPDF(); // Reload PDF with new data
      };

      reader.onerror = (e) => {
        console.error("FileReader error:", e);
        this.setStatus(`Error reading file: ${e.message}`, "text-red-500");
      };

      reader.readAsArrayBuffer(file);
    }
  }

  // Updates the text content of the file selection button
  updateButtonText() {
    if (this.files.length === 0) {
      this.selectButtonTarget.textContent = "Select PDF files";
    } else {
      const names = this.files.map(f => f.name);
      const display = names.length > 2
        ? `${names.slice(0, 2).join(', ')} +${names.length - 2} more`
        : names.join(', ');
      this.selectButtonTarget.textContent = display;
      this.buttonContainerTarget.style.visibility = 'visible'; // Make button container visible
    }
  }

  // Transitions from pre-upload state to post-upload editor state
  next() {
    this.preuploadTarget.classList.add("hidden");
    document.getElementById("postupload").classList.remove("hidden");
    document.getElementById("edit-icon").classList.remove("hidden")
  }

  // Loads the PDF document either from URL or Uint8Array data
  async loadPDF() {
    try {
      this.setStatus("Loading PDF...")

      let loadingTask;
      if (this.pdfData) {
        loadingTask = pdfjsLib.getDocument({ data: this.pdfData });
        console.log("Loading PDF from Uint8Array data");
      } else if (this.urlValue) {
        loadingTask = pdfjsLib.getDocument({ url: this.urlValue });
        console.log("Loading PDF from URL:", this.urlValue);
      } else {
        this.setStatus("No PDF source found.", "text-red-500");
        return;
      }

      const pdf = await loadingTask.promise;

      this.setStatus(`Loaded PDF with ${pdf.numPages} pages`)

      this.fullContainerTarget.innerHTML = "" // Clear previous PDF pages

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        await this.renderPage(pdf, pageNumber)
      }

      this.setStatus("PDF rendering complete")
    } catch (error) {
      this.setStatus(`Error: ${error.message}`, "text-red-500")
      console.error("Error loading PDF:", error);
    }
  }

  // Renders a single page of the PDF
  async renderPage(pdf, pageNumber) {
    const page = await pdf.getPage(pageNumber)
    this.currentPage = page

    const fullWrapper = document.createElement("div")
    fullWrapper.className = "relative" // Needed for absolute positioning of edits/handles
    fullWrapper.dataset.pageNumber = pageNumber

    await this.renderPageToTarget(page, this.fullScaleValue, fullWrapper, `full-${pageNumber}`)

    this.fullContainerTarget.appendChild(fullWrapper)

    if (this.editableValue) this.setupPageInteractions(fullWrapper)
  }

  // Helper to render a PDF page onto a canvas within a target element
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

  // Injects editor controls HTML into the document
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

  // Updates the currently selected color
  updateSelectedColor(event) {
    this.selectedColor = event.target.value;
    this.setStatus(`Color selected: ${this.selectedColor}`);
  }

  // Sets up interactions for each PDF page canvas
  setupPageInteractions(wrapper) {
    const canvas = wrapper.querySelector("canvas")
    // Add click listener for adding new elements
    canvas.addEventListener("click", e => {
      // If a specific edit mode is active, add the element
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
        this.editMode = null; // Reset edit mode after adding
      }
    })

    // Add mousedown listener for dragging existing elements
    canvas.addEventListener("mousedown", this.startInteraction.bind(this));
  }

  // Handles the start of a mouse interaction (click for new element or mousedown for drag/resize)
  startInteraction(e) {
    // Only proceed if not already resizing or dragging, and if the left mouse button is pressed
    if (this.isResizing || this.isDragging || e.button !== 0) return;

    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Check if an existing edit is clicked for dragging
    // Iterate in reverse to prioritize elements drawn later (on top)
    for (let i = this.edits.length - 1; i >= 0; i--) {
      const edit = this.edits[i];
      if (edit.canvasId === canvas.id) { // Only check edits on the current canvas
        if (this.isPointInEdit(mouseX, mouseY, edit, canvas.getContext("2d"))) {
          // Found an edit to drag
          this.isDragging = true;
          this.draggedEditIndex = i;
          this.draggedEditInitialX = edit.x;
          this.draggedEditInitialY = edit.y;
          this.initialMouseX = mouseX;
          this.initialMouseY = mouseY;

          // Add global listeners for mouse move and up
          document.addEventListener("mousemove", this.performDrag.bind(this));
          document.addEventListener("mouseup", this.endDrag.bind(this), { once: true });
          e.preventDefault(); // Prevent default browser drag behavior
          e.stopPropagation(); // Stop event from bubbling up to canvas click listener
          this.setStatus(`Dragging ${edit.type} on page ${edit.page}.`);
          return; // Stop after finding the first draggable edit
        }
      }
    }
  }

  // Helper to check if a point is within an edit's bounds
  isPointInEdit(x, y, edit, ctx) {
    switch (edit.type) {
      case "text":
        // For text, we need to approximate its bounding box.
        // This is a rough estimate; for precise text bounds, measureText is needed.
        // Assuming a default font size if not present in edit.
        const fontSize = parseInt(edit.font || "16px Arial");
        const textWidth = ctx.measureText(edit.content).width; // Requires context
        const textHeight = fontSize; // Approximate height of text

        return x >= edit.x && x <= edit.x + textWidth &&
          y >= edit.y - textHeight && y <= edit.y; // Text y is baseline

      case "image":
      case "shape":
        if (edit.shape === "rectangle" || edit.shape === "triangle") {
          return x >= edit.x && x <= edit.x + edit.width &&
            y >= edit.y && y <= edit.y + edit.height;
        } else if (edit.shape === "circle") {
          const dx = x - edit.x; // x is center of circle
          const dy = y - edit.y; // y is center of circle
          return (dx * dx + dy * dy) <= (edit.radius * edit.radius);
        }
        break;
    }
    return false;
  }

  // Handles mouse move during a drag operation
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

    this.redrawCanvasEdit(edit); // Redraw the canvas with the moved edit
  }

  // Handles mouse up, ending the drag operation
  endDrag() {
    this.isDragging = false;
    this.draggedEditIndex = null;
    document.removeEventListener("mousemove", this.performDrag.bind(this));
    document.removeEventListener("mouseup", this.endDrag.bind(this));
    this.setStatus("Drag complete.");
    this.renderEditSummary(); // Update summary with new coordinates
  }

  // Toggles fullscreen mode for the editor
  toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen
    if (this.isFullscreen) {
      document.documentElement.requestFullscreen()
      // Note: editorTarget is not defined in the provided HTML. Assuming it's a typo
      // and should apply to a container that holds the PDF viewer.
      // For now, this will not have an effect unless editorTarget is added.
      // this.editorTarget.classList.add("fixed", "inset-0", "bg-white", "z-40")
    } else {
      document.exitFullscreen()
      // this.editorTarget.classList.remove("fixed", "inset-0", "bg-white", "z-40")
    }
  }

  // Sets the edit mode to 'text'
  setTextMode() {
    this.editMode = 'text'
    this.setStatus("Click to add text")
  }

  // Sets the edit mode to 'image'
  setImageMode() {
    this.editMode = 'image'
    this.setStatus("Click to add image")
  }

  // Sets the edit mode to 'rectangle'
  setRectangleMode() {
    this.editMode = 'rectangle'
    this.setStatus("Click on canvas to add rectangle")
  }

  // Sets the edit mode to 'circle'
  setCircleMode() {
    this.editMode = 'circle'
    this.setStatus("Click on canvas to add circle")
  }

  // Sets the edit mode to 'triangle'
  setTriangleMode() {
    this.editMode = 'triangle'
    this.setStatus("Click on canvas to add triangle")
  }

  // Adds a text element to the canvas
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

      const ctx = canvas.getContext("2d")
      ctx.font = "16px Arial" // Default font size
      ctx.fillStyle = this.selectedColor;
      ctx.fillText(text, x, y)
      dialog.close()

      this.recordEdit({
        type: "text",
        page: canvas.closest("[data-page-number]").dataset.pageNumber,
        content: text,
        x,
        y,
        font: ctx.font,
        color: ctx.fillStyle,
        canvasId: canvas.id
      })
      dialog.removeEventListener("close", submit)
      this.textTarget.value = ''; // Clear text input after adding
    }
    dialog.addEventListener("close", submit)
  }

  // Adds an image element to the canvas
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
          ctx.drawImage(img, x, y, 100, 100) // Default size for image
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
        img.src = event.target.result
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  // Adds a rectangle shape to the canvas
  addRectangle(canvas, x, y) {
    const ctx = canvas.getContext("2d")
    ctx.fillStyle = this.selectedColor;
    ctx.fillRect(x, y, 50, 50) // Default size for rectangle

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

  // Adds a circle shape to the canvas
  addCircle(canvas, x, y) {
    const ctx = canvas.getContext("2d")
    ctx.fillStyle = this.selectedColor;
    ctx.beginPath()
    ctx.arc(x, y, 25, 0, Math.PI * 2) // Default radius for circle
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

  // Adds a triangle shape to the canvas
  addTriangle(canvas, x, y) {
    const ctx = canvas.getContext("2d")
    ctx.fillStyle = this.selectedColor;
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 50, y)
    ctx.lineTo(x + 25, y - 50) // Default size for triangle
    ctx.closePath()
    ctx.fill()

    this.recordEdit({
      type: "shape",
      shape: "triangle",
      page: canvas.closest("[data-page-number]").dataset.pageNumber,
      x,
      y,
      width: 50, // Storing width and height for consistency with other shapes
      height: 50,
      color: ctx.fillStyle,
      canvasId: canvas.id
    })
  }

  // Records an edit and saves the canvas state before the edit is applied
  recordEdit(edit) {
    // Save the current canvas state BEFORE applying the new edit
    if (!this.currentCanvasStates.has(edit.canvasId)) {
      const canvas = document.getElementById(edit.canvasId);
      this.saveCanvasState(canvas);
    }
    this.edits.push(edit);
    this.setStatus(`Edit added on page ${edit.page}`);
    this.renderEditSummary();
  }

  // Renders a summary of all current edits in the changesContainer
  renderEditSummary() {
    if (!this.hasChangesContainerTarget) return;

    this.changesContainerTarget.innerHTML = ""; // Clear previous summary

    this.edits.forEach((edit, index) => {
      const div = document.createElement("div");
      div.className = "bg-white shadow p-2 mb-2 rounded text-sm  flex items-center justify-start gap-1";
      div.dataset.editIndex = index;

      const label = document.createElement("p");
      label.className = "font-semibold";
      label.innerHTML = `<i class="fa-solid fa-pen-fancy mr-1"></i> ${index + 1}: ${edit.type} on Page ${edit.page}`;
      div.appendChild(label);


      // Display and allow editing of text content and font size
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

      // Display and allow editing of width/height for images and rectangles/triangles
      if (edit.type === "image" || (edit.type === "shape" && (edit.shape === "rectangle" || edit.shape === "triangle"))) {
        // const sizeLabel = document.createElement("p");
        // sizeLabel.textContent = `Position: (${Math.round(edit.x)}, ${Math.round(edit.y)}) Size: ${Math.round(edit.width)}x${Math.round(edit.height)}`;
        // div.appendChild(sizeLabel);

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

      // Display and allow editing of radius for circles
      if (edit.type === "shape" && edit.shape === "circle") {
        // const posLabel = document.createElement("p");
        // posLabel.textContent = `Position: (${Math.round(edit.x)}, ${Math.round(edit.y)})`;
        // div.appendChild(posLabel);

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

      // Add a resize button for images and shapes
      if (edit.type === "image" || edit.type === "shape") {
        const resizeBtn = document.createElement("button");
        resizeBtn.className = "mt-2 text-xl text-green-500 underline ml-2 cursor-pointer";
        resizeBtn.innerHTML = `<i class="fa-solid fa-expand"></i>`;
        resizeBtn.addEventListener("click", () => {
          this.activateResizeMode(index);
        });
        div.appendChild(resizeBtn);
      }

      // Add an undo button for specific edits
      const undoBtn = document.createElement("button");
      undoBtn.className = "mt-2 text-xl text-red-600 underline ml-2 cursor-pointer";
      undoBtn.innerHTML = `<i class="fa-solid fa-trash"></i>`; // Changed from "Undo this" to "Remove" for clarity
      undoBtn.addEventListener("click", () => {
        this.undoSpecificEdit(index);
      });
      div.appendChild(undoBtn);

      this.changesContainerTarget.appendChild(div);
    });
  }

  // Activates resize mode for a specific edit
  activateResizeMode(editIndex) {
    this.editMode = 'resize';
    this.currentEditIndex = editIndex;
    const edit = this.edits[editIndex];
    this.setStatus(`Resizing ${edit.type} on page ${edit.page}. Click and drag the handle to resize.`, "text-orange-500");

    const canvas = document.getElementById(edit.canvasId);
    if (!canvas) return;

    // Create a visual resize handle on the canvas
    this.addResizeHandle(canvas, edit);

    // Add event listeners for mouse down, move, and up to the handle
    if (this.resizeHandle) {
      this.resizeHandle.addEventListener("mousedown", this.startResize.bind(this));
    }
    this.currentCanvasForResize = canvas;
  }

  // Adds a visual resize handle to the canvas for the given edit
  addResizeHandle(canvas, edit) {
    // Remove any existing handle first
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

    // Position the handle at the bottom-right of the edit's bounding box
    let handleX, handleY;
    if (edit.type === "image" || edit.shape === "rectangle" || edit.shape === "triangle") {
      handleX = edit.x + edit.width;
      handleY = edit.y + edit.height;
    } else if (edit.shape === "circle") {
      // For circle, position at the bottom right of its bounding box
      handleX = edit.x + edit.radius;
      handleY = edit.y + edit.radius;
    } else if (edit.type === "text") {
      // For text, resizing is typically done by changing font size, not dragging a handle.
      // If a handle is desired, it would need to be positioned relative to text bounds.
      // For now, we'll prevent handle for text.
      this.setStatus("Text resizing is done via the font size input.", "text-yellow-500");
      this.editMode = null;
      return;
    }

    // Adjust handle position to be relative to the canvas's parent (wrapper)
    // and offset by half its size to center the handle on the corner.
    const parentWrapper = canvas.parentNode;
    handle.style.left = `${handleX - handle.offsetWidth / 2}px`;
    handle.style.top = `${handleY - handle.offsetHeight / 2}px`;

    parentWrapper.appendChild(handle); // Append to the page wrapper, not the canvas directly
    this.resizeHandle = handle;
  }

  // Starts the resize operation when the resize handle is moused down
  startResize(e) {
    e.preventDefault(); // Prevent default drag behavior
    e.stopPropagation(); // Stop propagation to prevent canvas click/drag listener from firing

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

  // Performs the resize operation as the mouse moves
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
      // For circle, resize based on the larger of dx or dy, or Euclidean distance
      edit.radius = Math.max(5, this.initialRadius + Math.max(dx, dy) / 2);
    }

    this.redrawCanvasEdit(edit);
    // Update handle position during resize
    this.updateResizeHandlePosition(canvas, edit);
  }

  // Updates the position of the resize handle
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

  // Ends the resize operation
  endResize() {
    this.isResizing = false;
    this.currentEditIndex = null;
    document.removeEventListener("mousemove", this.performResize.bind(this));
    document.removeEventListener("mouseup", this.endResize.bind(this));

    if (this.resizeHandle && this.resizeHandle.parentNode) {
      this.resizeHandle.parentNode.removeChild(this.resizeHandle);
      this.resizeHandle = null;
    }
    this.currentCanvasForResize = null;
    this.editMode = null; // Reset edit mode
    this.setStatus("Resize complete.");
    this.renderEditSummary();
  }

  // Undoes a specific edit by its index
  undoSpecificEdit(index) {
    const [removed] = this.edits.splice(index, 1); // Remove the edit
    const canvas = document.getElementById(removed.canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas
      ctx.drawImage(img, 0, 0); // Redraw base PDF content
      this.reapplyEdits(canvas); // Reapply remaining edits
      this.renderEditSummary(); // Update summary
      this.setStatus(`Removed edit on page ${removed.page}`, "text-yellow-500");
    };
    // Load the original canvas state for this page
    img.src = this.currentCanvasStates.get(removed.canvasId);
  }

  // Saves the current state of a canvas as a data URL
  saveCanvasState(canvas) {
    const data = canvas.toDataURL("image/png")
    this.currentCanvasStates.set(canvas.id, data)
  }

  // Undoes the last edit performed
  undoLastEdit() {
    if (!this.edits.length) return this.setStatus("No edits to undo", "text-yellow-500")
    const last = this.edits.pop() // Remove the last edit
    const canvas = document.getElementById(last.canvasId)
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    const img = new Image()
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height) // Clear canvas
      ctx.drawImage(img, 0, 0) // Redraw base PDF content
      this.reapplyEdits(canvas) // Reapply remaining edits
      this.renderEditSummary(); // Update summary
    }
    // Load the original canvas state for this page
    img.src = this.currentCanvasStates.get(last.canvasId)
    this.setStatus(`Undid edit on page ${last.page}`)
  }

  // Reapplies all edits relevant to a given canvas
  reapplyEdits(canvas) {
    const ctx = canvas.getContext("2d")
    const canvasId = canvas.id

    this.edits
      .filter(e => e.canvasId === canvasId) // Filter edits for the current canvas
      .forEach(edit => {
        ctx.fillStyle = edit.color || "#000000"; // Ensure a default color

        if (edit.type === "text") {
          ctx.font = edit.font || "16px Arial";
          ctx.fillText(edit.content, edit.x, edit.y);

        } else if (edit.type === "image") {
          const img = new Image();
          img.src = edit.imageData;
          img.onload = () => {
            ctx.drawImage(img, edit.x, edit.y, edit.width, edit.height);
          };
          // If image is not yet loaded, it will be drawn once onload fires.
          // For immediate redraw, consider using a placeholder or ensuring image is cached.
          if (img.complete) { // Draw immediately if already loaded
            ctx.drawImage(img, edit.x, edit.y, edit.width, edit.height);
          }


        } else if (edit.type === "shape") {
          switch (edit.shape) {
            case "rectangle":
              ctx.fillRect(edit.x, edit.y, edit.width, edit.height);
              break;

            case "circle":
              ctx.beginPath();
              ctx.arc(edit.x, edit.y, edit.radius, 0, 2 * Math.PI);
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
        }
      })
  }

  // Redraws a specific canvas after an edit has been modified (e.g., resized, moved)
  redrawCanvasEdit(edit) {
    const canvas = document.getElementById(edit.canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas
      ctx.drawImage(img, 0, 0); // Redraw the base PDF content

      this.reapplyEdits(canvas); // Reapply all edits for this canvas

      this.setStatus(`Updated edit on page ${edit.page}`, "text-green-500");
    };
    img.src = this.currentCanvasStates.get(canvas.id); // Load the original state to redraw upon
  }

  // Saves all current edits (by re-saving the canvas states)
  saveEdits() {
    this.fullContainerTarget.querySelectorAll("[data-page-number]").forEach(page => {
      const canvas = page.querySelector("canvas")
      this.saveCanvasState(canvas)
    })
    this.setStatus(`Saved ${this.edits.length} edits`, "text-green-500")
  }

  async downloadEditedPDF() {
    try {
      this.setStatus("Preparing PDF for upload...", "text-blue-500");

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF();

      // Get all edited full-size canvases
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

      // Generate PDF as Blob
      const pdfBlob = pdf.output('blob');

      // Send to server (adjust endpoint and headers as needed)
      const formData = new FormData();
      formData.append("file", pdfBlob, "edited-document.pdf");
      formData.append("original_file", this.files[0])
      const loader = document.getElementById("fullscreen-loader");
      loader.style.display = "flex"; // Show loader


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
          link.download = 'edit_pdf.pdf'; // Name of the downloaded file
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.location.href = '/pdf_edit'; // Redirect to the jpg page
        })
        .catch(error => {
          console.error("pdf convert error:", error);
          alert("An error occurred while converting.");
        })
        .finally(() => {
          loader.style.display = "none"; // Hide loader
        });
    } catch (error) {
      console.error("Upload failed:", error);
      this.setStatus(`Upload failed: ${error.message}`, "text-red-500");
    }
  }


  // Sets the status message displayed to the user
  setStatus(msg, cls = "text-blue-500") {
    if (this.hasStatusTarget) {
      this.statusTarget.textContent = msg
      this.statusTarget.className = cls
    }
  }
}
