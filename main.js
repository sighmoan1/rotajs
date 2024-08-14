import { handleFile } from "./fileHandler.js"; // Ensure this import is correct
import { generateSchedule } from "./scheduleManager.js";
import { config } from "./config.js";

let fileData = null; // Define fileData here
document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("file-input");
  const generateButton = document.getElementById("generate-schedule");

  fileInput.addEventListener("change", (event) => {
    handleFile(event, (data) => {
      fileData = data; // Store the file data when it's loaded
    });
  });

  generateButton.addEventListener("click", () => {
    if (!fileData) {
      alert("Please upload a file before generating the schedule.");
      return;
    }

    const daysOfWeek = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];

    daysOfWeek.forEach((day) => {
      const dmShiftsInput = document.getElementById(
        `dm-shifts-${day.toLowerCase()}`
      );
      const tlShiftsInput = document.getElementById(
        `tl-shifts-${day.toLowerCase()}`
      );

      config.shiftsPerDay[day].DM = parseInt(dmShiftsInput.value, 10);
      config.shiftsPerDay[day].TL = parseInt(tlShiftsInput.value, 10);
    });

    // Remove or comment out the line that references the enforceRegionRule checkbox
    // config.enforceRegionRule = document.getElementById("enforce-region-rule").checked;

    // Generate the schedule with the stored file data
    generateSchedule(fileData);
  });
});
