const { poolPromise, sql } = require("../config/db");

const buildExamPayload = (exam, questions, choicesByQuestion) => ({
	exam,
	questions: questions.map(question => ({
		...question,
		choices: choicesByQuestion.get(question.Q_id) || []
	}))
});

const execProc = async (pool, name, inputs = []) => {
	const request = pool.request();
	inputs.forEach(({ key, type, value }) => {
		if (value !== undefined && value !== null) {
			request.input(key, type, value);
		}
	});
	return request.execute(name);
};

exports.getStudentCourses = async (req, res) => {
	const { st_id } = req.params;

	try {
		const pool = await poolPromise;

		const studCoursesResult = await execProc(pool, "SP_Select_Stud_Course", [
			{ key: "St_id", type: sql.Int, value: st_id }
		]);
		const coursesResult = await execProc(pool, "SP_Select_Course");
		const examsResult = await execProc(pool, "SP_Select_Exam");
		const examQuestionsResult = await execProc(pool, "SP_Select_ExamQuestions");
		const studentExamResult = await execProc(pool, "SP_Select_StudentExam");

		const studentCourses = studCoursesResult.recordset || [];
		const courses = coursesResult.recordset || [];
		const exams = examsResult.recordset || [];
		const examQuestions = examQuestionsResult.recordset || [];
		const studentExams = (studentExamResult.recordset || []).filter(
			row => row.st_id === Number(st_id)
		);

		const courseMap = new Map(courses.map(course => [course.Crs_id, course]));
		const examCourseMap = new Map(exams.map(exam => [exam.exam_id, exam.Crs_id]));
		const questionCountByCourse = new Map();
		const completedCourseIds = new Set();
		const gradeByCourse = new Map();

		studentExams.forEach(row => {
			const exam = exams.find(ex => ex.exam_id === row.exam_id);
			if (exam?.Crs_id) {
				completedCourseIds.add(exam.Crs_id);
				const gradeValue = row.grade ?? row.Grade ?? null;
				if (gradeValue !== null && gradeValue !== undefined) {
					gradeByCourse.set(exam.Crs_id, gradeValue);
				}
			}
		});

		examQuestions.forEach(row => {
			const courseId = examCourseMap.get(row.exam_id);
			if (!courseId) return;
			if (!questionCountByCourse.has(courseId)) questionCountByCourse.set(courseId, new Set());
			questionCountByCourse.get(courseId).add(row.Q_id);
		});

		const result = studentCourses
			.filter(row => row.St_id === Number(st_id))
			.map(row => {
				const course = courseMap.get(row.Crs_id) || {};
				return {
					Crs_id: row.Crs_id,
					name: course.name || course.Crs_name || "Course",
					crs_duration: course.crs_duration || null,
					total_questions: questionCountByCourse.get(row.Crs_id)?.size || 0,
					finished: completedCourseIds.has(row.Crs_id),
					grade: gradeByCourse.get(row.Crs_id) ?? null
				};
			});

		res.json(result);
	} catch (err) {
		console.error(err);
		res.status(500).send("DB Error");
	}
};

exports.getRandomExamByCourse = async (req, res) => {
	const { st_id, crs_id } = req.query;

	if (!st_id || !crs_id) {
		return res.status(400).json({ message: "st_id and crs_id are required" });
	}

	try {
		const pool = await poolPromise;

		const examResult = await execProc(pool, "Get_Random_Exam_By_Course", [
			{ key: "Crs_id", type: sql.Int, value: crs_id },
			{ key: "St_id", type: sql.Int, value: st_id }
		]);

		const statusRow = examResult.recordsets?.[0]?.[0] || null;
		if (statusRow?.Status === "Error") {
			return res.status(404).json({ message: statusRow.message || "No exam found for this course" });
		}

		const examInfo = examResult.recordsets?.[1]?.[0] || null;
		const rows = examResult.recordsets?.[2] || [];

		if (!examInfo) {
			return res.status(404).json({ message: "No exam found for this course" });
		}

		const questionsMap = new Map();
		const choicesByQuestion = new Map();

		rows.forEach(row => {
			if (!questionsMap.has(row.Q_id)) {
				questionsMap.set(row.Q_id, {
					Q_id: row.Q_id,
					Q_text: row.Q_text,
					Q_type: row.Q_type,
					mark: row.mark
				});
			}
			if (row.Ch_id) {
				if (!choicesByQuestion.has(row.Q_id)) choicesByQuestion.set(row.Q_id, []);
				choicesByQuestion.get(row.Q_id).push({
					Ch_id: row.Ch_id,
					text: row.Choice_Text
				});
			}
		});

		const questions = Array.from(questionsMap.values());
		const exam = {
			exam_id: examInfo.exam_id,
			exam_name: examInfo.exam_name,
			total_marks: examInfo.total_marks,
			Crs_id: examInfo.Crs_id,
			Course_Name: examInfo.Course_Name,
			Total_Questions: examInfo.Total_Questions,
			MCQ_Count: examInfo.MCQ_Count,
			TrueFalse_Count: examInfo.TrueFalse_Count
		};

		res.json(buildExamPayload(exam, questions, choicesByQuestion));
	} catch (err) {
		console.error(err);
		res.status(500).send("DB Error");
	}
};

