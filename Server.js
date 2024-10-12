const express = require('express');
require('dotenv').config();
const multer = require('multer');
const bodyParser = require('body-parser');
const natural = require('natural');
const spelling = require('spelling');
const dictionary = require('spelling/dictionaries/en_US');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const fs = require('fs');
const mammoth = require('mammoth');
const PORT = process.env.PORT || 3030;

// MongoDB Connection
mongoose.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected successfully'))
.catch(error => console.error('MongoDB connection error:', error));

// Define Schemas
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    regNumber: { type: String, required: true, unique: true },
    department: { type: String, required: true }
});

const EssaySchema = new mongoose.Schema({
    title: { type: String, required: true },
    courseCode: { type: String, required: true },
    filePath: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    grade: {
        contentRelevanceScore: { type: Number, default: 0 },
        structureScore: { type: Number, default: 0 },
        grammarScore: { type: Number, default: 0 },
        analysisScore: { type: Number, default: 0 },
        totalScore: { type: Number, default: 0 },
        comments: { type: String, default: '' }
    }
});

const User = mongoose.model('User', UserSchema);
const Essay = mongoose.model('Essay', EssaySchema);

const app = express();

// Session Setup
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage: storage });

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'static')));

// Spelling Checker and Tokenizer
const spellingChecker = new spelling(dictionary);
const tokenizer = new natural.WordTokenizer();

// Helper Functions
function extractKeyPhrases(topic) {
    return topic.toLowerCase().split(/[\s,]+/);
}

function calculateGrammarScore(essayWords) {
    let spellingErrors = 0;

    essayWords.forEach(word => {
        console.log(`Processing word: ${word}`); // Log each word being processed

        // Check for repeated characters (e.g., "zzzzzz")
        const repeatedCharRegex = /(.)\1{2,}/;
        if (repeatedCharRegex.test(word)) {
            spellingErrors += 10; // Penalize for repeated characters
            console.log(`Word has repeated characters: ${word}`);
            return; // Skip further checks for this word
        }

        // Clean the word (remove non-alphabetic characters)
        const cleanWord = word.replace(/[^a-zA-Z]/g, '');
        console.log(`Checking spelling for: ${cleanWord}`); // Log the cleaned word

        // Only check valid words
        if (cleanWord.length > 0) {
            // Perform the word lookup
            try {
                const isValidWord = spellingChecker.lookup(cleanWord);
                console.log(`Lookup result for "${cleanWord}":`, isValidWord); // Log the result of the lookup

                // Check if the word is valid
                if (!isValidWord.found) {
                    spellingErrors += 10; // Penalize for invalid words
                    console.log(`Word is not valid: ${cleanWord}`); // Log invalid words
                } else {
                    console.log(`Word is valid: ${cleanWord}`); // Log valid words
                }
            } catch (error) {
                console.error(`Error checking spelling for word "${cleanWord}": ${error.message}`);
                spellingErrors += 10; // Penalize for lookup error
            }
        } else {
            console.log(`Skipped empty or non-alphanumeric word: ${word}`);
        }
    });

    // Determine the grammar score based on the number of spelling errors
    return spellingErrors <= 5 ? 20 :
           spellingErrors <= 10 ? 15 :
           spellingErrors <= 20 ? 10 : 5;
}



async function gradeEssay(topic, essayContent) {
    let contentRelevanceScore = 0, structureScore = 0, grammarScore = 0, analysisScore = 0;

    const keyPhrases = extractKeyPhrases(topic);
    const essayWords = tokenizer.tokenize(essayContent.toLowerCase());

    let relevantPhraseCount = keyPhrases.reduce((count, phrase) => {
        const regex = new RegExp(`\\b${phrase}\\b`, 'i');
        return regex.test(essayContent) ? count + 1 : count;
    }, 0);

    contentRelevanceScore = relevantPhraseCount >= 15 ? 30 :
                            relevantPhraseCount >= 10 ? 20 :
                            relevantPhraseCount > 5 ? 10 : 0;

    const paragraphs = essayContent.split(/\n+/).filter(para => para.trim().length > 50);
    structureScore = paragraphs.length >= 5 ? 25 :
                     paragraphs.length >= 3 ? 15 :
                     paragraphs.length > 0 ? 5 : 0;

    grammarScore = calculateGrammarScore(essayWords);

    const wordCount = essayWords.length;
    analysisScore = wordCount > 300 ? 25 :
                    wordCount > 150 ? 15 : 5;

    return {
        contentRelevanceScore,
        structureScore,
        grammarScore,
        analysisScore,
        totalScore: contentRelevanceScore + structureScore + grammarScore + analysisScore
    };
}

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'registration.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/dashboard', (req, res) => req.session.userId ? res.sendFile(path.join(__dirname, 'student-dashboard.html')) : res.redirect('/'));
app.get('/admin-login', (req, res) => res.sendFile(path.join(__dirname, 'admin-login.html')));
app.get('/admin-dashboard', (req, res) => res.sendFile(path.join(__dirname, 'admin-dashboard.html')));

