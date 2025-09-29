const Joi = require('joi');

const assessmentSchema = Joi.object({
  siteAddress: Joi.string().required().min(5).max(200),
  date: Joi.date().iso().required()
});

function validateAssessmentRequest(data) {
  return assessmentSchema.validate(data);
}

module.exports = {
  validateAssessmentRequest
};
