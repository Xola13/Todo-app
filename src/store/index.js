import Vue from 'vue'
import Vuex from 'vuex'
import { parseSmartInput } from '../utils/smartParser'

Vue.use(Vuex)

const STORAGE_KEY = 'todo-app-storage-v2'
const SETTINGS_KEY = 'todo-app-settings'

function loadTasks() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    // migrate from the old simple schema if needed
    return raw.map(t => ({
      id: t.id,
      title: t.title,
      done: !!t.done,
      priority: t.priority || 'none',
      tags: Array.isArray(t.tags) ? t.tags : [],
      due: t.due || null,
      notes: t.notes || '',
      createdAt: t.createdAt || t.id || Date.now(),
      completedAt: t.completedAt || null
    }))
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

// Persist tasks + settings to localStorage after every mutation.
const persistPlugin = store => {
  store.subscribe((mutation, state) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks))
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ dark: state.dark }))
  })
}

export default new Vuex.Store({
  plugins: [persistPlugin],
  state: {
    tasks: loadTasks(),
    filter: 'all', // all | active | completed
    search: '',
    tagFilter: null,
    sortBy: 'smart', // smart | created | due | priority | alpha
    dark: persisted.dark || false
  },

  getters: {
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

      // status filter
      if (state.filter === 'active') list = list.filter(t => !t.done)
      else if (state.filter === 'completed') list = list.filter(t => t.done)

      // tag filter
      if (state.tagFilter) list = list.filter(t => t.tags.includes(state.tagFilter))

      // search
      if (state.search) {
        const q = state.search.toLowerCase()
        list = list.filter(
          t =>
            t.title.toLowerCase().includes(q) ||
            t.notes.toLowerCase().includes(q) ||
            t.tags.some(tag => tag.toLowerCase().includes(q))
        )
      }

      // sorting
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
            // completed sink to bottom, then priority, then due date
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
      if (t) {
        t.done = !t.done
        t.completedAt = t.done ? Date.now() : null
      }
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
    }
  },

  actions: {
    quickAdd({ commit }, rawText) {
      const parsed = parseSmartInput(rawText)
      if (!parsed.title) return null
      const task = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        title: parsed.title,
        done: false,
        priority: parsed.priority,
        tags: parsed.tags,
        due: parsed.due,
        notes: '',
        createdAt: Date.now(),
        completedAt: null
      }
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
    }
  }
})
