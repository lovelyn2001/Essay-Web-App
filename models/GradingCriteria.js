// models/GradingCriteria.js

const mongoose = require('mongoose');

// Define the grading criteria schema
const GradingCriteriaSchema = new mongoose.Schema({
    essayId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Essay',
        required: true
    },
    criteria: {
        type: String,
        required: true  // Description of the grading criteria
    },
    weightings: {
        type: [Number],
        required: true  // An array of weightings for each criterion
    }
}, {
    timestamps: true  // Automatically add createdAt and updatedAt fields
});

// Export the model
const GradingCriteria = mongoose.model('GradingCriteria', GradingCriteriaSchema);
module.exports = GradingCriteria;
