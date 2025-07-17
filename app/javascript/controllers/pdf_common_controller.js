import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="pdf-common"
export default class extends Controller {
  static targets = ["fileInput", "selectButton", "buttonContainer", "uploadContainer", "pdfmergeContainer", "previewContainer"]

  connect() {
    console.log("controller connect")
    this.files = []
  }

  select() {
    this.fileInputTarget.click();
  }

  filesSelected(event) {
    const newFiles = Array.from(event.target.files);

    // Add to existing file list
    this.files = [...this.files, ...newFiles];

    // Update the button or UI
    this.updateButtonText();

    // Clear file input so it can be reused
    this.fileInputTarget.value = '';
  }
receiveFiles(files) {
  // Handle the received files here
  this.files = files
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
      this.buttonContainerTarget.style.visibility = 'visible'; // Show the button container

      // const fileNames = this.files.map(f => f.name)
      // console.log("file:", this.files);
      // send data other controller

      const controllerName = document.querySelector("#controller").innerHTML; // e.g., "pdf-upload"

      const uploadElement = document.querySelector(`[data-controller~="${controllerName}"]`);
      const uploadController = this.application.getControllerForElementAndIdentifier(uploadElement, controllerName);

      if (uploadController) {
        uploadController.receiveFiles(this.files); // send files
      } else {
        console.error("Upload controller not found");
      }
      // sessionStorage.setItem("selectedFileNames", JSON.stringify(fileNames))
      this.filepreview();
    }
  }

  next() {
    this.pdfmergeContainerTarget.style.display = 'block';
    this.uploadContainerTarget.style.display = 'none';
    this.buttonContainerTarget.style.visibility = 'hidden';
    this.filepreview();
  }

 filepreview() {
  this.previewContainerTarget.innerHTML = '';
  this.files = Array.from(this.files);

  this.files.forEach((file, index) => {
    const blobURL = URL.createObjectURL(file);
    const fileType = file.type;
    const fileExt = file.name.split('.').pop().toLowerCase();

    const previewCard = document.createElement('div');
    previewCard.className = "relative flex flex-col items-center justify-center p-4 bg-green-50 border border-gray-200 rounded-lg shadow-sm cursor-grab mb-2";
    previewCard.draggable = true;
    previewCard.dataset.index = index;

    // Generate preview HTML
    let previewHTML = '';

    if (fileType.startsWith('image/')) {
      // Image preview
      previewHTML = `<img src="${blobURL}" class="w-full h-full object-contain" alt="Image Preview" />`;
    } else if (fileType === 'application/pdf') {
      // PDF preview
      previewHTML = `<iframe src="${blobURL}" class="w-full h-full"></iframe>`;
    } else if (
      fileExt === 'doc' || fileExt === 'docx' ||
      fileExt === 'xls' || fileExt === 'xlsx' ||
      fileExt === 'ppt' || fileExt === 'pptx'
    ) {
      // Office files: show icon + download/view link
      const icon = this.getIconForOfficeFile(fileExt);
      previewHTML = `
        <div class="flex flex-col items-center justify-center space-y-2">
          <i class="${icon} text-4xl text-gray-500"></i>
          <a href="${blobURL}" target="_blank" class="text-blue-600 underline text-sm">Open File</a>
        </div>`;
    } else {
      // Fallback for other files
      previewHTML = `<p class="text-gray-500 text-sm">Preview not available</p>`;
    }

    previewCard.innerHTML = `
      <div class="absolute top-1 right-1 bg-blue-500 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center font-semibold ring-2 ring-white">
        ${index + 1}
      </div>

      <div class="preview-thumbnail w-full p-5 h-40 bg-gray-200 rounded-md mb-3 flex items-center justify-center text-gray-500 overflow-hidden">
        ${previewHTML}
      </div>

      <p class="w-[300px] text-sm font-medium text-gray-700 text-center truncate px-2">${file.name}</p>

      <button class="delete-btn absolute top-1 left-1 text-red-500 text-2xl font-bold hover:text-red-700" title="Delete">
        <i class="fa-solid fa-trash"></i>
      </button>
    `;

    // Delete, drag, and drop handlers remain the same
    previewCard.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.files.splice(index, 1);
      this.filepreview();
    });

    previewCard.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', index.toString());
      e.currentTarget.classList.add('opacity-50');
    });

    previewCard.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.currentTarget.classList.add('ring', 'ring-blue-300');
    });

    previewCard.addEventListener('dragleave', (e) => {
      e.currentTarget.classList.remove('ring', 'ring-blue-300');
    });

    previewCard.addEventListener('drop', (e) => {
      e.preventDefault();
      const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
      const targetIndex = parseInt(e.currentTarget.dataset.index);

      if (draggedIndex !== targetIndex) {
        const draggedFile = this.files[draggedIndex];
        this.files.splice(draggedIndex, 1);
        this.files.splice(targetIndex, 0, draggedFile);
        this.filepreview();
      }
    });

    previewCard.addEventListener('dragend', (e) => {
      e.currentTarget.classList.remove('opacity-50');
    });

    this.previewContainerTarget.appendChild(previewCard);
  });
}
getIconForOfficeFile(extension) {
  switch (extension) {
    case 'doc':
    case 'docx':
      return 'fa-solid fa-file-word text-blue-600';
    case 'xls':
    case 'xlsx':
      return 'fa-solid fa-file-excel text-green-600';
    case 'ppt':
    case 'pptx':
      return 'fa-solid fa-file-powerpoint text-orange-600';
    default:
      return 'fa-solid fa-file';
  }
}


}
