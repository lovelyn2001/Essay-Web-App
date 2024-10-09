// models/Essay.js

const mongoose = require('mongoose');

// Define the essay schema
const EssaySchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    course: {
        type: String,
        required: true
    },
    instructions: {
        type: String
    },
    filePath: {
        type: String,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    gradingCriteria: {
        type: String,
        default: ''  // Instructors set this
    },
    weightings: {
        type: [Number],
        default: []  // Criteria weightings
    },
    adjustedScore: {
        type: Number,
        default: null  // Instructors can manually adjust the score
    },
    feedback: {
        type: String,
        default: ''  // Feedback from instructors
    },
    plagiarismThreshold: {
        type: Number,
        default: 0  // Plagiarism threshold for this essay
    }
}, {
    timestamps: true  // Automatically add createdAt and updatedAt fields
});

// Export the model
const Essay = mongoose.model('Essay', EssaySchema);
module.exports = Essay;
