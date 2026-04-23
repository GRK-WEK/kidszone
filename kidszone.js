// 1. Initialize Supabase Client
const SUPABASE_URL = 'https://miiewkxzsffpaefgdztm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1paWV3a3h6c2ZmcGFlZmdkenRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxNjc4ODEsImV4cCI6MjA4Mjc0Mzg4MX0.fLN3Ncmqb_ynCAPQnNr0nKZ_S0olZ4kohu87M6-Luy8';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log("Supabase Config Loaded:", !!SUPABASE_URL);

document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM Loaded - Starting app");
    const store = new StudyDataStore();
    window.app = new StudyAppUI(store);
    
    // Check if user is already logged in
    const { data: { session }, error: sessionError } = await _supabase.auth.getSession();
    console.log("Session check:", session ? "Has session" : "No session");
    
    if (sessionError) {
        console.error("Session error:", sessionError);
    }

    if (session) {
        console.log("User logged in:", session.user.id);
        await store.fetchAll(session.user.id);
        await window.app.diary.fetchEntries(session.user.id);
        showAppContent(session.user);
    } else {
        console.log("No session - showing login overlay");
        const overlay = document.getElementById('login-overlay');
        if (overlay) overlay.style.display = 'flex';
    }

    // Toggle between login and signup
    const showLogin = document.getElementById('show-login-link');
    const showSignup = document.getElementById('show-signup-link');
    const signupStep = document.getElementById('signup-step');
    const loginStep = document.getElementById('login-step');

    if (showLogin) {
        showLogin.addEventListener('click', (e) => {
            e.preventDefault();
            if (signupStep) signupStep.style.display = 'none';
            if (loginStep) loginStep.style.display = 'block';
        });
    }

    if (showSignup) {
        showSignup.addEventListener('click', (e) => {
            e.preventDefault();
            if (loginStep) loginStep.style.display = 'none';
            if (signupStep) signupStep.style.display = 'block';
        });
    }

    // LOGIN FORM HANDLER
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log("Login form submitted");

            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;

            if (!email || !password) {
                alert("Please enter both email and password.");
                return;
            }

            console.log("Attempting login for:", email);

            const { data, error } = await _supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                console.error("Login error:", error.message);
                if (error.message === "Invalid login credentials") {
                    alert("Login failed: Wrong email or password. Please sign up first if you don't have an account.");
                } else {
                    alert("Login failed: " + error.message);
                }
            } else {
                console.log("Login successful!", data.user.id);
                const profiles_id = data.user.id;

                // Save profile
                const { error: profileError } = await _supabase
                    .from('profiles')
                    .upsert({ 
                        id: profiles_id, 
                        firstname: data.user.user_metadata?.firstname || "Guest" 
                    });

                if (profileError) {
                    console.error("Error saving profile:", profileError.message);
                }

                await store.fetchAll(profiles_id);
                await window.app.diary.fetchEntries(profiles_id);
                showAppContent(data.user);
            }
        });
    }

    // SIGNUP FORM HANDLER
    const signupForm = document.getElementById('form');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log("Signup form submitted");

            const email = document.getElementById('email-input').value.trim();
            const password = document.getElementById('password-input').value;
            const repeatPassword = document.getElementById('repeat-password-input').value;
            const firstName = document.getElementById('firstname-input').value.trim();

            // Validation
            if (!email || !password || !firstName) {
                alert("Please fill in all fields!");
                return;
            }

            if (password !== repeatPassword) {
                alert("Passwords do not match!");
                return;
            }

            if (password.length < 6) {
                alert("Password must be at least 6 characters long!");
                return;
            }

            console.log("Attempting signup for:", email);

            const { data, error } = await _supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: { 
                        firstname: firstName 
                    }
                }
            });

            if (error) {
                console.error("Signup error:", error.message);
                if (error.message.includes("already registered")) {
                    alert("This email is already registered. Please login instead.");
                } else {
                    alert("Sign up error: " + error.message);
                }
            } else {
                console.log("Signup successful!", data);
                alert("Account created successfully! You can now login.");
                
                // Switch to login form
                const signupStepDiv = document.getElementById('signup-step');
                const loginStepDiv = document.getElementById('login-step');
                if (signupStepDiv) signupStepDiv.style.display = 'none';
                if (loginStepDiv) loginStepDiv.style.display = 'block';
                
                // Clear signup form
                document.getElementById('email-input').value = '';
                document.getElementById('password-input').value = '';
                document.getElementById('repeat-password-input').value = '';
                document.getElementById('firstname-input').value = '';
            }
        });
    }
});

