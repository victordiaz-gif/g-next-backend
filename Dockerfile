FROM node:20

WORKDIR /usr/src/app

COPY package.json ./
COPY package-lock.json ./
RUN npm install --production
COPY . .
RUN npm run build

# Run the web service on container startup.
CMD [ "npm", "run", "start" ]