const fs = require('fs'); 
let lines = fs.readFileSync('index.html', 'utf8').split('\n'); 
let start = -1; 
let end = -1; 
for(let i=0; i<lines.length; i++){ 
    if(lines[i].includes('class="excel-wizard-stepper"')) { 
        start = i; 
    } 
    if (start !== -1 && lines[i].includes('<!-- SCREEN 13: SETTINGS -->')) { 
        end = i; 
        break; 
    } 
} 
if(start !== -1 && end !== -1) { 
    lines.splice(start, end - start); 
    fs.writeFileSync('index.html', lines.join('\n')); 
    console.log('Removed from line ' + start + ' to ' + end); 
} else { 
    console.log('Not found'); 
}
