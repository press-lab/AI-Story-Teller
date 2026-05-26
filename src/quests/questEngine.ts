import type { Quest, QuestStep } from "../types/adventure";
import { nowIso } from "../utils/id";

function touchQuest(quest: Quest): Quest {
  return { ...quest, updatedAt: nowIso() };
}

function firstPlayableStep(steps: QuestStep[]): QuestStep | undefined {
  return steps.find((step) => step.status !== "completed" && step.status !== "failed") ?? steps[0];
}

export function startQuest(quest: Quest): Quest {
  const firstStep = firstPlayableStep(quest.steps);
  const steps = quest.steps.map((step) => ({
    ...step,
    status: firstStep && step.id === firstStep.id ? ("active" as const) : step.status === "active" ? ("pending" as const) : step.status,
  }));

  return touchQuest({
    ...quest,
    status: "active",
    currentStepId: firstStep?.id,
    steps,
  });
}

export function progressQuest(quest: Quest, stepId?: string): Quest {
  if (quest.status === "completed" || quest.status === "failed") return quest;

  const currentStepId = stepId ?? quest.currentStepId ?? quest.steps.find((step) => step.status === "active")?.id;
  if (!currentStepId) return startQuest(quest);

  const currentIndex = quest.steps.findIndex((step) => step.id === currentStepId);
  if (currentIndex === -1) return quest;

  const nextStep = quest.steps.slice(currentIndex + 1).find((step) => step.status !== "completed");
  const steps = quest.steps.map((step) => {
    if (step.id === currentStepId) return { ...step, status: "completed" as const };
    if (nextStep && step.id === nextStep.id) return { ...step, status: "active" as const };
    if (step.status === "active") return { ...step, status: "pending" as const };
    return step;
  });

  return touchQuest({
    ...quest,
    status: nextStep ? "active" : "completed",
    currentStepId: nextStep?.id,
    steps,
  });
}

export function completeQuest(quest: Quest): Quest {
  return touchQuest({
    ...quest,
    status: "completed",
    currentStepId: undefined,
    steps: quest.steps.map((step) => ({ ...step, status: step.status === "failed" ? step.status : "completed" })),
  });
}

export function failQuest(quest: Quest): Quest {
  return touchQuest({
    ...quest,
    status: "failed",
    steps: quest.steps.map((step) => (step.status === "active" ? { ...step, status: "failed" } : step)),
  });
}

export function getCurrentQuestObjective(quests: Quest[]): string {
  const activeQuest = quests.find((quest) => quest.status === "active");
  if (!activeQuest) return "No active quest objective.";
  const activeStep = activeQuest.steps.find((step) => step.id === activeQuest.currentStepId);
  if (!activeStep) return activeQuest.description || activeQuest.title;
  return `${activeQuest.title}: ${activeStep.objective || activeStep.title}`;
}
