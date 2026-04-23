// 1. Initialize Supabase Client
const SUPABASE_URL = 'https://miiewkxzsffpaefgdztm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1paWV3a3h6c2ZmcGFlZmdkenRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxNjc4ODEsImV4cCI6MjA4Mjc0Mzg4MX0.fLN3Ncmqb_ynCAPQnNr0nKZ_S0olZ4kohu87M6-Luy8 ';

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
        await loadUserProfile();
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
                    toast.error(error.message, { title: "Login Failed" });
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
                await loadUserProfile();
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
                toast.success("You can now log in with your credentials", { title: "Account Created" });

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

// Professional Toast Notification System
class ToastManager {
    constructor() {
        this.container = null;
        this.toasts = [];
        this.createContainer();
    }

    createContainer() {

        if (!document.getElementById('toast-container')) {
            const container = document.createElement('div');
            container.id = 'toast-container';
            container.style.position = 'fixed';
            container.style.bottom = '20px';
            container.style.right = '20px';
            container.style.zIndex = '10000';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '10px';
            document.body.appendChild(container);
            this.container = container;
        } else {
            this.container = document.getElementById('toast-container');
        }
    }

    show(message, options = {}) {
        const {
            type = 'success',
            duration = 3000,
            title = '',
            position = 'bottom-right'
        } = options;

        const toast = document.createElement('div');
        toast.className = `toast-notification ${position}`;

        let iconHtml = '';
        switch (type) {
            case 'success':
                iconHtml = '<i class="fas fa-check-circle"></i>';
                break;
            case 'error':
                iconHtml = '<i class="fas fa-exclamation-circle"></i>';
                break;
            case 'info':
                iconHtml = '<i class="fas fa-info-circle"></i>';
                break;
            case 'warning':
                iconHtml = '<i class="fas fa-exclamation-triangle"></i>';
                break;
        }

        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-icon ${type}">${iconHtml}</div>
                <div class="toast-message">
                    ${title ? `<strong>${title}</strong><br>` : ''}
                    ${message}
                    ${duration === 0 ? '<small>Click to dismiss</small>' : ''}
                </div>
                <button class="toast-close">&times;</button>
            </div>
            ${duration > 0 ? '<div class="toast-progress"><div class="toast-progress-bar"></div></div>' : ''}
        `;

        // Adjust container position based on toast position
        if (position.includes('top')) {
            this.container.style.top = '20px';
            this.container.style.bottom = 'auto';
        } else {
            this.container.style.bottom = '20px';
            this.container.style.top = 'auto';
        }

        if (position.includes('left')) {
            this.container.style.left = '20px';
            this.container.style.right = 'auto';
        } else {
            this.container.style.right = '20px';
            this.container.style.left = 'auto';
        }

        this.container.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);

        // Close button
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.dismiss(toast));

        // Auto dismiss
        if (duration > 0) {
            setTimeout(() => this.dismiss(toast), duration);
        } else {
            toast.style.cursor = 'pointer';
            toast.addEventListener('click', () => this.dismiss(toast));
        }

        this.toasts.push(toast);
        return toast;
    }

    dismiss(toast) {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
            this.toasts = this.toasts.filter(t => t !== toast);
        }, 300);
    }

    success(message, options = {}) {
        return this.show(message, { ...options, type: 'success' });
    }

    error(message, options = {}) {
        return this.show(message, { ...options, type: 'error' });
    }

    info(message, options = {}) {
        return this.show(message, { ...options, type: 'info' });
    }

    warning(message, options = {}) {
        return this.show(message, { ...options, type: 'warning' });
    }
}

window.toast = new ToastManager();

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
            toast.error("Incorrect answer. Try again!", { title: "Challenge Failed" });
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
        if (!user) { toast.warning("Please log in to add study entries", { title: "Authentication Required" }); return; }

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
            toast.error(e.message, { title: "Save Failed" });
        }
    }


    async handleImport() {
        const fileInput = document.getElementById('csvFileInput');
        const file = fileInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target.result;
            const lines = text.split('\n');
            const headers = lines[0].split(',');

            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                const values = lines[i].split(',');
                const entry = {
                    date: values[0],
                    lessons: parseInt(values[1]) || 0,
                    friends: parseInt(values[2]) || 0,
                    writing: parseInt(values[3]) || 0,
                    outdoor: parseInt(values[4]) || 0
                };
                await this.addRowFromImport(entry);
            }
            alert("Import complete!");
            this.render();
        };
        reader.readAsText(file);
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

    searchEntries(query) {
        if (!query || query.trim() === "") {
            document.getElementById('searchResults').style.display = 'none';
            return;
        }

        const results = Object.values(this.entries).filter(entry =>
            entry.text?.toLowerCase().includes(query.toLowerCase()) ||
            entry.tasks?.some(task => task.toLowerCase().includes(query.toLowerCase()))
        );

        const resultsDiv = document.getElementById('searchResults');
        if (results.length === 0) {
            resultsDiv.innerHTML = '<div class="search-result-item">No results found</div>';
        } else {
            resultsDiv.innerHTML = results.map(entry => `
            <div class="search-result-item" onclick="app.diary.openEntry('${entry.date}')">
                <strong>${entry.date}</strong>: ${entry.text?.substring(0, 50)}...
            </div>
        `).join('');
        }
        resultsDiv.style.display = 'block';
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
// Slideshow images - Combined collection (Landscapes + Study themed)
var images = [
    // ========== STUDY & EDUCATION THEMED ==========
    "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1600",
    "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1600",
    "https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=1600",
    "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=1600",
    "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=1600",
    "https://images.unsplash.com/photo-1491841550275-ad7854e35ca6?w=1600",
    "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=1600",
    "https://images.unsplash.com/photo-1501351955260-111b16bb0f0f?w=1600",
    "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1600",
    "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1600",
    "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=1600",
    "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1600",
    "https://images.unsplash.com/photo-1513258496099-48168024aec0?w=1600",
    "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1600",
    "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1600",
    "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600",
    "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?w=1600",
    "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=1600",
    "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1600",
    "https://images.unsplash.com/photo-1456324504439-367cee3b3c32?w=1600",
    
    // ========== NATURE & LANDSCAPES ==========
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600",
    "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1600",
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1600",
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1600",
    "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1600",
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600",
    "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1600",
    "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1600",
    
    // ========== MOUNTAINS & ADVENTURE ==========
    "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=1600",
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1600",
    "https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=1600",
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1600",
    
    // ========== CITIES & ARCHITECTURE ==========
    "https://images.unsplash.com/photo-1444723121867-7a241cacace0?w=1600",
    "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1600",
    "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1600",
    "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=1600",
    "https://images.unsplash.com/photo-1485738422979-f5c462d49f74?w=1600",
    
    // ========== BEACHES & OCEANS ==========
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600",
    "https://images.unsplash.com/photo-1439405326854-014607f694d7?w=1600",
    "https://images.unsplash.com/photo-1532972190885-39314c1dd93e?w=1600",
    "https://images.unsplash.com/photo-1506953829328-27f2b71b9c4f?w=1600",
    
    // ========== FORESTS & TREES ==========
    "https://images.unsplash.com/photo-1448375240586-882707db888b?w=1600",
    "https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=1600",
    "https://images.unsplash.com/photo-1425913397330-cf8af2ff40a1?w=1600",
    "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=1600",
    
    // ========== SUNSETS & SUNRISES ==========
    "https://images.unsplash.com/photo-1503803548695-c2a7b4a5b875?w=1600",
    "https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=1600",
    "https://images.unsplash.com/photo-1500462918059-b1a0cb512f1d?w=1600",
    "https://images.unsplash.com/photo-1444080748397-f442aa95c3e5?w=1600",
    
    // ========== WATERFALLS & RIVERS ==========
    "https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=1600",
    "https://images.unsplash.com/photo-1473188588951-666fce8e7c68?w=1600",
    "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=1600",
    
    // ========== SNOW & WINTER ==========
    "https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22?w=1600",
    "https://images.unsplash.com/photo-1478265409131-1f65c88f965c?w=1600",
    "https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=1600",
    
    // ========== DESERTS ==========
    "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=1600",
    "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1600",
    
    // ========== SPACE & STARS ==========
    "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1600",
    "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1600",
    "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1600",
    "https://images.unsplash.com/photo-1506703719100-f0b3c0c7e4b9?w=1600",
    
    // ========== ANIMALS ==========
    "https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=1600",
    "https://images.unsplash.com/photo-1535268647677-300dbf3d6d1b?w=1600",
    "https://images.unsplash.com/photo-1484406566174-9da000fda645?w=1600",
    
    // ========== FLOWERS & GARDENS ==========
    "https://images.unsplash.com/photo-1490750967868-88aa4476b946?w=1600",
    "https://images.unsplash.com/photo-1491147334573-44c6dbe4f64a?w=1600",
    "https://images.unsplash.com/photo-1457100019745-aeb21a5eb517?w=1600",
    
    // ========== MORE BEAUTIFUL LANDSCAPES ==========
    "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1600",
    "https://images.unsplash.com/photo-1502657877623-f66bf489d236?w=1600",
    "https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=1600",
    "https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?w=1600",
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1600",
    "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=1600",
    "https://images.unsplash.com/photo-1510784722466-f2aa9c52fed6?w=1600",
    "https://images.unsplash.com/photo-1532274402911-5a3b04759bb2?w=1600",
    "https://images.unsplash.com/photo-1433086566711-470233665e72?w=1600",
    "https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=1600",
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600",
    "https://images.unsplash.com/photo-1470115636491-c59c5070f73b?w=1600",
    "https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=1600",
    "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=1600",
    "https://images.unsplash.com/photo-1493246507139-91e8bef99c02?w=1600",
    "https://images.unsplash.com/photo-1444464666168-49d633b86797?w=1600",
    "https://images.unsplash.com/photo-1445964047600-cdbdb873673d?w=1600"
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

function downloadCSV() {
    console.log("Download button clicked");

    if (!window.app || !window.app.store) {
        alert("App not ready. Please wait.");
        return;
    }

    const data = window.app.store.data;

    if (!data || data.length === 0) {
        toast.error("No study data found", { title: "Cannot Download" });
        return;
    }

    let csv = "Date,Lessons,Social,Writing,Outdoor\n";
    for (const row of data) {
        csv += `"${row.date || ""}",${row.lessons || 0},${row.friends || 0},${row.writing || 0},${row.outdoor || 0}\n`;
    }

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `study_data_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(`Downloaded ${data.length} records`, { title: "Download Complete" });
}

// ============================================
// COMPLETE PROFILE SYSTEM WITH PICTURE UPLOAD
// ============================================

// Load user profile
async function loadUserProfile() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (!session) return;

