import { Controller } from "@hotwired/stimulus"
let globalFiles = [];
// Connects to data-controller="pdf-watermark"
export default class extends Controller {

  static targets = [
    "fileInput",
    "selectButton",
    "buttonContainer",
    "uploadContainer",
    "pdfmergeContainer",
    "previewContainer"
  ]


  connect() {

    this.files = [];
    this.position = "bottom-right";
    this.text = "Watermark";
    this.fontFamily = "Arial";
    this.fontSize = "12";
    this.bold = false;
    this.italic = false;
    this.underline = false;
    this.color = "#000000";

    document.querySelectorAll('#position-options button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#position-options button').forEach(b => {
          b.classList.remove('bg-[#4b5c1e]');
          const d = b.querySelector('.dot');
          if (d) d.remove();
        });

        btn.classList.add('bg-[#4b5c1e]');
        const dot = document.createElement('div');
        dot.className = 'dot w-4 h-4 bg-[#4b5c1e] rounded-full absolute bottom-1 right-1';
        btn.appendChild(dot);

        this.position = btn.dataset.position;
        this.updateDotPositions();
      });
    });

    ["boldBtn", "italicBtn", "underlineBtn"].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener("click", () => {
          btn.classList.toggle("bg-gray-300"); // Use this to mark as selected
        });
      }
    });

  }

  updateText(event) {
    this.text = event.target.value;
  }

  updateFont(event) {
    this.fontFamily = event.target.value;
  }

  updateFontSize(event) {
    this.fontSize = event.target.value;
  }

  toggleBold() {
    this.bold = !this.bold;
  }

  toggleItalic() {
    this.italic = !this.italic;
  }

  toggleUnderline() {
    this.underline = !this.underline;
  }

  updateColor(event) {
    this.color = event.target.value;
  }

  select() {
    this.fileInputTarget.click();
  }

  receiveFiles(files) {
    this.files = files;
    globalFiles = files;
  }

  filesSelected(event) {
    const newFiles = Array.from(event.target.files);
    this.files = newFiles;
    globalFiles = newFiles;
    this.updateButtonText();
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
      this.buttonContainerTarget.style.visibility = 'visible';
      const fileNames = this.files.map(f => f.name);
      sessionStorage.setItem("selectedFileNames", JSON.stringify(fileNames));
      this.filepreview();
    }
  }

  next() {
    this.pdfmergeContainerTarget.style.display = 'block';
    this.uploadContainerTarget.style.display = 'none';
    this.buttonContainerTarget.style.visibility = 'hidden';
  }

  getPositionClass(position) {
    switch (position) {
      case "top-left": return "top-4 left-4";
      case "top-center": return "top-4 left-1/2 transform -translate-x-1/2";
      case "top-right": return "top-4 right-4";
      case "middle-left": return "top-1/2 left-4 transform -translate-y-1/2";
      case "center": return "top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2";
      case "middle-right": return "top-1/2 right-4 transform -translate-y-1/2";
      case "bottom-left": return "bottom-4 left-4";
      case "bottom-center": return "bottom-4 left-1/2 transform -translate-x-1/2";
      case "bottom-right": return "bottom-4 right-4";
      default: return "bottom-4 right-4";
    }
  }

  updateDotPositions() {
    if (!this.hasPreviewContainerTarget) return;

    const cards = this.previewContainerTarget.querySelectorAll(".preview-card");

    cards.forEach(card => {
      const dot = card.querySelector(".red-dot");
      dot.className = `red-dot absolute w-3 h-3 bg-[#4b5c1e] rounded-full ${this.getPositionClass(this.position)}`;
    });
  }

  async filepreview() {
    const loader = document.getElementById("fullscreen-loader");
    loader.style.display = "flex";

    this.previewContainerTarget.innerHTML = '';
    this.files = Array.from(this.files);
    const pageEntries = [];

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

    this.pageEntries = pageEntries;

    pageEntries.forEach((entry) => {
      const previewCard = document.createElement('div');
      previewCard.className = "preview-card relative h-[200px] w-[200px] flex flex-col items-center justify-center p-2 bg-green-50 border border-gray-200 rounded-lg shadow-sm mb-2";

      const dot = document.createElement('div');
      dot.className = `red-dot absolute w-3 h-3 bg-[#4b5c1e] rounded-full ${this.getPositionClass(this.position)}`;
      previewCard.appendChild(dot);

      const badge = document.createElement('div');
      badge.className = "absolute top-1 right-1 bg-blue-500 text-white rounded-full w-5 h-5 text-[10px] flex items-center justify-center font-semibold ring-2 ring-white";
      badge.textContent = entry.pageNum;

      const title = document.createElement('p');
      title.className = "w-full text-xs font-medium text-gray-700 text-center truncate px-1";
      title.textContent = `${entry.filename} (Page ${entry.pageNum})`;

      previewCard.appendChild(badge);
      previewCard.appendChild(entry.canvas);
      previewCard.appendChild(title);

      this.previewContainerTarget.appendChild(previewCard);
    });

    loader.style.display = "none";
  }

  sendrequest() {
    this.files = globalFiles;
    if (this.files.length === 0) {
      alert("No files selected");
      return;
    }
    console.log("Files in sendrequest:", this.files);


    const loader = document.getElementById("fullscreen-loader");
    loader.style.display = "flex";

    const formData = new FormData();

    // Append PDF files
    this.files.forEach(file => {
      formData.append('files[]', file);
    });

    // Watermark text and formatting values
    const text = document.getElementById("watermarkText")?.value || "";
    const font = document.getElementById("fontFamily")?.value || "Arial";
    const fontSize = document.getElementById("fontSize")?.value || "12";
    const color = document.getElementById("textColor")?.value || "#000000";

    // Format styles
    const bold = document.getElementById("boldBtn")?.classList.contains("bg-gray-300") ? "true" : "false";
    const italic = document.getElementById("italicBtn")?.classList.contains("bg-gray-300") ? "true" : "false";
    const underline = document.getElementById("underlineBtn")?.classList.contains("bg-gray-300") ? "true" : "false";

    // Dot position
    const position = this.position || "bottom-right";

    // Append to formData
    formData.append("text", text);
    formData.append("font", font);
    formData.append("fontSize", fontSize);
    formData.append("color", color);
    formData.append("bold", bold);
    formData.append("italic", italic);
    formData.append("underline", underline);
    formData.append("position", position);

    fetch('/convert_pdf_watermark', {
      method: 'POST',
      headers: {
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
      },
      body: formData
    })
      .then(response => {
        if (!response.ok) throw new Error("Watermark request failed");
        return response.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'watermarked.pdf';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        window.location.href = '/pdf_watermark';
      })
      .catch(error => {
        console.error("Watermark error:", error);
        alert("An error occurred while processing the watermark.");
      })
      .finally(() => {
        loader.style.display = "none";
      });
  }

}
