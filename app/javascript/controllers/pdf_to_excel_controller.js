import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="pdf-to-excel"
export default class extends Controller {
 connect() {
    this.files = []
  }

  receiveFiles(files) {
    window._pdfUploadFiles = files;
    // console.log("Files received in second controller:", window._pdfUploadFiles);
  }
sendrequest() {
  this.files = window._pdfUploadFiles || [];
  console.log("Files to send:")

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

  fetch('/convert_pdf_to_excel', {
    method: 'POST',
    headers: {
      'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
    },
    body: formData
  })
    .then(response => {
      if (!response.ok) throw new Error("Excel convert failed");
      return response.blob();
    })
    .then(converted => {
      const url = URL.createObjectURL(converted);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'converted.zip';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.location.href = '/pdf_excel'; // Redirect to the PDF to Excel page
    })
    .catch(error => {
      console.error("Excel convert error:", error);
      alert("An error occurred while converting.");
    })
    .finally(() => {
      loader.style.display = "none"; // Hide loader
    });
}
}
