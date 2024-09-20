chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "calChoice") {
        getToken();
    } else {
        console.log("Unexpected message received!");
    }
});

function getToken() {
    let tokenPromise = new Promise(function(myResolve) {
        chrome.identity.getAuthToken({interactive: true}, function(token) {
            if (chrome.runtime.lastError || !token) {
                console.error('Error getting OAuth token:', chrome.runtime.lastError);
                window.alert('Failed to get OAuth token. Please try again.');
                return;
            }
            myResolve(token);
        });
    });
    
    tokenPromise.then(
        function(token) {
            getCalIds(token);
        }
    )
}

function getCalIds(token) {
    fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            console.log(`Error creating event: ${response.statusText}`);
            window.alert(`Error creating event: ${response.statusText}`);
        }
        return response.json();
    })
    .then(calObject => {
        console.log('Calendar list:', calObject);
        parseCalIds(calObject);
    })
    .catch(error => {
        console.error('Error occured:', error);
        window.alert(`Error occured: ${error.message}`);
    })
}

function parseCalIds(calObject) {
    let calJson = {};
    calObject.items.forEach(calendar => {
        if (!(calendar.summary.includes("Holidays")) && !(calendar.summary.includes("Birthdays"))) {
            calJson[calendar.summary] = calendar.id;
        }
    });

    chrome.runtime.sendMessage({
        action: 'calData',
        data: calJson
    });
}
