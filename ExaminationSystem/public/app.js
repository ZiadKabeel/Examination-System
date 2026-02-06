const getStoredStudent = () => {
  const raw = localStorage.getItem("student");
  return raw ? JSON.parse(raw) : null;
};

const saveStudent = student => {
  localStorage.setItem("student", JSON.stringify(student));
};

const logout = () => {
  localStorage.removeItem("student");
  localStorage.removeItem("lastExamId");
  Object.keys(localStorage)
    .filter(key => key.startsWith("exam_payload_"))
    .forEach(key => localStorage.removeItem(key));
  window.location.href = "/";
};

const showAlert = (el, message, type = "error") => {
  if (!el) return;
  el.textContent = message;
  el.classList.remove("hidden", "error", "success", "warning");
  el.classList.add(type);
};

const hideAlert = el => {
  if (!el) return;
  el.classList.add("hidden");
};

const page = document.body.dataset.page;

if (page === "login") {
  const form = document.getElementById("loginForm");
  const errorEl = document.getElementById("loginError");

  form.addEventListener("submit", async event => {
    event.preventDefault();
    hideAlert(errorEl);
    const formData = new FormData(form);
    const st_id = Number(formData.get("st_id"));
    const password = formData.get("password");

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ st_id, password })
      });
      const data = await response.json();

      if (!response.ok) {
        return showAlert(errorEl, data.message || "Login failed");
      }

      saveStudent(data.student);
      window.location.href = "/exam-ui";
    } catch (err) {
      showAlert(errorEl, "Login error. Please try again.");
    }
  });
}

if (page === "home") {
  const student = getStoredStudent();
  const welcome = document.getElementById("studentWelcome");
  const courseList = document.getElementById("courseList");
  const statusEl = document.getElementById("homeStatus");
  const logoutBtn = document.getElementById("logout");

  if (!student) {
    window.location.href = "/";
  } else {
    welcome.textContent = `Welcome, ${student.Fname} ${student.Lname}`;
  }

  const renderCourses = courses => {
    courseList.innerHTML = "";
    if (!courses.length) {
      courseList.innerHTML = "<p class=\"muted\">No courses registered.</p>";
      return;
    }
    const accents = ["accent-blue", "accent-green", "accent-purple", "accent-teal", "accent-indigo", "accent-orange"];
    courses.forEach((course, index) => {
      const card = document.createElement("div");
      card.className = `subject-card ${accents[index % accents.length]}`;
      const minutes = course.crs_duration ? `${30} Minutes` : "- Minutes";
      const questions = course.total_questions ? `${course.total_questions} Questions` : "- Questions";
      card.innerHTML = `
        <h3>${course.name}</h3>
        <p class="muted">Prepare for your examination in ${course.name}.</p>
        <div class="card-meta">
          <span>📄 ${questions}</span>
          <span>⏱ ${minutes}</span>
        </div>
      `;
      if (course.finished && course.grade !== null && course.grade !== undefined) {
        const gradeLine = document.createElement("div");
        gradeLine.className = "grade-line";
        gradeLine.textContent = `Grade: ${course.grade}%`;
        card.appendChild(gradeLine);
      }
      const btn = document.createElement("button");
      btn.className = "btn primary";
      if (course.finished) {
        btn.textContent = "Finished";
        btn.disabled = true;
        btn.classList.add("disabled");
      } else {
        btn.textContent = "Start Exam";
        btn.addEventListener("click", () => {
          window.location.href = `/exam-page?crs_id=${course.Crs_id}`;
        });
      }
      card.appendChild(btn);
      courseList.appendChild(card);
    });
  };

  const loadCourses = async () => {
    try {
      const response = await fetch(`/exam/courses/${student.St_id}`);
      const data = await response.json();
      if (!response.ok) {
        return showAlert(statusEl, data.message || "Failed to load courses");
      }
      renderCourses(data);
    } catch (err) {
      showAlert(statusEl, "Unable to load courses", "error");
    }
  };

  logoutBtn?.addEventListener("click", logout);
  loadCourses();
}

