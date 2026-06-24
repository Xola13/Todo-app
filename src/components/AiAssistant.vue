<template>
  <v-dialog :value="value" @input="$emit('input', $event)" max-width="560" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon left color="primary">mdi-robot-happy</v-icon>
        AI Assistant
        <v-spacer></v-spacer>
        <v-chip x-small outlined>{{ groqModel }}</v-chip>
        <v-btn icon @click="$emit('input', false)"><v-icon>mdi-close</v-icon></v-btn>
      </v-card-title>

      <v-divider></v-divider>

      <!-- Not configured -->
      <v-card-text v-if="!aiReady" class="text-center py-8">
        <v-icon size="48" color="grey">mdi-key-outline</v-icon>
        <p class="mt-3 mb-1">No Groq API key yet.</p>
        <p class="caption text--secondary">
          Add a free key from console.groq.com in Settings to enable the assistant.
        </p>
        <v-btn color="primary" small @click="$emit('open-settings')">Open Settings</v-btn>
      </v-card-text>

      <template v-else>
        <!-- Quick prompts -->
        <v-card-text class="pb-1">
          <div class="d-flex flex-wrap" style="gap:6px">
            <v-chip
              v-for="q in quickPrompts"
              :key="q.label"
              small
              outlined
              :disabled="loading"
              @click="send(q.text)"
            >
              <v-icon left x-small>{{ q.icon }}</v-icon>{{ q.label }}
            </v-chip>
          </div>
        </v-card-text>

        <!-- Conversation -->
        <v-card-text ref="log" style="max-height:340px">
          <div v-if="!messages.length" class="text--secondary caption text-center py-4">
            Ask me to plan your day, organize tasks, or break a goal into steps.
          </div>

          <div v-for="(m, i) in messages" :key="i" class="mb-3">
            <div :class="m.role === 'user' ? 'text-right' : ''">
              <div
                class="d-inline-block px-3 py-2 rounded"
                :class="m.role === 'user' ? 'primary white--text' : 'grey lighten-3 black--text'"
                style="max-width:90%; white-space:pre-wrap; text-align:left"
              >{{ m.content }}</div>
            </div>

            <!-- proposed actions -->
            <div v-if="m.actions && m.actions.length" class="mt-2">
              <v-card outlined class="pa-2">
                <div class="caption font-weight-medium mb-1">
                  Proposed changes ({{ m.actions.length }})
                </div>
                <div
                  v-for="(a, ai) in m.actions"
                  :key="ai"
                  class="caption d-flex align-center"
                  style="gap:6px"
                >
                  <v-icon x-small :color="actionColor(a.type)">{{ actionIcon(a.type) }}</v-icon>
                  <span>{{ describeAction(a) }}</span>
                </div>
                <div class="mt-2 text-right" v-if="!m.applied">
                  <v-btn x-small text @click="dismiss(m)">Dismiss</v-btn>
                  <v-btn x-small color="primary" @click="apply(m)">Apply</v-btn>
                </div>
                <div class="mt-1 text-right caption success--text" v-else>
                  <v-icon x-small color="success">mdi-check</v-icon> Applied
                </div>
              </v-card>
            </div>
          </div>

          <div v-if="loading" class="text-center py-2">
            <v-progress-circular indeterminate size="22" color="primary"></v-progress-circular>
            <span class="caption text--secondary ml-2">Thinking…</span>
          </div>
          <div v-if="error" class="error--text caption mt-2">{{ error }}</div>
        </v-card-text>

        <v-divider></v-divider>

        <v-card-actions>
          <v-text-field
            v-model="draft"
            @keyup.enter="send()"
            placeholder="Ask anything about your tasks…"
            dense
            outlined
            hide-details
            :disabled="loading"
          ></v-text-field>
          <v-btn icon color="primary" :disabled="loading || !draft.trim()" @click="send()">
            <v-icon>mdi-send</v-icon>
          </v-btn>
        </v-card-actions>
      </template>
    </v-card>
  </v-dialog>
</template>

<script>
import { mapState, mapGetters } from 'vuex'
import { groqChat, parseJsonLoose } from '../utils/groqClient'

