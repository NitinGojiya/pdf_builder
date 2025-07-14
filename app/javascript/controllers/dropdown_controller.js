import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="dropdown"
export default class extends Controller {
  static targets = ["details"]
  connect() {
    this.timeout = null

    this.element.addEventListener("mouseenter", () => {
      clearTimeout(this.timeout) // cancel any pending close
      this.detailsTarget.setAttribute("open", true)
    })

    this.element.addEventListener("mouseleave", () => {
      this.timeout = setTimeout(() => {
        this.detailsTarget.removeAttribute("open")
      }, 200) // close after 1 second
    })
  }

  disconnect() {
    clearTimeout(this.timeout)
  }
}
