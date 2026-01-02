// 1. Initialize Supabase Client
const SUPABASE_URL = 'https://miiewkxzsffpaefgdztm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1paWV3a3h6c2ZmcGFlZmdkenRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxNjc4ODEsImV4cCI6MjA4Mjc0Mzg4MX0.fLN3Ncmqb_ynCAPQnNr0nKZ_S0olZ4kohu87M6-Luy8';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

class StudyDataStore {

    constructor() {
        this.data = [];
    }

    // Pull all data from Supabase
    async fetchAll() {
        const { data, error } = await _supabase
            .from('tracker')
            .select('*')
            .order('date', { ascending: true });

        if (error) {
            console.error('Error fetching data:', error);
            return [];
        }
        this.data = data;
        return data;
    }

    // Add a single record
    async addRecord(entry) {
        const { data, error } = await _supabase
            .from('tracker')
            .insert([entry])
            .select();

        if (error) throw error;
        return data;
    }

    // Update a record
    async updateRecord(id, updates) {
        const { error } = await _supabase
            .from('tracker')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
    }

    // Delete a record
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
        this.masterCode = "739512"; // This is stored locally in your JS file

        this.challenges = [
            { q: "What was the shortest war in history?", a: "Anglo-Zanzibar War" },
            { q: "How many continents are there?", a: "7" },
            { q: "Square root of 81?", a: "9" },
            { q: "Hardest natural substance?", a: "Diamond" },
            { q: "Gas plants breathe in?", a: "Carbon Dioxide" },
            { q: "Seconds in 2 minutes?", a: "120" }
        ];
        this.init();
    }

    init() {
    const chartBtn = document.getElementById('chartTypeSelector');
    if (chartBtn) {
        chartBtn.addEventListener('change', (e) => this.changeChartType(e.target.value));
    } else {
        console.warn("Element 'chartTypeSelector' not found in HTML.");
    }
}

    // Swaps between Question view and Master Code view
    toggleBypass(showBypass) {
        document.getElementById('question-sequence').style.display = showBypass ? 'none' : 'block';
        document.getElementById('bypass-sequence').style.display = showBypass ? 'block' : 'none';
        if (showBypass) document.getElementById('master-code-input').focus();
    }

    // Checks the Master Code written inside the box
    verifyMaster() {
        const inputField = document.getElementById('master-code-input');
        const enteredCode = inputField.value;

        // Check against the code written inside the script
        if (enteredCode === "739512") {
            // Success: Unlock all 6 visual slots
            for (let i = 0; i < 6; i++) {
                const slot = document.getElementById(`slot-${i}`);
                slot.innerText = "739512"[i];
                slot.classList.add('revealed');
            }

            // Switch views
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
        this.currentChartType = 'bar'; // Default starting type
        this.diary = new DiaryManager(this);
    }

    async start() {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('main-nav').style.display = 'block';
        document.getElementById('app-content').style.display = 'block';

        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 30);
        document.getElementById('filterEnd').value = end.toISOString().split('T')[0];
        document.getElementById('filterStart').value = start.toISOString().split('T')[0];

        this.updateDisplayDate();
        this.initChart();

        await this.store.fetchAll();
        this.render();
    }

    // Handlers for dynamic switching
   changeChartType(newType) {
    this.currentChartType = newType;

    // 1. Clear the old chart
    if (this.chart) {
        this.chart.destroy();
    }

    // 2. Handle Bubble vs Standard
    const standardCanvas = document.getElementById('standardChart');
    const bubbleContainer = document.getElementById('bubbleChartContainer');

    if (newType === 'bubble') {
        // Show bubble, hide standard
        if (standardCanvas) standardCanvas.style.display = 'none';
        if (bubbleContainer) bubbleContainer.style.display = 'block';
        this.updateBubbleChart(); 
    } else {
        // Show standard, hide bubble
        if (standardCanvas) standardCanvas.style.display = 'block';
        if (bubbleContainer) bubbleContainer.style.display = 'none';
        this.initChart(); // Re-init for bar/line
        this.updateChart();
    }
}
    initChart() {
        const ctx = document.getElementById('timeChart').getContext('2d');

        const config = {
            type: this.currentChartType,
            data: { labels: [], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {} // Start empty, filled below
            }
        };

        // Pie charts do not use X/Y scales
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
            // Data Structure for Pie Chart
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
            // Data Structure for Bar / Line / Radar
            this.chart.data.labels = filtered.map(d => d.date || d.Date);
            this.chart.data.datasets = keys.map((key, i) => ({
                label: key.charAt(0).toUpperCase() + key.slice(1),
                data: filtered.map(item => parseInt(item[key]) || 0),
                backgroundColor: colors[i],
                borderColor: colors[i],
                borderWidth: 2,
                // Keep the 'outdoor' contrast if in bar mode
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

    // --- Data Management Methods ---

    async addRow() {
        const dateVal = document.getElementById('newDate').value;
        if (!dateVal) { alert("Please select a date first!"); return; }

        const newEntry = {
            date: dateVal,
            lessons: parseInt(document.getElementById('newLessons').value) || 0,
            friends: parseInt(document.getElementById('newFriends').value) || 0,
            writing: parseInt(document.getElementById('newWriting').value) || 0,
            outdoor: parseInt(document.getElementById('newOutdoor').value) || 0
        };

        try {
            await this.store.addRecord(newEntry);
            await this.store.fetchAll(); // Refresh local cache
            this.render();

            ['newDate', 'newLessons', 'newFriends', 'newWriting', 'newOutdoor'].forEach(id => {
                document.getElementById(id).value = '';
            });
        } catch (e) {
            alert("Error saving to database");
        }
    }

    render() {
        const tbody = document.getElementById('tableBody');
        if (!tbody) return;

        const sortedData = [...this.store.data].sort((a, b) =>
            new Date(a.date || a.Date) - new Date(b.date || b.Date)
        );

        tbody.innerHTML = this.store.data.map((row) => {
            return `
            <tr>
                <td>
                    <input type="date" value="${row.date}" 
                           class="inline-date-input" 
                           onchange="app.handleEdit(${row.id}, 'date', this.value)">
                </td>
                <td contenteditable="true" onblur="app.handleEdit(${row.id}, 'lessons', this.innerText)">${row.lessons}</td>
                <td contenteditable="true" onblur="app.handleEdit(${row.id}, 'friends', this.innerText)">${row.friends}</td>
                <td contenteditable="true" onblur="app.handleEdit(${row.id}, 'writing', this.innerText)">${row.writing}</td>
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
            await this.store.updateRecord(dbId, updateObj);
            await this.store.fetchAll();
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

    // --- Import/Export ---

    handleImport() {
        const fileInput = document.getElementById('csvFileInput');
        const file = fileInput.files[0];
        if (!file) { alert("Please select a CSV file first!"); return; }

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            // Split by lines and remove empty ones
            const rows = text.split('\n').map(r => r.trim()).filter(r => r !== '');
            if (rows.length < 2) return;

            // Parse headers (first row)
            const headers = rows[0].split(',').map(h => h.trim().toLowerCase());

            // Parse data rows
            const newData = rows.slice(1).map(row => {
                const values = row.split(',');
                let entry = {};
                headers.forEach((header, i) => {
                    let val = (values[i] || "").trim();
                    if (header === 'date') {
                        entry.date = val;
                    } else {
                        // Convert stats to numbers
                        entry[header] = parseFloat(val) || 0;
                    }
                });
                return entry;
            });

            // Update Local Storage
            const combinedData = [...this.store.data, ...newData];
           this.store.data = combinedData;


            // Refresh UI
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
    
}

class DiaryManager {
    constructor(app) {
        this.app = app;
        this.currentDate = new Date();
        this.selectedDate = null;
        this.entries = {}; 
    }

    async fetchEntries() {
        const { data, error } = await _supabase
            .from('diary')
            .select('*');

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
    const diaryBox = document.getElementById('diaryText');
    const errorMsg = document.getElementById('diaryError');
    const text = diaryBox.value.trim();
    
    if (!text) {
   
        errorMsg.style.display = 'block';
        diaryBox.style.borderColor = '#ff4d4f';
        diaryBox.focus(); 
        return; 
    }

    errorMsg.style.display = 'none';
    diaryBox.style.borderColor = '#ccc';

    const mood = document.getElementById('moodSelect').value;
    const currentTasks = this.entries[this.selectedDate]?.tasks || [];

    const { error } = await _supabase
        .from('diary')
        .upsert({
            date: this.selectedDate,
            text: text,
            mood: mood,
            tasks: currentTasks
        });

    if (!error) {
        alert("Saved successfully!");
        await this.fetchEntries();
    }
}

   async addTask() {
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
            mood: currentEntry.mood
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
    if (!this.selectedDate || !this.entries[this.selectedDate]) return;

    const updatedTasks = [...this.entries[this.selectedDate].tasks];
    updatedTasks.splice(index, 1);

    const { error } = await _supabase
        .from('diary')
        .upsert({
            date: this.selectedDate,
            tasks: updatedTasks,
            text: this.entries[this.selectedDate].text || '',
            mood: this.entries[this.selectedDate].mood || 'neutral'
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
    // 1. Hide the placeholder text
    document.getElementById('chart-placeholder-text').style.display = 'none';

    // 2. Hide all chart wrappers
    document.querySelectorAll('.chart-wrapper').forEach(wrapper => {
        wrapper.style.display = 'none';
    });

    // 3. Show the selected chart wrapper
    const targetWrapper = document.getElementById('wrapper-' + chartId);
    if (targetWrapper) {
        targetWrapper.style.display = 'block';
    }

    // 4. Highlight the active link
    document.querySelectorAll('.chart-nav-links a').forEach(link => {
        link.classList.remove('active-link');
        if (link.innerText.toLowerCase().includes(chartId.replace('Chart', '').toLowerCase())) {
            link.classList.add('active-link');
        }
    });

    // 5. Force the specific chart to resize and update
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
    "https://images.unsplash.com/photo-1431440653446-afb335c59ca2?w=1600",
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

setInterval(changeImage, 10000);

document.addEventListener('DOMContentLoaded', async () => {
    
    const store = new StudyDataStore();
    window.app = new StudyAppUI(store);

    
    await store.fetchAll(); 
    await window.app.diary.fetchEntries(); 

    window.app.render();
    window.app.passcode = new PasscodeManager(window.app);
    window.app.passcode.loadQuestion();
    
});