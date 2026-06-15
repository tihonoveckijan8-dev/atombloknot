/**
 * Notes — Премиальные заметки с жидким стеклом
 */
(() => {
    'use strict';

    const STORAGE_NOTES = 'nova_notes_data';
    const STORAGE_CATS = 'nova_notes_categories';
    const STORAGE_TASKS = 'nova_notes_tasks';
    const STORAGE_THEME = 'nova_notes_theme';
    const STORAGE_GS_URL = 'nova_notes_gs_url';

    const BUILTIN_CATS = [
        { id: 'personal', name: 'Личные', color: '#c9a87c', builtin: true },
        { id: 'reading', name: 'Чтение', color: '#7cb5c9', builtin: true },
        { id: 'work', name: 'Работа', color: '#8bc97c', builtin: true },
        { id: 'ideas', name: 'Идеи', color: '#c97cb5', builtin: true }
    ];

    const DEFAULT_NOTES = [
        { id: '1', title: 'Добро пожаловать!', content: '<p>Приложение с жидким стеклом и 4 темами.</p><p>Переключайте темы в настройках!</p><p><b>Тёмная</b> · <i>Светлая</i> · <b>Кибер</b> · <b>Аврора</b></p>', category: 'personal', createdAt: Date.now(), updatedAt: Date.now() },
        { id: '2', title: 'Список книг', content: '<ol><li>Мастер и Маргарита</li><li>1984</li><li>Маленький принц</li></ol>', category: 'reading', createdAt: Date.now() - 86400000, updatedAt: Date.now() - 86400000 },
        { id: '3', title: 'Задачи на неделю', content: '<ul><li>Понедельник: Созвон</li><li>Вторник: Ревью</li><li>Среда: Документация</li></ul>', category: 'work', createdAt: Date.now() - 172800000, updatedAt: Date.now() - 172800000 },
        { id: '4', title: 'Идеи для проекта', content: '<p>Жидкое стекло</p><p>4 темы</p><p>Чёткие иконки</p>', category: 'ideas', createdAt: Date.now() - 259200000, updatedAt: Date.now() - 259200000 }
    ];

    let notes = [], categories = [], tasks = [];
    let activeFilter = 'all', activeNoteId = null, activeTab = 'home', searchQuery = '', deleteTargetId = null;

    const $ = id => document.getElementById(id);
    const DOM = {};

    function init() {
        ['app', 'screenHome', 'screenNotes', 'screenTasks', 'screenProgress', 'screenSettings', 'screenEditor',
         'notesGrid', 'emptyState', 'searchInput', 'chipsContainer',
         'editorTitle', 'editorBody', 'editorDate', 'editorCategory', 'editorWords', 'formatToolbar',
         'bottomNav', 'fabBtn', 'backBtn', 'deleteBtn', 'themeToggle', 'themeToggleNotes',
         'deleteModal', 'cancelDelete', 'confirmDelete',
         'categoryModal', 'categoryNameInput', 'categoryColors', 'cancelCategory', 'confirmCategory',
         'addCategoryBtn', 'addTaskBtn', 'taskModal', 'taskNameInput', 'cancelTask', 'confirmTask',
         'deleteTaskModal', 'cancelDeleteTask', 'confirmDeleteTask',
         'clearDataModal', 'cancelClearData', 'confirmClearData',
         'homeStats', 'homeNotesList', 'activeTasksList', 'doneTasksList', 'emptyTasksState',
         'progressNotesCount', 'progressTasksDone', 'progressCategories', 'progressChart',
         'settingsExport', 'settingsClear', 'themeToggleVisual', 'themeToggleLabel', 'toast',
         'gsUrlInput', 'gsSyncBtn', 'gsStatus'
        ].forEach(id => DOM[id] = $(id));

        loadData();
        loadTheme();
        loadGSUrl();
        renderChips();
        renderNotes();
        renderHome();
        renderTasks();
        renderProgress();
        updateEditorCategories();
        bindEvents();
        registerSW();
    }

    // ===== ДАННЫЕ =====
    function loadData() {
        try { notes = JSON.parse(localStorage.getItem(STORAGE_NOTES)) || [...DEFAULT_NOTES]; } catch { notes = [...DEFAULT_NOTES]; }
        try { categories = JSON.parse(localStorage.getItem(STORAGE_CATS)) || [...BUILTIN_CATS]; } catch { categories = [...BUILTIN_CATS]; }
        try { tasks = JSON.parse(localStorage.getItem(STORAGE_TASKS)) || []; } catch { tasks = []; }
    }

    function saveNotes() { localStorage.setItem(STORAGE_NOTES, JSON.stringify(notes)); }
    function saveCats() { localStorage.setItem(STORAGE_CATS, JSON.stringify(categories)); }
    function saveTasks() { localStorage.setItem(STORAGE_TASKS, JSON.stringify(tasks)); }

    // ===== GOOGLE SHEETS =====
    function loadGSUrl() {
        if (DOM.gsUrlInput) {
            DOM.gsUrlInput.value = localStorage.getItem(STORAGE_GS_URL) || '';
        }
    }

    function saveGSUrl() {
        const url = DOM.gsUrlInput.value.trim();
        if (url) localStorage.setItem(STORAGE_GS_URL, url);
        else localStorage.removeItem(STORAGE_GS_URL);
    }

    async function syncToGoogleSheets() {
        const url = DOM.gsUrlInput.value.trim();
        if (!url) { showGSStatus('Введите URL Apps Script', 'error'); return; }
        localStorage.setItem(STORAGE_GS_URL, url);

        showGSStatus('Синхронизация...', 'syncing');
        DOM.gsSyncBtn.disabled = true;

        const payload = {
            action: 'sync',
            notes: notes.map(n => ({
                id: n.id,
                title: n.title,
                content: n.content,
                category: n.category,
                createdAt: new Date(n.createdAt).toISOString(),
                updatedAt: new Date(n.updatedAt).toISOString()
            })),
            categories: categories.map(c => ({
                id: c.id,
                name: c.name,
                color: c.color,
                builtin: c.builtin || false
            })),
            tasks: tasks.map(t => ({
                id: t.id,
                text: t.text,
                done: t.done,
                createdAt: new Date(t.createdAt).toISOString()
            }))
        };

        try {
            const resp = await fetch(url, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify(payload),
                headers: { 'Content-Type': 'text/plain' }
            });
            showGSStatus('✓ Данные отправлены', 'success');
        } catch (err) {
            showGSStatus('Ошибка: ' + err.message, 'error');
        } finally {
            DOM.gsSyncBtn.disabled = false;
        }
    }

    function showGSStatus(msg, type) {
        if (!DOM.gsStatus) return;
        DOM.gsStatus.textContent = msg;
        DOM.gsStatus.className = 'gs-status ' + type;
        if (type === 'success') setTimeout(() => { DOM.gsStatus.textContent = ''; DOM.gsStatus.className = 'gs-status'; }, 4000);
    }

    function loadTheme() {
        const t = localStorage.getItem(STORAGE_THEME) || 'dark';
        document.documentElement.setAttribute('data-theme', t);
        // Обновить label
        const label = document.getElementById('themeToggleLabel');
        if (label) {
            label.textContent = t === 'dark' ? 'Тёмная тема' : 'Светлая тема';
        }
    }

    function setTheme(t) {
        localStorage.setItem(STORAGE_THEME, t);
        document.documentElement.setAttribute('data-theme', t);
        updateThemeSelector(t);
    }

    function updateThemeSelector(active) {
        if (!DOM.themeSelector) return;
        DOM.themeSelector.querySelectorAll('.theme-option').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.theme === active);
        });
    }

    function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

    function formatDate(ts) {
        const d = new Date(ts);
        const pad = n => String(n).padStart(2, '0');
        return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
    }

    function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function getCatName(id) { const c = categories.find(x => x.id === id); return c ? c.name : id; }
    function getCatColor(id) { const c = categories.find(x => x.id === id); return c ? c.color : '#888'; }

    // ===== НАВИГАЦИЯ =====
    function switchTab(tab) {
        activeTab = tab;
        const screens = { home: 'screenHome', notes: 'screenNotes', tasks: 'screenTasks', progress: 'screenProgress', settings: 'screenSettings' };
        ['screenHome', 'screenNotes', 'screenTasks', 'screenProgress', 'screenSettings', 'screenEditor'].forEach(id => DOM[id].classList.remove('active'));
        if (screens[tab]) DOM[screens[tab]].classList.add('active');
        DOM.bottomNav.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.tab === tab));
        DOM.fabBtn.style.display = (tab === 'notes') ? '' : 'none';
        if (tab === 'home') renderHome();
        if (tab === 'notes') renderNotes();
        if (tab === 'tasks') renderTasks();
        if (tab === 'progress') renderProgress();
    }

    // ===== ЧИПЫ =====
    function renderChips() {
        DOM.chipsContainer.innerHTML = '';
        const allChip = document.createElement('button');
        allChip.className = 'chip' + (activeFilter === 'all' ? ' active' : '');
        allChip.dataset.filter = 'all';
        allChip.textContent = 'Все';
        DOM.chipsContainer.appendChild(allChip);
        categories.forEach(cat => {
            const chip = document.createElement('button');
            chip.className = 'chip' + (activeFilter === cat.id ? ' active' : '');
            chip.dataset.filter = cat.id;
            chip.textContent = cat.name;
            DOM.chipsContainer.appendChild(chip);
        });
    }

    function updateEditorCategories() {
        DOM.editorCategory.innerHTML = '';
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = cat.name;
            DOM.editorCategory.appendChild(opt);
        });
    }

    // ===== РЕНДЕР ЗАМЕТОК =====
    function renderNotes() {
        let filtered = [...notes];
        if (activeFilter !== 'all') filtered = filtered.filter(n => n.category === activeFilter);
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(n => (n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q));
        }
        filtered.sort((a, b) => b.updatedAt - a.updatedAt);
        DOM.notesGrid.innerHTML = '';
        if (filtered.length === 0) {
            DOM.emptyState.classList.add('visible');
            DOM.notesGrid.style.display = 'none';
        } else {
            DOM.emptyState.classList.remove('visible');
            DOM.notesGrid.style.display = '';
            filtered.forEach((note, i) => {
                const card = document.createElement('div');
                card.className = 'note-card';
                card.style.animationDelay = `${i * 0.05}s`;
                const plainText = (note.content || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
                const preview = plainText.slice(0, 100);
                const catColor = getCatColor(note.category);
                card.innerHTML = `
                    <div class="note-card-header">
                        <div class="note-card-title">${escapeHtml(note.title || 'Без заголовка')}</div>
                        <button class="note-card-more" data-id="${note.id}"><img src="./icons/more.svg" alt=""></button>
                    </div>
                    <div class="note-card-preview">${escapeHtml(preview)}</div>
                    <div class="note-card-footer">
                        <span class="note-card-tag" style="background:${catColor}20;color:${catColor}">${escapeHtml(getCatName(note.category))}</span>
                        <span class="note-card-date">${formatDate(note.updatedAt)}</span>
                    </div>`;
                card.addEventListener('click', e => { if (!e.target.closest('.note-card-more')) openEditor(note.id); });
                card.querySelector('.note-card-more').addEventListener('click', e => { e.stopPropagation(); openEditor(note.id); });
                DOM.notesGrid.appendChild(card);
            });
        }
    }

    // ===== РЕДАКТОР =====
    function openEditor(noteId) {
        const note = notes.find(n => n.id === noteId);
        if (!note) return;
        activeNoteId = noteId;
        DOM.editorTitle.value = note.title || '';
        DOM.editorBody.innerHTML = note.content || '';
        DOM.editorDate.textContent = formatDate(note.updatedAt);
        updateEditorCategories();
        DOM.editorCategory.value = note.category || 'personal';
        updateWordCount();
        ['screenHome', 'screenNotes', 'screenTasks', 'screenProgress', 'screenSettings'].forEach(id => DOM[id].classList.remove('active'));
        DOM.screenEditor.classList.add('active');
        DOM.bottomNav.style.display = 'none';
        DOM.fabBtn.style.display = 'none';
        setTimeout(() => { if (!note.title) DOM.editorTitle.focus(); else DOM.editorBody.focus(); }, 100);
    }

    function closeEditor() {
        saveCurrentNote();
        activeNoteId = null;
        DOM.screenEditor.classList.remove('active');
        DOM.bottomNav.style.display = '';
        switchTab(activeTab);
    }

    function saveCurrentNote() {
        if (!activeNoteId) return;
        const note = notes.find(n => n.id === activeNoteId);
        if (!note) return;
        const title = DOM.editorTitle.value.trim();
        const content = DOM.editorBody.innerHTML.trim();
        const textContent = DOM.editorBody.textContent.trim();
        if (!title && !textContent) { notes = notes.filter(n => n.id !== activeNoteId); saveNotes(); return; }
        note.title = title || 'Без заголовка';
        note.content = content;
        note.category = DOM.editorCategory.value;
        note.updatedAt = Date.now();
        saveNotes();
    }

    function updateWordCount() {
        if (!DOM.editorWords) return;
        const text = DOM.editorBody.textContent || '';
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        DOM.editorWords.textContent = `${words} слов`;
    }

    // ===== ФОРМАТИРОВАНИЕ =====
    function execFormat(cmd, value) {
        DOM.editorBody.focus();
        if (cmd === 'h1') {
            document.execCommand('formatBlock', false, '<h1>');
        } else if (cmd === 'h2') {
            document.execCommand('formatBlock', false, '<h2>');
        } else {
            document.execCommand(cmd, false, value || null);
        }
        updateWordCount();
    }

    function bindFormatToolbar() {
        if (!DOM.formatToolbar) return;
        DOM.formatToolbar.querySelectorAll('.fmt-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.preventDefault();
                execFormat(btn.dataset.cmd);
            });
        });
    }

    function createNote() {
        const note = { id: genId(), title: '', content: '', category: activeFilter !== 'all' ? activeFilter : categories[0]?.id || 'personal', createdAt: Date.now(), updatedAt: Date.now() };
        notes.unshift(note);
        saveNotes();
        openEditor(note.id);
        showToast('Новая заметка');
    }

    // ===== ЗАДАЧИ =====
    function renderTasks() {
        const active = tasks.filter(t => !t.done);
        const done = tasks.filter(t => t.done);
        DOM.activeTasksList.innerHTML = '';
        DOM.doneTasksList.innerHTML = '';
        if (tasks.length === 0) DOM.emptyTasksState.classList.add('visible');
        else DOM.emptyTasksState.classList.remove('visible');
        active.forEach(task => DOM.activeTasksList.appendChild(createTaskEl(task)));
        done.forEach(task => DOM.doneTasksList.appendChild(createTaskEl(task)));
    }

    function createTaskEl(task) {
        const el = document.createElement('div');
        el.className = 'task-item' + (task.done ? ' done' : '');
        el.innerHTML = `
            <div class="task-checkbox" data-id="${task.id}"><img src="./icons/check.svg" alt=""></div>
            <span class="task-text">${escapeHtml(task.text)}</span>
            <button class="task-delete" data-id="${task.id}"><img src="./icons/close.svg" alt=""></button>`;
        el.querySelector('.task-checkbox').addEventListener('click', () => toggleTask(task.id));
        el.querySelector('.task-delete').addEventListener('click', () => showDeleteTaskModal(task.id));
        return el;
    }

    function toggleTask(id) { const t = tasks.find(x => x.id === id); if (t) { t.done = !t.done; saveTasks(); renderTasks(); renderProgress(); } }

    function createTask() {
        const text = DOM.taskNameInput.value.trim();
        if (!text) return;
        tasks.unshift({ id: genId(), text, done: false, createdAt: Date.now() });
        saveTasks();
        DOM.taskModal.classList.remove('active');
        DOM.taskNameInput.value = '';
        renderTasks();
        renderProgress();
        showToast('Задача добавлена');
    }

    function showDeleteTaskModal(id) { deleteTargetId = id; DOM.deleteTaskModal.classList.add('active'); }
    function hideDeleteTaskModal() { DOM.deleteTaskModal.classList.remove('active'); deleteTargetId = null; }
    function confirmDeleteTask() {
        if (!deleteTargetId) return;
        tasks = tasks.filter(t => t.id !== deleteTargetId);
        saveTasks();
        hideDeleteTaskModal();
        renderTasks();
        renderProgress();
        showToast('Задача удалена');
    }

    // ===== ПРОГРЕСС =====
    function renderProgress() {
        DOM.progressNotesCount.textContent = notes.length;
        DOM.progressTasksDone.textContent = tasks.filter(t => t.done).length;
        DOM.progressCategories.textContent = categories.length;
        DOM.progressChart.innerHTML = '';
        const now = Date.now(), dayMs = 86400000;
        const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        let maxCount = 1;
        const counts = [];
        for (let i = 6; i >= 0; i--) {
            const dayStart = now - (i + 1) * dayMs, dayEnd = now - i * dayMs;
            const count = notes.filter(n => n.updatedAt >= dayStart && n.updatedAt < dayEnd).length;
            counts.push({ count, day: dayNames[new Date(dayEnd).getDay()] });
            if (count > maxCount) maxCount = count;
        }
        counts.forEach(c => {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;gap:4px';
            const bar = document.createElement('div');
            bar.className = 'progress-bar';
            bar.style.height = `${Math.max(4, (c.count / maxCount) * 100)}%`;
            const label = document.createElement('div');
            label.className = 'progress-bar-label';
            label.textContent = c.day;
            wrapper.appendChild(bar);
            wrapper.appendChild(label);
            DOM.progressChart.appendChild(wrapper);
        });
    }

    // ===== ГЛАВНАЯ =====
    function renderHome() {
        DOM.homeStats.innerHTML = `
            <div class="home-stat"><div class="home-stat-value">${notes.length}</div><div class="home-stat-label">Заметок</div></div>
            <div class="home-stat"><div class="home-stat-value">${tasks.filter(t => !t.done).length}</div><div class="home-stat-label">Задач</div></div>`;
        DOM.homeNotesList.innerHTML = '';
        const recent = [...notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
        if (recent.length === 0) DOM.homeNotesList.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:0.85rem">Нет заметок</div>';
        recent.forEach(note => {
            const el = document.createElement('div');
            el.className = 'note-card';
            el.style.animationDelay = '0s';
            const preview = (note.content || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
            const catColor = getCatColor(note.category);
            el.innerHTML = `
                <div class="note-card-header"><div class="note-card-title">${escapeHtml(note.title || 'Без заголовка')}</div></div>
                <div class="note-card-preview">${escapeHtml(preview)}</div>
                <div class="note-card-footer">
                    <span class="note-card-tag" style="background:${catColor}20;color:${catColor}">${escapeHtml(getCatName(note.category))}</span>
                    <span class="note-card-date">${formatDate(note.updatedAt)}</span>
                </div>`;
            el.addEventListener('click', () => openEditor(note.id));
            DOM.homeNotesList.appendChild(el);
        });
    }

    // ===== КАТЕГОРИИ =====
    function showCategoryModal() { DOM.categoryModal.classList.add('active'); DOM.categoryNameInput.value = ''; setTimeout(() => DOM.categoryNameInput.focus(), 100); }
    function hideCategoryModal() { DOM.categoryModal.classList.remove('active'); }
    function createCategory() {
        const name = DOM.categoryNameInput.value.trim();
        if (!name) return;
        const selectedColor = DOM.categoryColors.querySelector('.selected');
        const color = selectedColor ? selectedColor.dataset.color : '#c9a87c';
        categories.push({ id: 'cat_' + genId(), name, color, builtin: false });
        saveCats();
        hideCategoryModal();
        renderChips();
        updateEditorCategories();
        renderNotes();
        renderProgress();
        showToast(`Категория "${name}" создана`);
    }

    // ===== НАСТРОЙКИ =====
    function exportNotes() {
        const data = JSON.stringify({ notes, categories, tasks }, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'notes_backup.json'; a.click();
        URL.revokeObjectURL(url);
        showToast('Экспорт завершён');
    }

    function clearAllData() {
        notes = [...DEFAULT_NOTES]; categories = [...BUILTIN_CATS]; tasks = [];
        saveNotes(); saveCats(); saveTasks();
        renderChips(); renderNotes(); renderHome(); renderTasks(); renderProgress(); updateEditorCategories();
        DOM.clearDataModal.classList.remove('active');
        showToast('Данные сброшены');
    }

    function showToast(msg) {
        DOM.toast.textContent = msg;
        DOM.toast.classList.add('visible');
        setTimeout(() => DOM.toast.classList.remove('visible'), 2000);
    }

    // ===== СОБЫТИЯ =====
    function bindEvents() {
        DOM.bottomNav.addEventListener('click', e => { const item = e.target.closest('.nav-item'); if (item) switchTab(item.dataset.tab); });
        DOM.searchInput.addEventListener('input', e => { searchQuery = e.target.value.trim(); renderNotes(); });
        DOM.chipsContainer.addEventListener('click', e => {
            const chip = e.target.closest('.chip');
            if (chip) { activeFilter = chip.dataset.filter; DOM.chipsContainer.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.filter === activeFilter)); renderNotes(); }
        });
        DOM.fabBtn.addEventListener('click', createNote);

        DOM.backBtn.addEventListener('click', closeEditor);
        DOM.deleteBtn.addEventListener('click', () => DOM.deleteModal.classList.add('active'));
        DOM.cancelDelete.addEventListener('click', () => DOM.deleteModal.classList.remove('active'));
        DOM.confirmDelete.addEventListener('click', () => {
            if (!activeNoteId) return;
            notes = notes.filter(n => n.id !== activeNoteId);
            saveNotes();
            DOM.deleteModal.classList.remove('active');
            closeEditor();
            showToast('Заметка удалена');
        });

        DOM.editorTitle.addEventListener('input', () => { if (activeNoteId) { const n = notes.find(x => x.id === activeNoteId); if (n) { n.title = DOM.editorTitle.value.trim() || 'Без заголовка'; n.updatedAt = Date.now(); saveNotes(); } } });
        DOM.editorBody.addEventListener('input', () => { if (activeNoteId) { const n = notes.find(x => x.id === activeNoteId); if (n) { n.content = DOM.editorBody.innerHTML; n.updatedAt = Date.now(); saveNotes(); updateWordCount(); } } });
        DOM.editorCategory.addEventListener('change', () => { if (activeNoteId) { const n = notes.find(x => x.id === activeNoteId); if (n) { n.category = DOM.editorCategory.value; n.updatedAt = Date.now(); saveNotes(); } } });

        bindFormatToolbar();

        // Переключение темы: dark ↔ light
        const cycleTheme = () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            setTheme(next);
            updateThemeLabel();
            showToast(next === 'dark' ? 'Тёмная тема' : 'Светлая тема');
        };

        DOM.themeToggle.addEventListener('click', cycleTheme);
        DOM.themeToggleNotes.addEventListener('click', cycleTheme);

        // Переключатель в настройках
        const themeToggleRow = document.querySelector('.theme-toggle-row');
        if (themeToggleRow) {
            themeToggleRow.addEventListener('click', cycleTheme);
        }

        function updateThemeLabel() {
            const label = document.getElementById('themeToggleLabel');
            if (label) {
                const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                label.textContent = isDark ? 'Тёмная тема' : 'Светлая тема';
            }
        }

        DOM.addCategoryBtn.addEventListener('click', showCategoryModal);
        DOM.cancelCategory.addEventListener('click', hideCategoryModal);
        DOM.confirmCategory.addEventListener('click', createCategory);
        DOM.categoryColors.addEventListener('click', e => {
            const dot = e.target.closest('.color-dot');
            if (dot) { DOM.categoryColors.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected')); dot.classList.add('selected'); }
        });
        DOM.categoryNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') createCategory(); });

        DOM.addTaskBtn.addEventListener('click', () => { DOM.taskModal.classList.add('active'); DOM.taskNameInput.value = ''; setTimeout(() => DOM.taskNameInput.focus(), 100); });
        DOM.cancelTask.addEventListener('click', () => DOM.taskModal.classList.remove('active'));
        DOM.confirmTask.addEventListener('click', createTask);
        DOM.taskNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') createTask(); });
        DOM.cancelDeleteTask.addEventListener('click', hideDeleteTaskModal);
        DOM.confirmDeleteTask.addEventListener('click', confirmDeleteTask);

        DOM.settingsExport.addEventListener('click', exportNotes);
        DOM.settingsClear.addEventListener('click', () => DOM.clearDataModal.classList.add('active'));
        if (DOM.gsSyncBtn) DOM.gsSyncBtn.addEventListener('click', syncToGoogleSheets);
        if (DOM.gsUrlInput) DOM.gsUrlInput.addEventListener('change', saveGSUrl);
        DOM.cancelClearData.addEventListener('click', () => DOM.clearDataModal.classList.remove('active'));
        DOM.confirmClearData.addEventListener('click', clearAllData);

        document.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (activeNoteId) closeEditor(); }
            if (e.key === 'Escape') {
                if (DOM.deleteModal.classList.contains('active')) DOM.deleteModal.classList.remove('active');
                else if (DOM.categoryModal.classList.contains('active')) DOM.categoryModal.classList.remove('active');
                else if (DOM.taskModal.classList.contains('active')) DOM.taskModal.classList.remove('active');
                else if (DOM.deleteTaskModal.classList.contains('active')) DOM.deleteTaskModal.classList.remove('active');
                else if (DOM.clearDataModal.classList.contains('active')) DOM.clearDataModal.classList.remove('active');
                else if (activeNoteId) closeEditor();
            }
        });

        [DOM.deleteModal, DOM.categoryModal, DOM.taskModal, DOM.deleteTaskModal, DOM.clearDataModal].forEach(m => {
            m.addEventListener('click', e => { if (e.target === m) m.classList.remove('active'); });
        });
    }

    function registerSW() { if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {}); }

    document.addEventListener('DOMContentLoaded', init);
})();
