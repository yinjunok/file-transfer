FROM node

RUN mkdir -p /file-transfer \
    && mkdir -p /file-transfer/download
COPY package.json index.js public/* /file-transfer/
RUN cd /file-transfer \
    && npm install
EXPOSE 3000
CMD ["node", "/file-transfer/index.js"]
