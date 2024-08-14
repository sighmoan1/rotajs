// Import necessary modules
import { displayTable, displayWeeks } from "./uiRenderer.js";
import { config } from "./config.js";

// Utility function to map day index to day name
function getDayName(index) {
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return dayNames[index];
}

// Function to generate and display the schedule
export function generateSchedule(data) {
  // Extract configuration parameters
  const { daysPerWeek } = config;

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
    canDoDM: row["can_do_dm"] === "Y",
    canDoTL: row["can_do_tl"] === "Y",
    totalDMShifts: 0,
    totalTLShifts: 0,
    weekday_shifts: Array(7).fill(0),
  }));

  // Initialize schedule
  const schedule = initializeSchedule(startDate, days);

  // Allocate shifts
  allocateShifts(schedule, startDate, people);

  // Display the schedule using existing logic
  displayGeneratedSchedule(schedule, startDate, people, daysPerWeek);

  // Display the rules applied
  displayRulesApplied();
}

// Function to initialize the schedule based on shifts per day
function initializeSchedule(startDate, days) {
  return Array.from({ length: days }, (_, dayIndex) => {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + dayIndex);

    const dayOfWeek = getDayName(currentDate.getDay());

    return {
      DM: Array(config.shiftsPerDay[dayOfWeek].DM).fill(null),
      TL: Array(config.shiftsPerDay[dayOfWeek].TL).fill(null),
    };
  });
}

// Utility function to find an available person for a shift
function findAvailablePerson(
  currentDay,
  roleType,
  avoidRegions,
  schedule,
  people
) {
  const eligiblePeople = people.filter((person) => {
    if (roleType === "DM" && !person.canDoDM) return false;
    if (roleType === "TL" && !person.canDoTL) return false;
    if (avoidRegions.includes(person.region)) return false;
    return true;
  });

  eligiblePeople.sort(
    (a, b) => a[`total${roleType}Shifts`] - b[`total${roleType}Shifts`]
  );

  return (
    eligiblePeople.find(
      (person) =>
        !Object.values(schedule[currentDay]).some(
          (shift) => shift && shift.includes(person.name)
        )
    ) || null
  );
}

// Function to allocate shifts for a single day
function allocateShiftsForDay(schedule, day, startDate, people) {
  const currentDate = new Date(startDate);
  currentDate.setDate(startDate.getDate() + day);
  const dayOfWeekIndex = currentDate.getDay();
  const dayOfWeek = getDayName(dayOfWeekIndex);

  const allocateShift = (role) => {
    const avoidRegions = [];

    // Loop through the number of shifts needed for that day
    for (let i = 0; i < config.shiftsPerDay[dayOfWeek][role]; i++) {
      // First, try to allocate from unallocated regions
      let nextPerson = findAvailablePerson(
        day,
        role,
        avoidRegions,
        schedule,
        people
      );
      if (nextPerson) {
        assignShift(schedule, day, role, nextPerson, dayOfWeekIndex);
        avoidRegions.push(nextPerson.region);
      } else {
        // If no unallocated regions left, allocate from regions with the fewest shifts
        nextPerson = findAvailablePerson(day, role, [], schedule, people);
        if (nextPerson) {
          assignShift(schedule, day, role, nextPerson, dayOfWeekIndex);
        }
      }
    }
  };

  // Allocate TL shifts first if they exist
  if (config.shiftsPerDay[dayOfWeek].TL > 0) {
    allocateShift("TL");
  }

  // Allocate DM shifts
  allocateShift("DM");
}

// Helper function to assign a shift to a person
function assignShift(schedule, day, role, person, dayOfWeekIndex) {
  const availableShift = schedule[day][role].findIndex((s) => !s);
  if (availableShift !== -1) {
    schedule[day][role][availableShift] = `${person.name} (${person.region})`;
    person[`total${role}Shifts`]++;
    person.weekday_shifts[dayOfWeekIndex]++;
  }
}

// Main function to allocate all shifts across the entire schedule
function allocateShifts(schedule, startDate, people) {
  for (let day = 0; day < schedule.length; day++) {
    allocateShiftsForDay(schedule, day, startDate, people);
  }
}

// Function to display the generated schedule and summary
function displayGeneratedSchedule(schedule, startDate, people, daysPerWeek) {
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const monthFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  });

  const scheduleDataByMonth = groupScheduleByMonth(
    schedule,
    startDate,
    dateFormatter,
    monthFormatter
  );

  const summaryData = createSummaryData(people);

  displayTable("summary-table", summaryData);
  renderMonthlySchedule(scheduleDataByMonth, daysPerWeek);
}

