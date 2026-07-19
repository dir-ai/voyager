# voyager — containerized CLI + MCP server. Needs network egress to the
# allowlisted APIs (npm / PyPI / OSV / GitHub / …).
#
#   docker run --rm ghcr.io/dir-ai/voyager check express
#   docker run -i --rm ghcr.io/dir-ai/voyager mcp
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --no-audit --no-fund
COPY src ./src
RUN npm run build

FROM node:22-alpine
# git + npm are present in the base image; the (opt-in) twin uses npm install.
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server.json LICENSE SECURITY.md README.md ./
ENTRYPOINT ["node", "/app/dist/cli.js"]
CMD ["help"]
