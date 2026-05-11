import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createHead } from '@unhead/vue/client'
import App from './App.vue'
import router from './router'
import './assets/main.css'
import { initPaddle } from './services/paddle.service'
import { initAnalytics } from './services/analytics'

initAnalytics()

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(createHead())

app.mount('#app')

initPaddle()
