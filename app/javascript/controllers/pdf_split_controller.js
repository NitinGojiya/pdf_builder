import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="pdf-split"
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
    this.files = newFiles;

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
    // this.filepreview();
  }

async filepreview() {
  this.previewContainerTarget.innerHTML = '';
  this.files = Array.from(this.files);

  const pageEntries = [];

  // Step 1: Extract all page canvases
  for (let fileIndex = 0; fileIndex < this.files.length; fileIndex++) {
    const file = this.files[fileIndex];
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context, viewport }).promise;

      canvas.style.maxWidth = "100%";
      canvas.style.maxHeight = "100%";
      canvas.style.objectFit = "contain";

      pageEntries.push({
        file,
        pageNum,
        canvas,
        filename: file.name
      });
    }
  }

  // Sort by page number (globally)
  pageEntries.sort((a, b) => a.pageNum - b.pageNum);

  // Store for access in other methods
  this.pageEntries = pageEntries;

  // Step 2: Render each preview with checkbox
  pageEntries.forEach((entry, index) => {
    const previewCard = document.createElement('div');
    previewCard.className = "relative h-[200px] w-[200px] flex flex-col items-center justify-center p-2 bg-green-50 border border-gray-200 rounded-lg shadow-sm mb-2";
    previewCard.dataset.index = index;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.className = "absolute top-1 left-1 w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-0";

    checkbox.addEventListener("change", () => {
      previewCard.style.display = checkbox.checked ? "flex" : "none";
      this.logSelectedPages();
    });

    const badge = document.createElement('div');
    badge.className = "absolute top-1 right-1 bg-blue-500 text-white rounded-full w-5 h-5 text-[10px] flex items-center justify-center font-semibold ring-2 ring-white";
    badge.textContent = entry.pageNum;

    const title = document.createElement('p');
    title.className = "w-full text-xs font-medium text-gray-700 text-center truncate px-1";
    title.textContent = `${entry.filename} (Page ${entry.pageNum})`;

    previewCard.appendChild(checkbox);
    previewCard.appendChild(badge);
    previewCard.appendChild(entry.canvas);
    previewCard.appendChild(title);

    this.previewContainerTarget.appendChild(previewCard);

  });




}

 // ✅ Final Step: Log selected page numbers only
logSelectedPages() {
  const selectedPageNumbers = Array.from(this.previewContainerTarget.children)
    .filter(card => card.querySelector('input[type="checkbox"]').checked)
    .map(card => {
      const index = parseInt(card.dataset.index, 10);
      return this.pageEntries[index].pageNum;
    });

  console.log("Selected Page Numbers:", selectedPageNumbers);
}


}
