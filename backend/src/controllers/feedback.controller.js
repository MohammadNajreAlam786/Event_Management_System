import { asyncHandler } from '../utils/asyncHandler.js';
import * as feedbackService from '../services/feedback.service.js';

/* ---------------- Participant (USER, own feedback only) ---------------- */

/** GET /api/events/:id/feedback/mine */
export const getMine = asyncHandler(async (req, res) => {
  const data = await feedbackService.getMyFeedbackForEvent({
    userId: req.user.id,
    eventId: req.params.id,
  });
  res.status(200).json({ success: true, data });
});

/** POST /api/events/:id/feedback */
export const submit = asyncHandler(async (req, res) => {
  const data = await feedbackService.submitFeedback({
    userId: req.user.id,
    eventId: req.params.id,
    rating: req.body?.rating,
    comment: req.body?.comment,
  });
  res.status(201).json({ success: true, data, message: 'Feedback submitted successfully.' });
});

/** PATCH /api/events/:id/feedback/:feedbackId */
export const update = asyncHandler(async (req, res) => {
  const data = await feedbackService.updateFeedback({
    userId: req.user.id,
    eventId: req.params.id,
    feedbackId: req.params.feedbackId,
    rating: req.body?.rating,
    comment: req.body?.comment,
  });
  res.status(200).json({ success: true, data, message: 'Feedback updated.' });
});

/* ---------------- Organiser (owner of the event) ---------------- */

/** GET /api/events/:id/feedback */
export const listForEvent = asyncHandler(async (req, res) => {
  const data = await feedbackService.listEventFeedback({
    organiserId: req.user.id,
    eventId: req.params.id,
  });
  res.status(200).json({ success: true, data });
});