    const userId = session.user.id;
    const email = session.user.email;
    const firstName = session.user.user_metadata?.firstname || email.split('@')[0];

    try {
        // Get profile from database
        let { data: profile, error } = await _supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        // If no profile exists, create one
        if (!profile) {
            const { data: newProfile, error: insertError } = await _supabase
                .from('profiles')
                .insert({
                    id: userId,
                    firstname: firstName,
                    created_at: new Date(),
                    updated_at: new Date()
                })
                .select()
                .single();

            if (!insertError && newProfile) {
                profile = newProfile;
            }
        }

        // Update UI with profile data
        const displayName = profile?.firstname || firstName;
        document.getElementById('profile-display-name').innerText = displayName;

        const nameInput = document.getElementById('profile-name');
        if (nameInput) nameInput.value = displayName;

        const emailInput = document.getElementById('profile-email');
        if (emailInput) emailInput.value = email;

        // Member since
        const joinedDate = profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : new Date().toLocaleDateString();
        const joinedInput = document.getElementById('profile-joined');
        if (joinedInput) joinedInput.value = joinedDate;

        // Theme preference
        const savedTheme = profile?.theme || 'dark';
        const themeSelect = document.getElementById('profile-theme');
        if (themeSelect) themeSelect.value = savedTheme;

        // Notifications preference
        const notifCheckbox = document.getElementById('profile-notifications');
        if (notifCheckbox) notifCheckbox.checked = profile?.notifications ?? true;

        // Handle avatar
        let avatarUrl = profile?.avatar_url;
        if (!avatarUrl || avatarUrl === '') {
            // Generate avatar with initials
            const initial = displayName.charAt(0).toUpperCase();
            avatarUrl = `https://ui-avatars.com/api/?background=2ecc71&color=fff&bold=true&size=120&length=1&name=${initial}`;
        }

        // Update all avatar images
        const footerAvatar = document.getElementById('user-profile-pic');
        const modalAvatar = document.getElementById('modal-avatar-img');

        if (footerAvatar) footerAvatar.src = avatarUrl;
        if (modalAvatar) modalAvatar.src = avatarUrl;

        // Apply theme
        applyTheme(savedTheme);

    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

// Upload profile picture - WORKING VERSION
async function uploadProfilePicture(input) {
    const file = input.files[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
        showNotification('Please select an image file', 'error');
        return;
    }

    if (file.size > 2 * 1024 * 1024) {
        showNotification('Image must be less than 2MB', 'error');
        return;
    }

    // Show loading
    const modalAvatar = document.getElementById('modal-avatar-img');
    const originalSrc = modalAvatar?.src;
    if (modalAvatar) {
        modalAvatar.style.opacity = '0.5';
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async function (e) {
        const base64Image = e.target.result;

        // Update preview
        if (modalAvatar) {
            modalAvatar.src = base64Image;
            modalAvatar.style.opacity = '1';
        }

        // Save to Supabase
        const { data: { session } } = await _supabase.auth.getSession();
        if (!session) {
            showNotification('Please login first', 'error');
            return;
        }

        const { error } = await _supabase
            .from('profiles')
            .update({
                avatar_url: base64Image,
                updated_at: new Date()
            })
            .eq('id', session.user.id);

        if (error) {
            console.error('Upload error:', error);
            showNotification('Failed to save image', 'error');
            // Revert on error
            if (modalAvatar) modalAvatar.src = originalSrc;
        } else {
            showNotification('Profile picture updated!', 'success');
            // Update footer avatar
            const footerAvatar = document.getElementById('user-profile-pic');
            if (footerAvatar) footerAvatar.src = base64Image;
        }
    };

    reader.onerror = function () {
        showNotification('Error reading file', 'error');
        if (modalAvatar) modalAvatar.style.opacity = '1';
    };

    reader.readAsDataURL(file);
}

// Save profile settings
async function saveProfileSettings() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (!session) {
        showNotification('Please login first', 'error');
        return;
    }

    const displayName = document.getElementById('profile-name')?.value.trim();
    const theme = document.getElementById('profile-theme')?.value;
    const notifications = document.getElementById('profile-notifications')?.checked;

    if (!displayName) {
        showNotification('Please enter a display name', 'error');
        return;
    }

    // Show saving state
    const saveBtn = document.querySelector('.save-profile-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    try {
        const { error } = await _supabase
            .from('profiles')
            .update({
                firstname: displayName,
                theme: theme,
                notifications: notifications,
                updated_at: new Date()
            })
            .eq('id', session.user.id);

        if (error) throw error;

        // Update UI
        document.getElementById('profile-display-name').innerText = displayName;

        // Update greeting
        const greetingElement = document.getElementById('main-greeting');
        if (greetingElement) {
            const hour = new Date().getHours();
            let greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
            greetingElement.innerText = `${greeting}, ${displayName}`;
        }

        // Update avatar initials if no custom avatar
        const currentAvatar = document.getElementById('user-profile-pic')?.src;
        if (currentAvatar && currentAvatar.includes('ui-avatars.com')) {
            const initial = displayName.charAt(0).toUpperCase();
            const newAvatar = `https://ui-avatars.com/api/?background=2ecc71&color=fff&bold=true&size=120&length=1&name=${initial}`;
            document.getElementById('user-profile-pic').src = newAvatar;
            document.getElementById('modal-avatar-img').src = newAvatar;
        }

        // Apply theme
        applyTheme(theme);

        showNotification('Profile settings saved!', 'success');
        closeProfileModal();

    } catch (error) {
        console.error('Save error:', error);
        showNotification('Failed to save settings', 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
        }
    }
}

// Apply theme (light/dark)
function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-theme');
        document.body.classList.remove('dark-theme');
    } else if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
    }
}

