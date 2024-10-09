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
        paragraphScore: { type: Number, default: 0 },
        topicScore: { type: Number, default: 0 },
        spellingScore: { type: Number, default: 0 },
        wordCountScore: { type: Number, default: 0 },
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


const upload = multer({
    dest: 'uploads/', // Destination folder for uploaded files
    limits: { fileSize: 20 * 1024 * 1024 } // Set the file size limit to 20MB
});

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'static')));

// Spelling checker and tokenizer
const spellingChecker = new spelling(dictionary);
const tokenizer = new natural.WordTokenizer();

// Grading function
function gradeEssay(topic, essayContent) {
    let paragraphScore, topicScore, spellingScore, wordCountScore;

    // Paragraph Check
    const paragraphs = essayContent.split(/\n+/).filter(para => para.trim().length > 0).length;
    paragraphScore = paragraphs >= 5 ? 25 : paragraphs >= 3 ? 15 : 5;

    // Topic Relevance Check
    const essayWords = tokenizer.tokenize(essayContent.toLowerCase());
    const topicWords = tokenizer.tokenize(topic.toLowerCase());
    const relevantWords = topicWords.filter(word => essayWords.includes(word)).length; // Check for relevant words
    topicScore = relevantWords > 0 ? 25 : 0;

    // Spelling Check
    const spellingErrors = essayWords.filter(word => {
        try {
            return !spellingChecker.lookup(word);
        } catch (error) {
            console.error(`Error checking spelling for word "${word}": ${error.message}`);
            return true; // Treat it as a spelling error if there's an exception
        }
    }).length;

    spellingScore = spellingErrors <= 10 ? 25 : spellingErrors <= 50 ? 15 : 5;

    // Word Count Check
    const wordCount = essayWords.length;
    wordCountScore = wordCount >= 400 ? 25 : wordCount >= 200 ? 15 : 5;

    // Total Score
    const totalScore = paragraphScore + topicScore + spellingScore + wordCountScore;

    // Return grading results
    return {
        paragraphScore,
        topicScore,
        spellingScore,
        wordCountScore,
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

    // Check if user is logged in
    if (!userId) {
        return res.json({ success: false, message: 'User not logged in!' });
    }

    // Read the essay content from the uploaded file
    // Only if you really need to read the content, otherwise just save it
    const fs = require('fs');
    fs.readFile(filePath, 'utf-8', (err, essayContent) => {
        if (err) {
            console.error('Error reading essay file:', err);
            return res.json({ success: false, message: 'Failed to read essay file.' });
        }

        const grades = gradeEssay(courseCode, essayContent); // Ensure you use the right function

        // Create a new essay document
        const essay = new Essay({
            title,
            courseCode,
            filePath,
            userId,
            grade: {
                paragraphScore: grades.paragraphScore,
                topicScore: grades.topicScore,
                spellingScore: grades.spellingScore,
                wordCountScore: grades.wordCountScore,
                totalScore: grades.totalScore
            }
        });

        // Save to the database
        essay.save()
            .then(() => {
                console.log('Essay saved to database'); // Log for confirmation
                return res.json({ success: true, message: 'Essay submitted and graded successfully!' });
            })
            .catch(error => {
                console.error('Error saving essay to database:', error);
                return res.json({ success: false, message: 'Failed to save essay. Please try again.' });
            });
    });
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
            res.download(essay.filePath);
        } else {
            res.status(404).send('File not found!');
        }
    } catch (error) {
        res.status(500).send('Error downloading file.');
    }
});



// Start Server
app.listen(PORT, () => {
    console.log(`server started on port ${PORT}`);
  });