function showAppContent(user) {
    console.log("Showing app content for user:", user.id);
    
    const hour = new Date().getHours();
    let greeting = "Good evening";
    if (hour < 12) greeting = "Good morning";
    else if (hour < 18) greeting = "Good afternoon";

    // Hide login/signup UI
    const loginStep = document.getElementById('login-step');
    const signupStep = document.getElementById('signup-step');
    const overlay = document.getElementById('login-overlay');
    const quiz = document.querySelector('.login-card');

    if (loginStep) loginStep.style.display = 'none';
    if (signupStep) signupStep.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
    if (quiz) quiz.style.display = 'none';

    // Show main navigation and content
    const nav = document.getElementById('main-nav');
    const content = document.getElementById('app-content');
    if (nav) nav.style.display = 'block';
    if (content) content.style.display = 'block';

    // Set greeting
    const emailName = user.email ? user.email.split('@')[0] : "Guest";
    const capitalizedName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
    const welcomeHeading = document.getElementById('main-greeting');
    if (welcomeHeading) {
        welcomeHeading.innerText = `${greeting}, ${capitalizedName}`;
    }

    // Set footer name
    _supabase.from('profiles')
        .select('firstname')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data, error }) => {
            let nameToShow = capitalizedName;
            if (data && data.firstname && data.firstname !== "Guest") {
                nameToShow = data.firstname;
            }
            const footerName = document.getElementById('footer-user-name')?.querySelector('h1');
            if (footerName) {
                footerName.innerText = nameToShow;
            }
        });

    // Initialize passcode and start app
    window.app.passcode = new PasscodeManager(window.app);
    window.app.start();
}

class StudyDataStore {
    constructor() {
        this.data = [];
    }

    async fetchAll(profiles_id) {
        if (!profiles_id) {
            console.error("FetchAll failed: No profiles_id provided");
            return [];
        }

        try {
            const { data, error } = await _supabase
                .from('tracker')
                .select('*')
                .eq('profiles_id', profiles_id)
                .order('date', { ascending: true });

            if (error) throw error;
            this.data = data || [];
            console.log(`Fetched ${this.data.length} records`);
            return this.data;
        } catch (err) {
            console.error('Error fetching data:', err.message);
            return [];
        }
    }

    async addRecord(entry) {
        const { data, error } = await _supabase
            .from('tracker')
            .insert([entry])
            .select();

        if (error) throw error;
        if (data && data[0]) {
            this.data.push(data[0]);
        }
        return data;
    }

    async updateRecord(id, updates) {
        const { error } = await _supabase
            .from('tracker')
            .update(updates)
            .eq('id', id);

        if (error) throw error;

        const index = this.data.findIndex(item => item.id === id);
        if (index !== -1) {
            this.data[index] = { ...this.data[index], ...updates };
        }
    }

    async deleteRecord(id) {
        const { error } = await _supabase
            .from('tracker')
            .delete()
            .eq('id', id);

        if (error) throw error;
        this.data = this.data.filter(item => item.id !== id);
    }
}

class PasscodeManager {
    constructor(app) {
        this.app = app;
        this.currentStep = 0;
        this.masterCode = "739512";
        this.challenges = [];

        this.challenges = [
            { q: "What was the shortest war in history?", a: "Anglo-Zanzibar War", img: "https://cdn.britannica.com/33/258533-138-8E8958F4/anglo-zanzibar-war-august-27-1896.jpg?w=800&h=450&c=crop" },
            { q: "How many continents are there?", a: "7", img: "https://miro.medium.com/v2/resize:fit:720/format:webp/1*wIhzDQkzhdSvUq7SDFGdcg.png" },
            { q: "Square root of 81?", a: "9", img: "https://www.freepik.com/free-psd/glossy-red-numbers-with-white-3d-letter-9_417252495.htm" },
            { q: "Hardest natural substance?", a: "Diamond", img: "https://docs.growndiamondcorp.com/blog/types-of-diamonds.png" },
            { q: "Gas plants breathe in?", a: "Carbon Dioxide", img: "https://www.freepik.com/free-vector/oxygen-cycle-diagram-science-education_39207658.htm" },
            { q: "Seconds in 2 minutes?", a: "120", img: "" }
        ];
    }

