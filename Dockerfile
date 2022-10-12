ARG APP_PATH=/opt/outline

FROM node:16.17-bullseye AS base

ARG APP_PATH
WORKDIR $APP_PATH
COPY ./package.json ./yarn.lock ./

RUN yarn install --no-optional --frozen-lockfile --network-timeout 1000000 && \
  yarn cache clean

COPY . .
ARG CDN_URL
RUN yarn build

RUN rm -rf node_modules

RUN yarn install --production=true --frozen-lockfile --network-timeout 1000000 && \
  yarn cache clean

FROM node:16.17-bullseye AS production

ARG APP_PATH
WORKDIR $APP_PATH
ENV NODE_ENV production

COPY --from=base $APP_PATH/build ./build
COPY --from=base $APP_PATH/server ./server
COPY --from=base $APP_PATH/public ./public
COPY --from=base $APP_PATH/.sequelizerc ./.sequelizerc
COPY --from=base $APP_PATH/node_modules ./node_modules
COPY --from=base $APP_PATH/package.json ./package.json

RUN addgroup -gid 1024 app \
  && adduser -uid 1024 --system --disabled-password --ingroup app app \
  && chown -R app:app $APP_PATH/build

USER app

EXPOSE 3000
CMD ["yarn", "start"]
