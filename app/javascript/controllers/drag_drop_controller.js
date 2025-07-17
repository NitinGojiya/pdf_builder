import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="drag-drop"
export default class extends Controller {
  static targets = ["dropzone"];

  dragOver(event) {
    event.preventDefault();
    this.dropzoneTarget.classList.add("bg-gray-100");
  }

  dragLeave(event) {
    event.preventDefault();
    this.dropzoneTarget.classList.remove("bg-gray-100");
  }

  drop(event) {
    event.preventDefault();
    this.dropzoneTarget.classList.remove("bg-gray-100");

    const files = Array.from(event.dataTransfer.files);
    console.log(files)
    const dataTransfer = new DataTransfer();
    files.forEach(file => dataTransfer.items.add(file));
    const controller_name = document.querySelector("#controller").innerHTML; // e.g., "pdf-upload"

    const targetAttr = `data-${controller_name}-target`;

    const fileInput = document.querySelector(`[${targetAttr}="fileInput"]`);
    fileInput.files = dataTransfer.files;

    // Trigger change event so Stimulus picks it up
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
  }

}
