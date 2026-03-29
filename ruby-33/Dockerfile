FROM ruby:3.3-alpine

RUN apk add --no-cache \
    build-base \
    libpq-dev \
    mariadb-dev \
    tzdata \
    curl \
  && gem install bundler puma \
  && rm -rf /var/cache/apk/*

RUN adduser -D -u 1000 webuser \
  && mkdir -p /app && chown -R webuser:webuser /app

WORKDIR /app

USER webuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q --spider http://localhost:3000/health || exit 1

CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
