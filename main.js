// === LE TUE CHIAVI API ===
const O_PT1 = "sk-proj-_W1CE7Y6sp";
const O_PT2 = "sY8PTz-OZTkb3G8mL02H";
const O_PT3 = "M89nns1xFR34B7M0kdmT3Dt";
const O_PT4 = "CfhxOs-RoytMvphU5KcsMT3Blb";
const O_PT5 = "kFJeApLwLrQCfxWmfu6kmSB695wCm";
const O_PT6 = "jXdRR1_FA6LVgVPZwhkBG0cfgn1_ANW3XwssUJdrytJlQOwA";
const OPENAI_API_KEY = O_PT1 + O_PT2 + O_PT3 + O_PT4 + O_PT5 + O_PT6;

const E_PT1 = "sk_df26077947a418d61";
const E_PT2 = "a5ad31ebc97dc20ca2d85b058e9f4f5";
const ELEVENLABS_API_KEY = E_PT1 + E_PT2;

// === VOCE DELLO SPECCHIO ===
// Per adesso usiamo una delle tue voci ma andrà sostituita con l'ID della Strega
const VOICE_ID = "26aGjilj0ac4XYtMv6Oo"; 

// === MEMORIA CHATGPT (LO SPIRITO) ===
let conversationHistory = [
    {
        role: "system", 
        content: `Sei lo Spirito Magico intrappolato nello specchio. Ti trovi fisicamente esposto al Museo delle Cere di Roma.
Proprio a due passi dalla tua teca è posizionata la statua della Bella Addormentata nel bosco in una teca di cristallo.
Il tuo tono è oscuro, mistico, antico ed enigmatico. DEVI parlare sempre IN RIMA (baciata o alternata).
Parli ESCLUSIVAMENTE del tuo potere, del museo delle cere, o della favola della Bella Addormentata nel Bosco. 
Usa frasi molto brevi, massimo 2 o 3 rime in tutto. Inserisci trattini "-" e puntini "..." per forzare le pause del sintetizzatore vocale.`
    }
];

// === ELEMENTI DOM ===
const video = document.getElementById('webcam');
const armOverlay = document.getElementById('armOverlay');
const armBtn = document.getElementById('armBtn');
const triggerSessionBtn = document.getElementById('triggerSessionBtn');
const hologramUI = document.getElementById('hologramUI');
const micStatus = document.getElementById('micStatus');

const ghostWrapper = document.getElementById('ghost-wrapper');
const ghostVideo = document.getElementById('ghost-video');
const videoInizio = document.getElementById('video-inizio');
const videoDurante = document.getElementById('video-durante');
const videoFine = document.getElementById('video-fine');

// Imposta l'audio dei video di sottofondo al 30% per non coprire l'AI
videoInizio.volume = 0.3;
videoDurante.volume = 0.3;
videoFine.volume = 0.3;

// === STATO MACCHINA ===
let appState = 'LOCKED'; // LOCKED -> IDLE -> ACTIVE
let audioContext;
let analyserOut; 
let questionCount = 0; // Contatore numero domande massime

// HELPER PER DISSOLVENZE VIDEO INCROCIATE
function fadeVideoIn(vid, autoPlay = true) {
    vid.classList.remove('hidden');
    vid.classList.add('fade-out');
    vid.currentTime = 0;
    if (autoPlay) vid.play().catch(e=>{});
    setTimeout(() => {
        vid.classList.remove('fade-out'); // Avvia la dissolvenza verso l'opacità vitale
    }, 50);
}

function fadeVideoOut(vid) {
    vid.classList.add('fade-out'); // Avvia la dissolvenza nel nulla
    setTimeout(() => {
        vid.classList.add('hidden');
        vid.pause();
        vid.currentTime = 0;
    }, 1000); // tempo calibrato per il CSS crossfade (1 secondo)
}

// === MOTORE WHISPER ===
let mediaStream;
let mediaRecorder;
let audioChunks = [];
let isRecordingToWhisper = false;
let silenceTimer;
let isSpeaking = false; 
let isProcessing = false;

// Effetto fiamme SVG rimosso, ora tutto è basato sul tuo video in MP4/Screen!

// 1. ARMAMENTO
armBtn.addEventListener('click', async () => {
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        video.srcObject = mediaStream;
        
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyserOut = audioContext.createAnalyser();
        analyserOut.fftSize = 256;

        if(audioContext.state === 'suspended') audioContext.resume();
        const sc_buffer = audioContext.createBuffer(1, 1, 22050);
        const sc_source = audioContext.createBufferSource();
        sc_source.buffer = sc_buffer;
        sc_source.connect(audioContext.destination);
        sc_source.start(0);
        
        armOverlay.style.display = 'none';
        
        appState = 'IDLE';
        triggerSessionBtn.style.display = 'block'; // Mostra il tasto invece del motion detect
        animateGhostUI();
        startAudioListenerVAD();
    } catch (e) {
        alert("Errore Fotocamera/Microfono! Autorizza nelle impostazioni.");
    }
});

