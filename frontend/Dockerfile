FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install

COPY . .

# O Nuxt usa a porta 3000 por padrão
EXPOSE 3000

# O comando para rodar Nuxt em modo dev e aceitar host externo
CMD ["npm", "run", "dev", "--", "--host"]