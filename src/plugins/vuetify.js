import Vue from 'vue';
import Vuetify from 'vuetify/lib/framework';

Vue.use(Vuetify);

export default new Vuetify({
  theme: {
    themes: {
      light: {
        primary: '#5b6ef5',
        secondary: '#26a69a',
        success: '#43a047',
        error: '#e53935',
        warning: '#fb8c00'
      },
      dark: {
        primary: '#7c8cff',
        secondary: '#26a69a',
        success: '#66bb6a',
        error: '#ef5350',
        warning: '#ffa726'
      }
    }
  }
});
