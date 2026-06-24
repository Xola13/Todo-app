// Lightweight due-date reminder service using the browser Notification API.
// Polls the store on an interval and fires a notification once per task when it
// becomes due (within the next minute) or is already overdue and unnotified.

let timer = null

export function supportsNotifications() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export async function requestPermission() {
  if (!supportsNotifications()) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  try {
    return await Notification.requestPermission()
  } catch (e) {
    return Notification.permission
  }
}

function fire(task) {
  try {
    const n = new Notification('⏰ Task due: ' + task.title, {
      body: task.due ? 'Due ' + new Date(task.due).toLocaleString() : 'Reminder',
      tag: 'todo-' + task.id
    })
    n.onclick = () => {
      window.focus()
      n.close()
    }
  } catch (e) {
    /* ignore */
  }
}

// Start polling. `store` is the Vuex store. Returns a stop function.
export function startReminderService(store) {
  stopReminderService()

  const check = () => {
    if (!store.state.notifications) return
    if (!supportsNotifications() || Notification.permission !== 'granted') return
    const now = Date.now()
    store.state.tasks.forEach(task => {
      if (task.done || task.notified || !task.due) return
      const due = new Date(task.due).getTime()
      // notify when due within the next 60s or already overdue
      if (due - now <= 60 * 1000) {
        fire(task)
        store.commit('SET_NOTIFIED', task.id)
      }
    })
  }

  check()
  timer = setInterval(check, 30 * 1000)
  return stopReminderService
}

export function stopReminderService() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