// Show notification (uses toast if available)
function showNotification(message, type = 'success') {
    if (window.toast) {
        if (type === 'success') toast.success(message);
        else if (type === 'error') toast.error(message);
        else toast.info(message);
    } else {
        alert(message);
    }
}

// Profile modal functions
function openProfileModal() {
    const modal = document.getElementById('profileModal');
    if (modal) {
        loadUserProfile();
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
    }
}

// Upload profile picture
async function uploadProfilePicture(input) {
    const file = input.files[0];
    if (!file) return;

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
        alert('Image too large! Max 2MB');
        return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async function (e) {
        const imageUrl = e.target.result;

        // Update profile picture preview
        document.getElementById('user-profile-pic').src = imageUrl;

        // Save to database
        const { data: { session } } = await _supabase.auth.getSession();
        if (session) {
            const { error } = await _supabase
                .from('profiles')
                .upsert({
                    id: session.user.id,
                    avatar_url: imageUrl,
                    firstname: session.user.user_metadata?.firstname || session.user.email.split('@')[0]
                });

            if (error) {
                console.error('Save error:', error);
                alert('Failed to save picture');
            } else {
                alert('Profile picture updated!');
            }
        }
    };
    reader.readAsDataURL(file);
}

// Load profile picture when page loads
async function loadProfilePicture() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (!session) return;

    const { data: profile } = await _supabase
        .from('profiles')
        .select('avatar_url, firstname')
        .eq('id', session.user.id)
        .single();

    if (profile) {
        if (profile.avatar_url) {
            document.getElementById('user-profile-pic').src = profile.avatar_url;
        }
        if (profile.firstname) {
            document.getElementById('profile-display-name').innerText = profile.firstname;
        }
    }
}

function closeProfileModal() {
    const modal = document.getElementById('profileModal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

function openProfileSettings() {
    openProfileModal();
}

// Close modal when clicking outside
document.addEventListener('click', function (e) {
    const modal = document.getElementById('profileModal');
    if (e.target === modal) {
        closeProfileModal();
    }
});

// Add this to your existing showAppContent function
const originalShowAppContent = window.showAppContent;
if (originalShowAppContent) {
    window.showAppContent = async function (user) {
        await originalShowAppContent(user);
        await loadUserProfile();
        await loadProfilePicture();
    };
}

// Apply privacy settings to main app
function applyPrivacySettings() {
    const settings = JSON.parse(localStorage.getItem('privacy_settings_cached') || '{}');
    
    // Disable analytics if user opted out
    if (settings.analytics === false) {
        console.log('📊 Analytics disabled by user');
        // Disable any tracking calls here
    }
    
    // Disable personalization if opted out  
    if (settings.personalization === false) {
        console.log('🎯 Personalization disabled by user');
        // Disable recommendation features
    }
    
    // Apply cookie preferences
    if (settings.cookies === false) {
        console.log('🍪 Non-essential cookies disabled');
        // Disable non-essential cookies
    }
}

// Call this when app starts
applyPrivacySettings();