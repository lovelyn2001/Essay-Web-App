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
const PORT = process.env.PORT || 3030;


// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('MongoDB connected successfully');
})
.catch((error) => {
    console.error('MongoDB connection error:', error);
});

// Define User and Essay schemas
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

// Session setup
app.use(session({
    secret: 'your-secret-key', 
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));


// Set up storage engine with multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'uploads')); // Save files to 'uploads' folder
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname)); // Save files with unique names
    }
});

const upload = multer({ storage: storage });

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'static')));

// Spelling checker and tokenizer
const spellingChecker = new spelling(dictionary);
const tokenizer = new natural.WordTokenizer();

// Grading function based on the new criteria
function gradeEssay(topic, essayContent) {
    let contentRelevanceScore, structureScore, grammarScore, analysisScore;

    // Content Relevance Check (30%)
    const essayWords = tokenizer.tokenize(essayContent.toLowerCase());
    const topicWords = tokenizer.tokenize(topic.toLowerCase());
    const relevantWords = topicWords.filter(word => essayWords.includes(word)).length; // Check for relevant words
    contentRelevanceScore = relevantWords > 0 ? (relevantWords >= 5 ? 30 : 15) : 0;

    // Organization and Structure Check (25%)
    const paragraphs = essayContent.split(/\n+/).filter(para => para.trim().length > 0).length;
    structureScore = paragraphs >= 5 ? 25 : paragraphs >= 3 ? 15 : 5;

    // Grammar and Mechanics Check (20%)
    const spellingErrors = essayWords.filter(word => {
        try {
            return !spellingChecker.lookup(word);
        } catch (error) {
            console.error(`Error checking spelling for word "${word}": ${error.message}`);
            return true; // Treat as a spelling error if there's an exception
        }
    }).length;

    grammarScore = spellingErrors <= 5 ? 20 : spellingErrors <= 15 ? 10 : 5;

    // Depth of Analysis and Argument (25%)
    // You can simulate this by checking the average word length and complexity of sentences (for simplicity)
    const wordCount = essayWords.length;
    const averageWordLength = essayWords.reduce((sum, word) => sum + word.length, 0) / wordCount;
    analysisScore = averageWordLength > 5 ? 25 : averageWordLength > 4 ? 15 : 5;

    // Total Score
    const totalScore = contentRelevanceScore + structureScore + grammarScore + analysisScore;

    // Return grading results
    return {
        contentRelevanceScore,
        structureScore,
        grammarScore,
        analysisScore,
        totalScore
    };
}



// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'registration.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
// Serve Student Dashboard (for essay submission)
app.get('/dashboard', (req, res) => {
    if (req.session.userId) { // Check if user is logged in
        res.sendFile(path.join(__dirname, 'student-dashboard.html'));
    } else {
        res.redirect('/'); // Redirect to registration if not logged in
    }
});
app.get('/admin-login', (req, res) => res.sendFile(path.join(__dirname, 'admin-login.html')));
app.get('/admin-dashboard', (req, res) => res.sendFile(path.join(__dirname, 'admin-dashboard.html')));

// Admin Dashboard - View All Submitted Essays

app.get('/essays', async (req, res) => {
    try {
        const essays = await Essay.find().populate('userId', 'name regNumber department');
        res.json(essays);
    } catch (error) {
        console.error('Error fetching essays:', error);
        res.status(500).json({ message: 'Failed to fetch essays' });
    }
});


// Register Student
app.post('/register-student', async (req, res) => {
    const { name, regNumber, department } = req.body;

    // Check if student is already registered
    const existingStudent = await User.findOne({ regNumber });
    if (existingStudent) {
        return res.json({ success: false, message: 'Student already registered!' });
    }

    const user = new User({ name, regNumber, department });
    await user.save();
    res.json({ success: true, message: 'Student registered successfully!' });
});

// Student Login
app.post('/login-student', async (req, res) => {
    const { name, regNumber } = req.body;
    
    try {
        const user = await User.findOne({ name, regNumber });

        if (user) {
            // Store user ID in session after successful login
            req.session.userId = user._id; 
            res.json({ success: true, message: 'Login successful!' });
        } else {
            res.json({ success: false, message: 'Invalid credentials!' });
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.json({ success: false, message: 'An error occurred during login.' });
    }
});



// Route to handle essay submission
app.post('/submit-essay', upload.single('essayFile'), async (req, res) => {
    const { title, courseCode } = req.body;
    const filePath = req.file.path; // Get the uploaded file path
    const userId = req.session.userId; // Get the user ID from the session

    try {
        const essayContent = ''; // You would parse the uploaded file to get the essay content here
        const grades = gradeEssay(title, essayContent); // Grade the essay using the new criteria

        const essay = new Essay({
            title,
            courseCode,
            filePath, // Store the file path in the database
            userId,
            grade: {
                contentRelevanceScore: grades.contentRelevanceScore,
                structureScore: grades.structureScore,
                grammarScore: grades.grammarScore,
                analysisScore: grades.analysisScore,
                totalScore: grades.totalScore
            }
        });

        await essay.save();
        res.json({ success: true, message: 'Essay submitted and graded successfully!' });
    } catch (error) {
        console.error('Error saving essay:', error);
        res.status(500).json({ success: false, message: 'Error submitting essay.' });
    }
});


app.post('/update-grade', async (req, res) => {
    const { essayId, newScores, comments } = req.body;
    try {
        const essay = await Essay.findById(essayId);
        if (essay) {
            essay.grade.paragraphScore = newScores[0];
            essay.grade.topicScore = newScores[1];
            essay.grade.spellingScore = newScores[2];
            essay.grade.wordCountScore = newScores[3];
            essay.grade.totalScore = newScores.reduce((a, b) => a + b, 0);
            essay.grade.comments = comments;
            await essay.save();
            res.json({ success: true, message: 'Grade updated successfully!' });
        } else {
            res.json({ success: false, message: 'Essay not found!' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update grade.' });
    }
});

// Route to add a comment to an essay
app.post('/add-comment', async (req, res) => {
    const { essayId, comment } = req.body;

    try {
        const essay = await Essay.findById(essayId);

        if (essay) {
            essay.grade.comments = comment; // Add the new comment
            await essay.save(); // Save the changes to the database
            res.json({ success: true, message: 'Comment added successfully!' });
        } else {
            res.json({ success: false, message: 'Essay not found!' });
        }
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ success: false, message: 'Failed to add comment.' });
    }
});


app.get('/download/:essayId', async (req, res) => {
    try {
        const essay = await Essay.findById(req.params.essayId);
        if (essay) {
            const filePath = essay.filePath; // Get file path from the database
            res.download(filePath); // Download the file
        } else {
            res.status(404).json({ success: false, message: 'File not found!' });
        }
    } catch (error) {
        console.error('Error downloading file:', error);
        res.status(500).json({ success: false, message: 'Error downloading file.' });
    }
});




// Start Server
app.listen(PORT, () => {
    console.log(`server started on port ${PORT}`);
  });