if (page === "exam") {
  const student = getStoredStudent();
  const examTitle = document.getElementById("examTitle");
  const examProgress = document.getElementById("examProgress");
  const questionTag = document.getElementById("questionTag");
  const questionText = document.getElementById("questionText");
  const questionMeta = document.getElementById("questionMeta");
  const choicesContainer = document.getElementById("choicesContainer");
  const answeredCount = document.getElementById("answeredCount");
  const nextBtn = document.getElementById("nextQuestion");
  const navGrid = document.getElementById("questionNav");
  const timerEl = document.getElementById("examTimer");
  const submitBtn = document.getElementById("submitExam");
  const statusEl = document.getElementById("submitStatus");
  const logoutBtn = document.getElementById("logout");

  let examPayload = null;
  let currentIndex = 0;
  let countdownInterval = null;
  const answersMap = new Map();

  const getExamStorageKey = crsId => `exam_payload_${student?.St_id || ""}_${crsId}`;

  if (!student) {
    window.location.href = "/";
  }

  const beforeUnloadHandler = event => {
    event.preventDefault();
    event.returnValue = "";
  };
  window.addEventListener("beforeunload", beforeUnloadHandler);

  const updateProgress = () => {
    if (!examPayload) return;
    const total = examPayload.questions.length;
    examProgress.textContent = `Question ${currentIndex + 1} of ${total}`;
    answeredCount.textContent = `${answersMap.size} of ${total} answered`;
  };

  const renderNavigator = () => {
    if (!examPayload) return;
    navGrid.innerHTML = "";
    examPayload.questions.forEach((question, index) => {
      const btn = document.createElement("button");
      btn.className = "nav-item";
      if (index === currentIndex) btn.classList.add("active");
      if (answersMap.has(question.Q_id)) btn.classList.add("answered");
      btn.textContent = String(index + 1);
      btn.addEventListener("click", () => {
        currentIndex = index;
        renderQuestion();
      });
      navGrid.appendChild(btn);
    });
  };

  const renderQuestion = () => {
    if (!examPayload) return;
    const question = examPayload.questions[currentIndex];
    const qType = question.Q_type || "Question";
    questionTag.textContent = qType === "t&f" ? "True / False" : "Multiple Choice";
    questionText.textContent = question.Q_text || `Question ${currentIndex + 1}`;
    questionMeta.textContent = `${question.mark} marks`;

    choicesContainer.innerHTML = "";
    if (!question.choices || question.choices.length === 0) {
      const warn = document.createElement("p");
      warn.className = "muted";
      warn.textContent = "No choices available for this question.";
      choicesContainer.appendChild(warn);
    } else {
      question.choices.forEach(choice => {
        const label = document.createElement("label");
        label.className = "choice-pill";

        const input = document.createElement("input");
        input.type = "radio";
        input.name = `q_${question.Q_id}`;
        input.value = choice.Ch_id;
        input.checked = answersMap.get(question.Q_id) === choice.Ch_id;
        input.addEventListener("change", () => {
          answersMap.set(question.Q_id, choice.Ch_id);
          renderNavigator();
          updateProgress();
        });

        const text = document.createElement("span");
        text.textContent = choice.text;

        label.appendChild(input);
        label.appendChild(text);
        choicesContainer.appendChild(label);
      });
    }

    updateProgress();
    renderNavigator();
  };

  const startTimer = minutes => {
    if (countdownInterval) clearInterval(countdownInterval);
    let remaining = minutes * 60;
    const render = () => {
      const min = String(Math.floor(remaining / 60)).padStart(2, "0");
      const sec = String(remaining % 60).padStart(2, "0");
      timerEl.textContent = `⏱ ${min}:${sec}`;
    };
    render();
    countdownInterval = setInterval(() => {
      if (remaining <= 0) {
        clearInterval(countdownInterval);
        return;
      }
      remaining -= 1;
      render();
    }, 1000);
  };

  const renderExam = payload => {
    examPayload = payload;
    currentIndex = 0;
    answersMap.clear();
    examTitle.textContent = payload.exam.Course_Name || payload.exam.exam_name || "Exam";
    startTimer(30);
    renderQuestion();
  };

  const submitExam = async () => {
    hideAlert(statusEl);
    const exam_id = Number(examPayload?.exam?.exam_id || 0);
    const crs_id = Number(examPayload?.exam?.Crs_id || 0);
    if (!exam_id) {
      return showAlert(statusEl, "Load an exam first", "warning");
    }

    const orderedChoices = examPayload.questions.map(question => {
      const selected = answersMap.get(question.Q_id);
      return selected ?? null;
    });

    if (orderedChoices.some(choice => !choice)) {
      return showAlert(statusEl, "Please answer all questions before submit", "warning");
    }

    try {
      const response = await fetch("/exam/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ st_id: student.St_id, exam_id, crs_id, choice_ids: orderedChoices })
      });
      const data = await response.json();
      if (!response.ok) {
        return showAlert(statusEl, data.message || "Submit failed");
      }
      localStorage.setItem("lastExamId", String(exam_id));
      if (crs_id) localStorage.setItem("lastCourseId", String(crs_id));
      if (crs_id) localStorage.removeItem(getExamStorageKey(crs_id));
      window.removeEventListener("beforeunload", beforeUnloadHandler);
      window.location.href = "/exam-ui";
    } catch (err) {
      showAlert(statusEl, "Submit error", "error");
    }
  };

  const loadExamByCourse = async crs_id => {
    hideAlert(statusEl);
    try {
      const response = await fetch(`/exam/random-by-course?st_id=${student.St_id}&crs_id=${crs_id}`);
      const data = await response.json();
      if (!response.ok) {
        return showAlert(statusEl, data.message || "Failed to load exam", "warning");
      }
      localStorage.setItem(getExamStorageKey(crs_id), JSON.stringify(data));
      renderExam(data);
    } catch (err) {
      showAlert(statusEl, "Unable to load exam", "error");
    }
  };

  submitBtn?.addEventListener("click", submitExam);
  nextBtn?.addEventListener("click", () => {
    if (!examPayload) return;
    if (currentIndex < examPayload.questions.length - 1) {
      currentIndex += 1;
      renderQuestion();
    }
  });
  logoutBtn?.addEventListener("click", logout);

  const params = new URLSearchParams(window.location.search);
  const crs_id = Number(params.get("crs_id") || 0);
  if (crs_id) {
    const cached = localStorage.getItem(getExamStorageKey(crs_id));
    if (cached) {
      try {
        const cachedPayload = JSON.parse(cached);
        renderExam(cachedPayload);
      } catch {
        localStorage.removeItem(getExamStorageKey(crs_id));
        loadExamByCourse(crs_id);
      }
    } else {
      loadExamByCourse(crs_id);
    }
  } else {
    showAlert(statusEl, "Missing course id", "warning");
  }
}

