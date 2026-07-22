const fs = require('fs');

let js = fs.readFileSync('app.js', 'utf8');

// Add import at the top
if (!js.includes('import { trainingData }')) {
    js = 'import { trainingData } from "./trainingData.js";\n' + js;
}

const renderFunction = `
    function renderTrainingScreen() {
        const sidebar = document.getElementById('training-sidebar');
        const content = document.getElementById('training-content');
        if (!sidebar || !content) return;

        sidebar.innerHTML = '';
        
        trainingData.forEach((chapter, index) => {
            const tab = document.createElement('div');
            tab.className = 'training-tab' + (index === 0 ? ' active' : '');
            tab.textContent = chapter.title;
            tab.onclick = () => {
                document.querySelectorAll('.training-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                renderChapter(chapter);
            };
            sidebar.appendChild(tab);
        });

        if (trainingData.length > 0) {
            renderChapter(trainingData[0]);
        }

        function renderChapter(chapter) {
            let html = '<h2>' + chapter.title + '</h2>';
            const paragraphs = chapter.content.split('\\n\\n').filter(p => p.trim());
            paragraphs.forEach(p => {
                if (p.length < 60 && !p.includes('.') && p.trim().endsWith(':')) {
                    html += '<h3>' + p + '</h3>';
                } else {
                    html += '<p>' + p.replace(/\\n/g, '<br>') + '</p>';
                }
            });
            content.innerHTML = html;
        }
    }
`;

// Insert the render function before navigateToScreen
if (!js.includes('function renderTrainingScreen')) {
    js = js.replace('function navigateToScreen(screenId) {', renderFunction + '\n    function navigateToScreen(screenId) {');
}

// Hook into navigateToScreen
if (!js.includes("if (screenId === 'training') renderTrainingScreen();")) {
    js = js.replace(
        'renderAllLists();', 
        'renderAllLists();\n        if (screenId === "training") renderTrainingScreen();'
    );
}

fs.writeFileSync('app.js', js);
console.log("Updated app.js");
