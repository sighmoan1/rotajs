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

  const scheduleData = fullSchedule.map((shifts, day) => {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + day);
    const formattedDate = dateFormatter.format(currentDate);
    return {
      Day: formattedDate,
      "TL Shift 1": shifts["TL1"],
      "TL Shift 2": shifts["TL2"],
      "DM Shift 1": shifts["DM1"] || "",
      "DM Shift 2": shifts["DM2"] || "",
    };
  });

  // Split scheduleData into weeks, starting each week on a Monday
  const weeksData = [];
  let currentWeek = [];
  let weekStart = new Date(startDate);

  scheduleData.forEach((entry, index) => {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + index);

    if (currentDate.getDay() === 1 && currentWeek.length > 0) {
      // Push the current week and start a new week
      weeksData.push({ weekStart: weekStart, weekData: currentWeek });
      currentWeek = [];
      weekStart = currentDate;
    }

    currentWeek.push(entry);

    // Handle the last partial week
    if (index === scheduleData.length - 1 && currentWeek.length > 0) {
      weeksData.push({ weekStart: weekStart, weekData: currentWeek });
    }
  });

  // Display each week's schedule separately
  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = ""; // Clear previous results

  weeksData.forEach((week, index) => {
    const weekStartDate = week.weekStart;
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + week.weekData.length - 1);

    const weekTitle = document.createElement("h3");
    weekTitle.textContent = `Week ${
      index + 1
    } (${weekStartDate.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })} - ${weekEndDate.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })})`;
    resultsDiv.appendChild(weekTitle);

    const weekTable = document.createElement("table");
    displayTable(weekTable, week.weekData);
    resultsDiv.appendChild(weekTable);
  });

  // Create download button
  const downloadBtn = document.createElement("button");
  downloadBtn.textContent = "Download Schedule";
  downloadBtn.onclick = function () {
    const wb = XLSX.utils.book_new();

    weeksData.forEach((week, index) => {
      const ws = XLSX.utils.json_to_sheet(week.weekData);
      XLSX.utils.book_append_sheet(wb, ws, `Week ${index + 1}`);
    });

    const summaryData = people.map((person) => ({
      Name: person.name,
      "Can Do TL": person.can_do_tl,
      "Can Do DM": person.can_do_dm,
      "Total TL Shifts": tlShifts[person.name] || 0,
      "Total DM Shifts": dmShifts[person.name] || 0,
      "Total Shifts":
        (tlShifts[person.name] || 0) + (dmShifts[person.name] || 0),
    }));
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "schedule.xlsx";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  resultsDiv.appendChild(downloadBtn);
}

function displayTable(tableElement, data) {
  tableElement.innerHTML = "";

  if (data.length === 0) {
    tableElement.innerHTML = "<p>No data available</p>";
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

  tableElement.appendChild(thead);
  tableElement.appendChild(tbody);
}
