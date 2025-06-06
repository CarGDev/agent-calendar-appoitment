const axios = require("axios");
const prompt = require("./prompt.js");
const {
  loadAppointmentsFromFile,
  saveAppointmentsToFile,
} = require("./addingFile.js");
const gmtConversion = require("convert-time-gmt");

// Ensure the KEY_AUTH environment variable is set or use a default value, in this case I'm using a endpoint on my local server that is hosted
// by api-ai.cargdev.io
const key = process.env.KEY_AUTH;
const host = process.env.HOST;

require("dotenv").config();

let appointments = loadAppointmentsFromFile();

/* Forcing axios to response on text format
 * to manipulate the response further
 * */
const headers = {
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Accept: "application/x-ndjson",
  },
  responseType: "text",
};

/**
 * @typedef {Object} Appointment
 * @property {string} parsed_date - The appointment datetime in YY/MM/DD HH:mm format.
 * @property {'available' | 'taken'} status - Whether the time slot is available.
 * @property {string} message - A user-facing confirmation or suggestion.
 * @property {Object} calendar_event - A full calendar-compatible event object.
 * @property {string} calendar_event.summary - Title of the appointment.
 * @property {string} calendar_event.description - Details of the appointment.
 * @property {string} calendar_event.location - Where the appointment takes place.
 * @property {{ dateTime: string, timeZone: string }} calendar_event.start - Start time.
 * @property {{ dateTime: string, timeZone: string }} calendar_event.end - End time.
 * @property {{ email: string }[]} calendar_event.attendees - List of participant emails.
 * @property {{ useDefault: boolean, overrides: { method: string, minutes: number }[] }} calendar_event.reminders - Reminder rules.
 */

/**
 * Collects and merges all assistant-generated message chunks into a single string.
 * Assumes each chunk in `data` is a parsed JSON object from a streamed LLM response.
 * The result is logged as a reconstructed JSON string that can be parsed as {@link Appointment}.
 *
 * @param {Array<{ message: { role: string, content: string } }>} data - Streamed message chunks from the LLM response.
 * @returns {Promise<void>} Logs the combined response string to the console.
 */

const getResponse = async (data) => {
  const arr = [];
  // generate a lop for each response
  data?.forEach((v) => {
    if (v?.message?.role === "assistant") {
      arr.push(v?.message?.content);
    }
  });
  const str = arr.join("");
  // Extract JSON from string (anything between the first ```json and the last ```)
  const match = str.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) {
    console.warn("⚠️ No JSON block found in response.");
    return;
  }

  try {
    const appointmentObj = JSON.parse(match[1]);
    const appointments = loadAppointmentsFromFile();
    appointments.push(appointmentObj);
    saveAppointmentsToFile(appointments);

    console.log("✅ Appointment added to file:");
    console.log(appointmentObj);
  } catch (err) {
    console.error("❌ Failed to parse appointment JSON:", err.message);
  }
};

/**
 * @typedef {{ email: string }} Attendee
 */

/**
 * Generates a new prompt message to check if an appointment is available.
 * Includes user details, location, date, and attendees in the content for LLM context.
 *
 * @param {string} dateTime - The appointment request datetime in local GMT-05:00 format.
 * @param {string} [userName="Carlos Gutierrez"] - Name of the user requesting the appointment.
 * @param {string} [location="Zoom"] - Location of the appointment.
 * @param {Attendee[]} [attendees=[{ email: "example@test.com" }]] - List of participant emails.
 * @param {string[]} [appointments=[]] - List of already booked appointments in YY/MM/DD HH:mm format.
 * @param {Object} prompt - The mutable prompt object to which the message will be added.
 */
const generateThePrompt = (
  dateTime,
  userName = "Carlos Gutierrez",
  location = "Zoom",
  attendees = [{ email: "example@test.com" }],
) => {
  const userInput = `I want to make an appointment on ${dateTime}, for a meeting with John Doe at ${location}.`;

  const appointmentCheckMessage = {
    role: "user",
    content: `
${userInput}
User: ${userName}
Requested appointment time: "${dateTime}"
Location: ${location}
Attendees: ${attendees.map((a) => a.email).join(", ")}
Booked appointments (YY/MM/DD HH:mm): ${JSON.stringify(appointments)}

Instructions:
1. Extract the date and time from the user's request.
2. Check if the requested time is available.
3. Respond with a JSON object using the following keys only:
  - "parsed_date": string (in YY/MM/DD HH:mm)
  - "status": "available" | "taken"
  - "message": short, user-friendly message.

If taken, provide a brief suggestion for an alternative.
    `,
  };

  prompt.messages.push(appointmentCheckMessage);
};

(async () => {
  const ora = (await import("ora")).default;
  const spinner = ora("🧠 Asking the AI, please wait...").start();

  // Loop to simulate 10 appointment requests, 1 day apart
  for (let i = 0; i < 2; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const dateTime = gmtConversion(date, "GMT-05:00");

    generateThePrompt(dateTime);

    try {
      const response = await axios.post(
        `${host}/api/chat`,
        prompt,
        headers,
      );

      spinner.succeed(`✅ Appointment ${i + 1} booked`);
      const raw = response.data;
      const parsedChunks = raw
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      getResponse(parsedChunks);
    } catch (error) {
      spinner.fail(`❌ Failed to book appointment ${i + 1}`);
      console.error("Error:", error.message);
    }
  }
})();