// Function to group the schedule by month
function groupScheduleByMonth(
  schedule,
  startDate,
  dateFormatter,
  monthFormatter
) {
  const scheduleDataByMonth = {};

  schedule.forEach((shifts, day) => {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + day);
    const formattedDate = dateFormatter.format(currentDate);
    const monthKey = monthFormatter.format(currentDate);

    const entry = { Day: formattedDate };
    ["DM", "TL"].forEach((role) => {
      shifts[role].forEach((shift, index) => {
        entry[`${role} Shift ${index + 1}`] = shift || "";
      });
    });

    if (!scheduleDataByMonth[monthKey]) {
      scheduleDataByMonth[monthKey] = [];
    }
    scheduleDataByMonth[monthKey].push(entry);
  });

  return scheduleDataByMonth;
}

// Function to create summary data for display
function createSummaryData(people) {
  const summaryData = people.map((person) => ({
    Name: person.name,
    Region: person.region,
    "Total DM Shifts": person.totalDMShifts,
    "Total TL Shifts": person.totalTLShifts,
    "Total Shifts": person.totalDMShifts + person.totalTLShifts,
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

  return summaryData;
}

// Function to render the monthly schedule with week display
function renderMonthlySchedule(scheduleDataByMonth, daysPerWeek) {
  const scheduleContainer = document.getElementById("schedule-table");
  scheduleContainer.innerHTML = "";

  const monthKeys = Object.keys(scheduleDataByMonth);
  let currentMonthIndex = 0;

  const monthSelect = createMonthSelect(monthKeys, currentMonthIndex);
  monthSelect.onchange = () => {
    currentMonthIndex = parseInt(monthSelect.value, 10);
    renderMonth(
      scheduleContainer,
      monthKeys,
      scheduleDataByMonth,
      currentMonthIndex,
      daysPerWeek
    );
  };

  renderMonth(
    scheduleContainer,
    monthKeys,
    scheduleDataByMonth,
    currentMonthIndex,
    daysPerWeek
  );

  // Add month navigation controls
  addMonthNavigationControls(
    scheduleContainer,
    monthKeys,
    currentMonthIndex,
    monthSelect,
    daysPerWeek
  );
}

// Function to create the month select dropdown
function createMonthSelect(monthKeys, currentMonthIndex) {
  const monthSelect = document.createElement("select");
  monthSelect.classList.add("month-select");

  monthKeys.forEach((month, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = month;
    monthSelect.appendChild(option);
  });

  return monthSelect;
}

// Function to render the schedule for a specific month
function renderMonth(
  scheduleContainer,
  monthKeys,
  scheduleDataByMonth,
  monthIndex,
  daysPerWeek
) {
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
  displayWeeks(monthData, paginationContainer, daysPerWeek);
}

// Function to add month navigation controls
function addMonthNavigationControls(
  scheduleContainer,
  monthKeys,
  currentMonthIndex,
  monthSelect,
  daysPerWeek
) {
  const monthControls = document.createElement("div");
  monthControls.classList.add("month-controls");
  const prevMonthButton = document.createElement("button");
  prevMonthButton.textContent = "Previous Month";
  prevMonthButton.disabled = currentMonthIndex === 0;
  prevMonthButton.onclick = () => {
    currentMonthIndex = Math.max(0, currentMonthIndex - 1);
    monthSelect.value = currentMonthIndex;
    renderMonth(
      scheduleContainer,
      monthKeys,
      scheduleDataByMonth,
      currentMonthIndex,
      daysPerWeek
    );
  };
  const nextMonthButton = document.createElement("button");
  nextMonthButton.textContent = "Next Month";
  nextMonthButton.disabled = currentMonthIndex === monthKeys.length - 1;
  nextMonthButton.onclick = () => {
    currentMonthIndex = Math.min(monthKeys.length - 1, currentMonthIndex + 1);
    monthSelect.value = currentMonthIndex;
    renderMonth(
      scheduleContainer,
      monthKeys,
      scheduleDataByMonth,
      currentMonthIndex,
      daysPerWeek
    );
  };

  monthControls.appendChild(prevMonthButton);
  monthControls.appendChild(nextMonthButton);
  monthControls.appendChild(monthSelect);

  scheduleContainer.appendChild(monthControls);
}
