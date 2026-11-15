FROM node:24-alpine AS base
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
# Copy only the manifests first: the dependency layer is rebuilt only when they change.
COPY package.json package-lock.json ./

# Image used by the test profile: includes dev dependencies, tests and lint config.
FROM base AS test
RUN npm ci
COPY . .
USER node
CMD ["npm", "test"]

# Image that runs the API: production dependencies and runtime files only.
FROM base AS production
ENV NODE_ENV=production
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY db ./db
COPY openapi.yaml ./
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
