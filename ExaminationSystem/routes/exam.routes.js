const express = require("express");
const router = express.Router();
const examController = require("../controllers/exam.controller");

router.get("/courses/:st_id", examController.getStudentCourses);
router.get("/random-by-course", examController.getRandomExamByCourse);
router.post("/submit", examController.submitExam);
router.get("/review", examController.reviewExam);

module.exports = router;
