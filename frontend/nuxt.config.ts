import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',

    devtools: {enabled: false},

    css: ['./app/assets/css/main.css'],

    modules: ["nuxt-charts"],

    vite: {
        plugins: [
            tailwindcss(),
        ],
    },

    devServer: {
        host: '0.0.0.0',
        port: 3000
    },

    // Configuração para comunicar com o Backend (evita CORS)
    routeRules: {
        '/api/**': {
            // Quando rodando no Docker, usa o nome do container 'app'
            // Quando no browser cliente, ele vai tentar bater no localhost
            proxy: process.env.NODE_ENV === 'production'
                ? 'http://app:5000/api/**'
                : 'http://app:5000/api/**'
        }
    }

})
