FROM node:24-alpine
WORKDIR /app
COPY package.json server.js cars.json index.html style.css app.js ./
ENV NODE_ENV=production
CMD ["node", "server.js"]
