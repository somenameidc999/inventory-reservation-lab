FROM node:24-alpine AS source
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY --chown=node:node . .
ENV NEXT_TELEMETRY_DISABLED=1

FROM source AS app
RUN npm run build
USER node
CMD ["sh", "-c", "npm run db:setup && exec node node_modules/next/dist/bin/next start --hostname 0.0.0.0"]

FROM source AS eval
RUN apk add --no-cache git postgresql16
ENV PATH="/usr/libexec/postgresql16:${PATH}"
USER node
CMD ["npm", "test"]