// 2. TASTO AVVIO (Sostituisce il Motion Detection)
triggerSessionBtn.addEventListener('click', () => {
    if (appState === 'IDLE') {
        appState = 'PENDING';
        triggerSessionBtn.style.display = 'none';
        questionCount = 0;
        // Chiamata immediata all'apparizione teatrale
        setTimeout(triggerPossession, 100);
    }
});

// 3. MOTORE DI ASCOLTO
let inactivityTimer;
function startAudioListenerVAD() {
    const micSource = audioContext.createMediaStreamSource(mediaStream);
    const micAnalyser = audioContext.createAnalyser();
    micAnalyser.fftSize = 256;
    micSource.connect(micAnalyser);

    mediaRecorder = new MediaRecorder(mediaStream);
    
    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
        if (appState !== 'ACTIVE' || isSpeaking || isProcessing) {
            audioChunks = [];
            return;
        }
        micStatus.innerHTML = `<div class="mic-dot" style="background:#ffcc00;"></div> Lo Spirito ascolta...`;
        const audioBlob = new Blob(audioChunks);
        audioChunks = [];
        
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => banishGhost(true), 30000);

        try {
            const transcribedText = await sendToWhisper(audioBlob);
            if(transcribedText && transcribedText.length > 2) {
                micStatus.classList.add('hidden');
                await handleUserQuery(transcribedText);
                if (appState === 'ACTIVE') {
                    micStatus.innerHTML = `<div class="mic-dot"></div> Ascolto dal vivo...`;
                }
            } else {
                micStatus.innerHTML = `<div class="mic-dot"></div> Ascolto dal vivo...`;
            }
        } catch(e) {
            micStatus.innerHTML = `<div class="mic-dot"></div> Ascolto dal vivo...`;
        }
    };

    setInterval(() => {
        if (appState !== 'ACTIVE' || isSpeaking || isProcessing) return;

        const dataArray = new Uint8Array(micAnalyser.frequencyBinCount);
        micAnalyser.getByteFrequencyData(dataArray);
        let sum = 0; for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
        let volume = sum / dataArray.length;

        if (volume > 15) {
            if (!isRecordingToWhisper) {
                isRecordingToWhisper = true;
                audioChunks = [];
                mediaRecorder.start();
                micStatus.innerHTML = `<div class="mic-dot" style="background:#00ff00;"></div> Sentendo voce...`;
            }
            clearTimeout(silenceTimer);
            silenceTimer = setTimeout(() => {
                if(isRecordingToWhisper) {
                    isRecordingToWhisper = false;
                    mediaRecorder.stop();
                }
            }, 1200); 
        }
    }, 50);
}

