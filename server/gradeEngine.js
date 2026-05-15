export const GRADE_SCALE = 10;
export const DEFAULT_WEIGHTS = {
  quizzes: 0.1,
  midterm: 0.3,
  final: 0.6,
};
export const QUIZ_MAX_POINTS = [7, 8, 7, 7, 7, 7, 7, 7, 7, 7];
export const MIDTERM_RESCALED_MAX_POINTS = 85;
export const MIDTERM_REPORTED_MAX_POINTS = 90;
export const MIDTERM_ACTUAL_MAX_POINTS = 94;
export const FINAL_DEFAULT_MAX_POINTS = 100;
export const TARGET_GRADES = Array.from({ length: 19 }, (_, index) => (index + 2) / 2);

function clamp(value, min, max) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return min;
  }
  return Math.min(Math.max(numericValue, min), max);
}

function component(name, points, maxPoints) {
  const safeMaxPoints = Math.max(Number(maxPoints) || 0, 0.01);
  const safePoints = clamp(points, 0, safeMaxPoints);
  const percent = safePoints / safeMaxPoints;

  return {
    name,
    points: safePoints,
    maxPoints: safeMaxPoints,
    percent,
    grade: percent * GRADE_SCALE,
  };
}

function weightedGrade(components, weights) {
  return Object.entries(weights).reduce(
    (total, [key, weight]) => total + components[key].grade * weight,
    0,
  );
}

function flexiWeights(components) {
  const weights = { ...DEFAULT_WEIGHTS };
  const orderedNames = ["quizzes", "midterm", "final"];
  const weakest = orderedNames.reduce((currentWeakest, name) =>
    components[name].grade < components[currentWeakest].grade ? name : currentWeakest,
  );
  const strongest = orderedNames.reduce((currentStrongest, name) =>
    components[name].grade > components[currentStrongest].grade ? name : currentStrongest,
  );

  if (weakest !== strongest) {
    weights[weakest] -= 0.1;
    weights[strongest] += 0.1;
  }

  return weights;
}

export function buildResult({
  quizScores,
  midtermPoints,
  finalPoints,
  finalMaxPoints = FINAL_DEFAULT_MAX_POINTS,
}) {
  const normalizedQuizScores = QUIZ_MAX_POINTS.map((maxPoints, index) =>
    clamp(quizScores[index], 0, maxPoints),
  );
  const quizPoints = normalizedQuizScores.reduce((total, score) => total + score, 0);
  const quizMaxPoints = QUIZ_MAX_POINTS.reduce((total, score) => total + score, 0);

  const components = {
    quizzes: component("Quizzes", quizPoints, quizMaxPoints),
    midterm: component("Midterm", midtermPoints, MIDTERM_RESCALED_MAX_POINTS),
    final: component("Final exam", finalPoints, finalMaxPoints),
  };
  const normalWeights = { ...DEFAULT_WEIGHTS };
  const flexibleWeights = flexiWeights(components);

  return {
    components,
    normalWeights,
    flexiWeights: flexibleWeights,
    normalGrade: weightedGrade(components, normalWeights),
    flexiGrade: weightedGrade(components, flexibleWeights),
  };
}

export function buildStatistics({ quizScores, midtermPoints }) {
  const scenarios = Array.from({ length: 21 }, (_, index) => {
    const finalPercent = index * 5;
    const result = buildResult({
      quizScores,
      midtermPoints,
      finalPoints: finalPercent,
      finalMaxPoints: 100,
    });

    return {
      finalPercent,
      normalGrade: result.normalGrade,
      flexiGrade: result.flexiGrade,
      flexiWeights: result.flexiWeights,
    };
  });

  const requiredFinalPercentages = TARGET_GRADES.map((targetGrade) => ({
    targetGrade,
    requiredFinalPercent: requiredFinalPercentForTarget({
      quizScores,
      midtermPoints,
      targetGrade,
    }),
  }));

  const current = buildResult({
    quizScores,
    midtermPoints,
    finalPoints: 0,
    finalMaxPoints: 100,
  });
  const best = buildResult({
    quizScores,
    midtermPoints,
    finalPoints: 100,
    finalMaxPoints: 100,
  });

  return {
    known: {
      quizzes: current.components.quizzes,
      midterm: current.components.midterm,
    },
    range: {
      minimumFlexiGrade: current.flexiGrade,
      maximumFlexiGrade: best.flexiGrade,
      maximumFlexiWeights: best.flexiWeights,
    },
    scenarios,
    requiredFinalPercentages,
  };
}

function requiredFinalPercentForTarget({ quizScores, midtermPoints, targetGrade }) {
  for (let finalPercent = 0; finalPercent <= 1000; finalPercent += 1) {
    const normalizedFinalPercent = finalPercent / 10;
    const result = buildResult({
      quizScores,
      midtermPoints,
      finalPoints: normalizedFinalPercent,
      finalMaxPoints: 100,
    });

    if (result.flexiGrade >= targetGrade) {
      return normalizedFinalPercent;
    }
  }

  return null;
}

export function summarizeRules() {
  return {
    quizMaxPoints: QUIZ_MAX_POINTS,
    midtermRescaledMaxPoints: MIDTERM_RESCALED_MAX_POINTS,
    midtermReportedMaxPoints: MIDTERM_REPORTED_MAX_POINTS,
    midtermActualMaxPoints: MIDTERM_ACTUAL_MAX_POINTS,
    defaultWeights: DEFAULT_WEIGHTS,
    targetGrades: TARGET_GRADES,
  };
}
