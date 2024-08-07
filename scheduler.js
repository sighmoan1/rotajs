function handleFile(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      generateSchedule(jsonData);
    };
    reader.readAsArrayBuffer(file);
  }
}

function generateSchedule(data) {
  // Constants
  const TL_SHIFTS_PER_DAY = 2;
  const DM_SHIFTS_PER_DAY = 2;
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
    name: row["name"],
    can_do_tl: row["can_do_tl"],
    can_do_dm: row["can_do_dm"],
  }));

  function allocateShifts(people, days, shiftsPerDay, eligibleKey, shiftKeys) {
    const eligible = people
      .filter((p) => p[eligibleKey] === "Y")
      .map((p) => p.name);
    const shiftsPerPerson = Object.fromEntries(
      eligible.map((name) => [name, 0])
    );
    const schedule = Array.from({ length: days }, () =>
      Object.fromEntries(shiftKeys.map((key) => [key, null]))
    );

    let index = 0;
    for (let day = 0; day < days; day++) {
      for (let shift = 0; shift < shiftsPerDay; shift++) {
        const person = eligible[index % eligible.length];
        schedule[day][shiftKeys[shift]] = person;
        shiftsPerPerson[person]++;
        index++;
      }
    }
    return { schedule, shiftsPerPerson };
  }

  function allocateDmShifts(people, days, tlSchedule) {
    const eligible = people
      .filter((p) => p.can_do_dm === "Y" && p.can_do_tl === "N")
      .map((p) => p.name);
    const shiftsPerPerson = Object.fromEntries(
      eligible.map((name) => [name, 0])
    );

    let index = 0;
    for (let day = 0; day < days; day++) {
      for (let shift = 0; shift < DM_SHIFTS_PER_DAY; shift++) {
        const person = eligible[index % eligible.length];
        if (
          tlSchedule[day]["TL1"] !== person &&
          tlSchedule[day]["TL2"] !== person
        ) {
          tlSchedule[day][`DM${shift + 1}`] = person;
          shiftsPerPerson[person]++;
          index++;
        }
      }
    }
    return { schedule: tlSchedule, shiftsPerPerson };
  }

  const { schedule: tlSchedule, shiftsPerPerson: tlShifts } = allocateShifts(
    people,
    days,
    TL_SHIFTS_PER_DAY,
    "can_do_tl",
    ["TL1", "TL2"]
  );
  const { schedule: fullSchedule, shiftsPerPerson: dmShifts } =
    allocateDmShifts(people, days, tlSchedule);

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

  fullSchedule.forEach((shifts, day) => {
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
    };

    if (!scheduleDataByMonth[monthKey]) {
      scheduleDataByMonth[monthKey] = [];
    }
    scheduleDataByMonth[monthKey].push(entry);
  });

  const summaryData = people.map((person) => ({
    Name: person.name,
    "Can Do TL": person.can_do_tl,
    "Can Do DM": person.can_do_dm,
    "Total TL Shifts": tlShifts[person.name] || 0,
    "Total DM Shifts": dmShifts[person.name] || 0,
    "Total Shifts": (tlShifts[person.name] || 0) + (dmShifts[person.name] || 0),
  }));

  // Display the summary table
  displayTable("summary-table", summaryData);

  // Create monthly schedule sections with week display
  const scheduleContainer = document.getElementById("schedule-table");
  scheduleContainer.innerHTML = "";

  let monthKeys = Object.keys(scheduleDataByMonth);
  let currentMonthIndex = 0;

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
      renderMonth(currentMonthIndex);
    };

    const nextMonthButton = document.createElement("button");
    nextMonthButton.textContent = "Next Month";
    nextMonthButton.disabled = monthIndex === monthKeys.length - 1;
    nextMonthButton.onclick = () => {
      currentMonthIndex = Math.min(monthKeys.length - 1, currentMonthIndex + 1);
      renderMonth(currentMonthIndex);
    };

    monthControls.appendChild(prevMonthButton);
    monthControls.appendChild(nextMonthButton);

    scheduleContainer.appendChild(monthControls);
  }

  renderMonth(currentMonthIndex);

  // Create download button
  const downloadBtn = document.createElement("button");
  downloadBtn.textContent = "Download Schedule";
  downloadBtn.onclick = function () {
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(fullSchedule);
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

function displayTable(container, data) {
  if (typeof container === "string") {
    container = document.getElementById(container);
  }
  container.innerHTML = "";

  if (data.length === 0) {
    container.innerHTML = "<p>No data available</p>";
    return;
  }

  const headers = Object.keys(data[0]);
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  const headerRow = document.createElement("tr");
  headers.forEach((header) => {
    const th = document.createElement("th");
    th.textContent = header;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  data.forEach((row) => {
    const tr = document.createElement("tr");
    headers.forEach((header) => {
      const td = document.createElement("td");
      td.textContent = row[header];
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  container.appendChild(thead);
  container.appendChild(tbody);
}

function displayWeeks(data, container, daysPerWeek) {
  let weekIndex = 1;
  let dayIndex = 0;

  // Define the monthFormatter inside the function or pass it as an argument
  const monthFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  });

  while (dayIndex < data.length) {
    const weekStart = new Date(data[dayIndex].Day);
    const weekEnd = new Date(
      data[Math.min(dayIndex + daysPerWeek - 1, data.length - 1)].Day
    );
    const weekData = [];

    for (
      let i = 0;
      i < daysPerWeek && dayIndex < data.length;
      i++, dayIndex++
    ) {
      weekData.push(data[dayIndex]);
    }

    // Add a title for the week
    const weekTitle = document.createElement("h4");
    weekTitle.textContent = `Week ${weekIndex} - ${formatDateRange(
      weekStart,
      weekEnd
    )}`;
    container.appendChild(weekTitle);

    // Create a table for the week
    const table = document.createElement("table");
    displayTable(table, weekData);
    container.appendChild(table);

    // Move to the next week
    weekIndex++;
  }
}

function formatDateRange(start, end) {
  const options = { day: "2-digit", month: "short", year: "numeric" };
  return `${start.toLocaleDateString(
    "en-GB",
    options
  )} to ${end.toLocaleDateString("en-GB", options)}`;
}