    init() {
        this.currentStep = 0;
        this.renderQuestion();
        this.resetSlots();
    }

    renderQuestion() {
        const questText = document.getElementById('quest-text');
        const progressText = document.getElementById('quest-progress');

        if (this.currentStep < this.challenges.length) {
            const currentChallenge = this.challenges[this.currentStep];
            if (questText) questText.innerText = currentChallenge.q;
            if (progressText) progressText.innerText = `Question ${this.currentStep + 1} of ${this.challenges.length}`;
            const answerInput = document.getElementById('quest-answer');
            if (answerInput) answerInput.value = '';
        } else {
            if (questText) questText.innerText = "Challenge Complete! Enter Final Passcode.";
        }
    }

    handleCorrectAnswer(index) {
        const currentChallenge = this.challenges[index];
        const slot = document.getElementById(`slot-${index}`);
        if (slot) {
            slot.innerText = "";
            slot.style.backgroundImage = `url('${currentChallenge.img}')`;
            slot.style.backgroundSize = "cover";
            slot.style.backgroundPosition = "center";
            slot.classList.add('unlocked');
        }
    }

    resetSlots() {
        const slots = document.querySelectorAll('.code-slot');
        slots.forEach(slot => {
            slot.classList.remove('revealed');
            slot.innerText = '';
        });
    }

    checkAnswer() {
        const userAns = document.getElementById('quest-answer').value.trim().toLowerCase();
        const correctAns = this.challenges[this.currentStep].a.toLowerCase();

        if (userAns === correctAns) {
            this.handleCorrectAnswer(this.currentStep);
            const digit = this.masterCode[this.currentStep];
            const slot = document.getElementById(`slot-${this.currentStep}`);
            slot.innerText = digit;
            slot.classList.add('revealed');
            this.currentStep++;

            if (this.currentStep < this.challenges.length) {
                this.renderQuestion();
            } else {
                document.getElementById('question-sequence').style.display = 'none';
                document.getElementById('final-unlock').style.display = 'block';
            }
        } else {
            alert("Wrong! Try again.");
        }
    }
}

class StudyAppUI {
    constructor(store) {
        this.store = store;
        this.chart = null;
        this.currentChartType = 'bar';
        this.diary = new DiaryManager(this);
    }

    async start() {
        const nav = document.getElementById('main-nav');
        const content = document.getElementById('app-content');
        const quiz = document.querySelector('.login-card');

        if (nav) nav.style.display = 'block';
        if (content) content.style.display = 'block';
        if (quiz) quiz.style.display = 'none';

        const end = new Date();
        const startDate = new Date();
        startDate.setDate(end.getDate() - 30);

        const endInput = document.getElementById('filterEnd');
        const startInput = document.getElementById('filterStart');

        if (endInput) endInput.value = end.toISOString().split('T')[0];
        if (startInput) startInput.value = startDate.toISOString().split('T')[0];

        this.updateDisplayDate();
        this.initChart();

        const { data: { session } } = await _supabase.auth.getSession();
        if (session) {
            const profiles_id = session.user.id;
            await this.store.fetchAll(profiles_id);
            this.render();
        }
    }

