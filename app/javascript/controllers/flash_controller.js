import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="flash"
export default class extends Controller {
   static targets = ["alert"]

  connect() {
    // Automatically dismiss the alert after 3 seconds
    this.timeout = setTimeout(() => {
      this.dismiss()
    }, 3000)
  }

  dismiss() {
    this.alertTarget.classList.add("opacity-0", "translate-x-full")
    setTimeout(() => this.alertTarget.remove(), 300) // Remove after animation
  }
}
