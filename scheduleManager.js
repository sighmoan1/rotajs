// scheduleManager.js

import { displayTable, displayWeeks } from "./uiRenderer.js";

export function generateSchedule(data) {
  // Constants
  const TL_SHIFTS_PER_DAY = 2;
  const DM_SHIFTS_PER_DAY = 2;
  const ADDITIONAL_DM_SHIFTS_WEEKEND = 2; // Additional DM shifts on Saturday and Sunday
  const DAYS_PER_WEEK = 7;

  // Get the start date from the input
  const startDateInput = document.getElementById("start-date").value;
  const startDate = new Date(startDateInput);
  const endDate = new Date(startDate);
  endDate.setFullYear(startDate.getFullYear() + 1);

  // Calculate the number of days between start and end dates
  const days = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));

  // Load people data
  const people = data.map((row) => ({
    name: row["Name"],
    region: row["Region"],
    can_do_tl: row["can_do_tl"] === "Y",
    can_do_dm: row["can_do_dm"] === "Y",
    total_tl_shifts: 0, // Separate TL and DM shifts
    total_dm_shifts: 0,
    weekday_shifts: Array(7).fill(0), // Array to count shifts per day of the week
  }));

  // Initialize schedule
  const schedule = Array.from({ length: days }, () => ({
    TL1: null,
    TL2: null,
    DM1: null,
    DM2: null,
    DM3: null,
    DM4: null,
  }));

  // Utility function to find a person who can take the shift
  function findAvailablePerson(currentDay, roleType, avoidRegions) {
    const eligiblePeople = people.filter((person) => {
      if (roleType === "TL" && !person.can_do_tl) return false;
      if (roleType === "DM" && !person.can_do_dm) return false;
      if (avoidRegions.includes(person.region)) return false;
      return true;
    });

    eligiblePeople.sort(
      (a, b) =>
        a.total_tl_shifts +
        a.total_dm_shifts -
        (b.total_tl_shifts + b.total_dm_shifts)
    );

    // Return a person who isn't scheduled for the same type of role today
    for (let person of eligiblePeople) {
      if (
        !Object.values(schedule[currentDay]).some(
          (shift) => shift && shift.includes(person.name)
        )
      ) {
        return person;
      }
    }
    return null;
  }

  function allocateTlShifts(schedule) {
    for (let day = 0; day < schedule.length; day++) {
      for (let shift = 0; shift < TL_SHIFTS_PER_DAY; shift++) {
        const avoidRegions = Object.values(schedule[day])
          .filter((shift) => shift)
          .map((shift) => shift.split("(")[1].replace(")", "").trim());

        const person = findAvailablePerson(day, "TL", avoidRegions);
        if (person) {
          schedule[day][`TL${shift + 1}`] = `${person.name} (${person.region})`;
          person.total_tl_shifts++; // Increment TL-specific shifts
          const currentDate = new Date(startDate);
          currentDate.setDate(startDate.getDate() + day);
          person.weekday_shifts[currentDate.getDay()]++;
        }
      }
    }
  }

  function allocateDmShifts(schedule) {
    for (let day = 0; day < schedule.length; day++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + day);
      const dayOfWeek = currentDate.getDay();

      for (let shift = 0; shift < DM_SHIFTS_PER_DAY; shift++) {
        const avoidRegions = Object.values(schedule[day])
          .filter((shift) => shift)
          .map((shift) => shift.split("(")[1].replace(")", "").trim());

        const person = findAvailablePerson(day, "DM", avoidRegions);
        if (person) {
          schedule[day][`DM${shift + 1}`] = `${person.name} (${person.region})`;
          person.total_dm_shifts++; // Increment DM-specific shifts
          person.weekday_shifts[dayOfWeek]++;
        }
      }

      if (dayOfWeek === 6 || dayOfWeek === 0) {
        for (let shift = 0; shift < ADDITIONAL_DM_SHIFTS_WEEKEND; shift++) {
          const avoidRegions = Object.values(schedule[day])
            .filter((shift) => shift)
            .map((shift) => shift.split("(")[1].replace(")", "").trim());

          const person = findAvailablePerson(day, "DM", avoidRegions);
          if (person) {
            schedule[day][
              `DM${shift + 3}`
            ] = `${person.name} (${person.region})`;
            person.total_dm_shifts++;
            person.weekday_shifts[dayOfWeek]++;
          }
        }
      }
    }
  }

  function resolveRegionConflicts(schedule) {
    // Identify conflicts and attempt to resolve them
    for (let day = 0; day < schedule.length; day++) {
      const shifts = schedule[day];
      const regionCount = {};

      // Count the number of people from each region on this day
      for (const role in shifts) {
        if (shifts[role]) {
          const region = shifts[role].split("(")[1].replace(")", "").trim();

          if (!regionCount[region]) {
            regionCount[region] = [];
          }
          regionCount[region].push(role);
        }
      }

      // Identify conflicts (regions with more than one person)
      for (const region in regionCount) {
        while (regionCount[region].length > 1) {
          const roleToSwap = regionCount[region].pop();

          // Try to resolve by swapping with another day
          for (let swapDay = 0; swapDay < schedule.length; swapDay++) {
            if (swapDay === day) continue;

            const swapShifts = schedule[swapDay];
            const swapRegions = {};

            // Create map of regions for swap day
            for (const swapRole in swapShifts) {
              if (swapShifts[swapRole]) {
                const swapRegion = swapShifts[swapRole]
                  .split("(")[1]
                  .replace(")", "")
                  .trim();

                if (!swapRegions[swapRegion]) {
                  swapRegions[swapRegion] = [];
                }
                swapRegions[swapRegion].push(swapRole);
              }
            }

            // Find a role on swapDay that can be swapped without conflict
            for (const swapRole in swapShifts) {
              if (
                swapRole.startsWith(roleToSwap.slice(0, 2)) && // Match TL or DM
                (!swapRegions[region] ||
                  !swapRegions[region].includes(swapRole))
              ) {
                // Perform the swap
                const temp = shifts[roleToSwap];
                shifts[roleToSwap] = swapShifts[swapRole];
                swapShifts[swapRole] = temp;
                break;
              }
            }
          }
        }
      }
    }
  }

  allocateTlShifts(schedule);
  allocateDmShifts(schedule);

  // Resolve region conflicts
  resolveRegionConflicts(schedule);

  // Create schedule data with formatted dates
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // Group the schedule by month and ensure each week starts on Monday
  const monthFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  });
  const scheduleDataByMonth = {};

  schedule.forEach((shifts, day) => {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + day);
    const formattedDate = dateFormatter.format(currentDate);
    const monthKey = monthFormatter.format(currentDate);

    const entry = {
      Day: formattedDate,
      "TL Shift 1": shifts["TL1"],
      "TL Shift 2": shifts["TL2"],
      "DM Shift 1": shifts["DM1"] || "",
      "DM Shift 2": shifts["DM2"] || "",
      "DM Shift 3": shifts["DM3"] || "",
      "DM Shift 4": shifts["DM4"] || "",
    };

    if (!scheduleDataByMonth[monthKey]) {
      scheduleDataByMonth[monthKey] = [];
    }
    scheduleDataByMonth[monthKey].push(entry);
  });

  const summaryData = people.map((person) => ({
    Name: person.name,
    Region: person.region,
    "Can Do TL": person.can_do_tl ? "Y" : "N",
    "Can Do DM": person.can_do_dm ? "Y" : "N",
    "Total TL Shifts": person.total_tl_shifts,
    "Total DM Shifts": person.total_dm_shifts,
    "Total Shifts": person.total_tl_shifts + person.total_dm_shifts,
    "Monday Shifts": person.weekday_shifts[1],
    "Tuesday Shifts": person.weekday_shifts[2],
    "Wednesday Shifts": person.weekday_shifts[3],
    "Thursday Shifts": person.weekday_shifts[4],
    "Friday Shifts": person.weekday_shifts[5],
    "Saturday Shifts": person.weekday_shifts[6],
    "Sunday Shifts": person.weekday_shifts[0],
  }));

  // Sort the summary data by region and then by name
  summaryData.sort((a, b) => {
    if (a.Region < b.Region) return -1;
    if (a.Region > b.Region) return 1;
    if (a.Name < b.Name) return -1;
    if (a.Name > b.Name) return 1;
    return 0;
  });

  // Display the summary table
  displayTable("summary-table", summaryData);

  // Create monthly schedule sections with week display
  const scheduleContainer = document.getElementById("schedule-table");
  scheduleContainer.innerHTML = "";

  let monthKeys = Object.keys(scheduleDataByMonth);
  let currentMonthIndex = 0;

  // Create month selection dropdown
  const monthSelect = document.createElement("select");
  monthSelect.classList.add("month-select");

  monthKeys.forEach((month, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = month;
    monthSelect.appendChild(option);
  });

  monthSelect.onchange = () => {
    currentMonthIndex = parseInt(monthSelect.value, 10);
    renderMonth(currentMonthIndex);
  };

  function renderMonth(monthIndex) {
    scheduleContainer.innerHTML = "";
    const monthKey = monthKeys[monthIndex];
    const monthData = scheduleDataByMonth[monthKey];

    const monthSection = document.createElement("div");
    monthSection.classList.add("month-section");

    const monthTitle = document.createElement("h3");
    monthTitle.textContent = monthKey;
    monthSection.appendChild(monthTitle);

    const paginationContainer = document.createElement("div");
    paginationContainer.classList.add("pagination-container");
    monthSection.appendChild(paginationContainer);

    scheduleContainer.appendChild(monthSection);

    // Display weeks within the month
    displayWeeks(monthData, paginationContainer, DAYS_PER_WEEK);

    // Add month navigation controls
    const monthControls = document.createElement("div");
    monthControls.classList.add("month-controls");

    const prevMonthButton = document.createElement("button");
    prevMonthButton.textContent = "Previous Month";
    prevMonthButton.disabled = monthIndex === 0;
    prevMonthButton.onclick = () => {
      currentMonthIndex = Math.max(0, currentMonthIndex - 1);
      monthSelect.value = currentMonthIndex;
      renderMonth(currentMonthIndex);
    };

    const nextMonthButton = document.createElement("button");
    nextMonthButton.textContent = "Next Month";
    nextMonthButton.disabled = monthIndex === monthKeys.length - 1;
    nextMonthButton.onclick = () => {
      currentMonthIndex = Math.min(monthKeys.length - 1, currentMonthIndex + 1);
      monthSelect.value = currentMonthIndex;
      renderMonth(currentMonthIndex);
    };

    monthControls.appendChild(prevMonthButton);
    monthControls.appendChild(nextMonthButton);
    monthControls.appendChild(monthSelect);

    scheduleContainer.appendChild(monthControls);
  }

  renderMonth(currentMonthIndex);

  // Create download button
  const downloadBtn = document.createElement("button");
  downloadBtn.textContent = "Download Schedule";
  downloadBtn.onclick = function () {
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(schedule);
    XLSX.utils.book_append_sheet(wb, ws1, "Schedule");

    const ws2 = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws2, "Summary");

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "schedule.xlsx";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  document.getElementById("results").appendChild(downloadBtn);
}
