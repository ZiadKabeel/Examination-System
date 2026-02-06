require("dotenv").config();
const express = require("express");
const path = require("path");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const { poolPromise } = require("./config/db");
const authRoutes = require("./routes/auth.routes");
const examRoutes = require("./routes/exam.routes");
const metaRoutes = require("./routes/meta.routes");

app.get("/test-db", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT 1 AS test");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send("DB Error");
  }
});

app.get("/test-students", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(
      "SELECT TOP (10) St_id, Fname, Lname, Dept_id FROM Student"
    );
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send("DB Error");
  }
});

app.get("/debug/tables", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'"
    );
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send("DB Error");
  }
});

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await poolPromise;
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
    server.on("error", err => {
      console.error("❌ Server error:", err);
    });
  } catch (err) {
    console.error("❌ Failed to start server due to DB error:", err);
  }
})();

app.use("/auth", authRoutes);
app.use("/exam", examRoutes);
app.use("/meta", metaRoutes);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.get("/exam-ui", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "home.html"));
});

app.get("/exam-page", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "exam.html"));
});

app.get("/review-ui", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "review.html"));
});
