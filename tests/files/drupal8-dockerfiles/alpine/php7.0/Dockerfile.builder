ARG IMAGE_REPO
FROM ${IMAGE_REPO:-lagoon}/php:7.0-cli-alpine

COPY composer.json composer.lock /app/
COPY scripts /app/scripts
RUN composer install --no-dev
COPY . /app