import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="excel-to-pdf"
export default class extends Controller {
  connect() {
    this.files = [] // Store files in memory
  }

  receiveFiles(files) {
    window._pdfUploadFiles = files;
    // console.log("Files received in second controller:", window._pdfUploadFiles);
  }


  sendrequest() {

    this.files = window._pdfUploadFiles || [];
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

    fetch('/convert_excel_to_pdf', {
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
        link.download = 'converted_excel.pdf'; // Name of the downloaded file
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.location.href = '/excel_pdf'; // Redirect to the jpg page
      })
      .catch(error => {
        console.error("pdf convert error:", error);
        alert("An error occurred while converting.");
      })
      .finally(() => {
        loader.style.display = "none"; // Hide loader
      });
  }
}