exports.submitExam = async (req, res) => {
	const { st_id, exam_id, choice_ids } = req.body;

	if (!st_id || !exam_id || !Array.isArray(choice_ids)) {
		return res.status(400).json({ message: "Invalid payload" });
	}

	try {
		const pool = await poolPromise;
		const submitResult = await execProc(pool, "Submit_Exam_Answers", [
			{ key: "St_id", type: sql.Int, value: st_id },
			{ key: "Exam_id", type: sql.Int, value: exam_id },
			{ key: "Choice_IDs", type: sql.VarChar, value: choice_ids.join(",") }
		]);

		const submitStatus = submitResult.recordset?.[0] || null;
		if (submitStatus?.Status === "Error") {
			return res.status(400).json({ message: submitStatus.message || "Submit failed" });
		}

		const correctionResult = await execProc(pool, "Exam_Correction", [
			{ key: "St_id", type: sql.Int, value: st_id },
			{ key: "Exam_id", type: sql.Int, value: exam_id }
		]);

		const correctionStatus = correctionResult.recordset?.[0] || null;
		if (correctionStatus?.Status === "Error") {
			return res.status(400).json({ message: correctionStatus.message || "Correction failed" });
		}

		res.json({
			message: correctionStatus?.message || "Exam submitted",
			grade: correctionStatus?.Percentage ?? null,
			details: correctionStatus
		});
	} catch (err) {
		console.error(err);
		res.status(500).send("DB Error");
	}
};

exports.reviewExam = async (req, res) => {
	const { st_id, exam_id } = req.query;

	if (!st_id || !exam_id) {
		return res.status(400).json({ message: "st_id and exam_id are required" });
	}

	try {
		const pool = await poolPromise;
		const answersResult = await execProc(pool, "SP_Select_StudentAnswers");
		const questionsResult = await execProc(pool, "SP_Select_Question");
		const choicesResult = await execProc(pool, "SP_Select_Choice");
		const examQuestionsResult = await execProc(pool, "SP_Select_ExamQuestions");

		const answers = (answersResult.recordset || []).filter(
			row => row.st_id === Number(st_id) && row.exam_id === Number(exam_id)
		);
		const questions = new Map(
			(questionsResult.recordset || []).map(row => [row.Q_id, row])
		);
		const choices = (choicesResult.recordset || []).filter(row => row.Q_id);
		const examQuestions = (examQuestionsResult.recordset || []).filter(
			row => row.exam_id === Number(exam_id)
		);

		const correctChoiceByQuestion = new Map();
		choices.forEach(choice => {
			if (choice.is_correct === 1) correctChoiceByQuestion.set(choice.Q_id, choice);
		});

		const studentChoiceByQuestion = new Map();
		answers.forEach(answer => {
			const choice = choices.find(ch => ch.Ch_id === answer.Choise_id || ch.Ch_id === answer.Ch_id);
			studentChoiceByQuestion.set(answer.Q_id, choice || null);
		});

		const result = examQuestions.map(eq => {
			const question = questions.get(eq.Q_id) || {};
			const studentChoice = studentChoiceByQuestion.get(eq.Q_id) || {};
			const correctChoice = correctChoiceByQuestion.get(eq.Q_id) || {};
			return {
				Q_id: eq.Q_id,
				mark: question.mark,
				student_choice_id: studentChoice.Ch_id || null,
				student_choice_text: studentChoice.text || null,
				correct_choice_id: correctChoice.Ch_id || null,
				correct_choice_text: correctChoice.text || null
			};
		});

		res.json(result);
	} catch (err) {
		console.error(err);
		res.status(500).send("DB Error");
	}
};
