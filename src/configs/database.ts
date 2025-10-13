// /configs/database.ts
/*import mysql from "mysql2/promise";

export const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "botosafedb",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});*/

// /configs/database.ts
import mysql from "mysql2/promise";

export const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "botosafe_user",
  password: process.env.DB_PASSWORD || "botosafepassword",
  database: process.env.DB_NAME || "botosafedb",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
