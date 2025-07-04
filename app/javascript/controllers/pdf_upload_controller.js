import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["fileInput", "selectButton", "buttonContainer", "uploadContainer", "pdfmergeContainer", "previewContainer"]

  connect() {
    this.files = [] // Store files in memory
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
      // Store file names only (you can't store full file objects in sessionStorage)
      const fileNames = this.files.map(f => f.name)
      console.log("file:", this.files);
      sessionStorage.setItem("selectedFileNames", JSON.stringify(fileNames))
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

  // Make sure files is a mutable array
  this.files = Array.from(this.files);

  this.files.forEach((file, index) => {
    const blobURL = URL.createObjectURL(file);

    const previewCard = document.createElement('div');
    previewCard.className = "relative flex flex-col items-center justify-center p-4 bg-green-50 border border-gray-200 rounded-lg shadow-sm cursor-pointer mb-2";
    previewCard.draggable = true;
    previewCard.dataset.index = index;

    previewCard.innerHTML = `
      <!-- Number Badge -->
      <div class="absolute top-1 right-1 bg-blue-500 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center font-semibold ring-2 ring-white">
        ${index + 1}
      </div>

      <!-- Thumbnail -->
      <div class="preview-thumbnail w-full p-5 h-40 bg-gray-200 rounded-md mb-3 flex items-center justify-center text-gray-500 overflow-hidden">
        <span class="text-sm text-gray-500">Click to preview PDF</span>
      </div>

      <!-- Filename -->
      <p class="w-[300px] text-sm font-medium text-gray-700 text-center truncate px-2">${file.name}</p>

      <!-- Delete Button -->
      <button class="delete-btn absolute top-1 left-1 text-red-500 text-xl font-bold hover:text-red-700" title="Delete">
        <i class="fa-solid fa-trash"></i>
      </button>
    `;

    // Click to preview PDF
    previewCard.querySelector('.preview-thumbnail').addEventListener('click', function () {
      this.innerHTML = `<iframe src="${blobURL}" class="w-full h-full"></iframe>`;
    });

    // Delete handler
    previewCard.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.files.splice(index, 1);
      this.filepreview();
    });

    // Drag and Drop Handlers
    previewCard.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', index.toString());
      e.currentTarget.classList.add('opacity-50');
    });

    previewCard.addEventListener('dragover', (e) => {
      e.preventDefault(); // Allow drop
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
        // Swap positions
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




 merge() {
  if (this.files.length === 0) {
    alert("No files selected");
    return;
  }

  const loader = document.getElementById("fullscreen-loader");
  loader.style.display = "flex"; // Show loader

  const formData = new FormData();
  this.files.forEach((file, index) => {
    formData.append('files[]', file); // Rails accepts array inputs with this syntax
  });

  fetch('/combine_pdfs', {
    method: 'POST',
    headers: {
      'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
    },
    body: formData
  })
    .then(response => {
      if (!response.ok) throw new Error("Merge failed");
      return response.blob();
    })
    .then(mergedPdf => {
      const url = URL.createObjectURL(mergedPdf);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'pdfBuilder_merged.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.location.href = '/pdf_merge';
    })
    .catch(error => {
      console.error("Merge error:", error);
      alert("An error occurred while merging.");
    })
    .finally(() => {
      loader.style.display = "none"; // Hide loader
    });
}


}
