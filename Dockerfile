FROM node:22-slim AS client
WORKDIR /app
COPY client/package.json ./client/package.json
RUN npm --prefix client install
COPY client ./client
RUN npm --prefix client run build

FROM node:22-slim AS server
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./package.json
RUN npm install --omit=dev && npx playwright install --with-deps chromium
COPY server ./server
COPY --from=client /app/client/dist ./client/dist
COPY client/public ./client/public
RUN mkdir -p /app/data
EXPOSE 5050
CMD ["node", "server/index.js"]
