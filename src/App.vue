<template>
  <v-app id="inspire">
    <v-navigation-drawer v-model="drawer" app>
      <v-list-item two-line>
        <v-list-item-avatar color="primary">
          <v-icon dark>mdi-check-all</v-icon>
        </v-list-item-avatar>
        <v-list-item-content>
          <v-list-item-title class="text-h6">Todo plans</v-list-item-title>
          <v-list-item-subtitle>Stay smart, stay on track</v-list-item-subtitle>
        </v-list-item-content>
      </v-list-item>

      <v-divider></v-divider>

      <!-- Live progress in the drawer -->
      <div class="pa-4">
        <div class="d-flex justify-space-between caption mb-1">
          <span>Completed</span>
          <span>{{ stats.completed }}/{{ stats.total }}</span>
        </div>
        <v-progress-linear
          :value="stats.percent"
          color="success"
          height="6"
          rounded
        ></v-progress-linear>
      </div>

      <v-divider></v-divider>

      <v-list dense nav>
        <v-list-item v-for="item in items" :key="item.title" :to="item.to" link>
          <v-list-item-icon>
            <v-icon>{{ item.icon }}</v-icon>
          </v-list-item-icon>
          <v-list-item-content>
            <v-list-item-title>{{ item.title }}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list>

      <template v-slot:append>
        <div class="pa-3">
          <v-switch
            :input-value="dark"
            @change="toggleDark"
            label="Dark mode"
            prepend-icon="mdi-theme-light-dark"
            hide-details
            dense
          ></v-switch>
        </div>
      </template>
    </v-navigation-drawer>

    <v-app-bar app color="primary" dark prominent :src="headerImg">
      <template v-slot:img="{ props }">
        <v-img
          v-bind="props"
          gradient="to top right, rgba(19,84,122,.7), rgba(128,208,199,.8)"
        ></v-img>
      </template>

      <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>

      <v-app-bar-title style="color: white">Tasks</v-app-bar-title>

      <v-spacer></v-spacer>

      <v-slide-x-reverse-transition>
        <v-text-field
          v-if="showSearch"
          :value="search"
          @input="setSearch"
          flat
          solo-inverted
          hide-details
          dense
          clearable
          label="Search tasks"
          prepend-inner-icon="mdi-magnify"
          style="max-width: 280px"
        ></v-text-field>
      </v-slide-x-reverse-transition>

      <v-btn icon @click="showSearch = !showSearch">
        <v-icon>{{ showSearch ? 'mdi-close' : 'mdi-magnify' }}</v-icon>
      </v-btn>

      <v-btn icon @click="toggleDark">
        <v-icon>{{ dark ? 'mdi-weather-sunny' : 'mdi-weather-night' }}</v-icon>
      </v-btn>

      <v-btn icon @click="settingsDialog = true">
        <v-badge dot :color="aiReady ? 'success' : 'transparent'" overlap>
          <v-icon>mdi-cog</v-icon>
        </v-badge>
      </v-btn>
    </v-app-bar>

    <v-main>
      <router-view></router-view>
    </v-main>

    <!-- Settings dialog -->
    <v-dialog v-model="settingsDialog" max-width="520">
      <v-card>
        <v-card-title>
          <v-icon left>mdi-cog</v-icon>Settings
        </v-card-title>
        <v-card-text>
          <div class="text-subtitle-2 mb-2">
            <v-icon small left color="primary">mdi-robot-happy</v-icon>AI Assistant (Groq)
          </div>
          <v-text-field
            v-model="form.groqApiKey"
            :type="showKey ? 'text' : 'password'"
            label="Groq API key"
            placeholder="gsk_..."
            outlined
            dense
            :append-icon="showKey ? 'mdi-eye-off' : 'mdi-eye'"
            @click:append="showKey = !showKey"
            hint="Get a free key at console.groq.com/keys"
            persistent-hint
          ></v-text-field>
          <v-combobox
            v-model="form.groqModel"
            :items="modelOptions"
            label="Model"
            outlined
            dense
            class="mt-3"
            hint="Pick a current Groq model. You can type a custom id."
            persistent-hint
          ></v-combobox>

          <v-alert dense text type="warning" class="mt-3 caption mb-0">
            Your key is stored only in this browser and sent directly to Groq.
            For a public site, proxy requests through a backend instead.
          </v-alert>

          <v-divider class="my-4"></v-divider>

          <div class="text-subtitle-2 mb-1">
            <v-icon small left color="primary">mdi-bell</v-icon>Reminders
          </div>
          <v-switch
            v-model="form.notifications"
            label="Notify me when tasks are due"
            hide-details
            dense
            @change="onToggleNotifications"
          ></v-switch>
          <div v-if="notifPermission === 'denied'" class="caption error--text mt-1">
            Notifications are blocked in your browser settings.
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text @click="settingsDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="saveSettings">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-app>
</template>

<script>
import { mapState, mapGetters } from 'vuex'
import { requestPermission, supportsNotifications } from './utils/reminders'

export default {
  data: () => ({
    drawer: null,
    showSearch: false,
    settingsDialog: false,
    showKey: false,
    headerImg: require('./assets/mountain.jpg'),
    notifPermission: supportsNotifications() ? Notification.permission : 'unsupported',
    form: { groqApiKey: '', groqModel: '', notifications: false },
    modelOptions: [
      'openai/gpt-oss-20b',
      'openai/gpt-oss-120b',
      'qwen/qwen3.6-27b',
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant'
    ],
    items: [
      { title: 'Todo', icon: 'mdi-format-list-checks', to: '/' },
      { title: 'About', icon: 'mdi-help-box', to: '/about' }
    ]
  }),
  computed: {
    ...mapState(['dark', 'search', 'groqApiKey', 'groqModel', 'notifications']),
    ...mapGetters(['stats', 'aiReady'])
  },
  created() {
    this.$vuetify.theme.dark = this.dark
    this.$root.$on('open-settings', this.openSettings)
  },
  watch: {
    settingsDialog(open) {
      if (open) this.syncForm()
    }
  },
  methods: {
    toggleDark() {
      const value = !this.dark
      this.$store.commit('SET_DARK', value)
      this.$vuetify.theme.dark = value
    },
    setSearch(v) {
      this.$store.commit('SET_SEARCH', v || '')
    },
    openSettings() {
      this.settingsDialog = true
    },
    syncForm() {
      this.form = {
        groqApiKey: this.groqApiKey,
        groqModel: this.groqModel,
        notifications: this.notifications
      }
    },
    async onToggleNotifications(value) {
      if (value) {
        const result = await requestPermission()
        this.notifPermission = result
        if (result !== 'granted') this.form.notifications = false
      }
    },
    saveSettings() {
      this.$store.commit('SET_SETTINGS', {
        groqApiKey: (this.form.groqApiKey || '').trim(),
        groqModel: (this.form.groqModel || 'openai/gpt-oss-20b').trim(),
        notifications: !!this.form.notifications
      })
      this.settingsDialog = false
    }
  }
}
</script>
