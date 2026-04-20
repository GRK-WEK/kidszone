
// 1. Initialize Supabase Client
const SUPABASE_URL = 'https://miiewkxzsffpaefgdztm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1paWV3a3h6c2ZmcGFlZmdkenRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxNjc4ODEsImV4cCI6MjA4Mjc0Mzg4MX0.fLN3Ncmqb_ynCAPQnNr0nKZ_S0olZ4kohu87M6-Luy8 ';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async () => {
    const store = new StudyDataStore();
    window.app = new StudyAppUI(store);
    const { data: { session } } = await _supabase.auth.getSession();

    if (session) {
        await store.fetchAll(session.user.id);
        await window.app.diary.fetchEntries(session.user.id);
        showAppContent(session.user);
    } else {
        const overlay = document.getElementById('login-overlay');
        if (overlay) overlay.style.display = 'flex';
    }

    const showLogin = document.getElementById('show-login-link');
    const showSignup = document.getElementById('show-signup-link');
    const signupStep = document.getElementById('signup-step');
    const loginStep = document.getElementById('login-step');

    if (showLogin) {
        showLogin.addEventListener('click', (e) => {
            e.preventDefault();
            signupStep.style.display = 'none';
            loginStep.style.display = 'block';
        });
    }

    if (showSignup) {
        showSignup.addEventListener('click', (e) => {
            e.preventDefault();
            loginStep.style.display = 'none';
            signupStep.style.display = 'block';
        });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;

            if (!email || !password) {
                alert("Wait! You forgot to type your email or password.");
                return;
            }

            const { data, error } = await _supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                console.error("Supabase Auth Error:", error.message);
                alert("Login failed: " + error.message);
            } else {
                const profiles_id = data.user.id;
                console.log("Success! Profile ID:", profiles_id);

                const { error: profileError } = await _supabase
                    .from('profiles')
                    .upsert({ id: profiles_id, firstname: data.user.user_metadata.firstname || "Guest" });

                if (profileError) {
                    console.error("Error saving profile:", profileError.message);
                }

                await store.fetchAll(profiles_id);
                await window.app.diary.fetchEntries(profiles_id);
                showAppContent(data.user);
            }
        });
    }
});
function showAppContent(user) {

    const hour = new Date().getHours();
    let greeting = "Good evening";

    if (hour < 12) {
        greeting = "Good morning";
    } else if (hour < 18) {
        greeting = "Good afternoon";
    }

    // 2. Hide Login/Signup UI
    const loginStep = document.getElementById('login-step');
    const signupStep = document.getElementById('signup-step');
    const overlay = document.getElementById('login-overlay');
    const quiz = document.querySelector('.login-card');

    if (loginStep) loginStep.style.display = 'none';
    if (signupStep) signupStep.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
    if (quiz) quiz.style.display = 'none';


    const emailName = user.email ? user.email.split('@')[0] : "Guest";
    const capitalizedName = emailName.charAt(0).toUpperCase() + emailName.slice(1);

    const welcomeHeading = document.getElementById('main-greeting');

    if (welcomeHeading) {

        const fullGreeting = `${greeting}, ${capitalizedName}`;

        console.log("Found the heading! Setting text to:", fullGreeting);

        welcomeHeading.innerText = fullGreeting;
    } else {
        console.error("Could not find an element with id='main-greeting'. Check your HTML footer!");
    }


    _supabase.from('profiles')
        .select('firstname')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data,
            error }) => {
            let nameToShow = capitalizedName;
            if (data && data.firstname && data.firstname !== "Guest") {
                nameToShow = data.firstname;
            }

            const footerName = document.getElementById('footer-user-name')?.querySelector('h1');
            if (footerName) {
                footerName.innerText = nameToShow;
            }
        });

    // 6. Start the App Logic
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
            this.data = data;
            return data;
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
        return data;
    }

    async updateRecord(id, updates) {
        const { error } = await _supabase
            .from('tracker')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
    }

    async deleteRecord(id) {
        const { error } = await _supabase
            .from('tracker')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
}

