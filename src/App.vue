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
    </v-app-bar>

    <v-main>
      <router-view></router-view>
    </v-main>
  </v-app>
</template>

<script>
import { mapState, mapGetters } from 'vuex'

export default {
  data: () => ({
    drawer: null,
    showSearch: false,
    headerImg: require('./assets/mountain.jpg'),
    items: [
      { title: 'Todo', icon: 'mdi-format-list-checks', to: '/' },
      { title: 'About', icon: 'mdi-help-box', to: '/about' }
    ]
  }),
  computed: {
    ...mapState(['dark', 'search']),
    ...mapGetters(['stats'])
  },
  created() {
    this.$vuetify.theme.dark = this.dark
  },
  methods: {
    toggleDark() {
      const value = !this.dark
      this.$store.commit('SET_DARK', value)
      this.$vuetify.theme.dark = value
    },
    setSearch(v) {
      this.$store.commit('SET_SEARCH', v || '')
    }
  }
}
</script>
