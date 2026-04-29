// ============================================
// КОНФИГУРАЦИЯ — ИЗМЕНИТЕ ПОД СЕБЯ!
// ============================================
const CONFIG = {
    // URL вашего бэкенда на Vercel (ЗАМЕНИТЕ НА ВАШ!)
    BACKEND_URL: 'https://virtual-psychologist-backend.vercel.app',
    
    // Выберите провайдера аватара: 'anam', 'tavus', 'none'
    AVATAR_PROVIDER: 'none',  // none - пока без аватара, только голос
    
    // Настройки сессии
    SESSION_ID: generateSessionId()
};

// Глобальные переменные
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let sessionId = CONFIG.SESSION_ID;

// DOM элементы
const micButton = document.getElementById('mic-button');
const statusText = document.querySelector('.status-text');
const statusDot = document.querySelector('.status-dot');
const subtitleElement = document.getElementById('subtitle-text');
const safetyButton = document.getElementById('safety-button');
const endSessionButton = document.getElementById('end-session');

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function updateStatus(text, state) {
    statusText.textContent = text;
    statusDot.className = 'status-dot';
    if (state === 'listening') {
        statusDot.classList.add('listening');
    } else if (state === 'speaking') {
        statusDot.classList.add('speaking');
    }
}

function updateSubtitle(text, isUser = false) {
    subtitleElement.textContent = text;
    if (isUser) {
        subtitleElement.style.color = '#7A7A7A';
    } else {
        subtitleElement.style.color = '#2C2C2C';
    }
}

function showSafetyHelpline() {
    safetyButton.style.display = 'block';
    updateSubtitle('❗ Пожалуйста, обратись к реальному специалисту. Я рядом и не исчезну.');
}

function hideSafetyHelpline() {
    safetyButton.style.display = 'none';
}

// ============================================
// ОБЩЕНИЕ С БЭКЕНДОМ
// ============================================

async function sendToBackend(userMessage) {
    try {
        updateStatus('Психолог думает...', 'speaking');
        updateSubtitle('...');
        
        const response = await fetch(CONFIG.BACKEND_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: userMessage,
                sessionId: sessionId
            })
        });
        
        const data = await response.json();
        
        // Проверка кризисной ситуации
        if (data.isCrisis) {
            showSafetyHelpline();
        } else {
            hideSafetyHelpline();
        }
        
        // Обновляем субтитры
        updateSubtitle(data.response);
        
        // Озвучиваем ответ
        speakResponse(data.response);
        
        return data.response;
        
    } catch (error) {
        console.error('Backend error:', error);
        updateSubtitle('Извини, произошла ошибка. Попробуй ещё раз.');
        return 'Извини, произошла ошибка. Попробуй ещё раз.';
    }
}

// ============================================
// ЗАПИСЬ ГОЛОСА И РАСПОЗНАВАНИЕ
// ============================================

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            await processAudio(audioBlob);
            stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorder.start();
        isRecording = true;
        micButton.classList.add('active');
        updateStatus('Слушаю...', 'listening');
        updateSubtitle('🎙️ Говорите...');
        
    } catch (error) {
        console.error('Microphone error:', error);
        updateSubtitle('Не могу получить доступ к микрофону. Проверьте разрешения в браузере.');
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        micButton.classList.remove('active');
    }
}

async function processAudio(audioBlob) {
    updateStatus('Распознаю речь...', 'listening');
    
    try {
        // Используем Web Speech API для распознавания речи
        // ВНИМАНИЕ: Работает только в Chrome/Edge, требует HTTPS
        
        // Для демо-режима используем простой prompt
        // В реальном проекте замените на отправку аудио на ваш бэкенд с Whisper
        
        const userText = prompt('🎤 Распознавание речи в демо-режиме.\n\nВведите то, что вы сказали (или нажмите Отмена):');
        
        if (userText && userText.trim()) {
            updateSubtitle(userText, true);
            await sendToBackend(userText);
        } else {
            updateStatus('Готов к разговору', '');
            updateSubtitle('Не услышал. Нажмите микрофон и скажите снова.');
        }
        
    } catch (error) {
        console.error('Recognition error:', error);
        updateSubtitle('Не удалось распознать речь. Попробуйте ещё раз.');
        updateStatus('Готов к разговору', '');
    }
}

// ============================================
// ОЗВУЧИВАНИЕ ОТВЕТОВ (TTS)
// ============================================

function speakResponse(text) {
    if ('speechSynthesis' in window) {
        updateStatus('Психолог говорит...', 'speaking');
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ru-RU';
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        
        utterance.onend = () => {
            updateStatus('Готов к разговору', '');
        };
        
        utterance.onerror = () => {
            updateStatus('Готов к разговору', '');
        };
        
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    } else {
        updateStatus('Готов к разговору', '');
    }
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================

async function init() {
    // Убираем лоадер
    const placeholder = document.getElementById('avatar-placeholder');
    if (CONFIG.AVATAR_PROVIDER === 'none') {
        placeholder.innerHTML = '<p>🧠 Виртуальный психолог (голосовой режим)</p>';
    }
    updateStatus('Готов к разговору', '');
    
    // Настройка кнопки микрофона (удержание для записи)
    micButton.addEventListener('mousedown', startRecording);
    micButton.addEventListener('mouseup', stopRecording);
    micButton.addEventListener('mouseleave', stopRecording);
    
    // Для touch-устройств
    micButton.addEventListener('touchstart', startRecording);
    micButton.addEventListener('touchend', stopRecording);
    
    // Завершение сессии
    endSessionButton.addEventListener('click', () => {
        sessionId = generateSessionId();
        updateSubtitle('Сессия завершена. Начните новый разговор, когда будете готовы.');
        hideSafetyHelpline();
        updateStatus('Готов к новому разговору', '');
    });
    
    // Проверка поддержки микрофона
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        updateSubtitle('⚠️ Ваш браузер не поддерживает микрофон. Используйте Chrome, Edge или Safari.');
        micButton.disabled = true;
        micButton.style.opacity = '0.5';
    }
    
    // Проверка поддержки Speech Synthesis
    if (!('speechSynthesis' in window)) {
        console.warn('Speech Synthesis not supported');
    }
}

// Запуск при загрузке страницы
document.addEventListener('DOMContentLoaded', init);

