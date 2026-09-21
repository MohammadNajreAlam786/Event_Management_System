import EventTask from '../models/eventTask.model.js';
import EventResource from '../models/eventResource.model.js';
import EventBudgetItem from '../models/eventBudgetItem.model.js';
import EventTeamMember from '../models/eventTeamMember.model.js';
import { listSchedule, getReadiness } from './planning.service.js';
import { ApiError } from '../utils/apiError.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * AI Planning Assistant (Phase 5).
 *
 * Flow:  controller -> gatherAiContext (reads Phase 4 planning data + the
 * existing readiness score) -> requestAnalysis (POSTs that JSON to the FastAPI
 * service) -> normalised structured result back to the controller.
 *
 * The AI service is called server-to-server. No database credentials, auth
 * tokens or user records are sent — only the planning content it needs.
 * Readiness is NOT recomputed here: getReadiness() (the Phase 4 calculation)
 * is the single source of truth and is passed through for the AI to explain.
 */

const MAX_ITEMS = 200; // bound the payload; planning lists are small in practice

const isOverdue = (t) => Boolean(t.dueDate && t.status !== 'COMPLETED' && new Date(t.dueDate) < new Date());

/** Build the exact structured payload the AI service expects. */
export const gatherAiContext = async (eventId, event) => {
  const [tasks, scheduleView, resources, budget, team, readiness] = await Promise.all([
    EventTask.find({ event: eventId }).sort({ createdAt: 1 }).limit(MAX_ITEMS).lean(),
    listSchedule(eventId),
    EventResource.find({ event: eventId }).sort({ createdAt: 1 }).limit(MAX_ITEMS).lean(),
    EventBudgetItem.find({ event: eventId }).sort({ createdAt: 1 }).limit(MAX_ITEMS).lean(),
    EventTeamMember.find({ event: eventId }).sort({ createdAt: 1 }).limit(MAX_ITEMS).lean(),
    getReadiness(eventId),
  ]);

  return {
    event: {
      title: event.title ?? '',
      description: event.description ?? '',
      startDate: event.startDate ?? null,
      endDate: event.endDate ?? null,
      venue: event.venue ?? '',
      status: event.status ?? '',
    },
    tasks: tasks.map((t) => ({
      title: t.title ?? '',
      description: t.description ?? '',
      priority: t.priority ?? 'MEDIUM',
      status: t.status ?? 'TODO',
      dueDate: t.dueDate ?? null,
      assignedTo: t.assignedTo ?? '',
      overdue: isOverdue(t),
    })),
    schedule: (scheduleView.schedule ?? []).map((s) => ({
      title: s.title ?? '',
      startTime: s.startTime ?? null,
      endTime: s.endTime ?? null,
      location: s.location ?? '',
      type: s.type ?? 'SESSION',
      conflictCount: Array.isArray(s.conflictsWith) ? s.conflictsWith.length : 0,
    })),
    resources: resources.map((r) => ({
      name: r.name ?? '',
      category: r.category ?? 'OTHER',
      quantity: r.quantity ?? 1,
      unit: r.unit ?? '',
      status: r.status ?? 'REQUIRED',
      estimatedUnitCost: r.estimatedUnitCost ?? 0,
      estimatedTotalCost: (r.quantity ?? 0) * (r.estimatedUnitCost ?? 0),
    })),
    budget: budget.map((b) => ({
      category: b.category ?? 'MISCELLANEOUS',
      description: b.description ?? '',
      estimatedAmount: b.estimatedAmount ?? 0,
      actualAmount: b.actualAmount ?? null,
      status: b.status ?? 'PLANNED',
    })),
    team: team.map((m) => ({
      name: m.name ?? '',
      role: m.role ?? '',
      responsibility: m.responsibility ?? '',
      status: m.status ?? 'INVITED',
    })),
    readiness: {
      overallScore: readiness.overallScore,
      status: readiness.status,
      components: readiness.components,
      weights: readiness.weights,
    },
  };
};

const AI_UNAVAILABLE = 'AI planning assistance is temporarily unavailable.';

/** POST the context to the FastAPI service and return its structured result. */
const requestAnalysis = async (context) => {
  let res;
  try {
    res = await fetch(`${env.ai.serviceUrl}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context),
      signal: AbortSignal.timeout(env.ai.timeoutMs),
    });
  } catch (err) {
    // Network refused, DNS, or timeout — never surface the detail to the client.
    logger.warn(`AI service call failed: ${err.name || 'Error'} ${err.message}`);
    throw new ApiError(503, AI_UNAVAILABLE);
  }

  if (!res.ok) {
    logger.warn(`AI service responded ${res.status}`);
    throw new ApiError(503, AI_UNAVAILABLE);
  }

  let body;
  try {
    body = await res.json();
  } catch {
    logger.warn('AI service returned a non-JSON body');
    throw new ApiError(503, AI_UNAVAILABLE);
  }

  if (
    !body ||
    typeof body.summary !== 'string' ||
    !Array.isArray(body.recommendations) ||
    !Array.isArray(body.risks)
  ) {
    logger.warn('AI service returned an unexpected shape');
    throw new ApiError(503, AI_UNAVAILABLE);
  }

  return body;
};

/** Orchestrate a full analysis for one owned event. */
export const analyzeEventPlan = async (eventId, event) => {
  const context = await gatherAiContext(eventId, event);
  const result = await requestAnalysis(context);

  return {
    method: result.method || 'rule-based',
    engine: result.engine || 'heuristic-planning-analyzer',
    priority: result.priority || 'LOW',
    summary: result.summary,
    readinessAssessment: result.readinessAssessment || '',
    recommendations: result.recommendations,
    risks: result.risks,
    readiness: {
      overallScore: context.readiness.overallScore,
      status: context.readiness.status,
    },
    basedOn: {
      tasks: context.tasks.length,
      schedule: context.schedule.length,
      resources: context.resources.length,
      budget: context.budget.length,
      team: context.team.length,
    },
    generatedAt: new Date().toISOString(),
  };
};
