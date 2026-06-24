<template>
  <div class="about pa-6 mx-auto" style="max-width: 760px">
    <h1 class="mb-2">About Todo Plans</h1>
    <p class="text--secondary">
      A smart task manager that understands plain English. Just type what you need
      to do and it figures out the priority, tags, and due date for you.
    </p>

    <v-card outlined class="my-4">
      <v-card-title class="text-subtitle-1">Smart quick-add cheatsheet</v-card-title>
      <v-list dense>
        <v-list-item v-for="tip in tips" :key="tip.code">
          <v-list-item-content>
            <v-list-item-title>
              <code>{{ tip.code }}</code>
            </v-list-item-title>
            <v-list-item-subtitle>{{ tip.desc }}</v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-card>

    <v-card outlined>
      <v-card-title class="text-subtitle-1">Features</v-card-title>
      <v-card-text>
        <v-chip v-for="f in features" :key="f" class="ma-1" small outlined>
          <v-icon left x-small>mdi-check</v-icon>{{ f }}
        </v-chip>
      </v-card-text>
    </v-card>
  </div>
</template>

<script>
export default {
  name: 'AboutView',
  data: () => ({
    tips: [
      { code: '!high  !!  !med  !low', desc: 'Set priority explicitly' },
      { code: 'urgent / asap / important', desc: 'Auto-detected as high priority' },
      { code: '#work  #home  #shopping', desc: 'Add one or more tags' },
      { code: 'today / tomorrow / friday', desc: 'Relative due dates' },
      { code: 'in 3 days / in 2 weeks', desc: 'Offset due dates' },
      { code: '9am / 5:30pm / 17:00', desc: 'Add a time to the due date' },
      { code: 'every day / every monday / weekly', desc: 'Recurring tasks that roll forward' }
    ],
    features: [
      'AI assistant (Groq)',
      'Natural-language parsing',
      'Recurring tasks',
      'Subtasks',
      'Priorities',
      'Tags',
      'Due dates & browser reminders',
      'Overdue detection',
      'Smart sorting',
      'Search & filters',
      'Progress stats',
      'Dark mode',
      'Undo delete',
      'Offline persistence'
    ]
  })
}
</script>
