const taskList = document.getElementById('taskList');
    const alarm = document.getElementById('alarmSound');
    let tasks = [];
    let vibrationInterval = null;
    let activeAlarm = null;
    let countdownNotifications = new Set(); // Track which tasks have shown countdown notifications

    // Request notification permission
    if ("Notification" in window && Notification.permission!== "granted") {
      Notification.requestPermission();
}

    window.onload = () => {
      const saved = localStorage.getItem('tasks');
      if (saved) {
        tasks = JSON.parse(saved);
        renderTasks();
}
};

    function saveTasks() {
      localStorage.setItem('tasks', JSON.stringify(tasks));
}

    function addTask() {
      const name = document.getElementById('taskName').value.trim();
      const timeStr = document.getElementById('taskTime').value;
      const endTime = new Date(timeStr).getTime();
      const repeatOption = document.getElementById('repeatOption').value;
      if (!name || isNaN(endTime)) return alert("Enter valid task and time");

      tasks.push({ name, endTime, expired: false, repeatOption });
      
      // Clear/refresh all input fields
      document.getElementById('taskName').value = '';
      document.getElementById('taskTime').value = '';
      document.getElementById('repeatOption').value = 'none';
      
      saveTasks();
      renderTasks();
    }

    function formatTime(ms) {
      const totalSecs = Math.floor(ms / 1000);
      const hrs = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

    function renderTasks() {
      taskList.innerHTML = '';
      tasks.forEach((task, index) => {
        const remaining = task.endTime - Date.now();
        const div = document.createElement('div');
        div.className = 'task';
    
        if (task.expired) {
          div.classList.add('expired');
          div.innerHTML += `<div class="flag">✅</div>`;
        } else if (remaining <= 20000) {
          div.classList.add('soon');
        }
    
        const deadline = new Date(task.endTime).toLocaleString();
        // Handle both new repeatOption and legacy repeatDaily
        const repeatOption = task.repeatOption || (task.repeatDaily ? 'daily' : 'none');
        const repeatLabels = {
          'daily': ' <em>(Daily)</em>',
          'weekly': ' <em>(Weekly)</em>',
          'yearly': ' <em>(Yearly)</em>',
          'none': ''
        };
        const repeatLabel = repeatLabels[repeatOption] || '';
        div.innerHTML += `<strong>${task.name}</strong>${repeatLabel}<br>
                          Deadline: ${deadline}<br>
                          Time left: ${task.expired? 'Expired': formatTime(remaining)}
                          <div class="controls">
                            <button onclick="editTask(${index})">✏️ Edit</button>
                            <button class="del" onclick="deleteTask(${index})">🗑️ Delete</button>
                            ${task.expired? `<button onclick="snoozeTask(${index})">😴 Snooze</button>`: ''}
      </div>`;
        taskList.appendChild(div);
      });
    }

    function editTask(index) {
      const task = tasks[index];
      const newName = prompt("Edit task name:", task.name);
      const newTime = prompt("Edit deadline (YYYY-MM-DD HH:MM:SS):", new Date(task.endTime).toISOString().slice(0, 19).replace("T", " "));
      const currentRepeat = task.repeatOption || (task.repeatDaily ? 'daily' : 'none'); // Handle legacy tasks
      const repeatStr = prompt("Repeat option (none/daily/weekly/yearly):", currentRepeat);
      const validOptions = ['none', 'daily', 'weekly', 'yearly'];
      const repeatOption = validOptions.includes(repeatStr) ? repeatStr : 'none';
      if (newName && newTime) {
        task.name = newName;
        task.endTime = new Date(newTime.replace(" ", "T")).getTime();
        task.repeatOption = repeatOption;
        delete task.repeatDaily; // Remove legacy property
        task.expired = false;
        saveTasks();
        renderTasks();
      }
    }

    function deleteTask(index) {
      tasks.splice(index, 1);
      saveTasks();
      renderTasks();
}

    function snoozeTask(index) {
      tasks[index].endTime = Date.now() + 5 * 60000;
      tasks[index].expired = false;
      stopAlarm();
      saveTasks();
      renderTasks();
}

    function stopAlarm() {
      if (activeAlarm) {
        activeAlarm.pause();
        activeAlarm.currentTime = 0;
        activeAlarm = null;
}
      if (vibrationInterval) {
        clearInterval(vibrationInterval);
        vibrationInterval = null;
}
}

    function triggerAlarm(taskName) {
      activeAlarm = alarm;
      alarm.volume = 1.0;
      alarm.play();
    
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(`${taskName} ⏰`, { body: `${taskName} is due!`});
      }
    
      if (navigator.vibrate) {
        vibrationInterval = setInterval(() => navigator.vibrate([500, 500]), 1000);
      }
    }

    setInterval(() => {
      tasks.forEach((task, index) => {
        const remaining = task.endTime - Date.now();
        const taskId = `${task.name}_${task.endTime}`; // Unique identifier for task
        
        // Show countdown notification when 20 seconds remaining
        if (!task.expired && remaining <= 20000 && remaining > 19000 && !countdownNotifications.has(taskId)) {
          countdownNotifications.add(taskId);
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(`⏰ ${task.name} - 20 seconds left!`, {
              body: `Your task "${task.name}" will expire in 20 seconds!`,
              icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="18" font-size="18">⏰</text></svg>'
            });
          }
        }
        
        if (!task.expired && Date.now()>= task.endTime) {
          triggerAlarm(task.name);
          countdownNotifications.delete(taskId); // Clean up countdown notification tracker
          
          // Handle both new repeatOption and legacy repeatDaily
          const repeatOption = task.repeatOption || (task.repeatDaily ? 'daily' : 'none');
          
          if (repeatOption !== 'none') {
            // Calculate next occurrence based on repeat type
            const intervals = {
              'daily': 24 * 60 * 60 * 1000,      // 1 day
              'weekly': 7 * 24 * 60 * 60 * 1000, // 7 days
              'yearly': 365 * 24 * 60 * 60 * 1000 // 365 days
            };
            
            const interval = intervals[repeatOption];
            if (interval) {
              let next = task.endTime + interval;
              while (next <= Date.now()) next += interval;
              task.endTime = next;
              
              // Migrate legacy tasks to new format
              if (task.repeatDaily) {
                task.repeatOption = 'daily';
                delete task.repeatDaily;
              }
            }
          } else {
            task.expired = true;
          }
          saveTasks();
        }
      });
      renderTasks();
    }, 1000);

    document.addEventListener('click', () => {
      alarm.volume = 1.0;
    }, { once: true});

    function subscribeNewsletter(event) {
      event.preventDefault();
      const email = document.getElementById('newsletterEmail').value;
      if (email) {
        alert(`Thank you for subscribing with email: ${email}`);
        document.getElementById('newsletterEmail').value = '';
      }
    }