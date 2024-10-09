document.addEventListener('DOMContentLoaded', function () {
    // Submit Essay
    const essayForm = document.getElementById('essayForm');
    if (essayForm) {
        essayForm.addEventListener('submit', async function (e) {
            e.preventDefault(); // Prevent default form submission
            
            const title = document.getElementById('title').value;
            const courseCode = document.getElementById('courseCode').value;
            const essayFile = document.getElementById('essayFile').files[0];

            // Create a FormData object
            const formData = new FormData();
            formData.append('title', title);
            formData.append('courseCode', courseCode);
            formData.append('essayFile', essayFile);

            try {
                const response = await fetch('/submit-essay', {
                    method: 'POST',
                    body: formData // Send the FormData with the file
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();
                alert(result.message); // Show the result message

                if (result.success) {
                    window.location.href = '/dashboard'; // Redirect to the dashboard
                }
            } catch (error) {
                console.error('Error during fetch:', error);
                alert('Error submitting essay. Please try again later.');
            }
        });
    }
});


document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault(); // Prevent the default form submission
            
            const name = document.getElementById('name').value;
            const regNumber = document.getElementById('regNumber').value;

            try {
                const response = await fetch('/login-student', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, regNumber })
                });

                const result = await response.json();

                if (result.success) {
                    // Redirect to the dashboard upon successful login
                    window.location.href = '/dashboard';
                } else {
                    alert('Login failed: ' + result.message);
                }
            } catch (error) {
                console.error('Login error:', error);
                alert('An error occurred during login. Please try again.');
            }
        });
    }
});

document.addEventListener('DOMContentLoaded', function () {
    // Toggle between Student and Admin forms
    const roleRadios = document.querySelectorAll('input[name="role"]');
    
    if (roleRadios) {
        roleRadios.forEach((radio) => {
            radio.addEventListener('change', (event) => {
                if (event.target.value === 'student') {
                    document.getElementById('student-form').style.display = 'block'; // Show student form
                    document.getElementById('admin-form').style.display = 'none';   // Hide admin form
                } else {
                    document.getElementById('student-form').style.display = 'none'; // Hide student form
                    document.getElementById('admin-form').style.display = 'block';  // Show admin form
                }
            });
        });
    }

    // Student Registration
    const registrationForm = document.getElementById('studentRegistrationForm');
    if (registrationForm) {
        registrationForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const name = document.getElementById('name').value;
            const regNumber = document.getElementById('regNumber').value;
            const department = document.getElementById('department').value;

            try {
                const response = await fetch('/register-student', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, regNumber, department })
                });

                const result = await response.json();
                alert(result.message);
                if (result.success) {
                    window.location.href = '/login'; // Redirect to login page after registration
                }
            } catch (error) {
                console.error('Error during registration:', error);
                alert('Error registering. Please try again.');
            }
        });
    }

    // Admin Login
    const adminLoginForm = document.getElementById('adminLoginForm');
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const username = document.getElementById('adminUsername').value;
            const password = document.getElementById('adminPassword').value;

            if (username === 'Mouau' && password === 'Mouau') {
                alert('Admin login successful!');
                window.location.href = '/admin-dashboard'; // Redirect to the admin dashboard
            } else {
                alert('Invalid admin credentials');
            }
        });
    }
});