class StudyDataLocalStore {
    constructor() {
        this.storageKey = 'notion_study_tracker_v5';
        this.data = JSON.parse(localStorage.getItem(this.storageKey)) || [];
    }

    save(newData) {
        this.data = newData.sort((a, b) => new Date(a.date || a.Date) - new Date(b.date || b.Date));
        localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    }
}

class PasscodeManager {
    constructor(app) {
        this.app = app;
        this.currentStep = 0;
        this.masterCode = "739512";
        this.challenges = [];

        this.loadQuestion();
        this.challenges = [
            { q: "What was the shortest war in history?", a: "Anglo-Zanzibar War", img: "https://cdn.britannica.com/33/258533-138-8E8958F4/anglo-zanzibar-war-august-27-1896.jpg?w=800&h=450&c=crop" },
            { q: "How many continents are there?", a: "7", img: "https://miro.medium.com/v2/resize:fit:720/format:webp/1*wIhzDQkzhdSvUq7SDFGdcg.png" },
            { q: "Square root of 81?", a: "9", img: "https://www.freepik.com/free-psd/glossy-red-numbers-with-white-3d-letter-9_417252495.htm#fromView=keyword&page=1&position=1&uuid=e0dff457-03d3-4d37-9563-b3bacef73e95&query=Number+9" },
            { q: "Hardest natural substance?", a: "Diamond", img: "https://docs.growndiamondcorp.com/blog/types-of-diamonds.png" },
            { q: "Gas plants breathe in?", a: "Carbon Dioxide", img: "https://www.freepik.com/free-vector/oxygen-cycle-diagram-science-education_39207658.htm#fromView=search&page=1&position=0&uuid=4cb89849-2de8-40b4-9664-baccdd93bee0&query=carbon+dioxide" },
            { q: "Seconds in 2 minutes?", a: "120", img: "" }
        ];
    }

    init() {
        this.currentStep = 0;
        this.revealedSlots = 0;
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

    toggleBypass(showBypass) {
        document.getElementById('question-sequence').style.display = showBypass ? 'none' : 'block';
        document.getElementById('bypass-sequence').style.display = showBypass ? 'block' : 'none';
        if (showBypass) document.getElementById('master-code-input').focus();
    }

    verifyMaster() {
        const inputField = document.getElementById('master-code-input');
        const enteredCode = inputField.value;

        if (enteredCode === "739512") {
            for (let i = 0; i < 6; i++) {
                const slot = document.getElementById(`slot-${i}`);
                slot.innerText = "739512"[i];
                slot.classList.add('revealed');
            }

            document.getElementById('bypass-sequence').style.display = 'none';
            document.getElementById('final-unlock').style.display = 'block';
        } else {
            inputField.style.border = "2px solid red";
            alert("Incorrect Code. Access Denied.");
        }
    }

    loadQuestion() {
        if (this.currentStep < this.challenges.length) {
            document.getElementById('quest-text').innerText = this.challenges[this.currentStep].q;
            document.getElementById('quest-answer').value = '';
        }
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
                this.loadQuestion();
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

        const standardCanvas = document.getElementById('timeChart');
        const bubbleContainer = document.getElementById('bubbleChartContainer');

        if (newType === 'bubble') {
            if (standardCanvas) standardCanvas.style.display = 'none';
            if (bubbleContainer) bubbleContainer.style.display = 'block';
            this.updateBubbleChart();
        } else {
            if (standardCanvas) standardCanvas.style.display = 'block';
            if (bubbleContainer) bubbleContainer.style.display = 'none';
            this.initChart();
            this.updateChart();
        }
    }

    initChart() {
        const ctx = document.getElementById('timeChart').getContext('2d');

        if (this.chart) {
            this.chart.destroy();
        }

        const config = {
            type: this.currentChartType,
            data: { labels: [], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {}
            }
        };

        if (this.currentChartType !== 'pie') {
            config.options.scales = {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Minutes' }
                }
            };
        }

        this.chart = new Chart(ctx, config);
    }

