const messages = [
    "Bereitstellungsraum ist der Parkplatz der Stadtwerke, Luisenstraße, 49074 Osnabrück.",
    "Evakuierung erforderlich in einem 1000 m Radius um 32UMC36339139.",
    "Sie bearbeiten den Einsatzbereich A südwestlich der Bahngleise.",
    "Detmarstrasse wurde geräumt.",
    "Person in Kollegienwall 11 verweigert Evakuierung. Polizei benötigt.",
    "Schlagvorder Strasse wurde geräumt.",
    "Polizei in Kollegienwall 11 eingetroffen. Person wurde entfernt. Kollegienwall wurde geräumt.",
];

function createPopupManager() {
    let currentMessageIndex = 0;

    const popup = document.createElement('div');
    popup.id = 'popup';
    popup.className = 'popup';
    popup.style.display = 'none';
    popup.innerHTML = `
    <span id="popupClose" class="popup-close">&times;</span>
    <div id="popupMessage"></div>
    `;
    document.body.appendChild(popup);

    function closePopup() {
        currentMessageIndex++;
        if (currentMessageIndex < messages.length) {
            updatePopup(messages[currentMessageIndex]);
        } else {
            popup.style.display = 'none';
        }
    }

    document.getElementById('popupClose').onclick = closePopup;

    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closePopup();
        }
    });

    function updatePopup(message) {
        document.getElementById('popupMessage').textContent = message;
        popup.style.display = 'block';
    }

    return {
        showFirstMessage: () => updatePopup(messages[currentMessageIndex])
    };
}

function createRadioButton(popupManager) {
    const button = document.createElement('button');
    button.id = 'radioButton';
    button.className = 'radio-button';
    button.innerHTML = '<img src="../pycon_talk/img/walkie_talkie.svg" alt="Radio" class="radio-icon">';
    document.body.appendChild(button);
    button.onclick = function() {
        popupManager.showFirstMessage();
        button.remove();
    };
}

function initialize() {
    const popupManager = createPopupManager();
    createRadioButton(popupManager);
}


initialize();