    destroyChart() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }

    changeChartType(newType) {
        this.currentChartType = newType;
        this.destroyChart();
        this.initChart();
        this.updateChart();
    }

    initChart() {
        const ctx = document.getElementById('timeChart').getContext('2d');
        if (this.chart) {
            this.chart.destroy();
        }

        this.chart = new Chart(ctx, {
            type: this.currentChartType,
            data: { labels: [], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: this.currentChartType !== 'pie' ? {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Minutes' }
                    }
                } : {}
            }
        });
    }

    updateChart() {
        if (!this.chart) return;

        const startInput = document.getElementById('filterStart').value;
        const endInput = document.getElementById('filterEnd').value;
        const start = startInput ? new Date(startInput) : new Date('2000-01-01');
        const end = endInput ? new Date(endInput) : new Date('2099-12-31');

        const filtered = this.store.data.filter(item => {
            const d = new Date(item.date);
            return d >= start && d <= end;
        }).sort((a, b) => new Date(a.date) - new Date(b.date));

        const keys = ['lessons', 'friends', 'writing', 'outdoor'];
        const colors = ['#ff5e5e', '#5eafff', '#52c41a', '#b37feb'];

        if (this.currentChartType === 'pie') {
            const totals = keys.map(key =>
                filtered.reduce((sum, item) => sum + (parseInt(item[key]) || 0), 0)
            );
            this.chart.data.labels = ['Lessons', 'Social', 'Writing', 'Outdoor'];
            this.chart.data.datasets = [{
                data: totals,
                backgroundColor: colors,
                borderWidth: 1
            }];
        } else {
            this.chart.data.labels = filtered.map(d => d.date);
            this.chart.data.datasets = keys.map((key, i) => ({
                label: key.charAt(0).toUpperCase() + key.slice(1),
                data: filtered.map(item => parseInt(item[key]) || 0),
                backgroundColor: colors[i],
                borderColor: colors[i],
                borderWidth: 2,
                type: (this.currentChartType === 'bar' && key === 'outdoor') ? 'line' : this.currentChartType,
                tension: 0.4
            }));
        }
        this.chart.update();
    }

    updateDisplayDate() {
        const now = new Date();
        document.getElementById('displayDate').innerText = now.toLocaleDateString(undefined, {
            month: 'long', day: 'numeric', year: 'numeric'
        });
    }

    async addRow() {
        const { data: { session } } = await _supabase.auth.getSession();
        const user = session?.user;
        if (!user) { alert("You must be logged in!"); return; }

        const dateVal = document.getElementById('newDate').value;
        if (!dateVal) { alert("Please select a date!"); return; }

        const newEntry = {
            profiles_id: user.id,
            date: dateVal,
            lessons: parseInt(document.getElementById('newLessons').value) || 0,
            friends: parseInt(document.getElementById('newFriends').value) || 0,
            writing: parseInt(document.getElementById('newWriting').value) || 0,
            outdoor: parseInt(document.getElementById('newOutdoor').value) || 0
        };

        try {
            await this.store.addRecord(newEntry);
            await this.store.fetchAll(user.id);
            this.render();
        } catch (e) {
            alert("Error saving: " + e.message);
        }
    }

    async render() {
        const tbody = document.getElementById('tableBody');
        if (!tbody) return;

        const { data: { session } } = await _supabase.auth.getSession();
        if (session) {
            await this.store.fetchAll(session.user.id);
        }

        tbody.innerHTML = this.store.data.map((row) => {
            const cleanDate = row.date ? row.date.split('T')[0] : "";
            return `
            <tr>
                <td>
                    <input type="date" value="${cleanDate}" 
                        class="inline-date-input" 
                        onchange="app.handleEdit(${row.id}, 'date', this.value)">
                </td>
                <td contenteditable="true" onblur="app.handleEdit(${row.id}, 'lessons', this.innerText)">${row.lessons || 0}</td>
                <td contenteditable="true" onblur="app.handleEdit(${row.id}, 'friends', this.innerText)">${row.friends || 0}</td>
                <td contenteditable="true" onblur="app.handleEdit(${row.id}, 'writing', this.innerText)">${row.writing || 0}</td>
                <td contenteditable="true" onblur="app.handleEdit(${row.id}, 'outdoor', this.innerText)">${row.outdoor || 0}</td>
                <td>
                    <button class="del-btn" onclick="app.handleDelete(${row.id})">×</button>
                </td>
            </tr>`;
        }).join('');

        this.updateChart();
        this.updateSummary(this.store.data);
    }

    async handleEdit(dbId, field, value) {
        let updateObj = {};
        if (field === 'date') {
            updateObj.date = value;
        } else {
            updateObj[field] = parseInt(value.replace(/\D/g, '')) || 0;
        }

        try {
            const { data: { session } } = await _supabase.auth.getSession();
            await this.store.updateRecord(dbId, updateObj);
            await this.store.fetchAll(session.user.id);
            this.render();
        } catch (e) {
            console.error("Update failed", e);
        }
    }

    async handleDelete(dbId) {
        if (confirm("Delete this entry?")) {
            await this.store.deleteRecord(dbId);
            const { data: { session } } = await _supabase.auth.getSession();
            if (session) {
                await this.store.fetchAll(session.user.id);
            }
            this.render();
        }
    }

    updateSummary(data) {
        const totals = data.reduce((acc, curr) => ({
            l: acc.l + (Number(curr.lessons) || 0),
            f: acc.f + (Number(curr.friends) || 0),
            w: acc.w + (Number(curr.writing) || 0),
            o: acc.o + (Number(curr.outdoor) || 0)
        }), { l: 0, f: 0, w: 0, o: 0 });

        const ids = { l: 'sum-lessons', f: 'sum-friends', w: 'sum-writing', o: 'sum-outdoor' };
        for (let key in ids) {
            const el = document.getElementById(ids[key]);
            if (el) el.innerText = totals[key] + 'm';
        }
    }

    showPage(id) {
        document.querySelectorAll('.app-page').forEach(p => p.style.display = 'none');
        const target = document.getElementById(id);
        if (target) target.style.display = 'block';
        if (id === 'graph-page') {
            this.updateChart();
        }
    }

    async handleSignOut() {
        const { error } = await _supabase.auth.signOut();
        if (error) {
            console.error("Logout error:", error.message);
        } else {
            localStorage.clear();
            window.location.reload();
        }
    }
}

