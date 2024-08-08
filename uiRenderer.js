// uiRenderer.js

export function displayTable(container, data) {
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

export function displayWeeks(data, container, daysPerWeek) {
  let weekIndex = 1;
  let dayIndex = 0;

  while (dayIndex < data.length) {
    const weekStart = new Date(data[dayIndex].Day);

    // If the first day is not Monday, create a short week until Sunday
    if (weekIndex === 1 && weekStart.getDay() !== 1) {
      // First week ends on Sunday
      const firstWeekEndIndex = Math.min(
        dayIndex + (7 - weekStart.getDay()),
        data.length - 1
      );
      const firstWeekEnd = new Date(data[firstWeekEndIndex].Day);
      const weekData = [];

      for (
        ;
        dayIndex <= firstWeekEndIndex && dayIndex < data.length;
        dayIndex++
      ) {
        weekData.push(data[dayIndex]);
      }

      const weekTitle = document.createElement("h4");
      weekTitle.textContent = `Week ${weekIndex} - ${formatDateRange(
        weekStart,
        firstWeekEnd
      )}`;
      container.appendChild(weekTitle);

      const table = document.createElement("table");
      displayTable(table, weekData);
      container.appendChild(table);

      weekIndex++;
    } else {
      // All other weeks start on Monday and end on Sunday
      let weekEndIndex = Math.min(dayIndex + daysPerWeek - 1, data.length - 1);
      let weekEnd = new Date(data[weekEndIndex].Day);
      const weekData = [];

      for (; dayIndex <= weekEndIndex && dayIndex < data.length; dayIndex++) {
        weekData.push(data[dayIndex]);
      }

      const weekTitle = document.createElement("h4");
      weekTitle.textContent = `Week ${weekIndex} - ${formatDateRange(
        weekStart,
        weekEnd
      )}`;
      container.appendChild(weekTitle);

      const table = document.createElement("table");
      displayTable(table, weekData);
      container.appendChild(table);

      weekIndex++;
    }

    // If the week doesn't start on Monday, skip to the next Monday
    if (weekStart.getDay() !== 1 && dayIndex < data.length) {
      while (
        new Date(data[dayIndex].Day).getDay() !== 1 &&
        dayIndex < data.length
      ) {
        dayIndex++;
      }
    }
  }
}

function formatDateRange(start, end) {
  const options = { day: "2-digit", month: "short", year: "numeric" };
  return `${start.toLocaleDateString(
    "en-GB",
    options
  )} to ${end.toLocaleDateString("en-GB", options)}`;
}
