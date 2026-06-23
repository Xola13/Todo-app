<template>
  <div class="todo-wrap mx-auto pa-3">
    <!-- Stats dashboard -->
    <v-row dense class="mb-1">
      <v-col cols="6" sm="3">
        <v-card outlined class="text-center py-2">
          <div class="text-h5 font-weight-bold">{{ stats.total }}</div>
          <div class="caption text--secondary">Total</div>
        </v-card>
      </v-col>
      <v-col cols="6" sm="3">
        <v-card outlined class="text-center py-2">
          <div class="text-h5 font-weight-bold primary--text">{{ stats.active }}</div>
          <div class="caption text--secondary">Active</div>
        </v-card>
      </v-col>
      <v-col cols="6" sm="3">
        <v-card outlined class="text-center py-2">
          <div class="text-h5 font-weight-bold success--text">{{ stats.completed }}</div>
          <div class="caption text--secondary">Done</div>
        </v-card>
      </v-col>
      <v-col cols="6" sm="3">
        <v-card outlined class="text-center py-2">
          <div
            class="text-h5 font-weight-bold"
            :class="stats.overdue ? 'error--text' : 'text--disabled'"
          >
            {{ stats.overdue }}
          </div>
          <div class="caption text--secondary">Overdue</div>
        </v-card>
      </v-col>
    </v-row>

    <v-card outlined class="pa-3 mb-3">
      <div class="d-flex align-center mb-1">
        <span class="caption text--secondary">Progress</span>
        <v-spacer></v-spacer>
        <span class="caption font-weight-medium">{{ stats.percent }}%</span>
      </div>
      <v-progress-linear
        :value="stats.percent"
        height="8"
        rounded
        color="success"
      ></v-progress-linear>
    </v-card>

    <!-- Smart quick-add -->
    <v-text-field
      v-model="newTaskTitle"
      @keyup.enter="addTask"
      @click:append="addTask"
      outlined
      label="Add task — try: Email Sarah !high #work tomorrow 9am"
      append-icon="mdi-plus-circle"
      hide-details="auto"
      clearable
      class="mb-1"
    ></v-text-field>
    <div v-if="preview.title" class="px-1 mb-3 d-flex flex-wrap align-center" style="gap:6px">
      <span class="caption text--secondary">Will add:</span>
      <strong class="caption">{{ preview.title }}</strong>
      <v-chip
        v-if="preview.priority !== 'none'"
        x-small
        :color="priorityColor(preview.priority)"
        dark
      >{{ preview.priority }}</v-chip>
      <v-chip v-for="t in preview.tags" :key="t" x-small outlined>#{{ t }}</v-chip>
      <v-chip v-if="preview.due" x-small outlined color="primary">
        <v-icon left x-small>mdi-calendar</v-icon>{{ formatDue(preview.due) }}
      </v-chip>
    </div>

    <!-- Controls: filter tabs + search + sort -->
    <div class="d-flex align-center flex-wrap mb-2" style="gap:8px">
      <v-btn-toggle :value="filter" @change="setFilter" dense mandatory rounded>
        <v-btn small value="all">All</v-btn>
        <v-btn small value="active">Active</v-btn>
        <v-btn small value="completed">Done</v-btn>
      </v-btn-toggle>

      <v-spacer></v-spacer>

      <v-text-field
        :value="search"
        @input="setSearch"
        dense
        outlined
        hide-details
        clearable
        prepend-inner-icon="mdi-magnify"
        label="Search"
        style="max-width: 200px"
      ></v-text-field>

      <v-menu offset-y>
        <template v-slot:activator="{ on, attrs }">
          <v-btn small outlined v-bind="attrs" v-on="on">
            <v-icon left small>mdi-sort</v-icon>{{ sortLabel }}
          </v-btn>
        </template>
        <v-list dense>
          <v-list-item
            v-for="opt in sortOptions"
            :key="opt.value"
            @click="setSort(opt.value)"
          >
            <v-list-item-title>{{ opt.label }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </div>

    <!-- Tag filter chips -->
    <div v-if="allTags.length" class="mb-2 d-flex flex-wrap" style="gap:6px">
      <v-chip
        v-for="tag in allTags"
        :key="tag"
        small
        :color="tagFilter === tag ? 'primary' : undefined"
        :dark="tagFilter === tag"
        @click="setTagFilter(tag)"
      >#{{ tag }}</v-chip>
    </div>

    <!-- Task list -->
    <v-card outlined>
      <v-list class="pa-0">
        <template v-if="visibleTasks.length">
          <template v-for="(task, i) in visibleTasks">
            <v-list-item
              :key="task.id"
              :class="{ 'task-done': task.done }"
              @click="toggleTask(task.id)"
            >
              <v-list-item-action class="mr-3">
                <v-checkbox
                  :input-value="task.done"
                  :color="priorityColor(task.priority)"
                  @click.stop="toggleTask(task.id)"
                ></v-checkbox>
              </v-list-item-action>

              <v-list-item-content>
                <v-list-item-title
                  :class="{ 'text-decoration-line-through text--disabled': task.done }"
                >
                  {{ task.title }}
                </v-list-item-title>
                <v-list-item-subtitle
                  v-if="task.tags.length || task.due || task.priority !== 'none'"
                  class="mt-1 d-flex flex-wrap align-center"
                  style="gap:4px"
                >
                  <v-chip
                    v-if="task.priority !== 'none'"
                    x-small
                    :color="priorityColor(task.priority)"
                    dark
                  >{{ task.priority }}</v-chip>
                  <v-chip
                    v-if="task.due"
                    x-small
                    outlined
                    :color="dueColor(task)"
                  >
                    <v-icon left x-small>mdi-calendar-clock</v-icon>{{ formatDue(task.due) }}
                  </v-chip>
                  <v-chip v-for="t in task.tags" :key="t" x-small outlined>#{{ t }}</v-chip>
                </v-list-item-subtitle>
              </v-list-item-content>

              <v-list-item-action class="flex-row" style="flex-direction:row">
                <v-btn icon small @click.stop="openEdit(task)">
                  <v-icon small>mdi-pencil</v-icon>
                </v-btn>
                <v-btn icon small @click.stop="removeTask(task)">
                  <v-icon small color="red lighten-1">mdi-delete</v-icon>
                </v-btn>
              </v-list-item-action>
            </v-list-item>
            <v-divider v-if="i < visibleTasks.length - 1" :key="'d' + task.id"></v-divider>
          </template>
        </template>

        <v-list-item v-else>
          <v-list-item-content class="text-center py-6">
            <v-icon size="48" color="grey lighten-1">mdi-check-circle-outline</v-icon>
            <div class="text--secondary mt-2">{{ emptyMessage }}</div>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-card>

    <div v-if="stats.completed" class="text-right mt-2">
      <v-btn small text color="error" @click="clearCompleted">
        <v-icon left small>mdi-broom</v-icon>Clear completed
      </v-btn>
    </div>

    <!-- Edit dialog -->
    <v-dialog v-model="editDialog" max-width="460">
      <v-card v-if="editing">
        <v-card-title>Edit task</v-card-title>
        <v-card-text>
          <v-text-field v-model="editing.title" label="Title" outlined dense></v-text-field>
          <v-select
            v-model="editing.priority"
            :items="priorityItems"
            label="Priority"
            outlined
            dense
          ></v-select>
          <v-combobox
            v-model="editing.tags"
            label="Tags"
            multiple
            chips
            small-chips
            outlined
            dense
            append-icon=""
          ></v-combobox>
          <v-menu
            v-model="dateMenu"
            :close-on-content-click="false"
            transition="scale-transition"
            offset-y
          >
            <template v-slot:activator="{ on, attrs }">
              <v-text-field
                :value="editing.due ? formatDue(editing.due) : ''"
                label="Due date"
                prepend-inner-icon="mdi-calendar"
                readonly
                clearable
                outlined
                dense
                v-bind="attrs"
                v-on="on"
                @click:clear="editing.due = null"
              ></v-text-field>
            </template>
            <v-date-picker
              :value="editing.due ? editing.due.substring(0,10) : null"
              @input="onPickDate"
            ></v-date-picker>
          </v-menu>
          <v-textarea v-model="editing.notes" label="Notes" outlined dense rows="2"></v-textarea>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text @click="editDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="saveEdit">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Undo snackbar -->
    <v-snackbar v-model="snackbar" :timeout="5000">
      Task deleted
      <template v-slot:action="{ attrs }">
        <v-btn text color="primary" v-bind="attrs" @click="undoDelete">Undo</v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script>
import { mapGetters, mapState } from 'vuex'
import { parseSmartInput } from '../utils/smartParser'

export default {
  name: 'Todo',
  data() {
    return {
      newTaskTitle: '',
      editDialog: false,
      editing: null,
      dateMenu: false,
      snackbar: false,
      lastDeleted: null,
      sortOptions: [
        { value: 'smart', label: 'Smart' },
        { value: 'created', label: 'Newest' },
        { value: 'due', label: 'Due date' },
        { value: 'priority', label: 'Priority' },
        { value: 'alpha', label: 'A–Z' }
      ],
      priorityItems: [
        { text: 'None', value: 'none' },
        { text: 'Low', value: 'low' },
        { text: 'Medium', value: 'medium' },
        { text: 'High', value: 'high' }
      ]
    }
  },
  computed: {
    ...mapState(['filter', 'search', 'tagFilter', 'sortBy']),
    ...mapGetters(['visibleTasks', 'stats', 'allTags']),
    preview() {
      return parseSmartInput(this.newTaskTitle || '')
    },
    sortLabel() {
      const o = this.sortOptions.find(o => o.value === this.sortBy)
      return o ? o.label : 'Sort'
    },
    emptyMessage() {
      if (this.search) return 'No tasks match your search'
      if (this.filter === 'completed') return 'No completed tasks yet'
      if (this.filter === 'active') return 'Nothing to do — you’re all caught up!'
      return 'No tasks yet. Add one above to get started.'
    }
  },
  methods: {
    addTask() {
      if (!this.preview.title) return
      this.$store.dispatch('quickAdd', this.newTaskTitle)
      this.newTaskTitle = ''
    },
    toggleTask(id) {
      this.$store.dispatch('toggleTask', id)
    },
    async removeTask(task) {
      this.lastDeleted = await this.$store.dispatch('deleteTask', task.id)
      this.snackbar = true
    },
    undoDelete() {
      if (this.lastDeleted) {
        this.$store.dispatch('restoreTask', this.lastDeleted)
        this.lastDeleted = null
      }
      this.snackbar = false
    },
    clearCompleted() {
      this.$store.dispatch('clearCompleted')
    },
    openEdit(task) {
      this.editing = {
        id: task.id,
        title: task.title,
        priority: task.priority,
        tags: [...task.tags],
        due: task.due,
        notes: task.notes
      }
      this.editDialog = true
    },
    onPickDate(date) {
      // preserve any existing time, default to noon
      const base = this.editing.due ? new Date(this.editing.due) : new Date()
      const [y, m, d] = date.split('-').map(Number)
      base.setFullYear(y, m - 1, d)
      if (!this.editing.due) base.setHours(12, 0, 0, 0)
      this.editing.due = base.toISOString()
      this.dateMenu = false
    },
    saveEdit() {
      const { id, ...changes } = this.editing
      changes.tags = changes.tags.map(t => String(t).replace(/^#/, '').toLowerCase())
      this.$store.dispatch('updateTask', { id, changes })
      this.editDialog = false
    },
    setFilter(v) {
      if (v) this.$store.commit('SET_FILTER', v)
    },
    setSearch(v) {
      this.$store.commit('SET_SEARCH', v || '')
    },
    setTagFilter(tag) {
      this.$store.commit('SET_TAG_FILTER', tag)
    },
    setSort(v) {
      this.$store.commit('SET_SORT', v)
    },
    priorityColor(p) {
      return { high: 'red', medium: 'orange', low: 'blue', none: 'grey' }[p] || 'grey'
    },
    dueColor(task) {
      if (task.done) return 'grey'
      const now = Date.now()
      const due = new Date(task.due).getTime()
      if (due < now) return 'red'
      if (due - now < 24 * 3600 * 1000) return 'orange'
      return 'primary'
    },
    formatDue(iso) {
      const d = new Date(iso)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const target = new Date(d)
      target.setHours(0, 0, 0, 0)
      const dayDiff = Math.round((target - today) / (24 * 3600 * 1000))
      const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0
      const time = hasTime
        ? ' ' +
          d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        : ''
      if (dayDiff === 0) return 'Today' + time
      if (dayDiff === 1) return 'Tomorrow' + time
      if (dayDiff === -1) return 'Yesterday' + time
      if (dayDiff > 1 && dayDiff < 7)
        return d.toLocaleDateString([], { weekday: 'short' }) + time
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + time
    }
  }
}
</script>

<style scoped>
.todo-wrap {
  max-width: 760px;
}
.task-done {
  opacity: 0.7;
}
</style>
