const { poolPromise, sql } = require("../config/db");

exports.loginStudent = async (req, res) => {
  const { st_id, password } = req.body;

  try {
    const pool = await poolPromise;

    const result = await pool.request()
      .input("St_id", sql.Int, st_id)
      .input("Password", sql.VarChar, password)
      .execute("sp_LoginStudent");

    if (result.recordset.length === 0) {
      return res.status(401).json({ message: "Invalid ID or Password" });
    }

    res.json({
      message: "Login successful",
      student: result.recordset[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};
