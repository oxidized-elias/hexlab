FROM node:lts-alpine
EXPOSE 5173
EXPOSE 4173

WORKDIR /usr/local/hexlab

COPY package*.json ./
RUN npm install
COPY . .

CMD ["sh", "-c", "npm run dev -- --host 0.0.0.0"]
