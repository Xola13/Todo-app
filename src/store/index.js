import Vue from 'vue'
import Vuex from 'vuex'
import { parseSmartInput, nextOccurrence } from '../utils/smartParser'

Vue.use(Vuex)

const STORAGE_KEY = 'todo-app-storage-v2'
const SETTINGS_KEY = 'todo-app-settings'

let idSeq = 0
function newId() {
  return Date.now() * 1000 + (idSeq++ % 1000)
}

function normalizeTask(t) {
  return {
    id: t.id,
    title: t.title,
    done: !!t.done,
    priority: t.priority || 'none',
    tags: Array.isArray(t.tags) ? t.tags : [],
    due: t.due || null,
    notes: t.notes || '',
    recurrence: t.recurrence || null,
    subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
    createdAt: t.createdAt || t.id || Date.now(),
    completedAt: t.completedAt || null,
    notified: !!t.notified
  }
}

function loadTasks() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return raw.map(normalizeTask)
  } catch (e) {
    return []
  }
}

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
  } catch (e) {
    return {}
  }
}

const persisted = loadSettings()

const persistPlugin = store => {
  store.subscribe((mutation, state) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks))
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        dark: state.dark,
        groqApiKey: state.groqApiKey,
        groqModel: state.groqModel,
        notifications: state.notifications
      })
    )
  })
}

