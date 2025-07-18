import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="html-pdf"
export default class extends Controller {
  static targets = ["modal", "urlInput", "preload", "postload"]

  connect() {}

  openModal() {
    this.modalTarget.showModal()
  }

  submitUrl() {
    const url = this.urlInputTarget.value.trim()
    if (!url) {
      alert("Please enter a valid URL.")
      return
    }

    // Hide preload UI, show loader
    this.preloadTarget.classList.add("hidden")
    const loader = document.getElementById("fullscreen-loader")
    loader.style.display = "flex"

    const formData = new FormData()
    formData.append("url", url)

    fetch('/convert_html_to_pdf', {
      method: 'POST',
      headers: {
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
      },
      body: formData
    })
      .then(response => {
        if (!response.ok) throw new Error("PDF conversion failed")
        return response.blob()
      })
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'html_to_pdf.pdf'
        document.body.appendChild(link)
        link.click()
        link.remove()

        // Optional redirect after download
        window.location.href = '/html_pdf'
      })
      .catch(error => {
        console.error("PDF conversion error:", error)
        alert("An error occurred while converting.")
      })
      .finally(() => {
        loader.style.display = "none"
        this.modalTarget.close()
        this.postloadTarget.classList.remove("hidden")
      })
  }
}
