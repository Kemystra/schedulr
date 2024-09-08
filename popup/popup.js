document.getElementById('colorForm').addEventListener('submit', function(event) {
    event.preventDefault();  // Prevent the form from submitting

    try{
        // Get the value of the selected radio button
        const selectedSemesterValue = document.querySelector('input[name="semester"]:checked')?.value;
        const selectedReminderTime = document.querySelector('input[name="reminder"]:checked')?.value;
        const selectedColorValue = document.querySelector('input[name="color"]:checked')?.value;

        // Check if both values are selected
        if (selectedSemesterValue && selectedReminderTime && selectedColorValue) {
            chrome.identity.getAuthToken({interactive: true}, function(token) {
                if (chrome.runtime.lastError || !token) {
                    console.error('Error getting OAuth token:', chrome.runtime.lastError);
                    window.alert('Failed to get OAuth token. Please try again.');
                    return;
                }

                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    var currTab = tabs[0];
                    if (chrome.runtime.lastError || !currTab) {
                        console.error('Error querying tabs:', chrome.runtime.lastError);
                        window.alert('Failed to query the current tab. Please try again.');
                        return;
                    }

                    chrome.scripting.executeScript({
                        target: { tabId: currTab.id },
                        func: (token, selectedSemesterValue, selectedReminderTime, selectedColorValue) => {
                            try {
                                window.accessToken = token;  // Store the token globally

                                // ===============Google API===============
                                // Function to create a calendar event
                                function createCalendarEvent(accessToken, event) {
                                    fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                                        method: 'POST',
                                        headers: {
                                            'Authorization': `Bearer ${accessToken}`,
                                            'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify(event)
                                    })
                                    .then(response => {
                                        if (!response.ok) {
                                            throw new Error(`Error creating event: ${response.statusText}`);
                                        }
                                        return response.json();
                                    })
                                    .then(data => {
                                        console.log('Event created:', data);
                                    })
                                    .catch(error => {
                                        console.error('Error creating event:', error);
                                        window.alert('Failed to create event: ${error.message}');
                                    });
                                }

                                // ===============Web scrape functions===============
                                // Declare iframe
                                function processIframe(){
                                    try {
                                        const iframeElement = document.querySelector("#ptifrmtgtframe");

                                        if (!iframeElement) {
                                            throw "iframe not found!";
                                        }

                                        // Remove unnecessary prefix
                                        function truncLocation(location){
                                            const prefix = "Common Lecture Complex &amp; ";
                                            if (location.startsWith(prefix)) {
                                                return location.slice(prefix.length).trim();
                                            }
                                            return location;
                                        }

                                        // Remove unnecessary spaces for class. Currently looks like 'LM     PU3192 - FCI4'
                                        function truncClassSpace(className){
                                            const [beforeHyphen, afterHyphen] = className.split('-');
                                            const trimBeforeHyphen = beforeHyphen.replace(/\s+/g, '');
                                            const fullClassName = `${trimBeforeHyphen} -${afterHyphen}`
                                            return fullClassName
                                        }

                                        // Reformat time. Current looks like '2:00PM - 4:00PM' and '10:00AM - 12:00PM' 
                                        // Target format '2024-08-12T09:00:00+08:00'
                                        function formatTime(classTime){
                                            function convertTimeFormat(timeStr) {
                                                const [time, period] = timeStr.split(/(AM|PM)/);

                                                let [hour, minute] = time.split(':');

                                                if (period === 'AM' && parseInt(hour) < 10) {
                                                    hour = `0${hour}`;
                                                } else if (period === 'AM' && parseInt(hour) > 9) {
                                                    hour = `${hour}`;
                                                } else if (period === 'PM' && parseInt(hour) < 12) {
                                                    hour = parseInt(hour) + 12;
                                                }

                                                return `${hour}:${minute}:00+08:00`;
                                            }

                                            const [startTime, endTime] = classTime.split('-').map(t => t.trim());


                                            return {
                                                formattedStartTime: convertTimeFormat(startTime),
                                                formattedEndTime: convertTimeFormat(endTime)
                                            }
                                        }

                                        // Reformat date. Currently looks like '14 Aug'
                                        // Target format '2024-08-14'
                                        function formatDate(classDate, yearElement){
                                            // Get the correct date and month
                                            const [date, month] = classDate.split(' ')
                                            // console.log(`${date},${month}`)
                                            const months = {
                                                'Jan':'01', 'Feb':'02', 'Mar':'03', 'Apr':'04',
                                                'May':'05', 'Jun':'06', 'Jul':'07', 'Aug':'08',
                                                'Sep':'09', 'Oct':'10', 'Nov':'11', 'Dec':'12'
                                            }

                                            let monthValue = months[month];
                                            endDateYear = yearElement.substr(-4, 4);
                                            return `${endDateYear}-${monthValue}-${date}`
                                        }

                                        function createArray(rows, cols, value = 0) {
                                            let arr = new Array(rows);
                                            for (let i = 0; i < rows; i++) {
                                                arr[i] = new Array(cols).fill(value);
                                            }

                                            // console.log(arr);
                                            return arr;
                                        }

                                        function rowSpan(fStartTime, fEndTime) {
                                            // Parse formatted time
                                            const startTime = fStartTime.split(':');
                                            const endTime = fEndTime.split(':');

                                            // Get hour/min
                                            const startHour = parseInt(startTime[0]);
                                            const endHour = parseInt(endTime[0]);
                                            const endMin = parseInt(endTime[1]);

                                            hourSpan = endHour - startHour;
                                            if (endMin > 0) {
                                                let minSpan = 1;
                                                totalSpan = hourSpan + minSpan
                                            } else {
                                                totalSpan = hourSpan;
                                            }
                                            // console.log(totalSpan);

                                            return totalSpan;
                                        }

                                        if (iframeElement) {
                                            // Access the iframe's content document
                                            const iframeDocument = iframeElement.contentWindow.document.body;

                                            // Select elements in iframe
                                            const dayHeader = iframeDocument.querySelectorAll("th.PSLEVEL3GRIDODDROW");
                                            const rows = iframeDocument.querySelectorAll("table.PSLEVEL3GRIDODDROW  tr");
                                            const year = iframeDocument.querySelector("div#win0divDERIVED_CLASS_S_DESCR100_2 td.PSGROUPBOXLABEL.PSLEFTCORNER").textContent;

                                            // Get the dates
                                            const days = []
                                            const dates = []
                                            if (dayHeader.length > 0) {
                                                dayHeader.forEach((element) => {
                                                    const dayText = element.textContent.split("\n");
                                                    const day = dayText[0].trim();
                                                    const date = dayText[1]
                                                    // console.log(`Day: ${day}, Date: ${date}`);
                                                    days.push(day);
                                                    dates.push(date);
                                                    // console.log(days);
                                                    // console.log(dates);
                                                })
                                            } else {
                                                console.log("No day elements found");
                                                throw "No day elements found";
                                            }

                                            // days.shift();
                                            // dates.shift();
                                            // console.log(days);
                                            // console.log(dates);

                                            let skip = createArray(12, 8, 0);

                                            // For every tr
                                            rows.forEach((row, rowIndex) => {
                                                const cells = row.querySelectorAll("td.PSLEVEL3GRIDODDROW");
                                                // console.log(`Amount of cells: ${cells.length}`);

                                                // track current row skips
                                                let curRowSkips = 0;

                                                // Get every cell in row
                                                if (cells.length > 0) {
                                                    cells.forEach((cell, susColIndex) => {
                                                        if (susColIndex > 0) { // Skip first(time) column
                                                            let colIndex = susColIndex + curRowSkips;
                                                            // console.log(rowIndex, susColIndex);

                                                            if (skip[rowIndex][susColIndex] > 0) {
                                                                curRowSkips += skip[rowIndex][susColIndex];
                                                                colIndex += skip[rowIndex][susColIndex];
                                                            }

                                                            const spanElement = cell.querySelector("span");
                                                            if (spanElement) {
                                                                // Get innerHTML
                                                                const classContent = spanElement.innerHTML.split('<br>');

                                                                // Process data
                                                                const className = truncClassSpace(classContent[0]) + ', ' + classContent[1];
                                                                const classTime = classContent[2];
                                                                const {formattedStartTime, formattedEndTime} = formatTime(classTime);
                                                                const classLocation = truncLocation(classContent[3]);

                                                                const day = days[colIndex];
                                                                const startDate = formatDate(dates[colIndex], year);
                                                                const endDate = formatDate(dates[colIndex], year);

                                                                console.log(`Summary: ${className}, Location: ${classLocation}, Day: ${day}, startDateTime: ${startDate}T${formattedStartTime}, endDateTime: ${endDate}T${formattedEndTime}`);

                                                                // If class is 2 hours, mark slot below as "True"
                                                                let totalSpan = rowSpan(formattedStartTime, formattedEndTime);

                                                                if (totalSpan > 1) {
                                                                    for (i = 1; i < totalSpan; i++) {
                                                                        if (rowIndex + i < skip.length) {
                                                                            // Do a for loop that adds 1 to corresponding hours
                                                                            skip[rowIndex + i][colIndex] = 1;

                                                                            let itrColIndex = colIndex - 1
                                                                            while(itrColIndex > 0) {
                                                                                if(skip[rowIndex + i][itrColIndex] > 0) {
                                                                                    skip[rowIndex + i][itrColIndex] += 1
                                                                                }
                                                                                else {
                                                                                    break
                                                                                }
                                                                                itrColIndex -= 1
                                                                            }
                                                                        }
                                                                    }
                                                                }

                                                                var event = {
                                                                    'summary': `${className}`,
                                                                    'location': `${classLocation}`,
                                                                    'start': {
                                                                        'dateTime': `${startDate}T${formattedStartTime}`,
                                                                        'timeZone': 'Asia/Kuala_Lumpur'
                                                                    },
                                                                    'end': {
                                                                        'dateTime': `${endDate}T${formattedEndTime}`,
                                                                        'timeZone': 'Asia/Kuala_Lumpur'
                                                                    },
                                                                    'recurrence': [
                                                                        `RRULE:FREQ=WEEKLY;COUNT=${selectedSemesterValue}`
                                                                    ],
                                                                    'reminders': {
                                                                        'useDefault': false,
                                                                        'overrides': [
                                                                            {
                                                                                'method': 'popup',
                                                                                'minutes': selectedReminderTime
                                                                            }
                                                                        ]
                                                                    },
                                                                    'colorId': selectedColorValue
                                                                }

                                                                // console.log('Event: ', event)

                                                                // Log the selected value
                                                                // console.log(`RRULE:FREQ=WEEKLY;COUNT=${selectedSemesterValue}`);
                                                                // console.log('Selected semester value:', selectedSemesterValue);

                                                                if (window.accessToken) {
                                                                    // console.log("Extension end");
                                                                    createCalendarEvent(window.accessToken, event);
                                                                }
                                                            }
                                                        }
                                                    });
                                                }
                                            })
                                        }
                                    }
                                    catch(err) {
                                        console.error('Unexpected error in form submission:', err)
                                        window.alert(`An unexpected error occured: ${err}`)
                                    }
                                }
                                processIframe();
                            }
                            catch(err) {
                                console.error('An unexpected error occured: ', err);
                                window.alert('An unexpected error occured: ', err);
                            }
                        },
                        args: [token, selectedSemesterValue, selectedReminderTime, selectedColorValue]
                    });
                });
            });
        } else {
            window.alert('Please select all options.');
        }
    }
    catch(err) {
        console.error('An unexpected error occured: ', err);
        window.alert(`An unexpected error occured: ${err.message}`);
    }
});