export default {
  name: 'AiAssistant',
  props: { value: Boolean },
  data() {
    return {
      draft: '',
      messages: [],
      loading: false,
      error: '',
      quickPrompts: [
        { label: 'Plan my day', icon: 'mdi-calendar-check', text: 'Plan my day. Suggest a focused order for today’s tasks and flag anything overdue.' },
        { label: 'What to focus on', icon: 'mdi-target', text: 'Given my current tasks, what are the 3 most important things to focus on right now and why?' },
        { label: 'Organize tasks', icon: 'mdi-auto-fix', text: 'Review my tasks and propose better priorities, tags, and due dates where they’re missing.' },
        { label: 'Break down a goal', icon: 'mdi-sitemap', text: 'Help me break a goal into subtasks. Ask me what the goal is if I haven’t said.' }
      ]
    }
  },
  computed: {
    ...mapState(['groqApiKey', 'groqModel', 'tasks']),
    ...mapGetters(['aiReady'])
  },
  methods: {
    systemPrompt() {
      const now = new Date()
      const slim = this.tasks.map(t => ({
        id: t.id,
        title: t.title,
        done: t.done,
        priority: t.priority,
        tags: t.tags,
        due: t.due,
        recurrence: t.recurrence,
        subtasks: t.subtasks.map(s => s.title)
      }))
      return `You are the assistant inside a smart todo app. The current date/time is ${now.toISOString()} (local: ${now.toString()}).

Here is the user's current task list as JSON:
${JSON.stringify(slim)}

Reply ONLY with a JSON object of this shape:
{
  "reply": "a short, friendly message to the user",
  "actions": [ ... ]   // may be empty if the user only asked a question
}

Allowed action objects:
- {"type":"add","title":"...","priority":"none|low|medium|high","tags":["..."],"due":"ISO-8601 or null","notes":"...","subtasks":["..."],"recurrence":{"type":"daily|weekly|weekdays|monthly","interval":1,"weekday":0}}
- {"type":"update","match":"text in the task title" OR "id":<number>,"changes":{ any of priority,tags,due,title,notes }}
- {"type":"complete","match":"..." OR "id":<number>}
- {"type":"delete","match":"..." OR "id":<number>}
- {"type":"add_subtask","match":"..." OR "id":<number>,"title":"..."}

Rules: Use real ISO dates for "due" computed from the current date. Only include actions the user clearly wants; if they just asked a question, return "actions": []. Keep "reply" concise. Never invent task ids — prefer "match" with a snippet of the title.`
    },

    async send(text) {
      const content = (text != null ? text : this.draft).trim()
      if (!content || this.loading) return
      this.error = ''
      this.draft = ''
      this.messages.push({ role: 'user', content })
      this.scroll()

      const apiMessages = [
        { role: 'system', content: this.systemPrompt() },
        ...this.messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({ role: m.role, content: m.content }))
      ]

      this.loading = true
      try {
        const raw = await groqChat({
          apiKey: this.groqApiKey,
          model: this.groqModel,
          messages: apiMessages,
          temperature: 0.3,
          json: true
        })
        const parsed = parseJsonLoose(raw)
        if (parsed && (parsed.reply || parsed.actions)) {
          this.messages.push({
            role: 'assistant',
            content: parsed.reply || 'Done.',
            actions: Array.isArray(parsed.actions) ? parsed.actions : [],
            applied: false
          })
        } else {
          this.messages.push({ role: 'assistant', content: raw || '(no response)' })
        }
      } catch (e) {
        this.error = e.message || String(e)
      } finally {
        this.loading = false
        this.scroll()
      }
    },

    async apply(m) {
      const summary = await this.$store.dispatch('applyAiActions', m.actions)
      m.applied = true
      this.$emit('applied', summary)
    },
    dismiss(m) {
      m.actions = []
    },

    scroll() {
      this.$nextTick(() => {
        const el = this.$refs.log
        if (el) el.scrollTop = el.scrollHeight
      })
    },

    actionIcon(type) {
      return {
        add: 'mdi-plus',
        update: 'mdi-pencil',
        complete: 'mdi-check',
        delete: 'mdi-delete',
        add_subtask: 'mdi-format-list-checks'
      }[type] || 'mdi-circle-small'
    },
    actionColor(type) {
      return { add: 'success', delete: 'error', complete: 'primary' }[type] || 'grey'
    },
    describeAction(a) {
      switch (a.type) {
        case 'add':
          return `Add “${a.title}”` + (a.due ? ` (due ${this.shortDate(a.due)})` : '')
        case 'update':
          return `Update “${a.match || a.id}”: ${Object.keys(a.changes || {}).join(', ')}`
        case 'complete':
          return `Complete “${a.match || a.id}”`
        case 'delete':
          return `Delete “${a.match || a.id}”`
        case 'add_subtask':
          return `Subtask for “${a.match || a.id}”: ${a.title}`
        default:
          return a.type
      }
    },
    shortDate(iso) {
      const d = new Date(iso)
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }
}
</script>