export default new Vuex.Store({
  plugins: [persistPlugin],

  state: {
    tasks: loadTasks(),
    filter: 'all',
    search: '',
    tagFilter: null,
    sortBy: 'smart',
    dark: persisted.dark || false,
    // AI / settings — a saved key (from Settings) wins; otherwise fall back to
    // the build-time env value in .env.local (VUE_APP_GROQ_API_KEY).
    groqApiKey: persisted.groqApiKey || process.env.VUE_APP_GROQ_API_KEY || '',
    groqModel:
      persisted.groqModel || process.env.VUE_APP_GROQ_MODEL || 'openai/gpt-oss-20b',
    notifications: persisted.notifications || false
  },

  getters: {
    aiReady: state => !!state.groqApiKey,

    allTags(state) {
      const set = new Set()
      state.tasks.forEach(t => t.tags.forEach(tag => set.add(tag)))
      return [...set].sort()
    },

    stats(state) {
      const total = state.tasks.length
      const completed = state.tasks.filter(t => t.done).length
      const active = total - completed
      const now = Date.now()
      const overdue = state.tasks.filter(
        t => !t.done && t.due && new Date(t.due).getTime() < now
      ).length
      const percent = total ? Math.round((completed / total) * 100) : 0
      return { total, completed, active, overdue, percent }
    },

    visibleTasks(state) {
      const priorityRank = { high: 0, medium: 1, low: 2, none: 3 }
      let list = state.tasks.slice()

      if (state.filter === 'active') list = list.filter(t => !t.done)
      else if (state.filter === 'completed') list = list.filter(t => t.done)

      if (state.tagFilter) list = list.filter(t => t.tags.includes(state.tagFilter))

      if (state.search) {
        const q = state.search.toLowerCase()
        list = list.filter(
          t =>
            t.title.toLowerCase().includes(q) ||
            t.notes.toLowerCase().includes(q) ||
            t.tags.some(tag => tag.toLowerCase().includes(q))
        )
      }

      list.sort((a, b) => {
        switch (state.sortBy) {
          case 'created':
            return b.createdAt - a.createdAt
          case 'alpha':
            return a.title.localeCompare(b.title)
          case 'priority':
            return priorityRank[a.priority] - priorityRank[b.priority]
          case 'due': {
            const ad = a.due ? new Date(a.due).getTime() : Infinity
            const bd = b.due ? new Date(b.due).getTime() : Infinity
            return ad - bd
          }
          case 'smart':
          default: {
            if (a.done !== b.done) return a.done ? 1 : -1
            const pr = priorityRank[a.priority] - priorityRank[b.priority]
            if (pr !== 0) return pr
            const ad = a.due ? new Date(a.due).getTime() : Infinity
            const bd = b.due ? new Date(b.due).getTime() : Infinity
            if (ad !== bd) return ad - bd
            return b.createdAt - a.createdAt
          }
        }
      })

      return list
    }
  },

  mutations: {
    ADD_TASK(state, task) {
      state.tasks.push(task)
    },
    UPDATE_TASK(state, { id, changes }) {
      const t = state.tasks.find(t => t.id === id)
      if (t) Object.assign(t, changes)
    },
    TOGGLE_TASK(state, id) {
      const t = state.tasks.find(t => t.id === id)
      if (!t) return
      // Recurring tasks roll forward instead of completing permanently.
      if (!t.done && t.recurrence) {
        t.due = nextOccurrence(t.due, t.recurrence)
        t.subtasks.forEach(s => (s.done = false))
        t.notified = false
        t.completedAt = Date.now()
        return
      }
      t.done = !t.done
      t.completedAt = t.done ? Date.now() : null
    },
    SET_NOTIFIED(state, id) {
      const t = state.tasks.find(t => t.id === id)
      if (t) t.notified = true
    },
    DELETE_TASK(state, id) {
      state.tasks = state.tasks.filter(t => t.id !== id)
    },
    RESTORE_TASK(state, { task, index }) {
      state.tasks.splice(index, 0, task)
    },
    CLEAR_COMPLETED(state) {
      state.tasks = state.tasks.filter(t => !t.done)
    },
    ADD_SUBTASK(state, { id, title }) {
      const t = state.tasks.find(t => t.id === id)
      if (t) t.subtasks.push({ id: newId(), title, done: false })
    },
    TOGGLE_SUBTASK(state, { id, subId }) {
      const t = state.tasks.find(t => t.id === id)
      const s = t && t.subtasks.find(s => s.id === subId)
      if (s) s.done = !s.done
    },
    DELETE_SUBTASK(state, { id, subId }) {
      const t = state.tasks.find(t => t.id === id)
      if (t) t.subtasks = t.subtasks.filter(s => s.id !== subId)
    },
    SET_FILTER(state, filter) {
      state.filter = filter
    },
    SET_SEARCH(state, search) {
      state.search = search
    },
    SET_TAG_FILTER(state, tag) {
      state.tagFilter = state.tagFilter === tag ? null : tag
    },
    SET_SORT(state, sortBy) {
      state.sortBy = sortBy
    },
    SET_DARK(state, dark) {
      state.dark = dark
    },
    SET_SETTINGS(state, payload) {
      Object.assign(state, payload)
    }
  },

  actions: {
    quickAdd({ commit }, rawText) {
      const parsed = parseSmartInput(rawText)
      if (!parsed.title) return null
      const task = normalizeTask({
        id: newId(),
        title: parsed.title,
        priority: parsed.priority,
        tags: parsed.tags,
        due: parsed.due,
        recurrence: parsed.recurrence,
        createdAt: Date.now()
      })
      commit('ADD_TASK', task)
      return task
    },
    updateTask({ commit }, payload) {
      commit('UPDATE_TASK', payload)
    },
    toggleTask({ commit }, id) {
      commit('TOGGLE_TASK', id)
    },
    deleteTask({ commit, state }, id) {
      const index = state.tasks.findIndex(t => t.id === id)
      const task = state.tasks[index]
      commit('DELETE_TASK', id)
      return { task, index }
    },
    restoreTask({ commit }, payload) {
      commit('RESTORE_TASK', payload)
    },
    clearCompleted({ commit }) {
      commit('CLEAR_COMPLETED')
    },

    // --- Apply a batch of structured actions coming from the AI assistant ---
    applyAiActions({ commit, state }, actions) {
      const summary = []
      ;(actions || []).forEach(a => {
        switch (a.type) {
          case 'add': {
            const task = normalizeTask({
              id: newId(),
              title: a.title || 'Untitled',
              priority: a.priority || 'none',
              tags: a.tags || [],
              due: a.due || null,
              notes: a.notes || '',
              recurrence: a.recurrence || null,
              subtasks: (a.subtasks || []).map(s => ({
                id: newId(),
                title: typeof s === 'string' ? s : s.title,
                done: false
              })),
              createdAt: Date.now()
            })
            commit('ADD_TASK', task)
            summary.push(`Added “${task.title}”`)
            break
          }
          case 'update': {
            const id = resolveId(state, a)
            if (id != null) {
              commit('UPDATE_TASK', { id, changes: a.changes || {} })
              summary.push('Updated a task')
            }
            break
          }
          case 'complete': {
            const id = resolveId(state, a)
            const t = state.tasks.find(t => t.id === id)
            if (t && !t.done) commit('TOGGLE_TASK', id)
            summary.push('Completed a task')
            break
          }
          case 'delete': {
            const id = resolveId(state, a)
            if (id != null) commit('DELETE_TASK', id)
            summary.push('Deleted a task')
            break
          }
          case 'add_subtask': {
            const id = resolveId(state, a)
            if (id != null && a.title) {
              commit('ADD_SUBTASK', { id, title: a.title })
              summary.push('Added a subtask')
            }
            break
          }
        }
      })
      return summary
    }
  }
})

// AI may reference a task by id or by a fuzzy title match.
function resolveId(state, a) {
  if (a.id != null && state.tasks.some(t => t.id === a.id)) return a.id
  if (a.match) {
    const q = String(a.match).toLowerCase()
    const hit = state.tasks.find(t => t.title.toLowerCase().includes(q))
    if (hit) return hit.id
  }
  return null
}
