const fs = require('fs');

// 1. Update index.html
let html = fs.readFileSync('index.html', 'utf8');

const navItem = `
                    <div class="nav-item" data-target="training">
                        <i data-lucide="book-open"></i>
                        <span>Training Handbook</span>
                    </div>`;

if (!html.includes('data-target="training"')) {
    html = html.replace(
        '<div class="nav-item" data-target="settings-panel">', 
        navItem + '\n                    <div class="nav-item" data-target="settings-panel">'
    );
}

const screenHtml = `
                <!-- SCREEN: TRAINING -->
                <div class="app-screen" id="screen-training">
                    <div class="screen-header-layout" style="margin-bottom:24px;">
                        <div class="screen-title-desc">
                            <h1>Badi Katori Handbook</h1>
                            <p>Digital operations manual and training guidelines.</p>
                        </div>
                    </div>
                    
                    <div class="training-layout">
                        <div class="training-sidebar" id="training-sidebar">
                            <!-- Generated via JS -->
                        </div>
                        <div class="training-content" id="training-content">
                            <!-- Generated via JS -->
                        </div>
                    </div>
                </div>
`;

if (!html.includes('id="screen-training"')) {
    html = html.replace(
        '<!-- SCREEN 13: SETTINGS -->', 
        screenHtml + '\n                <!-- SCREEN 13: SETTINGS -->'
    );
}
fs.writeFileSync('index.html', html);

// 2. Update style.css
let css = fs.readFileSync('style.css', 'utf8');
const trainingCss = `
/* --- TRAINING SECTION --- */
.training-layout {
    display: flex;
    gap: 24px;
    height: calc(100vh - 180px);
}

.training-sidebar {
    width: 280px;
    background: #ffffff;
    border-radius: 12px;
    border: 1px solid var(--border);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
}

.training-tab {
    padding: 12px 16px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-secondary);
    transition: all 0.2s;
    border: 1px solid transparent;
}

.training-tab:hover {
    background: var(--bg-hover);
    color: var(--brand-blue);
}

.training-tab.active {
    background: rgba(37, 99, 235, 0.1);
    color: var(--brand-blue);
    border-color: rgba(37, 99, 235, 0.2);
}

.training-content {
    flex: 1;
    background: #ffffff;
    border-radius: 12px;
    border: 1px solid var(--border);
    padding: 32px;
    overflow-y: auto;
    font-size: 0.95rem;
    line-height: 1.7;
    color: var(--text-primary);
}

.training-content h2 {
    font-size: 1.5rem;
    font-weight: 800;
    margin-bottom: 24px;
    color: var(--brand-dark);
    padding-bottom: 12px;
    border-bottom: 2px solid var(--bg-hover);
}

.training-content h3 {
    font-size: 1.1rem;
    font-weight: 700;
    margin-top: 24px;
    margin-bottom: 12px;
    color: var(--brand-blue);
}

.training-content p {
    margin-bottom: 16px;
}
`;

if (!css.includes('.training-layout')) {
    fs.writeFileSync('style.css', css + '\n' + trainingCss);
}

console.log("HTML and CSS updated.");
