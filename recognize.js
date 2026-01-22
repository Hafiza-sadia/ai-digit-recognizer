// =================================================================
// recognize.js - AI Digit Recognizer Core Logic (Final)
// Note: Requires a valid Gemini API Key.
// =================================================================

// --- 1. CORE CONFIGURATION ---

const YOUR_API_KEY = "AIzaSyD0bmg_clLWQgxPuFpmI3QUqFzBN-lGXOw"; // <<<--- Replace this with your actual Key!
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${YOUR_API_KEY}`;
const MAX_RETRIES = 3;

// --- 2. DOM Elements & State ---

const canvas = document.getElementById('canvas'); 
const ctx = canvas ? canvas.getContext('2d') : null;

// Assuming these IDs are present in recognize.html
const predictButton = document.getElementById('predictButton');
const clearButton = document.getElementById('clearButton');
const resultDisplay = document.getElementById('resultDisplay');
const statusMessage = document.getElementById('statusMessage');
const errorMessage = document.getElementById('errorMessage');

let isDrawing = false;
let lastX = 0;
let lastY = 0;
let drawnImageBase64 = null; // Store the drawn image data for history

if (!canvas || !ctx) {
    console.error("Critical Error: Canvas element not found or context unavailable.");
    throw new Error("Missing canvas element.");
}

// --- 3. FRONTEND UTILITY FUNCTIONS (Canvas & Drawing Logic) ---

const setupCanvas = () => {
    canvas.width = 300; 
    canvas.height = 300;
    
    // Set up Black background and White drawing stroke (standard MNIST format)
    ctx.fillStyle = "#000000"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height); 
    
    ctx.lineWidth = 18; 
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'white'; 
    
    //if (resultDisplay) resultDisplay.textContent = 'Draw a digit';
    if (statusMessage) statusMessage.textContent = 'Awaiting input...';
    if (predictButton) predictButton.style.opacity = '0.5'; 
    drawnImageBase64 = null; // Clear old image data
};

function getCoords(event) {
    const rect = canvas.getBoundingClientRect();
    let x, y;

    if (event.touches) {
        x = event.touches[0].clientX - rect.left;
        y = event.touches[0].clientY - rect.top;
    } else {
        x = event.clientX - rect.left;
        y = event.clientY - rect.top;
    }
    return { x, y };
}

function startDrawing(e) {
    e.preventDefault();
    isDrawing = true;
    const { x, y } = getCoords(e);
    lastX = x;
    lastY = y;
    ctx.beginPath();
    ctx.moveTo(x, y);
    if (predictButton) predictButton.style.opacity = '1.0'; 
}

function draw(e) {
    e.preventDefault();
    if (!isDrawing) return;
    const { x, y } = getCoords(e);
    
    ctx.lineTo(x, y);
    ctx.stroke();

    lastX = x;
    lastY = y;
}

function stopDrawing() {
    isDrawing = false;
    ctx.closePath();
}

/**
 * Converts the current drawing to a 28x28 base64 PNG for the AI model.
 */
function preprocessAndGetBase64() {
    const tempCanvas = document.createElement('canvas');
    const TEMP_SIZE = 28; 
    tempCanvas.width = TEMP_SIZE;
    tempCanvas.height = TEMP_SIZE;
    const tempCtx = tempCanvas.getContext('2d');

    // Draw the main canvas content onto the small 28x28 canvas
    tempCtx.drawImage(canvas, 0, 0, TEMP_SIZE, TEMP_SIZE);

    // Store the 28x28 base64 data (without prefix)
    const dataUrl = tempCanvas.toDataURL('image/png');
    drawnImageBase64 = dataUrl; // Store full data URL for history page
    return dataUrl.split(',')[1];
}

// --- 4. DATA HISTORY MANAGEMENT (Local Storage) ---

/**
 * Saves the prediction result, drawn image, and date to Local Storage.
 * This data is used by history.html.
 */
function saveToHistory(prediction) {
    const history = JSON.parse(localStorage.getItem('digitHistory')) || [];
    
    const newEntry = {
        date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }),
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        prediction: prediction,
        // The drawn image is stored as a 28x28 data URL
        image: drawnImageBase64 || "N/A"
    };
    
    // Add new entry to the front of the array (latest first)
    history.unshift(newEntry);
    
    // Keep history limited to the last 20 entries
    if (history.length > 20) {
        history.pop();
    }
    
    localStorage.setItem('digitHistory', JSON.stringify(history));
}


// --- 5. BACKEND API SERVICE (Gemini API Call) ---

class DigitRecognitionService {
    constructor(apiUrl) {
        this.apiUrl = apiUrl;
        this.systemPrompt = "You are a specialized Computer Vision model for handwritten digit recognition. Your sole task is to analyze the provided image, which is a cropped representation of a handwritten digit (0-9). Based on the visual data, output *only* the single digit (0, 1, 2, ... 9) you recognize. Do not include any other text, explanation, or punctuation.";
    }

    async predict(base64Image) {
        const userQuery = "Identify the digit in this image.";
        const payload = {
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: userQuery },
                        {
                            inlineData: {
                                mimeType: "image/png",
                                data: base64Image
                            }
                        }
                    ]
                }
            ],
            systemInstruction: {
                parts: [{ text: this.systemPrompt }]
            },
            // API FIX: 'config' ko 'generationConfig' se badla gaya
            generationConfig: { 
                temperature: 0.1 
            }
        };

        let response;
        let lastError = null;

        for (let i = 0; i < MAX_RETRIES; i++) {
            try {
                response = await fetch(this.apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    break; 
                } else {
                    const errorBody = await response.json().catch(() => ({}));
                    lastError = errorBody.error?.message || `API error: ${response.status} ${response.statusText}`;
                    if (i < MAX_RETRIES - 1) {
                        const delay = Math.pow(2, i) * 1000;
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            } catch (error) {
                lastError = `Fetch failed: ${error.message}`;
                if (i < MAX_RETRIES - 1) {
                    const delay = Math.pow(2, i) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        if (!response || !response.ok) {
            throw new Error(lastError || "Failed to get a response from the AI model.");
        }

        const result = await response.json();
        return result?.candidates?.[0]?.content?.parts?.[0]?.text || 'N/A';
    }
}

// --- 6. FRONTEND INTEGRATION & API Call Logic ---

const recognitionService = new DigitRecognitionService(API_URL);

function displayError(message) {
    if (errorMessage) {
        errorMessage.textContent = `Error: ${message}`;
        errorMessage.style.display = 'block'; 
        setTimeout(() => {
            errorMessage.style.display = 'none'; 
        }, 5000); 
    }
}

async function handlePrediction() {
    // UI State Start
    if (predictButton) predictButton.style.opacity = '0.5';
    if (resultDisplay) resultDisplay.textContent = '...';
    if (statusMessage) statusMessage.textContent = 'Analyzing image...';
    if (errorMessage) errorMessage.style.display = 'none';

    try {
        const base64Image = preprocessAndGetBase64(); // Saves drawnImageBase64
        const rawPrediction = await recognitionService.predict(base64Image);
        const predictedDigit = rawPrediction.trim().match(/^\d$/);

        if (predictedDigit) {
            const digit = predictedDigit[0];
            if (resultDisplay) resultDisplay.textContent = digit;
            if (statusMessage) statusMessage.textContent = `Predicted Digit: ${digit}`;
            
            // SAVE TO HISTORY after successful prediction
            saveToHistory(digit);

        } else {
            if (resultDisplay) resultDisplay.textContent = 'X';
            if (statusMessage) statusMessage.textContent = 'Could not recognize a single digit. Try again.';
            console.warn("AI returned non-digit text:", rawPrediction);
        }

    } catch (error) {
        console.error('Prediction Error:', error);
        if (resultDisplay) resultDisplay.textContent = 'FAIL';
        if (statusMessage) statusMessage.textContent = 'Prediction failed.';
        displayError(error.message || 'Unknown network error occurred.');
    } finally {
        // UI State End
        if (predictButton) predictButton.style.opacity = '1.0';
    }
}

// --- 7. Event Listeners and Initialization ---

// Initialization on page load
document.addEventListener('DOMContentLoaded', setupCanvas);

// --- Attach Event Listeners ---
if (canvas) {
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', stopDrawing);
}

// Event listener for Clear Button
if (clearButton) {
    clearButton.addEventListener('click', () => {
        setupCanvas(); 
        if (predictButton) predictButton.style.opacity = '0.5'; 
        if (errorMessage) errorMessage.style.display = 'none';
    });
}

// Event listener for Recognize Button
if (predictButton) {
    predictButton.addEventListener('click', handlePrediction);
}