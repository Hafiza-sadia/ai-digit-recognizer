// ===== Canvas Drawing =====
const canvas = document.getElementById('digitCanvas');
if(canvas){
    const ctx = canvas.getContext('2d');
    let drawing = false;

    canvas.addEventListener('mousedown', () => drawing = true);
    canvas.addEventListener('mouseup', () => {
        drawing = false;
        ctx.beginPath();
    });
    canvas.addEventListener('mouseout', () => {
        drawing = false;
        ctx.beginPath();
    });

    canvas.addEventListener('mousemove', draw);

    function draw(e){
        if(!drawing) return;
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'black';
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(e.offsetX, e.offsetY);
    }

    // Clear Canvas function
    window.clearCanvas = function(){
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.beginPath();
    }

    // Recognize Digit Simulation
    const recognizeBtn = document.querySelector('.recognize-content .btn:nth-child(2)');
    if(recognizeBtn){
        recognizeBtn.addEventListener('click', () => {
            // Simulate AI prediction (random 0-9 for demo)
            const prediction = Math.floor(Math.random() * 10);
            alert("Predicted Digit: " + prediction);

            // Save to localStorage history
            let history = JSON.parse(localStorage.getItem('digitHistory')) || [];
            const today = new Date().toISOString().split('T')[0];
            history.push({date: today, drawn:'User Drawn', prediction: prediction});
            localStorage.setItem('digitHistory', JSON.stringify(history));

            // Clear canvas after recognition
            clearCanvas();
        });
    }
}

// ===== History Page Dynamic Table =====
const historyTable = document.querySelector('.history-content table');
if(historyTable){
    let history = JSON.parse(localStorage.getItem('digitHistory')) || [];
    history.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${item.date}</td><td>${item.drawn}</td><td>${item.prediction}</td>`;
        historyTable.appendChild(row);
    });
}

// ===== Optional: Clear History (if needed) =====
const clearHistoryBtn = document.getElementById('clearHistory');
if(clearHistoryBtn){
    clearHistoryBtn.addEventListener('click', () => {
        localStorage.removeItem('digitHistory');
        location.reload();
    });
}
