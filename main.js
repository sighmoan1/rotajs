// main.js
import { handleFile } from "./fileHandler.js";
import { generateSchedule } from "./scheduleManager.js";

// Wait for the DOM to be fully loaded before attaching event listeners
document.addEventListener("DOMContentLoaded", () => {
  // Attach the event listener to the file input
  const fileInput = document.getElementById("file-input");
  fileInput.addEventListener("change", (event) =>
    handleFile(event, generateSchedule)
  );
});
