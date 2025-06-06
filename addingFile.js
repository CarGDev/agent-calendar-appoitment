const fs = require("fs");
const path = require("path");

const APPOINTMENTS_FILE = path.resolve(__dirname, "appointments.json");

/**
 * Load existing appointments from file (or create it if missing)
 * @returns {Appointment[]}
 */
const loadAppointmentsFromFile = () => {
  if (!fs.existsSync(APPOINTMENTS_FILE)) {
    fs.writeFileSync(APPOINTMENTS_FILE, "[]", "utf-8");
    return [];
  }

  try {
    const data = fs.readFileSync(APPOINTMENTS_FILE, "utf-8");
    return JSON.parse(data) || [];
  } catch (err) {
    console.error("❌ Failed to read appointments file:", err.message);
    return [];
  }
};

/**
 * Save appointments back to file
 * @param {Appointment[]} appointments
 */
const saveAppointmentsToFile = (appointments) => {
  try {
    fs.writeFileSync(APPOINTMENTS_FILE, JSON.stringify(appointments, null, 2), "utf-8");
  } catch (err) {
    console.error("❌ Failed to save appointments:", err.message);
  }
};

module.exports = {
  loadAppointmentsFromFile,
  saveAppointmentsToFile,
}