if (page === "review") {
  const student = getStoredStudent();
  const reviewTable = document.getElementById("reviewTable");
  const reviewStatus = document.getElementById("reviewStatus");
  const reviewMeta = document.getElementById("reviewMeta");
  const logoutBtn = document.getElementById("logout");

  if (!student) {
    window.location.href = "/";
  }

  const params = new URLSearchParams(window.location.search);
  const exam_id = Number(params.get("exam_id") || localStorage.getItem("lastExamId"));

  const renderTable = rows => {
    reviewTable.innerHTML = "";
    const head = document.createElement("div");
    head.className = "table-row table-head";
    head.innerHTML = "<div>Question</div><div>Your Answer</div><div>Correct Answer</div><div>Mark</div>";
    reviewTable.appendChild(head);

    rows.forEach(row => {
      const rowEl = document.createElement("div");
      rowEl.className = "table-row";
      const isCorrect = row.student_choice_id === row.correct_choice_id;
      rowEl.innerHTML = `
        <div>Q${row.Q_id}</div>
        <div>${row.student_choice_text || "-"} ${row.student_choice_id ? (isCorrect ? '<span class="tag correct">Correct</span>' : '<span class="tag wrong">Wrong</span>') : ""}</div>
        <div>${row.correct_choice_text || "-"}</div>
        <div>${row.mark}</div>
      `;
      reviewTable.appendChild(rowEl);
    });
  };

  const loadReview = async () => {
    if (!exam_id) {
      return showAlert(reviewStatus, "Submit an exam first to review it", "warning");
    }
    reviewMeta.textContent = `Exam ID: ${exam_id}`;

    try {
      const response = await fetch(`/exam/review?st_id=${student.St_id}&exam_id=${exam_id}`);
      const data = await response.json();
      if (!response.ok) {
        return showAlert(reviewStatus, data.message || "Failed to load review", "error");
      }
      renderTable(data);
    } catch (err) {
      showAlert(reviewStatus, "Review error", "error");
    }
  };

  logoutBtn?.addEventListener("click", logout);
  loadReview();
}
