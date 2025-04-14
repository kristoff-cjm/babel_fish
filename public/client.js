var SpeechRecognition = SpeechRecognition || webkitSpeechRecognition
var SpeechRecognitionEvent = SpeechRecognitionEvent || webkitSpeechRecognitionEvent
var speech = speechSynthesis || webkitSpeechSynthesis


var recognition = new SpeechRecognition();
recognition.continuous = false;
recognition.interimResults = false;
recognition.maxAlternatives = 1;

let socket;
let clientId = "";

function connectWebSocket() {
    socket = new WebSocket(`ws://${location.host}`);

    socket.addEventListener("open", () => {
        console.log("WebSocket connection established");
    });

    socket.addEventListener("message", (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "init") {
            clientId = data.clientId;
            console.log("Received client ID:", clientId);
        }

        if (data.type === "message") {
            renderMessage(data.message);
            const currentLang = document.getElementById("languageSelect").value;
            speakMessage(data.message[currentLang]);
        }
    });

    socket.addEventListener("close", () => {
        console.warn("WebSocket closed. Attempting reconnect...");
        setTimeout(connectWebSocket, 1000);
    });

    socket.addEventListener("error", (err) => {
        console.error("WebSocket error:", err);
    });
}

connectWebSocket();

function submitText() {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.error("WebSocket is not open.");
        return;
    }

    const message = {
        type: "message",
        sourceLang: document.getElementById("languageSelect").value,
        text: document.getElementById("messageInput").value,
        clientId
    };

    document.getElementById("messageInput").value = "";

    socket.send(JSON.stringify(message));
}

function speakMessage(text){
    const utterance = new SpeechSynthesisUtterance(text);
    speech.speak(utterance);
}

function record(){
    recognition.lang = document.getElementById("languageSelect").value;
    recognition.start();
    console.log('Ready to receive your words.');
}

recognition.onresult = async function(event) {
    //show a spinner while we listen

    //Send the text to the server to process
    var text = event.results[0][0].transcript;
    document.getElementById("messageInput").value = text;
}

recognition.onspeechend = function() {
    console.log("stopping recording.");
    recognition.stop();
}

recognition.onerror = function(event) {
  console.error("Something went wrong...: "+event.error)
}

async function switchLanguage(){
    const selectedLang = document.getElementById("languageSelect").value;
    const recordBtn = document.getElementById("recordBtn");
    const sendBtn = document.getElementById("sendBtn");
    await refreshMessages();
    if (selectedLang == "en"){
        recordBtn.innerHTML = "🎤 Record";
        sendBtn.innerHTML = "Send";
    }else{
        recordBtn.innerHTML = "🎤 Recordar";
        sendBtn.innerHTML = "Enviar";
    }
}

async function refreshMessages() {
    const response = await fetch("/messages");
    const data = await response.json();

    renderMessages(data.messages);
}

function renderMessages(messages){
    const messageContainer = document.getElementById("messageContainer");
    messageContainer.innerHTML = "";
    messages.forEach(message => {
        renderMessage(message);
    });
}

function renderMessage(message) {
    const messageContainer = document.getElementById("messageContainer");
    const selectedLang = document.getElementById("languageSelect").value;
    
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("d-flex", "mb-2");

    const messageBubble = document.createElement("div");
    messageBubble.classList.add("p-2", "rounded", "text-white");
    messageBubble.style.maxWidth = "75%";
    
    if (message.clientId === clientId) {
        messageDiv.classList.add("justify-content-end");
        messageBubble.classList.add("bg-primary");
    } else {
        messageDiv.classList.add("justify-content-start");
        messageBubble.classList.add("bg-secondary");
    }
    
    const messageText = document.createElement("div");
    messageText.innerHTML = `${message[selectedLang]}`;
    messageBubble.appendChild(messageText);
    
    const timestamp = document.createElement("div");
    timestamp.classList.add("text-start", "text-light", "mt-2");
    timestamp.style.fontSize = "0.75rem";
    timestamp.textContent = new Date(message.datetime).toLocaleString();
    messageBubble.appendChild(timestamp);
    
    messageDiv.appendChild(messageBubble);
    messageContainer.appendChild(messageDiv);

    messageContainer.scrollTop = messageContainer.scrollHeight;
}