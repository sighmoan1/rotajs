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
  const DAYS = 366;
  const TL_SHIFTS_PER_DAY = 2;
  const DM_SHIFTS_PER_DAY = 2;

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
    DAYS,
    TL_SHIFTS_PER_DAY,
    "can_do_tl",
    ["TL1", "TL2"]
  );
  const { schedule: fullSchedule, shiftsPerPerson: dmShifts } =
    allocateDmShifts(people, DAYS, tlSchedule);

  const scheduleData = fullSchedule.map((shifts, day) => ({
    Day: day + 1,
    "TL Shift 1": shifts["TL1"],
    "TL Shift 2": shifts["TL2"],
    "DM Shift 1": shifts["DM1"] || "",
    "DM Shift 2": shifts["DM2"] || "",
  }));

  const summaryData = people.map((person) => ({
    Name: person.name,
    "Can Do TL": person.can_do_tl,
    "Can Do DM": person.can_do_dm,
    "Total TL Shifts": tlShifts[person.name] || 0,
    "Total DM Shifts": dmShifts[person.name] || 0,
    "Total Shifts": (tlShifts[person.name] || 0) + (dmShifts[person.name] || 0),
  }));

  // Display tables
  displayTable("schedule-table", scheduleData);
  displayTable("summary-table", summaryData);

  // Create download button
  const downloadBtn = document.createElement("button");
  downloadBtn.textContent = "Download Schedule";
  downloadBtn.onclick = function () {
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(scheduleData);
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

function displayTable(tableId, data) {
  const table = document.getElementById(tableId);
  table.innerHTML = "";

  if (data.length === 0) {
    table.innerHTML = "<p>No data available</p>";
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

  table.appendChild(thead);
  table.appendChild(tbody);
}
