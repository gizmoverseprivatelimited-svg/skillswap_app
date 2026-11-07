# Base image
FROM node:18-alpine


WORKDIR /app


COPY package*.json ./
RUN npm install --production

COPY . .


EXPOSE 3200

# App start command
CMD ["npm", "start"]
