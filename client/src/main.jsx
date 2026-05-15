import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertCircle,
  BarChart3,
  BookOpenCheck,
  Calculator,
  Github,
  GraduationCap,
  Info,
  Percent,
  Sigma,
} from "lucide-react";
import "./styles.css";

const QUIZ_MAX_POINTS = [7, 8, 7, 7, 7, 7, 7, 7, 7, 7];
const MIDTERM_MAX_POINTS = 85;
const TARGET_GRADES = Array.from({ length: 19 }, (_, index) => (index + 2) / 2);

const initialQuizScores = Array(QUIZ_MAX_POINTS.length).fill("");

function clamp(value, min, max) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return min;
  }
  return Math.min(Math.max(numericValue, min), max);
}

function roundHalfUp(value) {
  return Math.floor(value + 0.5);
}

function formatGrade(value) {
  return `${value.toFixed(2)}/10`;
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function gradeStatus(grade) {
  if (grade <= 3.5) {
    return "fail";
  }

  if (grade < 6) {
    return "retake";
  }

  return "pass";
}

function statusLabel(status) {
  return {
    fail: "Fail",
    retake: "Retake",
    pass: "Pass",
  }[status];
}

function component(name, points, maxPoints) {
  const safePoints = clamp(points, 0, maxPoints);
  const percent = safePoints / maxPoints;

  return {
    name,
    points: safePoints,
    maxPoints,
    percent,
    grade: percent * 10,
  };
}

function flexiWeights(components) {
  const weights = { quizzes: 0.1, midterm: 0.3, final: 0.6 };
  const names = ["quizzes", "midterm", "final"];
  const weakest = names.reduce((current, name) =>
    components[name].grade < components[current].grade ? name : current,
  );
  const strongest = names.reduce((current, name) =>
    components[name].grade > components[current].grade ? name : current,
  );

  if (weakest !== strongest) {
    weights[weakest] -= 0.1;
    weights[strongest] += 0.1;
  }

  return weights;
}

function weightedGrade(components, weights) {
  return Object.entries(weights).reduce(
    (total, [key, weight]) => total + components[key].grade * weight,
    0,
  );
}

function buildResult({ quizScores, midtermPoints, finalPoints, finalMaxPoints = 100 }) {
  const quizPoints = quizScores.reduce(
    (total, score, index) => total + clamp(score, 0, QUIZ_MAX_POINTS[index]),
    0,
  );
  const quizMaxPoints = QUIZ_MAX_POINTS.reduce((total, maxPoints) => total + maxPoints, 0);
  const components = {
    quizzes: component("Quizzes", quizPoints, quizMaxPoints),
    midterm: component("Midterm", midtermPoints, MIDTERM_MAX_POINTS),
    final: component("Final exam", finalPoints, finalMaxPoints),
  };
  const normalWeights = { quizzes: 0.1, midterm: 0.3, final: 0.6 };
  const flexibleWeights = flexiWeights(components);

  return {
    components,
    normalWeights,
    flexiWeights: flexibleWeights,
    normalGrade: weightedGrade(components, normalWeights),
    flexiGrade: weightedGrade(components, flexibleWeights),
  };
}

function finalPercentForTarget({ quizScores, midtermPoints, targetGrade }) {
  for (let tenthPercent = 0; tenthPercent <= 1000; tenthPercent += 1) {
    const finalPercent = tenthPercent / 10;
    const result = buildResult({
      quizScores,
      midtermPoints,
      finalPoints: finalPercent,
      finalMaxPoints: 100,
    });

    if (result.flexiGrade >= targetGrade) {
      return finalPercent;
    }
  }

  return null;
}

function NumberCell({ label, value, max, onChange, showMax = true }) {
  return (
    <label className="number-cell">
      <span>{label}</span>
      <input
        type="number"
        min="0"
        max={max}
        step="0.1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {showMax ? <small>/ {max}</small> : null}
    </label>
  );
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

function Metric({ icon: Icon, label, value, detail }) {
  return (
    <section className="metric">
      <Icon size={18} aria-hidden="true" />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {detail ? <small>{detail}</small> : null}
      </div>
    </section>
  );
}

function WeightText({ weights }) {
  return (
    <span>
      {formatPercent(weights.quizzes)} / {formatPercent(weights.midterm)} /{" "}
      {formatPercent(weights.final)}
    </span>
  );
}

function GradeWithStatus({ grade, emphasis = false }) {
  const status = gradeStatus(grade);

  return (
    <span className={`grade-status grade-status-${status}${emphasis ? " strong" : ""}`}>
      <span>{formatGrade(grade)}</span>
      <span className="status-pill">{statusLabel(status)}</span>
    </span>
  );
}

function App() {
  const [quizScores, setQuizScores] = useState(initialQuizScores);
  const [midtermPoints, setMidtermPoints] = useState("");
  const [finalPoints, setFinalPoints] = useState("");
  const [finalMaxPoints, setFinalMaxPoints] = useState(100);
  const [apiStatistics, setApiStatistics] = useState(null);
  const [apiActualResult, setApiActualResult] = useState(null);
  const [apiOnline, setApiOnline] = useState(false);

  const quizTotal = useMemo(
    () =>
      quizScores.reduce(
        (total, score, index) => total + clamp(score, 0, QUIZ_MAX_POINTS[index]),
        0,
      ),
    [quizScores],
  );
  const quizMax = QUIZ_MAX_POINTS.reduce((total, maxPoints) => total + maxPoints, 0);

  const beforeFinal = useMemo(
    () =>
      buildResult({
        quizScores,
        midtermPoints,
        finalPoints: 0,
        finalMaxPoints: 100,
      }),
    [quizScores, midtermPoints],
  );

  const bestCase = useMemo(
    () =>
      buildResult({
        quizScores,
        midtermPoints,
        finalPoints: 100,
        finalMaxPoints: 100,
      }),
    [quizScores, midtermPoints],
  );

  const scenarios = useMemo(
    () =>
      Array.from({ length: 21 }, (_, index) => {
        const finalPercent = index * 5;
        return {
          finalPercent,
          ...buildResult({
            quizScores,
            midtermPoints,
            finalPoints: finalPercent,
            finalMaxPoints: 100,
          }),
        };
      }),
    [quizScores, midtermPoints],
  );

  const targets = useMemo(
    () =>
      TARGET_GRADES.map((targetGrade) => ({
        targetGrade,
        finalPercent: finalPercentForTarget({ quizScores, midtermPoints, targetGrade }),
      })),
    [quizScores, midtermPoints],
  );

  const actualResult = useMemo(
    () =>
      buildResult({
        quizScores,
        midtermPoints,
        finalPoints,
        finalMaxPoints,
      }),
    [quizScores, midtermPoints, finalPoints, finalMaxPoints],
  );
  const visibleKnown = apiStatistics?.known ?? {
    quizzes: beforeFinal.components.quizzes,
    midterm: beforeFinal.components.midterm,
  };
  const visibleRange = apiStatistics?.range ?? {
    minimumFlexiGrade: beforeFinal.flexiGrade,
    maximumFlexiGrade: bestCase.flexiGrade,
    maximumFlexiWeights: bestCase.flexiWeights,
  };
  const visibleScenarios = apiStatistics?.scenarios ?? scenarios;
  const visibleTargets = apiStatistics?.requiredFinalPercentages ?? targets;
  const visibleActualResult = apiActualResult ?? actualResult;

  useEffect(() => {
    let ignore = false;

    postJson("/api/statistics", { quizScores, midtermPoints })
      .then((statistics) => {
        if (!ignore) {
          setApiStatistics(statistics);
          setApiOnline(true);
        }
      })
      .catch(() => {
        if (!ignore) {
          setApiOnline(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [quizScores, midtermPoints]);

  useEffect(() => {
    let ignore = false;

    postJson("/api/actual-grade", {
      quizScores,
      midtermPoints,
      finalPoints,
      finalMaxPoints,
    })
      .then((result) => {
        if (!ignore) {
          setApiActualResult(result);
          setApiOnline(true);
        }
      })
      .catch(() => {
        if (!ignore) {
          setApiOnline(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [quizScores, midtermPoints, finalPoints, finalMaxPoints]);

  function updateQuizScore(index, value) {
    setQuizScores((currentScores) =>
      currentScores.map((score, currentIndex) =>
        currentIndex === index ? value : score,
      ),
    );
  }

  return (
    <main>
      <header className="topbar">
        <div>
          <p className="eyebrow">Information Security</p>
          <h1>Grade Simulator</h1>
        </div>
        <a className="repo-link" href="https://github.com" aria-label="GitHub repository">
          <Github size={18} />
          {apiOnline ? "API online" : "Local fallback"}
        </a>
      </header>

      <section className="input-band">
        <div className="section-heading">
          <BookOpenCheck size={22} aria-hidden="true" />
          <div>
            <h2>Known Scores</h2>
            <p>Enter every known value. Missing quizzes can stay at zero.</p>
          </div>
        </div>

        <div className="quiz-grid" aria-label="Quiz score inputs">
          {QUIZ_MAX_POINTS.map((maxPoints, index) => (
            <NumberCell
              key={index}
              label={`Q${index + 1}`}
              value={quizScores[index]}
              max={maxPoints}
              onChange={(value) => updateQuizScore(index, value)}
            />
          ))}
        </div>

        <div className="exam-row">
          <NumberCell
            label="Midterm"
            value={midtermPoints}
            max={MIDTERM_MAX_POINTS}
            onChange={setMidtermPoints}
          />
          <div className="rule-note">
            <Info size={18} aria-hidden="true" />
            <span>Midterm denominator fixed to 85 after professor rescaling.</span>
          </div>
        </div>
      </section>

      <section className="metrics-row" aria-label="Current grade summary">
        <Metric
          icon={Sigma}
          label="Quiz total"
          value={`${quizTotal.toFixed(1)} / ${quizMax}`}
          detail={formatGrade(visibleKnown.quizzes.grade)}
        />
        <Metric
          icon={Percent}
          label="Midterm"
          value={`${clamp(midtermPoints, 0, MIDTERM_MAX_POINTS).toFixed(1)} / 85`}
          detail={formatGrade(visibleKnown.midterm.grade)}
        />
        <Metric
          icon={BarChart3}
          label="Outcome range"
          value={`${formatGrade(visibleRange.minimumFlexiGrade)} - ${formatGrade(
            visibleRange.maximumFlexiGrade,
          )}`}
          detail="Flexi grade, final from 0% to 100%"
        />
      </section>

      <section className="content-grid">
        <div className="panel wide">
          <div className="section-heading">
            <BarChart3 size={22} aria-hidden="true" />
            <div>
              <h2>Possible Outcomes</h2>
              <p>Final exam percentages mapped to the resulting course grade.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Final</th>
                  <th>Normal</th>
                  <th>Flexi</th>
                  <th>Flexi weights Q / M / F</th>
                </tr>
              </thead>
              <tbody>
                {visibleScenarios.map((scenario) => (
                  <tr key={scenario.finalPercent}>
                    <td>{scenario.finalPercent}%</td>
                    <td>
                      <GradeWithStatus grade={scenario.normalGrade} />
                    </td>
                    <td>
                      <GradeWithStatus grade={scenario.flexiGrade} emphasis />
                    </td>
                    <td>
                      <WeightText weights={scenario.flexiWeights} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="section-heading">
            <GraduationCap size={22} aria-hidden="true" />
            <div>
              <h2>Targets</h2>
              <p>Required final percentage for every half grade.</p>
            </div>
          </div>
          <div className="target-list">
            {visibleTargets.map((target) => {
              const requiredPercent = target.finalPercent ?? target.requiredFinalPercent;
              const isReachable = requiredPercent != null;
              const status = gradeStatus(target.targetGrade);

              return (
                <div
                  className={`target-row ${
                    isReachable ? `target-row-${status}` : "target-row-unreachable"
                  }`}
                  key={target.targetGrade}
                >
                  <span>{target.targetGrade.toFixed(1)}/10</span>
                  <strong className={isReachable ? "" : "not-reachable"}>
                    {isReachable ? `${roundHalfUp(requiredPercent)}%` : "Not reachable"}
                  </strong>
                  <small>{statusLabel(status)}</small>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="actual-band">
        <div className="section-heading">
          <Calculator size={22} aria-hidden="true" />
          <div>
            <h2>After The Final</h2>
            <p>Enter the final numerator and denominator after any announced rescaling.</p>
          </div>
        </div>

        <div className="actual-layout">
          <div className="actual-inputs">
            <NumberCell
              label="Final points"
              value={finalPoints}
              max={finalMaxPoints}
              onChange={setFinalPoints}
              showMax={false}
            />
            <NumberCell
              label="Final denominator"
              value={finalMaxPoints}
              max={200}
              onChange={setFinalMaxPoints}
              showMax={false}
            />
          </div>

          <div className="actual-result">
            <span>Actual Flexi Grade</span>
            <strong>
              <GradeWithStatus grade={visibleActualResult.flexiGrade} emphasis />
            </strong>
            <small>
              Normal: {formatGrade(visibleActualResult.normalGrade)} · weights{" "}
              <WeightText weights={visibleActualResult.flexiWeights} />
            </small>
          </div>
        </div>
      </section>

      <section className="notes-band">
        <AlertCircle size={20} aria-hidden="true" />
        <p>
          Final exam covers the whole course, including midterm material. Quiz 2 is worth
          8 points; the other quizzes are worth 7 points.
        </p>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
