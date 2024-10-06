const express = require('express');
const bodyParser = require('body-parser');
const natural = require('natural');
const spelling = require('spelling');
const dictionary = require('spelling/dictionaries/en_US');
const path = require('path');
const PORT = process.env.PORT || 3030;

const app = express();

// Serve static files from the "static" directory
app.use(express.static(path.join(__dirname, "static")));

app.use(bodyParser.json());

const spellingChecker = new spelling(dictionary);
const tokenizer = new natural.WordTokenizer();

function gradeEssay(topic, essay) {
    let paragraphScore, topicScore, spellingScore, wordCountScore;

    // Paragraph Check
    const paragraphs = essay.split(/\n+/).filter(para => para.trim().length > 0).length;
    if (paragraphs === 5 || paragraphs >= 5)  {
        paragraphScore = 25;
    } else if (paragraphs === 3 || paragraphs === 4) {
        paragraphScore = 15;
    } else {
        paragraphScore = 5;
    }

    // Topic Relevance Check
    const essayWords = tokenizer.tokenize(essay.toLowerCase());
    const topicWords = tokenizer.tokenize(topic.toLowerCase());
    const relevantWords = topicWords.filter(word => essayWords.includes(word)).length;
    topicScore = relevantWords > 0 ? 25 : 0;


    // Spelling Check
    const spellingErrors = essayWords.filter(word => !spellingChecker.lookup(word)).length;
    if (spellingErrors <= 10) {
        spellingScore = 25;
    } else if (spellingErrors <= 50) {
        spellingScore = 15;
    } else {
        spellingScore = 5;
    }

    // Word Count Check
    const wordCount = essayWords.length;
    if (wordCount >= 400) {
        wordCountScore = 25;
    } else if (wordCount >= 200 && wordCount <= 399) {
        wordCountScore = 15;
    } else {
        wordCountScore = 5;
    }

    // Total Score
    const totalScore = paragraphScore + topicScore + spellingScore + wordCountScore;

    // Grade Assignment
    let grade;
    if (totalScore >= 80) {
        grade = 'A';
    } else if (totalScore >= 60) {
        grade = 'B';
    } else if (totalScore >= 40) {
        grade = 'C';
    } else if (totalScore >= 20) {
        grade = 'D';
    } else if (totalScore >= 10) {
        grade = 'E';
    } else {
        grade = 'F';
    }

    return {
        paragraphScore,
        topicScore,
        spellingScore,
        wordCountScore,
        totalScore,
        grade
    };
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'essay.html'));
});

app.post('/grade-essay', (req, res) => {
	try {
	  const { topic, essay } = req.body;
	  const result = gradeEssay(topic, essay);
	  res.json(result);
	} catch (error) {
	  console.error('Error grading essay:', error);
	  res.status(500).json({ message: 'Internal Server Error' });
	}
  });

  app.listen(PORT, () => {
    console.log(`server started on port ${PORT}`);
  });
