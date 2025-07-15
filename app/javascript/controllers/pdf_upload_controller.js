import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    this.files = []
  }

  receiveFiles(files) {
    window._pdfUploadFiles = files;
    // console.log("Files received in second controller:", window._pdfUploadFiles);
  }


  sendrequest() {
    // console.log("sendrequest: controller ID", this.element, this.files);
    this.files = window._pdfUploadFiles || [];
    // console.log("Files send:", files);


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
