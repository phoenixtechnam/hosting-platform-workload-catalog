FROM httpd:2.4-alpine

# Enable useful modules
COPY httpd.conf /usr/local/apache2/conf/httpd.conf

RUN adduser -D -u 1000 webuser \
  && chown -R webuser:webuser /usr/local/apache2/htdocs

WORKDIR /usr/local/apache2/htdocs

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1