class DiaryManager {
    constructor(app) {
        this.app = app;
        this.currentDate = new Date();
        this.selectedDate = null;
        this.entries = {};
    }

    async fetchEntries(profiles_id) {
        if (!profiles_id) return;
        const { data, error } = await _supabase
            .from('diary')
            .select('*')
            .eq('profiles_id', profiles_id);

        if (error) {
            console.error('Error fetching diary:', error);
            return;
        }

        this.entries = data.reduce((acc, entry) => {
            acc[entry.date] = entry;
            return acc;
        }, {});

        this.renderCalendar();
    }

    async saveEntry() {
        const { data: { session } } = await _supabase.auth.getSession();
        const user = session?.user;
        const diaryBox = document.getElementById('diaryText');
        const text = diaryBox.value.trim();

        if (!text || !user) return;

        const mood = document.getElementById('moodSelect').value;
        const currentTasks = this.entries[this.selectedDate]?.tasks || [];

        const { error } = await _supabase
            .from('diary')
            .upsert({
                profiles_id: user.id,
                date: this.selectedDate,
                text: text,
                mood: mood,
                tasks: currentTasks
            });

        if (!error) {
            alert("Saved successfully!");
            await this.fetchEntries(user.id);
        }
    }

    async addTask() {
        const { data: { session } } = await _supabase.auth.getSession();
        const user = session?.user;
        const input = document.getElementById('newTaskInput');
        const taskText = input.value.trim();

        if (!taskText || !this.selectedDate) return;

        const currentEntry = this.entries[this.selectedDate] || { text: '', mood: 'neutral', tasks: [] };
        const updatedTasks = [...(currentEntry.tasks || []), taskText];

        const { error } = await _supabase
            .from('diary')
            .upsert({
                date: this.selectedDate,
                tasks: updatedTasks,
                text: currentEntry.text,
                mood: currentEntry.mood,
                profiles_id: user.id
            });

        if (!error) {
            input.value = '';
            if (!this.entries[this.selectedDate]) {
                this.entries[this.selectedDate] = { date: this.selectedDate, tasks: [], text: '', mood: 'neutral' };
            }
            this.entries[this.selectedDate].tasks = updatedTasks;
            this.renderTasks(updatedTasks);
            this.renderCalendar();
            await this.fetchEntries(user.id);
        } else {
            console.error("Task add error:", error);
            alert("Failed to add task to database.");
        }
    }

