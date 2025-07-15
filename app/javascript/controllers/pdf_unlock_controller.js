import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="pdf-unlock"
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
    console.log(document.getElementById("pdfsecuritypassword").value)
    if (this.files.length === 0) {
      alert("No files selected");
      return;
    }

    const loader = document.getElementById("fullscreen-loader");
    loader.style.display = "flex"; // Show loader

    const formData = new FormData();
    this.files.forEach((file) => {
      formData.append('files[]', file);
    });
    const password = document.getElementById("pdfsecuritypassword").value;
    formData.append('password', password);

    fetch('/convert_pdf_unlock', {
      method: 'POST',
      headers: {
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
      },
      body: formData
    })
      .then(response => {
        if (!response.ok) {
          // Try to parse the JSON error message
          return response.json().then(err => {
            throw new Error(err.error || "PDF conversion failed.");
          });
        }
        return response.blob();
      })
      .then(converted => {
        const url = URL.createObjectURL(converted);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'unlock.pdf';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.location.href = "pdf_unlock"
      })
      .catch(error => {
        console.error("PDF convert error:", error);
        alert("Error: " + error.message);
      })
      .finally(() => {
        loader.style.display = "none"; // Hide loader
      });
  }

}
