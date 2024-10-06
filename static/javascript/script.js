document.getElementById('essayForm').addEventListener('submit', async function(e) {
	e.preventDefault();
	const topic = document.getElementById('topic').value;
	const essay = document.getElementById('essay').value;
	console.log(topic);
	console.log(essay);

	const response = await fetch('/grade-essay', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ topic, essay })
	});

	const data = await response.json();
	document.getElementById('result').innerHTML = `
		<h2>Results</h2>
		<p><strong>Paragraph Score:</strong> ${data.paragraphScore}/25</p>
		<p><strong>Topic Relevance Score:</strong> ${data.topicScore}/25</p>
		<p><strong>Spelling Score:</strong> ${data.spellingScore}/25</p>
		<p><strong>Word Count Score:</strong> ${data.wordCountScore}/25</p>
		<h3>Total Score: ${data.totalScore}/100</h3>
		<h3>Grade: ${data.grade}</h3>
	`;
});
