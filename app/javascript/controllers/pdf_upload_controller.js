import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["fileInput", "selectButton", "buttonContainer","uploadContainer", "pdfmergeContainer","previewContainer"]

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

  filepreview(){
    this.previewContainerTarget.innerHTML = '';

  this.files.forEach(file => {
    const blobURL = URL.createObjectURL(file);

    const previewCard = document.createElement('div');
    previewCard.className = "flex flex-col items-center justify-center p-4 bg-green-50 border border-gray-200 rounded-lg shadow-sm  cursor-pointer mb-2";

    previewCard.innerHTML = `
      <div class="preview-thumbnail w-[300px] p-5 h-40 bg-gray-200 rounded-md mb-3 flex items-center justify-center text-gray-500 overflow-hidden">
        <span class="text-sm text-gray-500">Click to preview PDF</span>
      </div>
      <p class="w-[300px] text-sm font-medium text-gray-700 text-center truncate px-2">${file.name}</p>
    `;

    // Add click behavior to show the PDF preview
    previewCard.querySelector('.preview-thumbnail').addEventListener('click', function () {
      this.innerHTML = `
        <img src="${blobURL}" type="application/pdf" class="w-full h-full object-cover" />
      `;
    });

    this.previewContainerTarget.appendChild(previewCard);
  });
  }
}
