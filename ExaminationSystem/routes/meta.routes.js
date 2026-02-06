const express = require("express");
const router = express.Router();
const metaController = require("../controllers/meta.controller");

router.get("/tables", metaController.listTables);
router.get("/tables/:table/columns", metaController.listColumns);
router.get("/procedures", metaController.listProcedures);
router.get("/procedures/:name", metaController.getProcedureDefinition);

module.exports = router;
