const { poolPromise, sql } = require("../config/db");

const splitSchemaName = name => {
  if (!name) return { schema: "dbo", name: null };
  const parts = name.split(".");
  if (parts.length === 2) {
    return { schema: parts[0], name: parts[1] };
  }
  return { schema: "dbo", name };
};

exports.listTables = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(
      "SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_SCHEMA, TABLE_NAME"
    );
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send("DB Error");
  }
};

exports.listColumns = async (req, res) => {
  const { table } = req.params;
  const { schema, name } = splitSchemaName(table);

  if (!name) {
    return res.status(400).json({ message: "Table name is required" });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("schema", sql.VarChar, schema)
      .input("table", sql.VarChar, name)
      .query(
        "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE " +
        "FROM INFORMATION_SCHEMA.COLUMNS " +
        "WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table " +
        "ORDER BY ORDINAL_POSITION"
      );
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send("DB Error");
  }
};

exports.listProcedures = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(
      "SELECT SCHEMA_NAME(schema_id) AS schema_name, name AS procedure_name " +
      "FROM sys.procedures ORDER BY schema_name, procedure_name"
    );
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send("DB Error");
  }
};

exports.getProcedureDefinition = async (req, res) => {
  const { name: procName } = req.params;
  const { schema, name } = splitSchemaName(procName);

  if (!name) {
    return res.status(400).json({ message: "Procedure name is required" });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("schema", sql.VarChar, schema)
      .input("proc", sql.VarChar, name)
      .query(
        "SELECT OBJECT_DEFINITION(OBJECT_ID(QUOTENAME(@schema) + '.' + QUOTENAME(@proc))) AS definition"
      );

    const definition = result.recordset[0]?.definition || null;
    res.json({ schema, name, definition });
  } catch (err) {
    console.error(err);
    res.status(500).send("DB Error");
  }
};