// Fetch all submitted essays
app.get('/essays', async (req, res) => {
    try {
        const essays = await Essay.find().populate('userId', 'name regNumber department');
        res.json(essays);
    } catch (error) {
        console.error('Error fetching essays:', error);
        res.status(500).json({ message: 'Failed to fetch essays' });
    }
});

// Student registration
app.post('/register-student', async (req, res) => {
    const { name, regNumber, department } = req.body;
    const existingStudent = await User.findOne({ regNumber });
    if (existingStudent) return res.json({ success: false, message: 'Student already registered!' });
    
    const user = new User({ name, regNumber, department });
    await user.save();
    res.json({ success: true, message: 'Student registered successfully!' });
});

// Student login
app.post('/login-student', async (req, res) => {
    const { name, regNumber } = req.body;
    const user = await User.findOne({ name, regNumber });
    if (user) {
        req.session.userId = user._id;
        res.json({ success: true, message: 'Login successful!' });
    } else {
        res.json({ success: false, message: 'Invalid credentials!' });
    }
});

// Submit essay
app.post('/submit-essay', upload.single('essayFile'), async (req, res) => {
    const { title, courseCode } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });

    const filePath = req.file.path;
    const userId = req.session.userId;

    try {
        const result = await mammoth.extractRawText({ path: filePath });
        const essayContent = result.value;
        const grades = await gradeEssay(title, essayContent);

        const essay = new Essay({
            title,
            courseCode,
            filePath,
            userId,
            grade: grades
        });

        await essay.save();
        res.json({ success: true, message: 'Essay submitted successfully!' });
    } catch (error) {
        console.error('Error saving essay:', error);
        res.status(500).json({ success: false, message: 'Error submitting essay.' });
    }
});

// Update essay grade
app.post('/update-grade', async (req, res) => {
    const { essayId, newScores, comments } = req.body;
    try {
        const essay = await Essay.findById(essayId);
        if (!essay) return res.json({ success: false, message: 'Essay not found!' });

        Object.assign(essay.grade, {
            contentRelevanceScore: newScores[0],
            structureScore: newScores[1],
            grammarScore: newScores[2],
            analysisScore: newScores[3],
            totalScore: newScores.reduce((a, b) => a + b, 0),
            comments
        });

        await essay.save();
        res.json({ success: true, message: 'Grade updated successfully!' });
    } catch (error) {
        console.error('Error updating grade:', error);
        res.status(500).json({ success: false, message: 'Failed to update grade.' });
    }
});

// Add comment to essay
app.post('/add-comment', async (req, res) => {
    const { essayId, comment } = req.body;
    try {
        const essay = await Essay.findById(essayId);
        if (!essay) return res.json({ success: false, message: 'Essay not found!' });

        essay.grade.comments = comment;
        await essay.save();
        res.json({ success: true, message: 'Comment added successfully!' });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ success: false, message: 'Failed to add comment.' });
    }
});

// Download essay
app.get('/download/:essayId', async (req, res) => {
    try {
        const essay = await Essay.findById(req.params.essayId);
        if (!essay) return res.status(404).json({ success: false, message: 'File not found!' });

        res.download(essay.filePath);
    } catch (error) {
        console.error('Error downloading file:', error);
        res.status(500).json({ success: false, message: 'Error downloading file.' });
    }
});

// Start server
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

