<template>
  <div class="home"> 
    <v-text-field
    v-model="newTaskTitle"
    @click:append="addTask"
      class="pa-3"    
      outlined
      label="Add Task"
      append-icon="mdi-plus"
      hide-details
      clearable
          ></v-text-field>

    <v-list
      class="pt-0"
      flat
    >
       <div 
       v-for="task in tasks"
      :key="task.id">
      <v-list-item
      @click="doneTask(task.id)"
      :class="{ 'blue lighten-5' : task.done }"
      >
          <template v-slot:default>
            <v-list-item-action>
              <v-checkbox
                :input-value="task.done"
                color="primary"
              ></v-checkbox>
            </v-list-item-action>

            <v-list-item-content>
              <v-list-item-title
               :class="{ 'text-decoration-line-through' : task.done }"
              >
                {{ task.title }}
                </v-list-item-title>
            </v-list-item-content>

           <v-list-item-action>
          <v-btn icon
          @click.stop="deleteTask(task.id)"
          >
            <v-icon color="red lighten-1">mdi-delete</v-icon>
          </v-btn>
        </v-list-item-action>

          </template>
        </v-list-item>
     <v-divider></v-divider>
       </div>
        
    </v-list>
  </div>
</template>

<script>

  export default {
    name: 'Home',
    data() {
      return {
        STORAGE_KEY: 'todo-app-storage',
        newTaskTitle: '',
        tasks: [],
        newTask: ''
      }
    },
    created() {
      this.tasks = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]')
      console.log(this.tasks)
    },
    methods: {
       addTask() {
       let newTask = {
         id: Date.now(),
         title: this.newTaskTitle,
         done: false
       }
       this.tasks.push(newTask)
       this.newTaskTitle = ''
       localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.tasks));
       },

      doneTask(id) {
        let task = this.tasks.filter(task => task.id === id)[0]
        task.done = !task.done
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.tasks))
      },
      deleteTask(id) {
        this.tasks = this.tasks.filter(task => task.id !== id)
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.tasks))
      }
    }
  }
</script>