    updateChart() {
        if (!this.chart) return;

        const startInput = document.getElementById('filterStart').value;
        const endInput = document.getElementById('filterEnd').value;
        const start = startInput ? new Date(startInput) : new Date('2000-01-01');
        const end = endInput ? new Date(endInput) : new Date('2099-12-31');

        const filtered = this.store.data.filter(item => {
            const d = new Date(item.date || item.Date);
            return d >= start && d <= end;
        }).sort((a, b) => new Date(a.date || a.Date) - new Date(b.date || b.Date));

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
            this.chart.data.labels = filtered.map(d => d.date || d.Date);
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

    render() {
        const tbody = document.getElementById('tableBody');
        if (!tbody) return;

        tbody.innerHTML = this.store.data.map((row) => {
            const cleanDate = row.date ? row.date.split('T')[0] : "";

            return `
            <tr>
                <td>
                    <input type="date" value="${cleanDate}" 
                        class="inline-date-input" 
                        onchange="app.handleEdit(${row.id}, 'date', this.value)">
                </td>
                <td contenteditable="true" onblur="app.handleEdit(${row.id}, 'lessons', this.innerText)">${row.writing}</td>
                <td contenteditable="true" onblur="app.handleEdit(${row.id}, 'friends', this.innerText)">${row.friends}</td>
                <td contenteditable="true" onblur="app.handleEdit(${row.id}, 'writing', this.innerText)">${row.lessons}</td>
                <td contenteditable="true" onblur="app.handleEdit(${row.id}, 'outdoor', this.innerText)">${row.outdoor}</td>
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
            await this.store.fetchAll();
            this.render();
        }
    }

    updateSummary(data) {
        const totals = data.reduce((acc, curr) => ({
            l: acc.l + (Number(curr.lessons || curr.Lessons) || 0),
            f: acc.f + (Number(curr.friends || curr.Friends) || 0),
            w: acc.w + (Number(curr.writing || curr.Writing) || 0),
            o: acc.o + (Number(curr.outdoor || curr.Outdoor) || 0)
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

    handleImport() {
        const fileInput = document.getElementById('csvFileInput');
        const file = fileInput.files[0];
        if (!file) { alert("Please select a CSV file first!"); return; }

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const rows = text.split('\n').map(r => r.trim()).filter(r => r !== '');
            if (rows.length < 2) return;

            const headers = rows[0].split(',').map(h => h.trim().toLowerCase());

            const newData = rows.slice(1).map(row => {
                const values = row.split(',');
                let entry = {};
                headers.forEach((header, i) => {
                    let val = (values[i] || "").trim();
                    if (header === 'date') {
                        entry.date = val;
                    } else {
                        entry[header] = parseFloat(val) || 0;
                    }
                });
                return entry;
            });

            const combinedData = [...this.store.data, ...newData];
            this.store.data = combinedData;

            this.render();
            fileInput.value = '';
            alert(`Successfully imported ${newData.length} rows!`);
        };
        reader.readAsText(file);
    }

    resetWorkspace() {
        const confirmAll = confirm("⚠️ PERMANENT RESET: This will delete ALL study logs, table data, and diary entries. Are you sure?");

        if (confirmAll) {
            this.store.data = [];
            localStorage.removeItem(this.store.storageKey);
            if (this.diary) {
                this.diary.entries = {};
                localStorage.removeItem('diary_entries');
            }
            if (this.chart) {
                this.chart.destroy();
                this.initChart();
            }
            this.render();
            if (this.diary) {
                this.diary.renderCalendar();
            }

            alert("Workspace is now fresh and empty!");
        }
    }

    downloadTemplate() {
        const data = app.store.data;

        if (!data || data.length === 0) {
            alert("No data found to download! Add some entries first.");
            return;
        }

        const headers = ["Date", "Lessons", "Social", "Writing", "Outdoor"];

        const csvRows = data.map(row => {
            return [
                row.date,
                row.lessons,
                row.friends || row.social,
                row.writing,
                row.outdoor
            ].join(",");
        });

        const csvContent = [headers.join(","), ...csvRows].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.setAttribute("href", url);
        link.setAttribute("download", `study_data_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    save(newData) {
        this.data = newData.sort((a, b) => {
            const dateA = new Date(a.date || a.Date);
            const dateB = new Date(b.date || b.Date);
            return dateA - dateB;
        });

        localStorage.setItem(this.storageKey, JSON.stringify(this.data));
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
            await this.fetchEntries();
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
            await this.fetchEntries();
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
        document.getElementById('diaryEditor').style.display = 'block';
        document.getElementById('selectedDateDisplay').innerText = dateStr;

        const entry = this.entries[dateStr] || { text: '', tasks: [], mood: 'neutral' };
        document.getElementById('diaryText').value = entry.text || '';
        document.getElementById('moodSelect').value = entry.mood || 'neutral';
        this.renderTasks(entry.tasks || []);

        this.renderCalendar();
    }

    prevMonth() { this.currentDate.setMonth(this.currentDate.getMonth() - 1); this.renderCalendar(); }
    nextMonth() { this.currentDate.setMonth(this.currentDate.getMonth() + 1); this.renderCalendar(); }
}

toggleChart = function (chartId) {

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
    }); f

    const chartInstance = Chart.getChart(chartId);
    if (chartInstance) {
        chartInstance.resize();
        chartInstance.update();
    }


};


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
    "https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=1600",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600",
    "https://images.unsplash.com/photo-1499346030926-9a72daac6c63?w=1600",
    "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=1600",
    "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1600",
    "https://images.unsplash.com/photo-1473081556163-2a17de81fc97?w=1600",
    "https://images.unsplash.com/photo-1470252649358-96f3c8024217?w=1600",
    "https://images.unsplash.com/photo-1495539406979-bf61750d38ad?w=1600",
    "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1600",
    "https://images.unsplash.com/photo-1534067783941-51c9c23ecefd?w=1600",
    "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1600",
    "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1600",
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1600",
    "https://images.unsplash.com/photo-1511884642898-4c92249e20b6?w=1600",
    "https://images.unsplash.com/photo-1434725039720-abb26ce5a841?w=1600",
    "https://images.unsplash.com/photo-1532274402911-5a3b04759bb2?w=1600",
    "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=1600",
    "https://images.unsplash.com/photo-1433086566711-470233665e72?w=1600",
    "https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=1600",
    "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=1600",
    "https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=1600",
    "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1600",
    "https://images.unsplash.com/photo-1510784722466-f2aa9c52fed6?w=1600",
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600",
    "https://images.unsplash.com/photo-1470115636491-c59c5070f73b?w=1600",
    "https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=1600",
    "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=1600",
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1600",
    "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=1600",
    "https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?w=1600",
    "https://images.unsplash.com/photo-1441834491424-409521597dbc?w=1600",
    "https://images.unsplash.com/photo-1504198453319-5ce911bafcde?w=1600",
    "https://images.unsplash.com/photo-1455218873509-8097305ee378?w=1600",
    "https://images.unsplash.com/photo-1431411207774-da3c7311b5e8?w=1600",
    "https://images.unsplash.com/photo-1502675135487-e971002a6adb?w=1600",
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1600",
    "https://images.unsplash.com/photo-1444464666168-49d633b86797?w=1600",
    "https://images.unsplash.com/photo-1445964047600-cdbdb873673d?w=1600",
    "https://images.unsplash.com/photo-1493246507139-91e8bef99c02?w=1600",
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1600"
];

var index = 0;
var slideElement = document.getElementById("slideshow");

function changeImage() {
    slideElement.style.opacity = 0; // Fade out

    setTimeout(function () {
        index++;
        if (index >= images.length) { index = 0; }
        slideElement.src = images[index];
        slideElement.style.opacity = 1; // Fade in
    }, 1500);

}

setInterval(changeImage, 5000);

slideElement.src = images[0];