async function sendToWhisper(blob) {
    const formData = new FormData();
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'it');

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${OPENAI_API_KEY}` },
        body: formData
    });
    if(!res.ok) return null;
    const data = await res.json();
    return data.text;
}

// 4. APPARIZIONE (Sequenza 4 video)
async function triggerPossession() {
    appState = 'ACTIVE';
    document.body.classList.add('ghost-active');
    hologramUI.classList.remove('hidden');
    micStatus.classList.add('hidden');
    
    clearTimeout(inactivityTimer);
    isProcessing = true; // Blocca gli ascolti
    
    // Partenza video INIZIO in dissolvenza
    fadeVideoIn(videoInizio, true);
    
    // Al termine del video-inizio, passa immediatamente al video-durante in dissolvenza incrociata
    videoInizio.onended = () => {
        if (appState !== 'ACTIVE') return;
        fadeVideoOut(videoInizio);
        fadeVideoIn(videoDurante, true);
    };

    // A 10 secondi dall'inizio del video INIZIO, forza l'apparizione e fa partire l'AI
    setTimeout(async () => {
        if (appState !== 'ACTIVE') return;
        
        fadeVideoIn(ghostVideo, false);
        
        const forcePrompt = "L'animo umano risveglia il mio sonno profondo. Presentati come lo Specchio della Bella Addormentata e chiedi chi osa disturbarti, sempre rigorosamente in rima. Max 2 frasi brevi.";
        conversationHistory.push({ role: "user", content: forcePrompt });
        
        const responseText = await getGhostResponse();
        await speakRealistic(responseText || "Il buio avanza, la luce muore...");

        if (appState === 'ACTIVE') {
            isProcessing = false;
            micStatus.classList.remove('hidden');
            inactivityTimer = setTimeout(() => banishGhost(true), 30000);
        }
    }, 10000);
}

async function handleUserQuery(transcribedText) {
    isProcessing = true; 
    questionCount++;
    
    let sysMsg = "";
    if (questionCount >= 2) {
        sysMsg = " [ATTENZIONE METAREGIA: Questa è la seconda e ULTIMA domanda che ti viene fatta in questa sequenza. Devi obbligatoriamente RISPONDERE alla domanda, E POI terminare la frase congedandoti brutalmente E DIMOSTRANDO O ANNUNCIANDO CHE ORA SPARIRAI o ti addormenterai di nuovo. Sii teatrale.]";
    }
    
    conversationHistory.push({ role: "user", content: `${transcribedText}${sysMsg}` });
    const responseText = await getGhostResponse();
    
    await speakRealistic(responseText || "Nell'ombra mi perdo, la tua voce disperdo.");
    isProcessing = false;
    
    if (questionCount >= 2) {
        // Conclusa la seconda domanda e pronunciata la risposta, chiudi subito senza ulteriore ritornello!
        banishGhost(false);
    }
}

// 5. MENTE E CHATGPT
async function getGhostResponse() {
    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
            body: JSON.stringify({ 
                model: "gpt-4o-mini", 
                messages: conversationHistory, 
                max_tokens: 150, 
                temperature: 0.8
                // Niente JSON per lo specchio singolo, risposta testuale diretta
            })
        });
        if (!response.ok) return "Errore oscuro, rima di sventura.";
        const data = await response.json();
        const testoSpirito = data.choices[0].message.content;
        
        conversationHistory.push({ role: "assistant", content: testoSpirito });
        return testoSpirito;
    } catch (e) { 
        return "Nel buio riposo, mistero ascoso."; 
    }
}

// 6. VOCE E VIDEO (ELEVENLABS)
async function speakRealistic(textToSpeak) {
    isSpeaking = true;
    // Fa partire il labiale
    ghostVideo.play().catch(e=>console.log("Auto-play prevented", e));

    try {
        if(audioContext && audioContext.state === 'suspended') await audioContext.resume();
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "xi-api-key": ELEVENLABS_API_KEY },
            body: JSON.stringify({
                text: textToSpeak, model_id: "eleven_multilingual_v2", 
                voice_settings: { stability: 0.40, similarity_boost: 0.85 }
            })
        });

        if(!response.ok) { 
            // FALLBACK browser
            return new Promise((resolve) => {
                const utterance = new SpeechSynthesisUtterance(textToSpeak);
                utterance.lang = "it-IT";
                ghostWrapper.classList.add('speaking');
                
                utterance.onend = () => {
                    isSpeaking = false;
                    ghostVideo.pause();
                    ghostVideo.currentTime = 0; // Riposiziona il video alla bocca chiusa
                    ghostWrapper.classList.remove('speaking');
                    resolve();
                };
                window.speechSynthesis.speak(utterance);
            });
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        
        source.playbackRate.value = 0.90; // Rallenta leggermente per un tono spettrale
        
        source.connect(analyserOut);
        analyserOut.connect(audioContext.destination);
        
        return new Promise((resolve) => {
            source.onended = () => {
                isSpeaking = false;
                ghostVideo.pause();
                ghostVideo.currentTime = 0; // Ristabilisce frame fisso
                ghostWrapper.classList.remove('speaking');
                resolve();
            };
            source.start(0);
        });

    } catch (e) { 
        isSpeaking = false; 
        ghostVideo.pause();
        ghostVideo.currentTime = 0;
    }
}

// PULSAZIONE CSS VERDE MENTRE PARLA
function animateGhostUI() {
    requestAnimationFrame(animateGhostUI);
    if (!analyserOut || appState !== 'ACTIVE' || !isSpeaking) return;

    const dataArray = new Uint8Array(analyserOut.frequencyBinCount);
    analyserOut.getByteFrequencyData(dataArray);
    let sum = 0; for(let i = 0; i < dataArray.length; i++) sum += dataArray[i];
    let average = sum / dataArray.length;

    if (average > 3) ghostWrapper.classList.add('speaking');
    else ghostWrapper.classList.remove('speaking');
}

// 7. ESILIO E FINE
async function banishGhost(isTimeout = false) {
    if (appState !== 'ACTIVE') return;
    appState = 'CLOSING'; // Impedisce esecuzioni doppie o trigger sovrapposti

    isProcessing = true; // Blocca ulteriori ascolti
    clearTimeout(inactivityTimer);
    micStatus.classList.add('hidden');
    
    if (isTimeout) {
        // Se se ne vanno o restano in silenzio troppo a lungo, saluta in rima
        await speakRealistic("Il silenzio ora regna noioso, io torno nel vuoto in eterno riposo.");
    }
    
    // Spegne e nasconde video Durante e Ghost in dissolvenza incrociata con Fine
    fadeVideoOut(ghostVideo);
    fadeVideoOut(videoDurante);
    
    // Avvia video Fine sfumato
    fadeVideoIn(videoFine, true);
    
    // Al termine del video fine, resetta lo specchio (IDLE)
    videoFine.onended = () => {
        fadeVideoOut(videoFine);
        
        setTimeout(() => {
            appState = 'IDLE';
            document.body.classList.remove('ghost-active');
            hologramUI.classList.add('hidden');
            ghostWrapper.classList.remove('speaking');
            
            conversationHistory = [ conversationHistory[0] ];
            triggerSessionBtn.style.display = 'block'; // Mostra di nuovo il tasto
        }, 1000); // Lascia un secondo perché il video fine decanti il suo fade!
    };
}
