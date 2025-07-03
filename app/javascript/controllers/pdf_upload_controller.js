import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["fileInput", "selectButton", "buttonContainer","uploadContainer", "pdfmergeContainer"]

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
    }
  }

next() {
  this.pdfmergeContainerTarget.style.display = 'initial'; // Show the PDF merge container
  this.uploadContainerTarget.style.visibility = 'none';
  this.buttonContainerTarget.style.visibility = 'hidden'; // Hide the button container
  console.log("next button clicked");
  }
}
