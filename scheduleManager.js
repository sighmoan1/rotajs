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

  function allocateTlShifts(schedule) {
    const eligibleTLs = people.filter((p) => p.can_do_tl).map((p) => p.name);
    const shiftsPerPerson = Object.fromEntries(
      eligibleTLs.map((name) => [
        name,
        { total: 0, weekdays: Array(7).fill(0) },
      ])
    );

    let tlIndex = 0;
    for (let day = 0; day < schedule.length; day++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + day);
      const dayOfWeek = currentDate.getDay();

      for (let shift = 0; shift < TL_SHIFTS_PER_DAY; shift++) {
        const personName = eligibleTLs[tlIndex % eligibleTLs.length];
        const person = people.find((p) => p.name === personName);
        schedule[day][`TL${shift + 1}`] = `${person.name} (${person.region})`;
        shiftsPerPerson[personName].total++;
        shiftsPerPerson[personName].weekdays[dayOfWeek]++;
        tlIndex++;
      }
    }

    return shiftsPerPerson;
  }

  function allocateDmShifts(schedule) {
    const eligibleDMs = people.filter((p) => p.can_do_dm).map((p) => p.name);
    const nonTLDMs = people
      .filter((p) => p.can_do_dm && !p.can_do_tl)
      .map((p) => p.name);

    const shiftsPerPerson = Object.fromEntries(
      eligibleDMs.map((name) => [
        name,
        { total: 0, weekdays: Array(7).fill(0) },
      ])
    );

    let dmIndex = 0;
    let dmWeekendIndex = 0;

    for (let day = 0; day < schedule.length; day++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + day);
      const dayOfWeek = currentDate.getDay();

      // Allocate DM1 and DM2 for each day
      for (let shift = 0; shift < DM_SHIFTS_PER_DAY; shift++) {
        const personName = nonTLDMs[dmIndex % nonTLDMs.length];
        const person = people.find((p) => p.name === personName);
        schedule[day][`DM${shift + 1}`] = `${person.name} (${person.region})`;
        shiftsPerPerson[personName].total++;
        shiftsPerPerson[personName].weekdays[dayOfWeek]++;
        dmIndex++;
      }

      // Allocate DM3 and DM4 for weekends
      if (dayOfWeek === 6 || dayOfWeek === 0) {
        for (let shift = 0; shift < ADDITIONAL_DM_SHIFTS_WEEKEND; shift++) {
          const personName = eligibleDMs[dmWeekendIndex % eligibleDMs.length];
          const person = people.find((p) => p.name === personName);
          schedule[day][`DM${shift + 3}`] = `${person.name} (${person.region})`;
          shiftsPerPerson[personName].total++;
          shiftsPerPerson[personName].weekdays[dayOfWeek]++;
          dmWeekendIndex++;
        }
      }
    }

    return shiftsPerPerson;
  }

  const tlShifts = allocateTlShifts(schedule);
  const dmShifts = allocateDmShifts(schedule);

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

  const summaryData = people.map((person) => {
    const tlData = tlShifts[person.name] || {
      total: 0,
      weekdays: Array(7).fill(0),
    };
    const dmData = dmShifts[person.name] || {
      total: 0,
      weekdays: Array(7).fill(0),
    };

    return {
      Name: person.name,
      Region: person.region,
      "Can Do TL": person.can_do_tl ? "Y" : "N",
      "Can Do DM": person.can_do_dm ? "Y" : "N",
      "Total TL Shifts": tlData.total,
      "Total DM Shifts": dmData.total,
      "Total Shifts": tlData.total + dmData.total,
      "Sunday Shifts": tlData.weekdays[0] + dmData.weekdays[0],
      "Monday Shifts": tlData.weekdays[1] + dmData.weekdays[1],
      "Tuesday Shifts": tlData.weekdays[2] + dmData.weekdays[2],
      "Wednesday Shifts": tlData.weekdays[3] + dmData.weekdays[3],
      "Thursday Shifts": tlData.weekdays[4] + dmData.weekdays[4],
      "Friday Shifts": tlData.weekdays[5] + dmData.weekdays[5],
      "Saturday Shifts": tlData.weekdays[6] + dmData.weekdays[6],
    };
  });

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
