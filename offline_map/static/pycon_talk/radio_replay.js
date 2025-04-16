const messages = [
    "Go to Schlossgraben 1 in 64283 Darmstadt.",
    "Explore a parking area for vehicles over 2m high next to the venue.",
    "New mission: An unexploded World War II bomb was discovered during construction at 32UMC36339139. Evacuation in a 1000 m radius is required.",
    "You handle operational area A southwest of the railway tracks.",
    "Detmarstrasse is cleared.",
    "A person in Kollegienwall 11 refuses evacuation, Police required.",
    "Schlagvorder Strasse is cleared.",
    "Police arrived at Kollegienwall 11 and picked up the person. Kollegienwall is cleared.",
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
    button.innerHTML = '<img src="img/walkie_talkie.svg" alt="Radio" class="radio-icon">';
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