    async removeTask(index) {
        const { data: { session } } = await _supabase.auth.getSession();
        const user = session?.user;
        if (!this.selectedDate || !this.entries[this.selectedDate]) return;

        const updatedTasks = [...this.entries[this.selectedDate].tasks];
        updatedTasks.splice(index, 1);

        const { error } = await _supabase
            .from('diary')
            .upsert({
                date: this.selectedDate,
                tasks: updatedTasks,
                text: this.entries[this.selectedDate].text || '',
                mood: this.entries[this.selectedDate].mood || 'neutral',
                profiles_id: user.id
            });

        if (!error) {
            this.entries[this.selectedDate].tasks = updatedTasks;
            this.renderTasks(updatedTasks);
            await this.fetchEntries(user.id);
        } else {
            console.error("Delete error:", error);
            alert("Failed to delete task from database.");
        }
    }

    renderTasks(tasks) {
        const list = document.getElementById('diaryTaskList');
        if (!list) return;
        list.innerHTML = (tasks || []).map((task, index) => `
            <li>
                <span>${task}</span>
                <button onclick="app.diary.removeTask(${index})">×</button>
            </li>`).join('');
    }

    renderCalendar() {
        const grid = document.getElementById('calendarGrid');
        const monthYear = document.getElementById('monthDisplay');
        if (!grid || !monthYear) return;

        grid.innerHTML = '';
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        monthYear.innerText = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(this.currentDate);

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < firstDay; i++) grid.appendChild(document.createElement('div'));

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day';

            const entry = this.entries[dateStr];
            if (entry) {
                dayEl.classList.add('has-entry');
                if (entry.mood) dayEl.classList.add(`mood-${entry.mood}`);
            }

            if (this.selectedDate === dateStr) dayEl.classList.add('active');
            dayEl.innerText = day;
            dayEl.onclick = () => this.openEntry(dateStr);
            grid.appendChild(dayEl);
        }
    }

    openEntry(dateStr) {
        this.selectedDate = dateStr;
        const editor = document.getElementById('diaryEditor');
        if (editor) editor.style.display = 'block';
        const dateDisplay = document.getElementById('selectedDateDisplay');
        if (dateDisplay) dateDisplay.innerText = dateStr;

        const entry = this.entries[dateStr] || { text: '', tasks: [], mood: 'neutral' };
        const diaryText = document.getElementById('diaryText');
        const moodSelect = document.getElementById('moodSelect');
        if (diaryText) diaryText.value = entry.text || '';
        if (moodSelect) moodSelect.value = entry.mood || 'neutral';
        this.renderTasks(entry.tasks || []);
        this.renderCalendar();
    }

    prevMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.renderCalendar();
    }

    nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.renderCalendar();
    }
}

// Make functions available globally
window.toggleChart = function (chartId) {
    document.getElementById('chart-placeholder-text').style.display = 'none';
    document.querySelectorAll('.chart-wrapper').forEach(wrapper => {
        wrapper.style.display = 'none';
    });
    const targetWrapper = document.getElementById('wrapper-' + chartId);
    if (targetWrapper) {
        targetWrapper.style.display = 'block';
    }
    document.querySelectorAll('.chart-nav-links a').forEach(link => {
        link.classList.remove('active-link');
        if (link.innerText.toLowerCase().includes(chartId.replace('Chart', '').toLowerCase())) {
            link.classList.add('active-link');
        }
    });
    const chartInstance = Chart.getChart(chartId);
    if (chartInstance) {
        chartInstance.resize();
        chartInstance.update();
    }
};

// Slideshow code
var images = [
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1600",
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1600",
    "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1600",
    "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1600",
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600",
    "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1600",
    "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=1600",
    "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1600",
    "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1600",
    "https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=1600"
];

var index = 0;
var slideElement = document.getElementById("slideshow");

function changeImage() {
    if (!slideElement) return;
    slideElement.style.opacity = 0;
    setTimeout(function () {
        index++;
        if (index >= images.length) { index = 0; }
        slideElement.src = images[index];
        slideElement.style.opacity = 1;
    }, 1500);
}

if (slideElement) {
    setInterval(changeImage, 5000);
    slideElement.src = images[0];
}