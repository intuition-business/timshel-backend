require("dotenv").config();

const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const PORT = Number(process.env.PORT) || 4000;
const URL = process.env.URL || "localhost";
const NODE_ENV = process.env.NODE_ENV;
const SECRET = process.env.SECRET_KEY_JWT || "";
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_NUMBER = process.env.TWILIO_NUMBER || "";

const API_KEY_SENDGRID = process.env.API_KEY_SENDGRID || "";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

export {
  DB_PASSWORD,
  DB_USER,
  PORT,
  URL,
  NODE_ENV,
  SECRET,
  TWILIO_AUTH_TOKEN,
  TWILIO_ACCOUNT_SID,
  TWILIO_NUMBER,
  API_KEY_SENDGRID,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
};
