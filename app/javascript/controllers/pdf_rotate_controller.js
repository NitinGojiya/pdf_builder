import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="pdf-rotate"
export default class extends Controller {
  static targets = [
    "fileInput", "selectButton", "buttonContainer",
    "uploadContainer", "pdfmergeContainer", "previewContainer"
  ]

  connect() {
    this.files = []
    this.rotations = []
  }

  select() {
    this.fileInputTarget.click()
  }

  receiveFiles(files) {
    // Handle the received files here
    this.files = files
  }

  async filesSelected(event) {
    const newFiles = Array.from(event.target.files)
    const newRotations = newFiles.map(() => 0)
    this.files = [...this.files, ...newFiles]
    this.rotations = [...this.rotations, ...newRotations]
    this.updateButtonText()
    this.fileInputTarget.value = ''
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
      this.filepreview()
    }
  }

  next() {
    this.pdfmergeContainerTarget.style.display = 'block'
    this.uploadContainerTarget.style.display = 'none'
    this.buttonContainerTarget.style.visibility = 'hidden'
    this.filepreview()
  }

  async renderPDFToCanvas(file, canvas, rotation = 0) {
    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 1.5, rotation })

    const context = canvas.getContext("2d")
    canvas.width = viewport.width
    canvas.height = viewport.height

    await page.render({ canvasContext: context, viewport }).promise
  }

  async filepreview() {
    this.previewContainerTarget.innerHTML = ''

    this.files.forEach((file, index) => {
      const previewCard = document.createElement('div')
      previewCard.className = "relative flex flex-col items-center justify-center p-4 bg-green-50 border border-gray-200 rounded-lg shadow-sm cursor-grab mb-2"
      previewCard.dataset.index = index
      previewCard.draggable = true

      const canvas = document.createElement('canvas')
      canvas.className = "w-full mb-3 rounded border border-gray-300 h-[300px] w-[300px]"

      const rotateButtons = `
        <div class="flex gap-4">
          <div><button id="right" class="btn bg-[#4b5c1e] rotate-right text-white"><i class="fa-solid fa-rotate-right" data-index="${index}"></i>Right</button></div>
          <div><button id="left" class="rotate-left btn bg-[#4b5c1e] text-white"><i class="fa-solid fa-rotate-left" data-index="${index}"></i>Left</button></div>
        </div>
      `

      const filename = `<p class="w-[300px] text-sm font-medium text-gray-700 text-center truncate px-2">${file.name}</p>`

      const deleteBtn = `
        <button class="delete-btn absolute top-1 left-1 text-red-500 text-2xl font-bold hover:text-red-700" title="Delete">
          <i class="fa-solid fa-trash"></i>
        </button>`

      previewCard.innerHTML = `
        <div class="absolute top-1 right-1 bg-blue-500 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center font-semibold ring-2 ring-white">${index + 1}</div>
        ${deleteBtn}
        ${filename}
        ${rotateButtons}
      `

      previewCard.insertBefore(canvas, previewCard.querySelector('p'))

      this.previewContainerTarget.appendChild(previewCard)

      this.renderPDFToCanvas(file, canvas, this.rotations[index])

      // Rotation Handlers
      previewCard.querySelector('.rotate-left').addEventListener('click', () => {
        this.rotations[index] = (this.rotations[index] - 90 + 360) % 360
        this.renderPDFToCanvas(file, canvas, this.rotations[index])
        this.getData();
      })

      previewCard.querySelector('.rotate-right').addEventListener('click', () => {
        this.rotations[index] = (this.rotations[index] + 90) % 360
        this.renderPDFToCanvas(file, canvas, this.rotations[index])
        this.getData();
      })

      // Delete
      previewCard.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation()
        this.files.splice(index, 1)
        this.rotations.splice(index, 1)
        this.filepreview()
      })

      // Drag and Drop
      previewCard.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', index.toString())
        previewCard.classList.add('opacity-50')
      })

      previewCard.addEventListener('dragover', (e) => {
        e.preventDefault()
        previewCard.classList.add('ring', 'ring-blue-300')
      })

      previewCard.addEventListener('dragleave', (e) => {
        previewCard.classList.remove('ring', 'ring-blue-300')
      })

      previewCard.addEventListener('drop', (e) => {
        e.preventDefault()
        const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'))
        const targetIndex = index

        if (draggedIndex !== targetIndex) {
          const draggedFile = this.files[draggedIndex]
          const draggedRotation = this.rotations[draggedIndex]

          this.files.splice(draggedIndex, 1)
          this.rotations.splice(draggedIndex, 1)

          this.files.splice(targetIndex, 0, draggedFile)
          this.rotations.splice(targetIndex, 0, draggedRotation)

          this.filepreview()
        }
      })

      previewCard.addEventListener('dragend', (e) => {
        previewCard.classList.remove('opacity-50')
      })
    })
  }

  getData() {
    const result = this.files.map((file, index) => {
      return {
        file: file,
        rotation: this.rotations[index]
      }
    })

    // console.log("Files with Rotation Data:", result)

    // Optionally return the result if used elsewhere
    return result
  }

  sendrequest() {
    // console.log("send request ")
    if (this.files.length === 0) {
      alert("No files selected");
      return;
    }

    const loader = document.getElementById("fullscreen-loader");
    loader.style.display = "flex";


    const formData = new FormData();

    // Append files and rotation degrees
    this.files.forEach((file, index) => {
      formData.append('files[]', file);
      formData.append('rotations[]', this.rotations[index]); // added
    });


    fetch('/convert_pdf_rotate', {
      method: 'POST',
      headers: {
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
      },
      body: formData
    })
      .then(response => {
        if (!response.ok) throw new Error("rotate failed");
        return response.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'rotate.zip';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        window.location.href = '/pdf_rotate';
      })
      .catch(error => {
        console.error("rotate error:", error);
        alert("An error occurred while rotating.");
      })
      .finally(() => {
        loader.style.display = "none";
      });
  }


}
